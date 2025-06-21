/**
 * Cash Register Management Controller
 * Handles cash drawer operations, balance validation, and transaction audit
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';
import { auditLogger } from '../middleware/logging';
import { AuthenticatedRequest } from '../middleware/auth';

// Validation schemas
const openRegisterSchema = z.object({
  openingBalance: z.string().refine(val => Money.isValid(val), {
    message: 'Monto inicial inválido'
  }),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const closeRegisterSchema = z.object({
  closingBalance: z.string().refine(val => Money.isValid(val), {
    message: 'Monto final inválido'
  }),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const adjustmentSchema = z.object({
  amount: z.string().refine(val => Money.isValid(val), {
    message: 'Monto inválido'
  }),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL'], {
    errorMap: () => ({ message: 'Tipo debe ser DEPOSIT o WITHDRAWAL' })
  }),
  description: z.string().min(1, 'Descripción requerida'),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const countSchema = z.object({
  denominations: z.record(z.string(), z.number().min(0, 'Cantidad debe ser positiva')),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

export class CashController {
  /**
   * Open cash register for shift
   */
  async openRegister(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { openingBalance, operatorId } = openRegisterSchema.parse(req.body);
      const balance = new Money(openingBalance);

      // Check if register is already open
      const existingRegister = await prisma.cashRegister.findFirst({
        where: {
          status: 'OPEN',
          operatorId
        }
      });

      if (existingRegister) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REGISTER_ALREADY_OPEN',
            message: i18n.t('cash.register_already_open'),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Create new register session
      const cashRegister = await prisma.cashRegister.create({
        data: {
          operatorId,
          openingBalance: balance.toDatabase(),
          currentBalance: balance.toDatabase(),
          status: 'OPEN',
          shiftStart: new Date()
        }
      });

      // Log audit event
      auditLogger('CASH_REGISTER_OPENED', operatorId, {
        registerId: cashRegister.id,
        openingBalance: balance.formatPesos(),
        operator: req.user?.name
      });

      res.json({
        success: true,
        data: {
          registerId: cashRegister.id,
          openingBalance: balance.formatPesos(),
          currentBalance: balance.formatPesos(),
          status: 'OPEN',
          shiftStart: i18n.formatDateTime(cashRegister.shiftStart),
          message: i18n.t('cash.register_opened_successfully')
        }
      });
    } catch (error) {
      console.error('Error opening cash register:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Close cash register for shift
   */
  async closeRegister(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { closingBalance, operatorId } = closeRegisterSchema.parse(req.body);
      const countedBalance = new Money(closingBalance);

      // Get current open register
      const cashRegister = await prisma.cashRegister.findFirst({
        where: {
          status: 'OPEN',
          operatorId
        },
        include: {
          cashFlows: true
        }
      });

      if (!cashRegister) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_OPEN_REGISTER',
            message: i18n.t('cash.no_open_register'),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Calculate expected balance from cash flows
      const openingBalance = new Money(cashRegister.openingBalance);
      const cashFlowAmounts = cashRegister.cashFlows.map((cf: any) => {
        const amount = new Money(cf.amount);
        return cf.type === 'WITHDRAWAL' ? amount.multiply(-1) : amount;
      });
      const expectedBalance = cashFlowAmounts.reduce(
        (total: Money, amount: Money) => total.add(amount),
        openingBalance
      );

      // Calculate discrepancy
      const discrepancy = countedBalance.toDecimal().minus(expectedBalance.toDecimal());
      const discrepancyAmount = new Money(discrepancy, true); // Allow negative

      // Close register
      const updatedRegister = await prisma.cashRegister.update({
        where: { id: cashRegister.id },
        data: {
          expectedBalance: expectedBalance.toDatabase(),
          discrepancy: discrepancyAmount.toDatabase(),
          status: 'CLOSED',
          shiftEnd: new Date()
        }
      });

      // Log audit event
      auditLogger('CASH_REGISTER_CLOSED', operatorId, {
        registerId: cashRegister.id,
        openingBalance: openingBalance.formatPesos(),
        expectedBalance: expectedBalance.formatPesos(),
        countedBalance: countedBalance.formatPesos(),
        discrepancy: discrepancyAmount.formatPesos(),
        operator: req.user?.name,
        hasDiscrepancy: !discrepancyAmount.isZero()
      });

      res.json({
        success: true,
        data: {
          registerId: updatedRegister.id,
          summary: {
            openingBalance: openingBalance.formatPesos(),
            totalCashFlows: cashFlowAmounts.length,
            expectedBalance: expectedBalance.formatPesos(),
            countedBalance: countedBalance.formatPesos(),
            discrepancy: discrepancyAmount.formatPesos(),
            hasDiscrepancy: !discrepancyAmount.isZero()
          },
          status: 'CLOSED',
          shiftEnd: i18n.formatDateTime(updatedRegister.shiftEnd!),
          message: discrepancyAmount.isZero() 
            ? i18n.t('cash.register_balanced')
            : i18n.t('cash.register_discrepancy_detected')
        }
      });
    } catch (error) {
      console.error('Error closing cash register:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Make cash adjustment (deposit/withdrawal)
   */
  async makeAdjustment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { amount, type, description, operatorId } = adjustmentSchema.parse(req.body);
      const adjustmentAmount = new Money(amount);

      // Get current open register
      const cashRegister = await prisma.cashRegister.findFirst({
        where: {
          status: 'OPEN',
          operatorId
        }
      });

      if (!cashRegister) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_OPEN_REGISTER',
            message: i18n.t('cash.no_open_register'),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const currentBalance = new Money(cashRegister.currentBalance);
      
      // Validate withdrawal doesn't exceed balance
      if (type === 'WITHDRAWAL' && adjustmentAmount.greaterThan(currentBalance)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: i18n.t('errors.insufficient_funds'),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Calculate new balance
      const newBalance = type === 'DEPOSIT' 
        ? currentBalance.add(adjustmentAmount)
        : currentBalance.subtract(adjustmentAmount);

      // Create cash flow record
      const cashFlow = await prisma.cashFlow.create({
        data: {
          type: type as 'DEPOSIT' | 'WITHDRAWAL',
          amount: adjustmentAmount.toDatabase(),
          reason: description,
          performedBy: operatorId,
          cashRegisterId: cashRegister.id,
          timestamp: new Date()
        }
      });

      // Update register balance
      await prisma.cashRegister.update({
        where: { id: cashRegister.id },
        data: {
          currentBalance: newBalance.toDatabase(),
          lastUpdated: new Date()
        }
      });

      // Log audit event
      auditLogger('CASH_ADJUSTMENT', operatorId, {
        registerId: cashRegister.id,
        type,
        amount: adjustmentAmount.formatPesos(),
        description,
        previousBalance: currentBalance.formatPesos(),
        newBalance: newBalance.formatPesos(),
        operator: req.user?.name
      });

      res.json({
        success: true,
        data: {
          cashFlowId: cashFlow.id,
          type,
          amount: adjustmentAmount.formatPesos(),
          description,
          previousBalance: currentBalance.formatPesos(),
          newBalance: newBalance.formatPesos(),
          timestamp: i18n.formatDateTime(cashFlow.timestamp),
          message: i18n.t(`cash.${type.toLowerCase()}_successful`)
        }
      });
    } catch (error) {
      console.error('Error making cash adjustment:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get current register status
   */
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const operatorId = req.query.operatorId as string;
      
      if (!operatorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'OPERATOR_ID_REQUIRED',
            message: i18n.t('validation.operator_id_required'),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const cashRegister = await prisma.cashRegister.findFirst({
        where: {
          status: 'OPEN',
          operatorId
        },
        include: {
          cashFlows: {
            orderBy: { timestamp: 'desc' },
            take: 10
          }
        }
      });

      if (!cashRegister) {
        res.json({
          success: true,
          data: {
            status: 'CLOSED',
            message: i18n.t('cash.no_open_register')
          }
        });
        return;
      }

      const openingBalance = new Money(cashRegister.openingBalance);
      const currentBalance = new Money(cashRegister.currentBalance);
      const recentCashFlows = cashRegister.cashFlows.map((cf: any) => ({
        id: cf.id,
        type: cf.type,
        amount: new Money(cf.amount).formatPesos(),
        reason: cf.reason,
        timestamp: i18n.formatDateTime(cf.timestamp)
      }));

      res.json({
        success: true,
        data: {
          registerId: cashRegister.id,
          status: 'OPEN',
          openingBalance: openingBalance.formatPesos(),
          currentBalance: currentBalance.formatPesos(),
          shiftStart: i18n.formatDateTime(cashRegister.shiftStart),
          lastUpdated: i18n.formatDateTime(cashRegister.lastUpdated),
          recentCashFlows,
          message: i18n.t('cash.register_status_active')
        }
      });
    } catch (error) {
      console.error('Error getting cash register status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Count cash denominations
   */
  async countCash(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { denominations, operatorId } = countSchema.parse(req.body);

      // Calculate total from denominations
      let total = Money.zero();
      const breakdown: { [key: string]: { count: number; amount: string } } = {};

      for (const [denom, count] of Object.entries(denominations)) {
        const denomValue = new Money(denom.replace('$', ''));
        const subtotal = denomValue.multiply(count);
        total = total.add(subtotal);
        
        breakdown[denom] = {
          count,
          amount: subtotal.formatPesos()
        };
      }

      // Get current register for comparison
      const cashRegister = await prisma.cashRegister.findFirst({
        where: {
          status: 'OPEN',
          operatorId
        }
      });

      let comparison = null;
      if (cashRegister) {
        const expectedBalance = new Money(cashRegister.currentBalance);
        const discrepancy = total.toDecimal().minus(expectedBalance.toDecimal());
        const discrepancyAmount = new Money(discrepancy, true);

        comparison = {
          expectedBalance: expectedBalance.formatPesos(),
          countedBalance: total.formatPesos(),
          discrepancy: discrepancyAmount.formatPesos(),
          isBalanced: discrepancyAmount.isZero()
        };
      }

      // Log audit event
      auditLogger('CASH_COUNT', operatorId, {
        registerId: cashRegister?.id,
        totalCounted: total.formatPesos(),
        denominations: breakdown,
        operator: req.user?.name,
        hasDiscrepancy: comparison ? !comparison.isBalanced : false
      });

      res.json({
        success: true,
        data: {
          totalCounted: total.formatPesos(),
          breakdown,
          comparison,
          timestamp: i18n.formatDateTime(new Date()),
          message: i18n.t('cash.count_completed')
        }
      });
    } catch (error) {
      console.error('Error counting cash:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get cash register history
   */
  async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { operatorId, startDate, endDate, limit = 50 } = req.query;

      const where: any = {};
      if (operatorId) where.operatorId = operatorId;
      if (startDate || endDate) {
        where.shiftStart = {};
        if (startDate) where.shiftStart.gte = new Date(startDate as string);
        if (endDate) where.shiftStart.lte = new Date(endDate as string);
      }

      const registers = await prisma.cashRegister.findMany({
        where,
        include: {
          cashFlows: {
            orderBy: { timestamp: 'desc' }
          }
        },
        orderBy: { shiftStart: 'desc' },
        take: Number(limit)
      });

      const history = registers.map((register: any) => ({
        id: register.id,
        operatorId: register.operatorId,
        status: register.status,
        openingBalance: new Money(register.openingBalance).formatPesos(),
        currentBalance: new Money(register.currentBalance).formatPesos(),
        expectedBalance: register.expectedBalance ? new Money(register.expectedBalance).formatPesos() : null,
        discrepancy: register.discrepancy ? new Money(register.discrepancy).formatPesos() : null,
        shiftStart: i18n.formatDateTime(register.shiftStart),
        shiftEnd: register.shiftEnd ? i18n.formatDateTime(register.shiftEnd) : null,
        cashFlowCount: register.cashFlows.length,
        cashFlows: register.cashFlows.map((cf: any) => ({
          id: cf.id,
          type: cf.type,
          amount: new Money(cf.amount).formatPesos(),
          reason: cf.reason,
          timestamp: i18n.formatDateTime(cf.timestamp)
        }))
      }));

      res.json({
        success: true,
        data: {
          registers: history,
          total: history.length,
          message: i18n.t('cash.history_retrieved')
        }
      });
    } catch (error) {
      console.error('Error getting cash register history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: i18n.t('errors.cash_register_error'),
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export default new CashController();