import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';
import { BusinessLogicError, HardwareError } from '../middleware/errorHandler';
import { auditLogger } from '../middleware/logging';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';
import { withAtomicRetry } from '../../shared/utils/id-generation';
import {
  CreatePensionCustomerRequest,
  PensionPaymentRequest,
  PensionRenewalRequest,
  PensionStatus,
  PensionCustomerResponse
} from '../types/pension';

const prisma = new PrismaClient();

export class PensionController {
  private printerService: ThermalPrinterService;

  constructor() {
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

  /**
   * Lookup pension customer by plate number or barcode
   * Primary method: plate number (ABC-123)
   * Secondary: pension barcode (PENSION-ABC123)
   */
  async lookupCustomer(req: Request, res: Response): Promise<void> {
    const { identifier } = req.params;
    
    try {
      // Primary search: exact plate number match
      let customer = await prisma.pensionCustomer.findFirst({
        where: {
          plateNumber: identifier.toUpperCase(),
          isActive: true
        }
      });

      // Secondary search: if not found, try partial plate matches
      if (!customer) {
        customer = await prisma.pensionCustomer.findFirst({
          where: {
            plateNumber: {
              contains: identifier.toUpperCase()
            },
            isActive: true
          }
        });
      }

      // Tertiary search: pension barcode format
      if (!customer && identifier.startsWith('PENSION-')) {
        const plateFromBarcode = identifier.replace('PENSION-', '');
        customer = await prisma.pensionCustomer.findFirst({
          where: {
            plateNumber: plateFromBarcode.toUpperCase(),
            isActive: true
          }
        });
      }

      if (!customer) {
        throw new BusinessLogicError(
          i18n.t('parking.ticket_not_found'),
          'PENSION_CUSTOMER_NOT_FOUND',
          404,
          { identifier }
        );
      }

      const customerData = this.formatCustomerResponse(customer);

      res.json({
        success: true,
        data: customerData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Search pension customers by partial plate number query
   * For operators typing plate numbers to find customers
   */
  async searchCustomers(req: Request, res: Response): Promise<void> {
    const { query } = req.params;
    
    try {
      if (query.length < 2) {
        res.json({
          success: true,
          data: [],
          message: 'Ingrese al menos 2 caracteres para buscar',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const customers = await prisma.pensionCustomer.findMany({
        where: {
          AND: [
            { isActive: true },
            {
              OR: [
                {
                  plateNumber: {
                    contains: query.toUpperCase()
                  }
                },
                {
                  name: {
                    contains: query,
                    mode: 'insensitive'
                  }
                }
              ]
            }
          ]
        },
        take: 10, // Limit results for performance
        orderBy: { plateNumber: 'asc' }
      });

      const formattedCustomers = customers.map(customer => 
        this.formatCustomerResponse(customer)
      );

      res.json({
        success: true,
        data: formattedCustomers,
        message: `${formattedCustomers.length} clientes encontrados`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get pension customer details by ID
   */
  async getCustomer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    try {
      const customer = await prisma.pensionCustomer.findUnique({
        where: { id },
        include: {
          transactions: {
            orderBy: { timestamp: 'desc' },
            take: 10
          }
        }
      });

      if (!customer) {
        throw new BusinessLogicError(
          i18n.t('admin.operator_not_found'),
          'PENSION_CUSTOMER_NOT_FOUND',
          404,
          { id }
        );
      }

      const customerData = this.formatCustomerResponse(customer);

      res.json({
        success: true,
        data: {
          ...customerData,
          recentTransactions: customer.transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount.toNumber() <= 9999.99 
              ? Money.fromNumber(tx.amount.toNumber()).formatPesos()
              : `$${tx.amount.toNumber().toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pesos`,
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

  /**
   * Create new pension customer
   */
  async createCustomer(req: Request, res: Response): Promise<void> {
    const {
      name,
      phone,
      plateNumber,
      vehicleMake,
      vehicleModel,
      monthlyRate,
      startDate,
      durationMonths,
      operatorId
    }: CreatePensionCustomerRequest = req.body;
    
    try {
      // Check for existing customer with same plate
      const existingCustomer = await prisma.pensionCustomer.findFirst({
        where: {
          plateNumber: plateNumber.toUpperCase(),
          isActive: true
        }
      });

      if (existingCustomer) {
        throw new BusinessLogicError(
          'Ya existe un cliente de pensión activo con esta placa',
          'PENSION_CUSTOMER_EXISTS',
          409,
          { plateNumber }
        );
      }

      // Calculate end date
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);

      // Generate pension barcode
      const pensionBarcode = `PENSION-${plateNumber.toUpperCase()}`;

      // Create pension customer with initial payment and cash flow integration
      let cashRegisterUpdated = false;
      const customer = await withAtomicRetry(prisma, async (tx) => {
        // Create pension customer
        const newCustomer = await tx.pensionCustomer.create({
          data: {
            name,
            phone,
            plateNumber: plateNumber.toUpperCase(),
            vehicleMake,
            vehicleModel,
            monthlyRate,
            startDate,
            endDate,
            isActive: true
          }
        });

        // Create initial payment transaction
        await tx.transaction.create({
          data: {
            type: 'PENSION',
            amount: monthlyRate,
            pensionId: newCustomer.id,
            description: i18n.t('transaction.pension_payment', { 
              customerName: newCustomer.name 
            }),
            operatorId
          }
        });

        // Update cash register balance with initial pension payment
        const openCashRegister = await tx.cashRegister.findFirst({
          where: {
            operatorId,
            status: 'OPEN'
          }
        });

        if (openCashRegister) {
          // Create cash flow record for the initial pension payment
          await tx.cashFlow.create({
            data: {
              type: 'DEPOSIT',
              amount: monthlyRate,
              reason: `Registro pensión - Cliente: ${newCustomer.name} (${newCustomer.plateNumber})`,
              performedBy: operatorId,
              cashRegisterId: openCashRegister.id,
              timestamp: new Date()
            }
          });

          // Update cash register balance
          const currentBalance = new Money(openCashRegister.currentBalance);
          const paymentAmount = Money.fromNumber(monthlyRate);
          const newBalance = currentBalance.add(paymentAmount);
          
          await tx.cashRegister.update({
            where: { id: openCashRegister.id },
            data: {
              currentBalance: newBalance.toDatabase(),
              lastUpdated: new Date()
            }
          });

          cashRegisterUpdated = true;
        } else {
          console.warn(`No open cash register found for operator ${operatorId} - pension registration payment not added to cash flow`);
        }

        return newCustomer;
      });

      // Print pension customer card
      try {
        await this.printerService.printPensionReceipt({
          ticketNumber: customer.id,
          plateNumber: customer.plateNumber,
          customerName: customer.name,
          monthlyRate: monthlyRate,
          startDate: startDate,
          endDate: endDate,
          totalAmount: monthlyRate,
          cashReceived: monthlyRate,
          change: 0,
          type: 'PENSION'
        });
      } catch (printError) {
        console.error('Failed to print pension card:', printError);
      }

      // Log creation
      auditLogger('PENSION_CUSTOMER_CREATED', operatorId, {
        customerId: customer.id,
        name: customer.name,
        plateNumber: customer.plateNumber,
        monthlyRate: monthlyRate <= 9999.99 
          ? Money.fromNumber(monthlyRate).formatPesos()
          : `$${monthlyRate.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pesos`,
        duration: `${durationMonths} meses`,
        cashRegisterUpdated
      });

      const customerData = this.formatCustomerResponse(customer);

      res.status(201).json({
        success: true,
        data: customerData,
        message: 'Cliente de pensión creado exitosamente',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Process pension payment (monthly fee)
   */
  async processPayment(req: Request, res: Response): Promise<void> {
    const { customerId, cashReceived, operatorId, notes }: PensionPaymentRequest = req.body;
    
    try {
      const customer = await prisma.pensionCustomer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        throw new BusinessLogicError(
          'Cliente de pensión no encontrado',
          'PENSION_CUSTOMER_NOT_FOUND',
          404,
          { customerId }
        );
      }

      if (!customer.isActive) {
        throw new BusinessLogicError(
          'Cliente de pensión inactivo',
          'PENSION_CUSTOMER_INACTIVE',
          400,
          { customerId }
        );
      }

      // Handle large amounts safely for monthly payments
      const monthlyRate = customer.monthlyRate.toNumber() <= 9999.99
        ? Money.fromNumber(customer.monthlyRate.toNumber())
        : new Money(customer.monthlyRate.toString(), false);
      
      const cashGiven = cashReceived <= 9999.99 
        ? Money.fromNumber(cashReceived)
        : new Money(cashReceived.toString(), false);

      // Validate payment amount
      if (cashGiven.lessThan(monthlyRate)) {
        throw new BusinessLogicError(
          i18n.t('parking.insufficient_payment'),
          'INSUFFICIENT_PAYMENT',
          400,
          { 
            required: monthlyRate.formatPesos(),
            received: cashGiven.formatPesos(),
            shortfall: monthlyRate.subtract(cashGiven).formatPesos()
          }
        );
      }

      const changeAmount = cashGiven.subtract(monthlyRate);

      // Process payment with cash flow integration
      let cashRegisterUpdated = false;
      const result = await withAtomicRetry(prisma, async (tx) => {
        // Create payment transaction
        const transaction = await tx.transaction.create({
          data: {
            type: 'PENSION',
            amount: monthlyRate.toNumber(),
            pensionId: customer.id,
            description: i18n.t('transaction.pension_payment', { 
              customerName: customer.name 
            }),
            operatorId
          }
        });

        // Update cash register balance with pension payment
        const openCashRegister = await tx.cashRegister.findFirst({
          where: {
            operatorId,
            status: 'OPEN'
          }
        });

        if (openCashRegister) {
          // Create cash flow record for the pension payment
          await tx.cashFlow.create({
            data: {
              type: 'DEPOSIT',
              amount: monthlyRate.toDatabase(),
              reason: `Pago pensión - Cliente: ${customer.name} (${customer.plateNumber})`,
              performedBy: operatorId,
              cashRegisterId: openCashRegister.id,
              timestamp: new Date()
            }
          });

          // Update cash register balance
          const currentBalance = new Money(openCashRegister.currentBalance);
          const newBalance = currentBalance.add(monthlyRate);
          
          await tx.cashRegister.update({
            where: { id: openCashRegister.id },
            data: {
              currentBalance: newBalance.toDatabase(),
              lastUpdated: new Date()
            }
          });

          cashRegisterUpdated = true;
        } else {
          console.warn(`No open cash register found for operator ${operatorId} - pension payment not added to cash flow`);
        }

        // Extend pension if currently active (add 1 month)
        let updatedCustomer = customer;
        if (new Date() < customer.endDate) {
          // Customer is current, extend by 1 month
          const newEndDate = new Date(customer.endDate);
          newEndDate.setMonth(newEndDate.getMonth() + 1);
          
          updatedCustomer = await tx.pensionCustomer.update({
            where: { id: customerId },
            data: { 
              endDate: newEndDate,
              isActive: true
            }
          });
        } else {
          // Customer expired, start new period from today
          const newStartDate = new Date();
          const newEndDate = new Date();
          newEndDate.setMonth(newEndDate.getMonth() + 1);
          
          updatedCustomer = await tx.pensionCustomer.update({
            where: { id: customerId },
            data: { 
              startDate: newStartDate,
              endDate: newEndDate,
              isActive: true
            }
          });
        }

        return { transaction, customer: updatedCustomer };
      });

      // Print payment receipt
      try {
        await this.printerService.printPensionReceipt({
          ticketNumber: result.customer.id,
          plateNumber: result.customer.plateNumber,
          customerName: result.customer.name,
          monthlyRate: monthlyRate.toNumber(),
          startDate: result.customer.startDate,
          endDate: result.customer.endDate,
          totalAmount: monthlyRate.toNumber(),
          cashReceived: cashGiven.toNumber(),
          change: changeAmount.toNumber(),
          type: 'PENSION'
        });
      } catch (printError) {
        console.error('Failed to print pension receipt:', printError);
      }

      // Log payment
      auditLogger('PENSION_PAYMENT_PROCESSED', operatorId, {
        customerId: result.customer.id,
        customerName: result.customer.name,
        plateNumber: result.customer.plateNumber,
        amount: monthlyRate.formatPesos(),
        cashReceived: cashGiven.formatPesos(),
        changeGiven: changeAmount.formatPesos(),
        validUntil: i18n.formatDate(result.customer.endDate),
        cashRegisterUpdated
      });

      const customerData = this.formatCustomerResponse(result.customer);

      res.json({
        success: true,
        data: {
          customer: customerData,
          payment: {
            amount: monthlyRate.formatPesos(),
            cashReceived: cashGiven.formatPesos(),
            changeGiven: changeAmount.formatPesos(),
            validUntil: i18n.formatDate(result.customer.endDate),
            cashRegisterUpdated
          }
        },
        message: 'Pago de pensión procesado exitosamente',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Renew pension customer membership
   */
  async renewCustomer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { durationMonths, cashReceived, operatorId, notes }: PensionRenewalRequest = req.body;
    
    try {
      const customer = await prisma.pensionCustomer.findUnique({
        where: { id }
      });

      if (!customer) {
        throw new BusinessLogicError(
          'Cliente de pensión no encontrado',
          'PENSION_CUSTOMER_NOT_FOUND',
          404,
          { id }
        );
      }

      // Calculate total using Decimal arithmetic to avoid Money class limits
      const totalAmountDecimal = customer.monthlyRate.mul(durationMonths);
      const totalAmountValue = totalAmountDecimal.toNumber();
      
      // Use raw numbers for validation since amounts may exceed Money class limits
      const cashGivenValue = cashReceived;

      // Validate payment amount using raw numbers
      if (cashGivenValue < totalAmountValue) {
        const shortfall = totalAmountValue - cashGivenValue;
        throw new BusinessLogicError(
          i18n.t('parking.insufficient_payment'),
          'INSUFFICIENT_PAYMENT',
          400,
          { 
            required: this.formatLargeAmount(totalAmountValue),
            received: this.formatLargeAmount(cashGivenValue),
            shortfall: this.formatLargeAmount(shortfall)
          }
        );
      }

      const changeAmountValue = cashGivenValue - totalAmountValue;

      // Process renewal with cash flow integration
      let cashRegisterUpdated = false;
      const result = await withAtomicRetry(prisma, async (tx) => {
        // Create renewal transaction
        const transaction = await tx.transaction.create({
          data: {
            type: 'PENSION',
            amount: totalAmountValue,
            pensionId: customer.id,
            description: `Renovación pensión ${durationMonths} meses - ${customer.name}`,
            operatorId
          }
        });

        // Update cash register balance with renewal payment
        const openCashRegister = await tx.cashRegister.findFirst({
          where: {
            operatorId,
            status: 'OPEN'
          }
        });

        if (openCashRegister) {
          // Create cash flow record for the renewal payment
          await tx.cashFlow.create({
            data: {
              type: 'DEPOSIT',
              amount: totalAmountValue,
              reason: `Renovación pensión ${durationMonths} meses - Cliente: ${customer.name} (${customer.plateNumber})`,
              performedBy: operatorId,
              cashRegisterId: openCashRegister.id,
              timestamp: new Date()
            }
          });

          // Update cash register balance
          const currentBalance = new Money(openCashRegister.currentBalance);
          const renewalAmount = totalAmountValue <= 9999.99 
            ? Money.fromNumber(totalAmountValue)
            : new Money(totalAmountValue.toString(), false);
          const newBalance = currentBalance.add(renewalAmount);
          
          await tx.cashRegister.update({
            where: { id: openCashRegister.id },
            data: {
              currentBalance: newBalance.toDatabase(),
              lastUpdated: new Date()
            }
          });

          cashRegisterUpdated = true;
        } else {
          console.warn(`No open cash register found for operator ${operatorId} - pension renewal payment not added to cash flow`);
        }

        // Extend pension period
        const currentEndDate = customer.isActive && new Date() < customer.endDate 
          ? customer.endDate 
          : new Date();
        
        const newEndDate = new Date(currentEndDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
        
        const updatedCustomer = await tx.pensionCustomer.update({
          where: { id },
          data: { 
            endDate: newEndDate,
            isActive: true
          }
        });

        return { transaction, customer: updatedCustomer };
      });

      // Log renewal
      auditLogger('PENSION_CUSTOMER_RENEWED', operatorId, {
        customerId: result.customer.id,
        customerName: result.customer.name,
        duration: `${durationMonths} meses`,
        amount: this.formatLargeAmount(totalAmountValue),
        validUntil: i18n.formatDate(result.customer.endDate),
        cashRegisterUpdated
      });

      const customerData = this.formatCustomerResponse(result.customer);

      res.json({
        success: true,
        data: customerData,
        message: `Pensión renovada por ${durationMonths} meses`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Check pension customer status
   */
  async checkStatus(req: Request, res: Response): Promise<void> {
    const { identifier } = req.params;
    
    try {
      const customer = await prisma.pensionCustomer.findFirst({
        where: {
          OR: [
            { plateNumber: identifier.toUpperCase() },
            { id: identifier }
          ]
        }
      });

      if (!customer) {
        res.json({
          success: true,
          data: {
            found: false,
            status: 'NOT_FOUND',
            message: 'Cliente de pensión no encontrado'
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const customerData = this.formatCustomerResponse(customer);

      res.json({
        success: true,
        data: {
          found: true,
          customer: customerData,
          accessAllowed: customer.isActive && new Date() <= customer.endDate,
          message: this.getStatusMessage(customerData.status, customerData.daysRemaining)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * List all customers (for admin)
   */
  async listCustomers(req: Request, res: Response): Promise<void> {
    try {
      const customers = await prisma.pensionCustomer.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const formattedCustomers = customers.map(customer => 
        this.formatCustomerResponse(customer)
      );

      res.json({
        success: true,
        data: formattedCustomers,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update pension customer details
   */
  async updateCustomer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const updateData: CreatePensionCustomerRequest = req.body;
    
    try {
      const customer = await prisma.pensionCustomer.update({
        where: { id },
        data: {
          name: updateData.name,
          phone: updateData.phone,
          plateNumber: updateData.plateNumber.toUpperCase(),
          vehicleMake: updateData.vehicleMake,
          vehicleModel: updateData.vehicleModel,
          monthlyRate: updateData.monthlyRate
        }
      });

      const customerData = this.formatCustomerResponse(customer);

      res.json({
        success: true,
        data: customerData,
        message: 'Cliente actualizado exitosamente',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate pension customer
   */
  async deactivateCustomer(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    
    try {
      const customer = await prisma.pensionCustomer.update({
        where: { id },
        data: { isActive: false }
      });

      const customerData = this.formatCustomerResponse(customer);

      res.json({
        success: true,
        data: customerData,
        message: 'Cliente desactivado exitosamente',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Safely format large amounts that may exceed Money class limits
   */
  private formatLargeAmount(amount: number): string {
    try {
      if (amount <= 9999.99) {
        return Money.fromNumber(amount).formatPesos();
      }
      return `$${amount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} pesos`;
    } catch (error) {
      return `$${amount.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} pesos`;
    }
  }

  /**
   * Format customer data for API response
   */
  private formatCustomerResponse(customer: any): PensionCustomerResponse {
    const now = new Date();
    const endDate = new Date(customer.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    let status: PensionStatus;
    if (!customer.isActive) {
      status = PensionStatus.INACTIVE;
    } else if (daysRemaining < 0) {
      status = PensionStatus.EXPIRED;
    } else if (daysRemaining <= 7) {
      status = PensionStatus.EXPIRING_SOON;
    } else {
      status = PensionStatus.ACTIVE;
    }

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      plateNumber: customer.plateNumber,
      vehicleMake: customer.vehicleMake,
      vehicleModel: customer.vehicleModel,
      monthlyRate: customer.monthlyRate.toNumber(),
      status,
      startDate: customer.startDate.toISOString(),
      endDate: customer.endDate.toISOString(),
      daysRemaining: Math.max(0, daysRemaining),
      isActive: customer.isActive,
      barcode: `PENSION-${customer.plateNumber}`,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString()
    };
  }

  /**
   * Get status message in Spanish
   */
  private getStatusMessage(status: PensionStatus, daysRemaining: number): string {
    switch (status) {
      case PensionStatus.ACTIVE:
        return `Pensión válida - ${daysRemaining} días restantes`;
      case PensionStatus.EXPIRING_SOON:
        return `Pensión por vencer - ${daysRemaining} días restantes`;
      case PensionStatus.EXPIRED:
        return 'Pensión expirada - Renovación requerida';
      case PensionStatus.INACTIVE:
        return 'Cliente de pensión inactivo';
      default:
        return 'Estado desconocido';
    }
  }
}