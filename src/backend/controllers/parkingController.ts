import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { BarcodeScannerService } from '../services/scanner/barcode-scanner.service';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';
import { Money } from '../../shared/utils/money';
import { generateBarcode, withAtomicRetry } from '../../shared/utils/id-generation';
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
    this.printerService = new ThermalPrinterService({
      interfaceType: process.env.PRINTER_INTERFACE_TYPE as 'usb' | 'tcp' || 'usb',
      devicePath: process.env.PRINTER_DEVICE_PATH || '/dev/usb/lp0',
      host: process.env.PRINTER_HOST || '192.168.1.100',
      port: parseInt(process.env.PRINTER_PORT || '9100'),
      timeout: parseInt(process.env.PRINTER_TIMEOUT || '5000'),
      retryAttempts: parseInt(process.env.PRINTER_RETRY_ATTEMPTS || '3'),
      paperWidth: parseInt(process.env.PRINTER_PAPER_WIDTH || '32')
    });
  }

  async createEntry(req: Request, res: Response): Promise<void> {
      const { plateNumber, vehicleType, operatorId, notes }: EntryRequest = req.body;
      
      try {
        console.log(`[ENTRY] Checking for existing ticket with plate: "${plateNumber}"`);
        
        // Check for existing active ticket
        const existingTicket = await prisma.ticket.findFirst({
          where: {
            plateNumber: plateNumber.toUpperCase(), // Ensure consistent case
            status: 'ACTIVE'
          }
        });
        
        if (existingTicket) {
          console.log(`[ENTRY] Found existing active ticket: ID=${existingTicket.id}, Plate=${existingTicket.plateNumber}`);
        } else {
          console.log(`[ENTRY] No existing active ticket found for plate: "${plateNumber.toUpperCase()}"`);
        }
  
        if (existingTicket) {
          throw new BusinessLogicError(
            i18n.t('parking.vehicle_already_inside'),
            'VEHICLE_ALREADY_INSIDE',
            409,
            { plateNumber, existingTicket: existingTicket.id }
          );
        }
  
        const entryTime = new Date();
        
        // Get pricing configuration
        const pricing = await prisma.pricingConfig.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        });

        if (!pricing) {
          throw new BusinessLogicError(
            i18n.t('system.pricing_not_configured'),
            'PRICING_NOT_CONFIGURED',
            500
          );
        }
        
        // Use atomic transaction with retry logic to handle concurrency
        const ticket = await withAtomicRetry(prisma, async (tx) => {
          // Let Prisma generate the ID automatically (CUID)
          const newTicket = await tx.ticket.create({
            data: {
              plateNumber: plateNumber.toUpperCase(),
              entryTime,
              status: 'ACTIVE',
              barcode: '', // Will be updated after creation
              vehicleType,
              notes
            }
          });
  
          // Generate barcode using the actual ticket ID
          const barcode = generateBarcode(newTicket.id, newTicket.plateNumber);
          
          // Update with the barcode
          const updatedTicket = await tx.ticket.update({
            where: { id: newTicket.id },
            data: { barcode }
          });
  
          return updatedTicket;
        });
  
        // Print entry ticket
        try {
          // Ensure printer is connected before printing
          const printerStatus = this.printerService.getStatus();
          if (!printerStatus.connected) {
            console.log('[ENTRY] Connecting to printer...');
            const connected = await this.printerService.connect();
            if (!connected) {
              console.error('[ENTRY] Failed to connect to printer');
              // Continue anyway - ticket is created, just not printed
            }
          }
          
          await this.printerService.printEntryTicket({
            ticketNumber: ticket.id,
            plateNumber: ticket.plateNumber,
            entryTime: ticket.entryTime,
            barcode: ticket.barcode,
            location: 'Estacionamiento Principal',
            totalAmount: 0, // Not applicable for entry tickets
            type: 'ENTRY' as const
          });
          console.log(`[ENTRY] Print job queued for ticket: ${ticket.id}`);
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
            entryTime: ticket.entryTime.toISOString(),
            barcode: ticket.barcode!,
            estimatedFee: new Money(pricing.minimumRate).formatPesos(),
            message: i18n.t('parking.entry_successful')
          },
          timestamp: new Date().toISOString()
        });
  
      } catch (error) {
        throw error;
      }
    }

  async getPricingConfig(req: Request, res: Response): Promise<void> {
    try {
      const pricing = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!pricing) {
        throw new BusinessLogicError(
          i18n.t('system.pricing_not_configured'),
          'PRICING_NOT_CONFIGURED',
          500
        );
      }

      res.status(200).json({
        success: true,
        data: {
          minimumRate: pricing.minimumRate.toString(),
          minimumHours: pricing.minimumHours,
          incrementRate: pricing.incrementRate.toString(),
          incrementMinutes: pricing.incrementMinutes,
          monthlyRate: pricing.monthlyRate.toString(),
          lostTicketFee: pricing.lostTicketFee.toString(),
          dailySpecialHours: pricing.dailySpecialHours,
          dailySpecialRate: pricing.dailySpecialRate?.toString() || null
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

      // Validate and parse exit time with proper error handling
      let currentExitTime: Date;
      if (exitTime) {
        currentExitTime = new Date(exitTime);
        // Check if the date is valid
        if (isNaN(currentExitTime.getTime())) {
          throw new BusinessLogicError(
            'Hora de salida inválida proporcionada',
            'INVALID_EXIT_TIME',
            400
          );
        }
      } else {
        currentExitTime = new Date();
      }
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

      // Update ticket in database transaction with retry logic
      const updatedTicket = await withAtomicRetry(prisma, async (tx) => {
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
        // Ensure printer is connected before printing
        const printerStatus = this.printerService.getStatus();
        if (!printerStatus.connected) {
          console.log('[PAYMENT] Connecting to printer...');
          const connected = await this.printerService.connect();
          if (!connected) {
            console.error('[PAYMENT] Failed to connect to printer');
          }
        }
        
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
        let lostTicket: any = null;
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
        let cashRegisterUpdated = false;
  
        if (activeTicket) {
          // Found existing ticket - mark as lost and paid
          await withAtomicRetry(prisma, async (tx) => {
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

            // Update cash register balance with lost ticket payment
            const openCashRegister = await tx.cashRegister.findFirst({
              where: {
                operatorId,
                status: 'OPEN'
              }
            });

            if (openCashRegister) {
              // Create cash flow record for the lost ticket payment
              await tx.cashFlow.create({
                data: {
                  type: 'DEPOSIT',
                  amount: lostTicketFee.toDatabase(),
                  reason: `Boleto extraviado - Placa: ${activeTicket.plateNumber}`,
                  performedBy: operatorId,
                  cashRegisterId: openCashRegister.id,
                  timestamp: new Date()
                }
              });

              // Update cash register balance
              const currentBalance = new Money(openCashRegister.currentBalance);
              const newBalance = currentBalance.add(lostTicketFee);
              
              await tx.cashRegister.update({
                where: { id: openCashRegister.id },
                data: {
                  currentBalance: newBalance.toDatabase(),
                  lastUpdated: new Date()
                }
              });

              cashRegisterUpdated = true;
            } else {
              console.warn(`No open cash register found for operator ${operatorId} - lost ticket payment not added to cash flow`);
            }
          });
  
          // Log lost ticket processing
          auditLogger('LOST_TICKET_PROCESSED', operatorId, {
            ticketNumber: activeTicket.id,
            plateNumber: activeTicket.plateNumber,
            lostTicketFee: lostTicketFee.formatPesos(),
            cashReceived: cashGiven.formatPesos(),
            changeGiven: changeAmount.formatPesos(),
            cashRegisterUpdated
          });
  
          res.json({
            success: true,
            data: {
              transactionId: activeTicket.id,
              ticketNumber: activeTicket.id,
              plateNumber: activeTicket.plateNumber,
              entryTime: i18n.formatDateTime(activeTicket.entryTime),
              exitTime: i18n.formatDateTime(exitTime),
              penalty: lostTicketFee.formatPesos(),
              cashReceived: cashGiven.formatPesos(),
              changeGiven: changeAmount.formatPesos(),
              paymentTime: i18n.formatDateTime(new Date()),
              cashRegisterUpdated,
              message: i18n.t('parking.lost_ticket_processed')
            },
            timestamp: new Date().toISOString()
          });
  
        } else {
          // No active ticket found - reject the payment
          throw new BusinessLogicError(
            'No se encontró un boleto activo para esta placa. Solo se pueden procesar boletos extraviados para vehículos que ya están en el estacionamiento.',
            'NO_ACTIVE_TICKET_FOUND',
            404,
            { 
              plateNumber: plateNumber.toUpperCase(),
              suggestion: 'Verifique que el vehículo esté realmente en el estacionamiento y que el número de placa sea correcto.'
            }
          );
        }
  
      } catch (error) {
        throw error;
      }
    }

  async validatePlateForLostTicket(req: Request, res: Response): Promise<void> {
    const { plateNumber }: { plateNumber: string } = req.body;
    
    try {
      if (!plateNumber || plateNumber.trim().length === 0) {
        throw new BusinessLogicError(
          'Número de placa es requerido',
          'PLATE_NUMBER_REQUIRED',
          400
        );
      }

      // Find active ticket by plate number
      const activeTicket = await prisma.ticket.findFirst({
        where: {
          plateNumber: plateNumber.toUpperCase(),
          status: 'ACTIVE'
        }
      });

      if (!activeTicket) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_TICKET_FOUND',
            message: 'No se encontró un boleto activo para esta placa',
            details: {
              plateNumber: plateNumber.toUpperCase(),
              suggestion: 'Verifique que el vehículo esté en el estacionamiento y que el número de placa sea correcto'
            }
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get pricing configuration for lost ticket fee
      const pricing = await prisma.pricingConfig.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      const lostTicketFee = pricing ? Money.fromNumber(pricing.lostTicketFee.toNumber()) : Money.fromNumber(150);

      res.json({
        success: true,
        message: 'Boleto activo encontrado para la placa especificada',
        data: {
          ticketId: activeTicket.id,
          plateNumber: activeTicket.plateNumber,
          entryTime: i18n.formatDateTime(activeTicket.entryTime),
          duration: i18n.formatDuration(new Date().getTime() - activeTicket.entryTime.getTime()),
          lostTicketFee: lostTicketFee.formatPesos(),
          lostTicketFeeAmount: lostTicketFee.toNumber()
        },
        timestamp: new Date().toISOString()
      });

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
          todayRevenue: Money.fromNumber(
            todayRevenue._sum.amount 
              ? (todayRevenue._sum.amount as any).toNumber() 
              : 0
          ).formatPesos(),
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
  
        // Validate and parse exit time with proper error handling
        let currentExitTime: Date;
        if (exitTime) {
          currentExitTime = new Date(exitTime as string);
          // Check if the date is valid
          if (isNaN(currentExitTime.getTime())) {
            throw new BusinessLogicError(
              'Hora de salida inválida proporcionada',
              'INVALID_EXIT_TIME',
              400
            );
          }
        } else {
          currentExitTime = new Date();
        }
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
      console.log(`[LOOKUP] Searching for ticket with term: "${barcode}"`);
      
      // Find ticket by barcode, ID, or plate number (for manual entry)
      const ticket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { barcode: barcode },
            { id: barcode },
            { 
              plateNumber: barcode.toUpperCase(),
              status: 'ACTIVE'  // Only find active tickets when searching by plate
            }
          ]
        },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });
      
      if (ticket) {
        console.log(`[LOOKUP] Found ticket: ID=${ticket.id}, Plate=${ticket.plateNumber}, Status=${ticket.status}`);
      } else {
        console.log(`[LOOKUP] No ticket found for search term: "${barcode}"`);
      }

      if (!ticket) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'TICKET_NOT_FOUND',
          404,
          { 
            searchTerm: barcode,
            searchTypes: ['barcode', 'ticketId', 'plateNumber (active only)']
          }
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

  async getTicketsByPlate(req: Request, res: Response): Promise<void> {
    try {
      const { plateNumber } = req.params;

      if (!plateNumber) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PLATE',
            message: 'Número de placa requerido',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Find tickets by plate number
      const tickets = await prisma.ticket.findMany({
        where: {
          plateNumber: plateNumber.toUpperCase()
        },
        orderBy: {
          entryTime: 'desc'
        },
        take: 10 // Limit to last 10 tickets
      });

      res.json({
        success: true,
        data: tickets,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }
}