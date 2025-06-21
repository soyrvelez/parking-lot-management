import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { BarcodeScannerService } from '../services/scanner/barcode-scanner.service';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';
import { BusinessLogicError, HardwareError } from '../middleware/errorHandler';
import { auditLogger } from '../middleware/logging';
import {
  EntryRequest,
  CalculateRequest,
  PaymentRequest,
  ExitRequest
} from '../types/api';

const prisma = new PrismaClient();

export class ParkingController {
  private scannerService: BarcodeScannerService;
  private printerService: ThermalPrinterService;

  constructor() {
    this.scannerService = new BarcodeScannerService();
    this.printerService = new ThermalPrinterService();
  }

  async createEntry(req: Request, res: Response): Promise<void> {
    const { plateNumber, vehicleType, operatorId, notes }: EntryRequest = req.body;
    
    try {
      // Check for existing active ticket
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          plateNumber,
          status: 'ACTIVE'
        }
      });

      if (existingTicket) {
        throw new BusinessLogicError(
          i18n.t('parking.vehicle_already_inside'),
          'VEHICLE_ALREADY_INSIDE',
          409,
          { plateNumber, existingTicket: existingTicket.id }
        );
      }

      // Generate ticket number
      const ticketNumber = `T-${Date.now().toString().slice(-6)}`;
      const entryTime = new Date();
      
      // Generate barcode for the ticket
      const barcode = `${ticketNumber}-${plateNumber}`.toUpperCase();

      // Create ticket record
      const ticket = await prisma.ticket.create({
        data: {
          id: ticketNumber,
          plateNumber: plateNumber.toUpperCase(),
          entryTime,
          status: 'ACTIVE',
          barcode,
          vehicleType,
          notes
        }
      });

      // Print entry ticket
      try {
        await this.printerService.printEntryTicket({
          ticketNumber: ticket.id,
          plateNumber: ticket.plateNumber,
          entryTime: ticket.entryTime,
          totalAmount: 25.00,
          type: 'ENTRY'
        });
      } catch (printError) {
        // Log print failure but don't fail the entry
        console.error('Failed to print entry ticket:', printError);
        
        // Queue for retry handled internally by printEntryTicket
      }

      // Log entry
      auditLogger('VEHICLE_ENTRY', operatorId, {
        ticketNumber: ticket.id,
        plateNumber: ticket.plateNumber,
        vehicleType,
        entryTime: ticket.entryTime
      });

      res.status(201).json({
        success: true,
        data: {
          ticketNumber: ticket.id,
          plateNumber: ticket.plateNumber,
          entryTime: i18n.formatDateTime(ticket.entryTime),
          barcode: ticket.barcode!,
          estimatedFee: Money.fromNumber(25).formatPesos(),
          message: i18n.t('parking.entry_successful')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  async calculateFee(req: Request, res: Response): Promise<void> {
    const { ticketNumber, barcode, exitTime }: CalculateRequest = req.body;
    
    try {
      // Find ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketNumber }
      });

      if (!ticket) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'TICKET_NOT_FOUND',
          404,
          { ticketNumber }
        );
      }

      if (ticket.status !== 'ACTIVE') {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_already_processed'),
          'TICKET_ALREADY_PROCESSED',
          409,
          { ticketNumber, status: ticket.status }
        );
      }

      // Validate barcode if provided
      if (barcode && ticket.barcode !== barcode) {
        throw new BusinessLogicError(
          i18n.t('parking.barcode_mismatch'),
          'BARCODE_MISMATCH',
          400,
          { ticketNumber, expectedBarcode: ticket.barcode, providedBarcode: barcode }
        );
      }

      const currentExitTime = exitTime ? new Date(exitTime) : new Date();
      const durationMinutes = Math.floor((currentExitTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));

      // Get pricing configuration
      const pricing = await prisma.pricingConfig.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      if (!pricing) {
        throw new BusinessLogicError(
          i18n.t('system.pricing_not_configured'),
          'PRICING_NOT_CONFIGURED',
          500
        );
      }

      // Calculate fee using Money class
      const { total, breakdown } = this.calculateParkingFee(durationMinutes, pricing);

      // Format duration in Spanish
      const duration = i18n.formatDuration(durationMinutes);

      res.json({
        success: true,
        data: {
          ticketNumber: ticket.id,
          plateNumber: ticket.plateNumber,
          entryTime: i18n.formatDateTime(ticket.entryTime),
          exitTime: i18n.formatDateTime(currentExitTime),
          duration,
          pricing: {
            minimumCharge: breakdown.minimum.formatPesos(),
            incrementalCharges: breakdown.increments.map(inc => ({
              period: inc.period,
              amount: inc.amount.formatPesos()
            })),
            specialDiscount: null, // Not implemented yet
            subtotal: breakdown.subtotal.formatPesos(),
            total: total.formatPesos()
          },
          paymentRequired: total.greaterThan(Money.ZERO),
          message: total.equals(Money.ZERO) 
            ? i18n.t('parking.free_period')
            : i18n.t('parking.payment_required', { amount: total.formatPesos() })
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  async processPayment(req: Request, res: Response): Promise<void> {
    const { ticketNumber, barcode, cashReceived, operatorId }: PaymentRequest = req.body;
    
    try {
      // Find and validate ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketNumber }
      });

      if (!ticket) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'TICKET_NOT_FOUND',
          404,
          { ticketNumber }
        );
      }

      if (ticket.status !== 'ACTIVE') {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_already_processed'),
          'TICKET_ALREADY_PROCESSED',
          409,
          { ticketNumber, status: ticket.status }
        );
      }

      // Calculate current fee
      const exitTime = new Date();
      const durationMinutes = Math.floor((exitTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));
      
      const pricing = await prisma.pricingConfig.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      if (!pricing) {
        throw new BusinessLogicError(
          i18n.t('system.pricing_not_configured'),
          'PRICING_NOT_CONFIGURED',
          500
        );
      }

      const { total: totalAmount } = this.calculateParkingFee(durationMinutes, pricing);
      const cashGiven = Money.fromNumber(cashReceived);

      // Validate payment amount
      if (cashGiven.lessThan(totalAmount)) {
        throw new BusinessLogicError(
          i18n.t('parking.insufficient_payment'),
          'INSUFFICIENT_PAYMENT',
          400,
          { 
            required: totalAmount.formatPesos(),
            received: cashGiven.formatPesos(),
            shortfall: totalAmount.subtract(cashGiven).formatPesos()
          }
        );
      }

      // Calculate change
      const changeAmount = cashGiven.subtract(totalAmount);

      // Update ticket in database transaction
      const updatedTicket = await prisma.$transaction(async (tx) => {
        // Update ticket
        const updated = await tx.ticket.update({
          where: { id: ticketNumber },
          data: {
            status: 'PAID',
            exitTime,
            totalAmount: totalAmount.toNumber(),
            paidAt: new Date(),
            paymentMethod: 'CASH'
          }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            type: 'PARKING',
            amount: totalAmount.toNumber(),
            ticketId: ticketNumber,
            description: i18n.t('transaction.parking_payment'),
            operatorId
          }
        });

        return updated;
      });

      // Print payment receipt
      let receiptPrinted = false;
      try {
        await this.printerService.printPaymentReceipt({
          ticketNumber: updatedTicket.id,
          plateNumber: updatedTicket.plateNumber,
          entryTime: updatedTicket.entryTime,
          exitTime: updatedTicket.exitTime!,
          totalAmount: totalAmount.toNumber(),
          cashReceived: cashGiven.toNumber(),
          change: changeAmount.toNumber(),
          paymentMethod: 'EFECTIVO',
          durationMinutes,
          type: 'PAYMENT'
        });
        receiptPrinted = true;
      } catch (printError) {
        console.error('Failed to print payment receipt:', printError);
        // Queue for retry but don't fail the payment
      }

      // Get change denominations for cash register
      const denominations = changeAmount.greaterThan(Money.ZERO) 
        ? changeAmount.splitIntoDenominations() 
        : [];

      // Log payment
      auditLogger('PAYMENT_PROCESSED', operatorId, {
        ticketNumber: updatedTicket.id,
        plateNumber: updatedTicket.plateNumber,
        totalAmount: totalAmount.formatPesos(),
        cashReceived: cashGiven.formatPesos(),
        changeGiven: changeAmount.formatPesos()
      });

      res.json({
        success: true,
        data: {
          ticketNumber: updatedTicket.id,
          plateNumber: updatedTicket.plateNumber,
          totalAmount: totalAmount.formatPesos(),
          cashReceived: cashGiven.formatPesos(),
          changeGiven: changeAmount.formatPesos(),
          paymentTime: i18n.formatDateTime(updatedTicket.paidAt!),
          receiptPrinted,
          denominations,
          message: i18n.t('parking.payment_successful')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  async processExit(req: Request, res: Response): Promise<void> {
    const { ticketNumber, barcode, operatorId }: ExitRequest = req.body;
    
    try {
      // Find and validate ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketNumber }
      });

      if (!ticket) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'TICKET_NOT_FOUND',
          404,
          { ticketNumber }
        );
      }

      if (ticket.status !== 'PAID') {
        throw new BusinessLogicError(
          i18n.t('parking.payment_required_for_exit'),
          'PAYMENT_REQUIRED',
          402,
          { ticketNumber, currentStatus: ticket.status }
        );
      }

      // Validate barcode
      if (barcode && ticket.barcode !== barcode) {
        throw new BusinessLogicError(
          i18n.t('parking.barcode_mismatch'),
          'BARCODE_MISMATCH',
          400,
          { ticketNumber }
        );
      }

      // Calculate total duration
      const exitTime = new Date();
      const totalDuration = Math.floor((exitTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));

      // Mark ticket as completed
      await prisma.ticket.update({
        where: { id: ticketNumber },
        data: {
          exitTime,
          status: 'PAID'
        }
      });

      // Log exit
      auditLogger('VEHICLE_EXIT', operatorId, {
        ticketNumber: ticket.id,
        plateNumber: ticket.plateNumber,
        totalDuration: `${totalDuration} minutos`,
        amountPaid: Money.fromNumber(typeof ticket.totalAmount === 'number' ? ticket.totalAmount : 0).formatPesos()
      });

      res.json({
        success: true,
        data: {
          ticketNumber: ticket.id,
          plateNumber: ticket.plateNumber,
          exitTime: i18n.formatDateTime(exitTime),
          totalDuration: i18n.formatDuration(totalDuration),
          amountPaid: Money.fromNumber(typeof ticket.totalAmount === 'number' ? ticket.totalAmount : 0).formatPesos(),
          gateOpened: true,
          message: i18n.t('parking.exit_successful')
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  async processLostTicket(req: Request, res: Response): Promise<void> {
      const { plateNumber, cashReceived, operatorId }: { plateNumber: string; cashReceived: number; operatorId: string } = req.body;
      
      try {
        // Find active ticket by plate number
        const activeTicket = await prisma.ticket.findFirst({
          where: {
            plateNumber: plateNumber.toUpperCase(),
            status: 'ACTIVE'
          }
        });
  
        // Get pricing configuration for lost ticket fee
        const pricing = await prisma.pricingConfig.findFirst({
          orderBy: { createdAt: 'desc' }
        });
  
        if (!pricing) {
          throw new BusinessLogicError(
            i18n.t('system.pricing_not_configured'),
            'PRICING_NOT_CONFIGURED',
            500
          );
        }
  
        const lostTicketFee = Money.fromNumber(pricing.lostTicketFee.toNumber());
        const cashGiven = Money.fromNumber(cashReceived);
  
        // Validate payment amount
        if (cashGiven.lessThan(lostTicketFee)) {
          throw new BusinessLogicError(
            i18n.t('parking.insufficient_payment'),
            'INSUFFICIENT_PAYMENT',
            400,
            { 
              required: lostTicketFee.formatPesos(),
              received: cashGiven.formatPesos(),
              shortfall: lostTicketFee.subtract(cashGiven).formatPesos()
            }
          );
        }
  
        const changeAmount = cashGiven.subtract(lostTicketFee);
        const exitTime = new Date();
  
        if (activeTicket) {
          // Found existing ticket - mark as lost and paid
          await prisma.$transaction(async (tx) => {
            // Update existing ticket
            await tx.ticket.update({
              where: { id: activeTicket.id },
              data: {
                status: 'LOST',
                exitTime,
                totalAmount: lostTicketFee.toNumber(),
                paidAt: new Date(),
                paymentMethod: 'CASH',
                failureReason: 'Lost ticket penalty applied'
              }
            });
  
            // Create transaction record
            await tx.transaction.create({
              data: {
                type: 'LOST_TICKET',
                amount: lostTicketFee.toNumber(),
                ticketId: activeTicket.id,
                description: i18n.t('transaction.lost_ticket_fee'),
                operatorId
              }
            });
          });
  
          // Log lost ticket processing
          auditLogger('LOST_TICKET_PROCESSED', operatorId, {
            ticketNumber: activeTicket.id,
            plateNumber: activeTicket.plateNumber,
            lostTicketFee: lostTicketFee.formatPesos(),
            cashReceived: cashGiven.formatPesos(),
            changeGiven: changeAmount.formatPesos()
          });
  
          res.json({
            success: true,
            data: {
              ticketNumber: activeTicket.id,
              plateNumber: activeTicket.plateNumber,
              entryTime: i18n.formatDateTime(activeTicket.entryTime),
              exitTime: i18n.formatDateTime(exitTime),
              lostTicketFee: lostTicketFee.formatPesos(),
              cashReceived: cashGiven.formatPesos(),
              changeGiven: changeAmount.formatPesos(),
              paymentTime: i18n.formatDateTime(new Date()),
              message: i18n.t('parking.lost_ticket_processed')
            },
            timestamp: new Date().toISOString()
          });
  
        } else {
          // No active ticket found - create lost ticket record for audit
          const lostTicketId = `L-${Date.now().toString().slice(-6)}`;
          
          await prisma.$transaction(async (tx) => {
            // Create lost ticket record
            const lostTicket = await tx.ticket.create({
              data: {
                id: lostTicketId,
                plateNumber: plateNumber.toUpperCase(),
                entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // Estimate 4 hours ago
                exitTime,
                totalAmount: lostTicketFee.toNumber(),
                status: 'LOST',
                barcode: `LOST-${plateNumber.toUpperCase()}`,
                paidAt: new Date(),
                paymentMethod: 'CASH',
                failureReason: 'No original ticket found - lost ticket fee applied',
                operatorId
              }
            });
  
            // Create transaction record
            await tx.transaction.create({
              data: {
                type: 'LOST_TICKET',
                amount: lostTicketFee.toNumber(),
                ticketId: lostTicket.id,
                description: i18n.t('transaction.lost_ticket_fee_no_original'),
                operatorId
              }
            });
          });
  
          // Log lost ticket processing without original
          auditLogger('LOST_TICKET_NO_ORIGINAL', operatorId, {
            ticketNumber: lostTicketId,
            plateNumber: plateNumber.toUpperCase(),
            lostTicketFee: lostTicketFee.formatPesos(),
            cashReceived: cashGiven.formatPesos(),
            changeGiven: changeAmount.formatPesos()
          });
  
          res.json({
            success: true,
            data: {
              ticketNumber: lostTicketId,
              plateNumber: plateNumber.toUpperCase(),
              lostTicketFee: lostTicketFee.formatPesos(),
              cashReceived: cashGiven.formatPesos(),
              changeGiven: changeAmount.formatPesos(),
              paymentTime: i18n.formatDateTime(new Date()),
              message: i18n.t('parking.lost_ticket_no_original_processed')
            },
            timestamp: new Date().toISOString()
          });
        }
  
        // Try to print lost ticket receipt
        try {
          await this.printerService.printLostTicketReceipt({
            ticketNumber: 'LOST-' + Date.now().toString().slice(-6),
            plateNumber: plateNumber.toUpperCase(),
            entryTime: new Date(),
            lostTicketFee: lostTicketFee.toNumber(),
            totalAmount: lostTicketFee.toNumber(),
            cashReceived: cashGiven.toNumber(),
            change: changeAmount.toNumber(),
            type: 'LOST_TICKET'
          });
        } catch (printError) {
          console.error('Failed to print lost ticket receipt:', printError);
          // Don't fail the transaction for print errors
        }
  
      } catch (error) {
        throw error;
      }
    }


  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      // Get current parking lot status
      const activeTickets = await prisma.ticket.count({
        where: { status: 'ACTIVE' }
      });

      const todayRevenue = await prisma.transaction.aggregate({
        where: {
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          },
          type: 'PARKING'
        },
        _sum: { amount: true }
      });

      res.json({
        success: true,
        data: {
          activeVehicles: activeTickets,
          todayRevenue: Money.fromNumber(typeof todayRevenue._sum.amount === 'number' ? todayRevenue._sum.amount : 0).formatPesos(),
          hardware: {
            scanner: this.scannerService.getStatus(),
            printer: this.printerService.getStatus()
          },
          timestamp: i18n.formatDateTime(new Date())
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }
  
    async getTicketStatus(req: Request, res: Response): Promise<void> {
      const { ticketId } = req.params;
      
      try {
        // Find ticket by ID
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            transactions: {
              orderBy: { timestamp: 'desc' }
            }
          }
        });
  
        if (!ticket) {
          throw new BusinessLogicError(
            i18n.t('parking.ticket_not_found'),
            'TICKET_NOT_FOUND',
            404,
            { ticketId }
          );
        }
  
        // Calculate current duration and fees if active
        let currentDuration = 0;
        let estimatedFee = Money.ZERO;
        let paymentRequired = false;
  
        if (ticket.status === 'ACTIVE') {
          const currentTime = new Date();
          currentDuration = Math.floor((currentTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));
          
          // Get pricing to calculate current fee
          const pricing = await prisma.pricingConfig.findFirst({
            orderBy: { createdAt: 'desc' }
          });
  
          if (pricing) {
            const { total } = this.calculateParkingFee(currentDuration, pricing);
            estimatedFee = total;
            paymentRequired = total.greaterThan(Money.ZERO);
          }
        }
  
        res.json({
          success: true,
          data: {
            ticketNumber: ticket.id,
            plateNumber: ticket.plateNumber,
            status: ticket.status,
            entryTime: i18n.formatDateTime(ticket.entryTime),
            exitTime: ticket.exitTime ? i18n.formatDateTime(ticket.exitTime) : null,
            currentDuration: ticket.status === 'ACTIVE' ? i18n.formatDuration(currentDuration) : null,
            estimatedFee: ticket.status === 'ACTIVE' ? estimatedFee.formatPesos() : null,
            totalAmount: ticket.totalAmount ? Money.fromNumber(ticket.totalAmount.toNumber()).formatPesos() : null,
            paymentMethod: ticket.paymentMethod || null,
            paidAt: ticket.paidAt ? i18n.formatDateTime(ticket.paidAt) : null,
            paymentRequired: ticket.status === 'ACTIVE' ? paymentRequired : false,
            vehicleType: ticket.vehicleType || 'car',
            barcode: ticket.barcode,
            transactions: ticket.transactions.map(tx => ({
              id: tx.id,
              type: tx.type,
              amount: Money.fromNumber(tx.amount.toNumber()).formatPesos(),
              timestamp: i18n.formatDateTime(tx.timestamp),
              description: tx.description
            }))
          },
          timestamp: new Date().toISOString()
        });
  
      } catch (error) {
        throw error;
      }
    }
  
    async calculateFeeById(req: Request, res: Response): Promise<void> {
      const { ticketId } = req.params;
      const { exitTime } = req.query;
      
      try {
        // Find ticket by ID
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId }
        });
  
        if (!ticket) {
          throw new BusinessLogicError(
            i18n.t('parking.ticket_not_found'),
            'TICKET_NOT_FOUND',
            404,
            { ticketId }
          );
        }
  
        if (ticket.status !== 'ACTIVE') {
          throw new BusinessLogicError(
            i18n.t('parking.ticket_already_processed'),
            'TICKET_ALREADY_PROCESSED',
            409,
            { ticketId, status: ticket.status }
          );
        }
  
        const currentExitTime = exitTime ? new Date(exitTime as string) : new Date();
        const durationMinutes = Math.floor((currentExitTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));
  
        // Get pricing configuration
        const pricing = await prisma.pricingConfig.findFirst({
          orderBy: { createdAt: 'desc' }
        });
  
        if (!pricing) {
          throw new BusinessLogicError(
            i18n.t('system.pricing_not_configured'),
            'PRICING_NOT_CONFIGURED',
            500
          );
        }
  
        // Calculate fee using Money class
        const { total, breakdown } = this.calculateParkingFee(durationMinutes, pricing);
  
        // Format duration in Spanish
        const duration = i18n.formatDuration(durationMinutes);
  
        res.json({
          success: true,
          data: {
            ticketNumber: ticket.id,
            plateNumber: ticket.plateNumber,
            entryTime: i18n.formatDateTime(ticket.entryTime),
            exitTime: i18n.formatDateTime(currentExitTime),
            duration,
            pricing: {
              minimumCharge: breakdown.minimum.formatPesos(),
              incrementalCharges: breakdown.increments.map(inc => ({
                period: inc.period,
                amount: inc.amount.formatPesos()
              })),
              specialDiscount: null, // Not implemented yet
              subtotal: breakdown.subtotal.formatPesos(),
              total: total.formatPesos()
            },
            paymentRequired: total.greaterThan(Money.ZERO),
            message: total.equals(Money.ZERO) 
              ? i18n.t('parking.free_period')
              : i18n.t('parking.payment_required', { amount: total.formatPesos() })
          },
          timestamp: new Date().toISOString()
        });
  
      } catch (error) {
        throw error;
      }
    }
  private calculateParkingFee(durationMinutes: number, pricing: any) {
    const minimumMinutes = pricing.minimumHours * 60;
    const minimumRate = Money.fromNumber(pricing.minimumRate);
    
    if (durationMinutes <= minimumMinutes) {
      return {
        total: minimumRate,
        breakdown: {
          minimum: minimumRate,
          increments: [],
          subtotal: minimumRate,
          specialDiscount: null
        }
      };
    }

    // Calculate incremental charges
    const excessMinutes = durationMinutes - minimumMinutes;
    const incrementPeriods = Math.ceil(excessMinutes / pricing.incrementMinutes);
    const incrementRate = Money.fromNumber(pricing.incrementRate);
    const incrementalTotal = incrementRate.multiply(incrementPeriods);
    
    const total = minimumRate.add(incrementalTotal);

    return {
      total,
      breakdown: {
        minimum: minimumRate,
        increments: [{
          period: `${incrementPeriods} × ${pricing.incrementMinutes} min`,
          amount: incrementalTotal
        }],
        subtotal: total,
        specialDiscount: null
      }
    };
  }

  async lookupTicket(req: Request, res: Response): Promise<void> {
    const { barcode } = req.params;
    
    try {
      // Find ticket by barcode or ID
      const ticket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { barcode: barcode },
            { id: barcode }
          ]
        },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      if (!ticket) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'TICKET_NOT_FOUND',
          404,
          { barcode }
        );
      }

      // Calculate current duration and fees if active
      let currentDuration = 0;
      let estimatedFee = Money.ZERO;
      let paymentRequired = false;

      if (ticket.status === 'ACTIVE') {
        const currentTime = new Date();
        currentDuration = Math.floor((currentTime.getTime() - ticket.entryTime.getTime()) / (1000 * 60));
        
        // Get pricing to calculate current fee
        const pricing = await prisma.pricingConfig.findFirst({
          orderBy: { createdAt: 'desc' }
        });

        if (pricing) {
          const { total } = this.calculateParkingFee(currentDuration, pricing);
          estimatedFee = total;
          paymentRequired = total.greaterThan(Money.ZERO);
        }
      }

      res.json({
        success: true,
        data: {
          id: ticket.id,
          ticketNumber: ticket.id,
          plateNumber: ticket.plateNumber,
          status: ticket.status,
          entryTime: ticket.entryTime.toISOString(),
          exitTime: ticket.exitTime?.toISOString() || null,
          currentDuration: ticket.status === 'ACTIVE' ? i18n.formatDuration(currentDuration) : null,
          estimatedFee: ticket.status === 'ACTIVE' ? estimatedFee.formatPesos() : null,
          totalAmount: ticket.totalAmount ? Money.fromNumber(ticket.totalAmount.toNumber()).formatPesos() : null,
          paymentMethod: ticket.paymentMethod || null,
          paidAt: ticket.paidAt?.toISOString() || null,
          paymentRequired: ticket.status === 'ACTIVE' ? paymentRequired : false,
          vehicleType: ticket.vehicleType || 'car',
          barcode: ticket.barcode,
          transactions: ticket.transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: Money.fromNumber(tx.amount.toNumber()).formatPesos(),
            timestamp: tx.timestamp.toISOString(),
            description: tx.description
          }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }
}