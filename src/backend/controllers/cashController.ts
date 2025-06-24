/**
 * Cash Register Management Controller
 * Handles cash drawer operations, balance validation, and transaction audit
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

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
  amount: z.string().refine(val => {
    try {
      const parsed = parseFloat(val);
      return !isNaN(parsed) && parsed > 0 && parsed <= 999999.99; // Allow up to $999,999.99
    } catch {
      return false;
    }
  }, {
    message: 'Monto inválido - debe ser un número positivo menor a $999,999.99'
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
   * Calculate total available balance using consistent logic across all endpoints
   */
  private async calculateTotalAvailableBalance(shiftStart: Date): Promise<{
    openingBalance: Decimal;
    salesRevenue: Decimal;
    manualAdjustments: Decimal;
    totalBalance: Decimal;
  }> {
    // Get all open registers
    const allOpenRegisters = await prisma.cashRegister.findMany({
      where: { status: 'OPEN' }
    });

    // Calculate total opening balance
    const openingBalance = allOpenRegisters.reduce((total, register) => {
      return total.plus(new Decimal(register.openingBalance.toString()));
    }, new Decimal(0));

    // Get sales revenue since shift start
    const salesRevenue = await prisma.transaction.aggregate({
      where: {
        timestamp: { gte: shiftStart },
        type: { in: ['PARKING', 'PENSION', 'PARTNER', 'LOST_TICKET'] }
      },
      _sum: { amount: true }
    });

    const totalSalesDecimal = salesRevenue._sum.amount 
      ? new Decimal(salesRevenue._sum.amount.toString())
      : new Decimal(0);

    // Get manual adjustments from cash flows
    const allCashFlows = await prisma.cashFlow.findMany({
      where: { 
        cashRegisterId: { in: allOpenRegisters.map(r => r.id) }
      }
    });

    const manualAdjustments = allCashFlows.reduce((total, cf) => {
      try {
        const amount = new Decimal(cf.amount.toString());
        return cf.type === 'DEPOSIT' ? total.plus(amount) : total.minus(amount);
      } catch (error) {
        return total;
      }
    }, new Decimal(0));

    const totalBalance = openingBalance.plus(totalSalesDecimal).plus(manualAdjustments);

    return {
      openingBalance,
      salesRevenue: totalSalesDecimal,
      manualAdjustments,
      totalBalance
    };
  }


  /**
   * Static helper function for transaction descriptions (to avoid binding issues)
   */
  private static formatTransactionDescription(transaction: any): string {
    switch (transaction.type) {
      case 'PARKING':
        const plateParking = transaction.ticket?.plateNumber || 'Sin placa';
        return `Pago estacionamiento - ${plateParking}`;
      case 'PENSION':
        const pensionName = transaction.pension?.name || 'Cliente pension';
        return `Pago mensualidad - ${pensionName}`;
      case 'PARTNER':
        const partnerBusiness = transaction.partnerTicket?.partnerBusiness?.name || 'Socio comercial';
        const platePartner = transaction.partnerTicket?.plateNumber || 'Sin placa';
        return `Pago socio (${partnerBusiness}) - ${platePartner}`;
      case 'LOST_TICKET':
        return 'Cuota por boleto perdido';
      default:
        return transaction.description || 'Transacción';
    }
  }
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
      const adjustmentAmount = new Decimal(amount);

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

      // Use shared calculation method to ensure consistency
      const balanceData = await this.calculateTotalAvailableBalance(cashRegister.shiftStart);
      const totalAvailableBalanceDecimal = balanceData.totalBalance;
      
      // Convert withdrawal amount to Decimal for comparison
      const withdrawalAmountDecimal = new Decimal(amount);
      
      
      // Validate withdrawal doesn't exceed total available balance
      if (type === 'WITHDRAWAL' && withdrawalAmountDecimal.greaterThan(totalAvailableBalanceDecimal)) {
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

      // Calculate new balance using Decimal throughout to avoid Money class limitations
      const currentManualBalanceDecimal = new Decimal(cashRegister.currentBalance.toString());
      
      let newBalanceDecimal: Decimal;
      if (type === 'DEPOSIT') {
        newBalanceDecimal = currentManualBalanceDecimal.plus(adjustmentAmount);
      } else {
        // For withdrawals, use Decimal to allow any amount
        newBalanceDecimal = currentManualBalanceDecimal.minus(adjustmentAmount);
      }

      // Create cash flow record with Decimal amount
      const cashFlow = await prisma.cashFlow.create({
        data: {
          type: type as 'DEPOSIT' | 'WITHDRAWAL',
          amount: adjustmentAmount.toFixed(2), // Convert Decimal to string
          reason: description,
          performedBy: operatorId,
          cashRegisterId: cashRegister.id,
          timestamp: new Date()
        }
      });

      // Update register balance with Decimal value
      await prisma.cashRegister.update({
        where: { id: cashRegister.id },
        data: {
          currentBalance: newBalanceDecimal.toFixed(2), // Convert Decimal to string
          lastUpdated: new Date()
        }
      });

      // Format amounts for audit logging and response
      const formatDecimalAsPesos = (decimal: Decimal): string => {
        return `$${decimal.toFixed(2)} pesos`;
      };

      // Log audit event
      auditLogger('CASH_ADJUSTMENT', operatorId, {
        registerId: cashRegister.id,
        type,
        amount: formatDecimalAsPesos(adjustmentAmount),
        description,
        previousBalance: formatDecimalAsPesos(currentManualBalanceDecimal),
        newBalance: formatDecimalAsPesos(newBalanceDecimal),
        totalAvailableBalance: `$${balanceData.totalBalance.toFixed(2)} pesos`,
        operator: req.user?.name
      });

      res.json({
        success: true,
        data: {
          cashFlowId: cashFlow.id,
          type,
          amount: formatDecimalAsPesos(adjustmentAmount),
          description,
          previousBalance: formatDecimalAsPesos(currentManualBalanceDecimal),
          newBalance: formatDecimalAsPesos(newBalanceDecimal),
          timestamp: i18n.formatDateTime(cashFlow.timestamp),
          message: i18n.t(`cash.${type.toLowerCase()}_successful`)
        }
      });
    } catch (error) {
      console.error('Error making cash adjustment:', error);
      
      // Check if it's a Zod validation error
      if (error && typeof error === 'object' && 'issues' in error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: (error as any).issues?.[0]?.message || 'Error de validación',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
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
            message: 'Operator ID required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // For admin users, aggregate all open registers
      if (operatorId.includes('admin')) {
        const allOpenRegisters = await prisma.cashRegister.findMany({
          where: { status: 'OPEN' },
          include: {
            cashFlows: {
              orderBy: { timestamp: 'desc' },
              take: 10
            }
          },
          orderBy: { shiftStart: 'desc' }
        });

        if (allOpenRegisters.length === 0) {
          res.json({
            success: true,
            data: {
              status: 'CLOSED',
              message: 'No hay registros abiertos'
            }
          });
          return;
        }

        // Get the oldest shift start to calculate total balance consistently
        const oldestShiftStart = allOpenRegisters.reduce((oldest, register) => 
          register.shiftStart < oldest ? register.shiftStart : oldest, 
          allOpenRegisters[0].shiftStart
        );

        // Use shared calculation method to ensure consistency with withdrawal validation
        const balanceData = await this.calculateTotalAvailableBalance(oldestShiftStart);
          

        // Get recent sales transactions and cash flows
        const salesTransactions = await prisma.transaction.findMany({
          where: {
            timestamp: { gte: oldestShiftStart },
            type: { in: ['PARKING', 'PENSION', 'PARTNER', 'LOST_TICKET'] }
          },
          include: {
            ticket: { select: { plateNumber: true } },
            pension: { select: { name: true, plateNumber: true } },
            partnerTicket: { 
              select: { 
                plateNumber: true, 
                customerName: true,
                partnerBusiness: { select: { name: true } }
              } 
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        });

        // Combine manual cash flows and sales transactions
        const allCashFlows = allOpenRegisters
          .flatMap(register => register.cashFlows.map(cf => ({ ...cf, operatorId: register.operatorId })))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5);

        const allActivities = [
          ...allCashFlows.map((cf: any) => {
            try {
              const amount = new Decimal(cf.amount.toString()).toFixed(2);
              return {
                id: cf.id,
                type: cf.type,
                amount: `$${amount} pesos`,
                reason: cf.reason,
                timestamp: cf.timestamp,
                operator: cf.operatorId,
                isManual: true
              };
            } catch (error) {
              return {
                id: cf.id,
                type: cf.type,
                amount: `$${cf.amount} (fallback)`,
                reason: cf.reason,
                timestamp: cf.timestamp,
                operator: cf.operatorId,
                isManual: true
              };
            }
          }),
          ...salesTransactions.slice(0, 5).map((st: any) => {
            try {
              const amount = new Decimal(st.amount.toString()).toFixed(2);
              return {
                id: st.id,
                type: st.type,
                amount: `$${amount} pesos`,
                reason: CashController.formatTransactionDescription(st),
                timestamp: st.timestamp,
                operator: st.operatorId || 'Sistema',
                isManual: false
              };
            } catch (error) {
              return {
                id: st.id,
                type: st.type,
                amount: `$${st.amount} (fallback)`,
                reason: st.description || 'Transacción',
                timestamp: st.timestamp,
                operator: st.operatorId || 'Sistema',
                isManual: false
              };
            }
          })
        ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

        const recentCashFlows = allActivities.map((activity: any) => ({
          id: activity.id,
          type: activity.type,
          amount: activity.amount,
          reason: activity.reason,
          timestamp: activity.timestamp,
          operator: activity.operator,
          isManual: activity.isManual
        }));

        res.json({
          success: true,
          data: {
            registerId: 'AGGREGATED',
            status: 'OPEN',
            openingBalance: `$${balanceData.openingBalance.toFixed(2)} pesos`,
            currentBalance: `$${balanceData.totalBalance.toFixed(2)} pesos`,
            salesRevenue: `$${balanceData.salesRevenue.toFixed(2)} pesos`,
            manualAdjustments: `$${balanceData.manualAdjustments.toFixed(2)} pesos`,
            shiftStart: oldestShiftStart.toISOString(),
            lastUpdated: new Date().toISOString(),
            recentCashFlows,
            openRegisters: allOpenRegisters.length,
            operators: allOpenRegisters.map(r => r.operatorId),
            message: `${allOpenRegisters.length} caja(s) registradora(s) abierta(s)`
          }
        });
        return;
      }

      // Normal operator-specific lookup (simplified for non-admin users)
      res.json({
        success: true,
        data: {
          status: 'CLOSED',
          message: 'Acceso restringido para operadores normales'
        }
      });
    } catch (error) {
      console.error('Error getting cash register status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: 'Cash register error: ' + (error instanceof Error ? error.message : 'Unknown error'),
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
      let total = new Decimal(0);
      const breakdown: { [key: string]: { count: number; amount: string } } = {};

      for (const [denom, count] of Object.entries(denominations)) {
        const denomValue = new Decimal(denom.replace('$', ''));
        const subtotal = denomValue.mul(count);
        total = total.plus(subtotal);
        
        breakdown[denom] = {
          count,
          amount: `$${subtotal.toFixed(2)} pesos`
        };
      }

      res.json({
        success: true,
        data: {
          totalCounted: `$${total.toFixed(2)} pesos`,
          breakdown,
          timestamp: new Date().toISOString(),
          message: 'Conteo completado'
        }
      });
    } catch (error) {
      console.error('Error counting cash:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: 'Error al contar efectivo',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get cash register history (simplified for now)
   */
  async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          registers: [],
          total: 0,
          message: 'Historial simplificado por mantenimiento'
        }
      });
    } catch (error) {
      console.error('Error getting cash register history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CASH_REGISTER_ERROR',
          message: 'Error al obtener historial',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export default new CashController(); 
