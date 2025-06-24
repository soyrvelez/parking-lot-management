import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';
import { Money } from '../../shared/utils/money';
import { generateBarcode, withAtomicRetry } from '../../shared/utils/id-generation';
import { i18n } from '../../shared/localization';
import { BusinessLogicError } from '../middleware/errorHandler';
import { auditLogger } from '../middleware/logging';
import Decimal from 'decimal.js';

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const prisma = new PrismaClient();

export class PartnerController {
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

  // Partner Business Management
  async getActivePartnerBusinesses(req: Request, res: Response): Promise<void> {
    try {
      const partners = await prisma.partnerBusiness.findMany({
        where: { 
          isActive: true 
        },
        select: {
          id: true,
          name: true,
          businessType: true,
          flatRate: true,
          hourlyRate: true,
          maxHours: true,
          validDays: true,
          validTimeStart: true,
          validTimeEnd: true,
          description: true,
          specialInstructions: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      res.json({
        success: true,
        data: partners,
        message: 'Socios comerciales activos obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error fetching active partner businesses:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener socios comerciales activos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async getAllPartnerBusinesses(req: Request, res: Response): Promise<void> {
    try {
      const { isActive, businessType, search } = req.query;
      
      const whereClause: any = {};
      
      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }
      
      if (businessType) {
        whereClause.businessType = businessType as string;
      }
      
      if (search) {
        whereClause.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { businessType: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const partners = await prisma.partnerBusiness.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              partnerTickets: {
                where: {
                  paymentStatus: 'PAID'
                }
              }
            }
          }
        },
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        data: partners,
        message: 'Socios comerciales obtenidos exitosamente'
      });
    } catch (error) {
      console.error('Error fetching partner businesses:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener socios comerciales',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async getPartnerBusiness(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const partner = await prisma.partnerBusiness.findUnique({
        where: { id },
        include: {
          partnerTickets: {
            orderBy: { printedAt: 'desc' },
            take: 10
          },
          _count: {
            select: {
              partnerTickets: true
            }
          }
        }
      });

      if (!partner) {
        res.status(404).json({
          success: false,
          message: 'Socio comercial no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        data: partner,
        message: 'Socio comercial obtenido exitosamente'
      });
    } catch (error) {
      console.error('Error fetching partner business:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener socio comercial',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async createPartnerBusiness(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        businessType,
        contactName,
        contactPhone,
        contactEmail,
        address,
        flatRate,
        hourlyRate,
        maxHours,
        validDays,
        validTimeStart,
        validTimeEnd,
        description,
        specialInstructions,
        logoUrl
      } = req.body;

      // Validate pricing logic
      const hasFlatRate = flatRate && parseFloat(flatRate) > 0;
      const hasHourlyRate = hourlyRate && parseFloat(hourlyRate) > 0;
      
      if (hasFlatRate === hasHourlyRate) {
        throw new ValidationError('Debe especificar una tarifa fija O una tarifa por hora, no ambas');
      }

      // Validate time range if provided
      if (validTimeStart && validTimeEnd) {
        const start = new Date(`2000-01-01T${validTimeStart}:00`);
        const end = new Date(`2000-01-01T${validTimeEnd}:00`);
        if (start >= end) {
          throw new ValidationError('La hora de inicio debe ser anterior a la hora de fin');
        }
      }

      const partner = await prisma.partnerBusiness.create({
        data: {
          name,
          businessType,
          contactName,
          contactPhone,
          contactEmail,
          address,
          flatRate: flatRate ? new Decimal(flatRate) : null,
          hourlyRate: hourlyRate ? new Decimal(hourlyRate) : null,
          maxHours,
          validDays: JSON.stringify(validDays),
          validTimeStart,
          validTimeEnd,
          description,
          specialInstructions,
          logoUrl,
          createdBy: (req as any).user?.id
        }
      });

      await auditLogger('CREATE_PARTNER_BUSINESS', (req as any).user?.id, {
        entityType: 'PartnerBusiness',
        entityId: partner.id,
        newValue: partner,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        data: partner,
        message: 'Socio comercial creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating partner business:', error);
      
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error al crear socio comercial',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async updatePartnerBusiness(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Get existing partner
      const existingPartner = await prisma.partnerBusiness.findUnique({
        where: { id }
      });

      if (!existingPartner) {
        res.status(404).json({
          success: false,
          message: 'Socio comercial no encontrado'
        });
        return;
      }

      // Validate pricing if provided
      if (updateData.flatRate !== undefined || updateData.hourlyRate !== undefined) {
        const flatRate = updateData.flatRate !== undefined ? updateData.flatRate : existingPartner.flatRate?.toString();
        const hourlyRate = updateData.hourlyRate !== undefined ? updateData.hourlyRate : existingPartner.hourlyRate?.toString();
        
        const hasFlatRate = flatRate && parseFloat(flatRate) > 0;
        const hasHourlyRate = hourlyRate && parseFloat(hourlyRate) > 0;
        
        if (hasFlatRate === hasHourlyRate) {
          throw new ValidationError('Debe especificar una tarifa fija O una tarifa por hora, no ambas');
        }
      }

      // Convert decimal fields
      if (updateData.flatRate) {
        updateData.flatRate = new Decimal(updateData.flatRate);
      }
      if (updateData.hourlyRate) {
        updateData.hourlyRate = new Decimal(updateData.hourlyRate);
      }

      // Convert validDays array to JSON string
      if (updateData.validDays) {
        updateData.validDays = JSON.stringify(updateData.validDays);
      }

      const updatedPartner = await prisma.partnerBusiness.update({
        where: { id },
        data: updateData
      });

      await auditLogger('UPDATE_PARTNER_BUSINESS', (req as any).user?.id, {
        entityType: 'PartnerBusiness',
        entityId: id,
        oldValue: existingPartner,
        newValue: updatedPartner,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        data: updatedPartner,
        message: 'Socio comercial actualizado exitosamente'
      });
    } catch (error) {
      console.error('Error updating partner business:', error);
      
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error al actualizar socio comercial',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async deletePartnerBusiness(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if partner has active tickets
      const activeTickets = await prisma.partnerTicket.findFirst({
        where: {
          partnerBusinessId: id,
          paymentStatus: 'ACTIVE'
        }
      });

      if (activeTickets) {
        res.status(400).json({
          success: false,
          message: 'No se puede eliminar un socio comercial con boletos activos'
        });
        return;
      }

      const partner = await prisma.partnerBusiness.findUnique({
        where: { id }
      });

      if (!partner) {
        res.status(404).json({
          success: false,
          message: 'Socio comercial no encontrado'
        });
        return;
      }

      await prisma.partnerBusiness.delete({
        where: { id }
      });

      await auditLogger('DELETE_PARTNER_BUSINESS', (req as any).user?.id, {
        entityType: 'PartnerBusiness',
        entityId: id,
        oldValue: partner,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: 'Socio comercial eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error deleting partner business:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar socio comercial',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // Partner Ticket Management
  async createPartnerTicket(req: Request, res: Response): Promise<void> {
    try {
      const {
        plateNumber,
        partnerBusinessId,
        customerName,
        businessReference,
        specialNotes,
        operatorId
      } = req.body;

      // Get partner business
      const partner = await prisma.partnerBusiness.findUnique({
        where: { id: partnerBusinessId }
      });

      if (!partner || !partner.isActive) {
        throw new BusinessLogicError(
          'Socio comercial no encontrado o inactivo',
          'PARTNER_NOT_FOUND',
          404
        );
      }

      // Validate business hours if configured
      const now = new Date();
      const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
      const validDays = JSON.parse(partner.validDays);

      if (!validDays.includes(currentDay)) {
        throw new BusinessLogicError(
          `Socio comercial no válido los días ${currentDay}`,
          'INVALID_DAY',
          400
        );
      }

      // Check time constraints
      if (partner.validTimeStart && partner.validTimeEnd) {
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
        if (currentTime < partner.validTimeStart || currentTime > partner.validTimeEnd) {
          throw new BusinessLogicError(
            `Socio comercial válido solo de ${partner.validTimeStart} a ${partner.validTimeEnd}`,
            'INVALID_TIME',
            400
          );
        }
      }

      // Check for existing active ticket
      const existingTicket = await prisma.partnerTicket.findFirst({
        where: {
          plateNumber: plateNumber.toUpperCase(),
          paymentStatus: 'ACTIVE'
        }
      });

      if (existingTicket) {
        throw new BusinessLogicError(
          'El vehículo ya tiene un boleto de socio activo',
          'VEHICLE_ALREADY_INSIDE',
          409
        );
      }

      // Calculate agreed rate
      const agreedRate = partner.flatRate || partner.hourlyRate || new Decimal(0);

      // Generate unique ticket number and barcode
      const ticketNumber = await withAtomicRetry(prisma, async (tx: any) => {
        const number = `PT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const existing = await tx.partnerTicket.findUnique({
          where: { ticketNumber: number }
        });
        if (existing) throw new Error('Ticket number collision');
        return number;
      });

      const barcode = generateBarcode(ticketNumber as string, plateNumber as string);

      const partnerTicket = await prisma.partnerTicket.create({
        data: {
          ticketNumber: ticketNumber as string,
          barcode,
          plateNumber: plateNumber.toUpperCase(),
          partnerBusinessId,
          customerName,
          businessReference,
          specialNotes,
          agreedRate,
          operatorId
        },
        include: {
          partnerBusiness: true
        }
      });

      // Print partner ticket
      try {
        await this.printPartnerTicket(partnerTicket);
      } catch (printError) {
        console.error('Failed to print partner ticket:', printError);
        // Don't fail the entire operation for printing errors
      }

      await auditLogger('CREATE_PARTNER_TICKET', operatorId, {
        entityType: 'PartnerTicket',
        entityId: partnerTicket.id,
        newValue: partnerTicket,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        data: partnerTicket,
        message: 'Boleto de socio creado exitosamente'
      });
    } catch (error) {
      console.error('Error creating partner ticket:', error);
      
      if (error instanceof BusinessLogicError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error al crear boleto de socio',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async processPartnerPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { operatorId, paymentMethod, hasBusinessStamp, chargeRegularRate } = req.body;

      const partnerTicket = await prisma.partnerTicket.findUnique({
        where: { id },
        include: {
          partnerBusiness: true
        }
      });

      if (!partnerTicket) {
        res.status(404).json({
          success: false,
          message: 'Boleto de socio no encontrado'
        });
        return;
      }

      if (partnerTicket.paymentStatus !== 'ACTIVE') {
        res.status(400).json({
          success: false,
          message: 'El boleto ya ha sido pagado o cancelado'
        });
        return;
      }

      const exitTime = new Date();
      const amountToPay = chargeRegularRate ? 
        await this.calculateRegularParkingAmount(partnerTicket, exitTime) :
        this.calculatePartnerAmount(partnerTicket, exitTime);

      // Process payment transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update partner ticket
        const updatedTicket = await tx.partnerTicket.update({
          where: { id },
          data: {
            paymentStatus: 'PAID',
            exitTime,
            paidAmount: amountToPay,
            hasBusinessStamp,
            chargedRegularRate: chargeRegularRate
          },
          include: {
            partnerBusiness: true
          }
        });

        // Create transaction record
        const transactionDescription = chargeRegularRate ? 
          `Pago boleto socio (tarifa regular) - ${partnerTicket.partnerBusiness.name}` :
          `Pago boleto socio - ${partnerTicket.partnerBusiness.name}`;
        
        const transaction = await tx.transaction.create({
          data: {
            type: chargeRegularRate ? 'PARKING' : 'PARTNER',
            amount: amountToPay,
            description: transactionDescription,
            operatorId,
            paymentMethod,
            partnerTicketId: id
          }
        });

        return { ticket: updatedTicket, transaction };
      });

      await auditLogger('PROCESS_PARTNER_PAYMENT', operatorId, {
        entityType: 'PartnerTicket',
        entityId: id,
        newValue: result.ticket,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        data: {
          ticket: result.ticket,
          transaction: result.transaction,
          amountPaid: amountToPay.toString()
        },
        message: 'Pago de boleto de socio procesado exitosamente'
      });
    } catch (error) {
      console.error('Error processing partner payment:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar pago de boleto de socio',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async calculatePartnerTicketAmount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const partnerTicket = await prisma.partnerTicket.findUnique({
        where: { id },
        include: {
          partnerBusiness: true
        }
      });

      if (!partnerTicket) {
        res.status(404).json({
          success: false,
          message: 'Boleto de socio no encontrado'
        });
        return;
      }

      const exitTime = new Date();
      const amount = this.calculatePartnerAmount(partnerTicket, exitTime);
      const duration = Math.ceil((exitTime.getTime() - partnerTicket.entryTime.getTime()) / (1000 * 60 * 60));

      res.json({
        success: true,
        data: {
          amount: amount.toString(),
          duration: `${duration} horas`,
          partnerName: partnerTicket.partnerBusiness.name,
          rateType: partnerTicket.partnerBusiness.flatRate ? 'Tarifa fija' : 'Tarifa por hora'
        }
      });
    } catch (error) {
      console.error('Error calculating partner ticket amount:', error);
      res.status(500).json({
        success: false,
        message: 'Error al calcular monto del boleto de socio',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async calculateBothRates(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const partnerTicket = await prisma.partnerTicket.findUnique({
        where: { id },
        include: {
          partnerBusiness: true
        }
      });

      if (!partnerTicket) {
        res.status(404).json({
          success: false,
          message: 'Boleto de socio no encontrado'
        });
        return;
      }

      const exitTime = new Date();
      const duration = Math.ceil((exitTime.getTime() - partnerTicket.entryTime.getTime()) / (1000 * 60 * 60));

      // Calculate both amounts
      const partnerAmount = this.calculatePartnerAmount(partnerTicket, exitTime);
      const regularAmount = await this.calculateRegularParkingAmount(partnerTicket, exitTime);

      // Calculate savings
      const savings = regularAmount.minus(partnerAmount);
      const savingsPercentage = regularAmount.greaterThan(0) ? 
        savings.dividedBy(regularAmount).mul(100).toFixed(1) : '0';

      res.json({
        success: true,
        data: {
          partnerRate: {
            amount: partnerAmount.toString(),
            description: partnerTicket.partnerBusiness.flatRate ? 'Tarifa fija' : 'Tarifa por hora',
            businessName: partnerTicket.partnerBusiness.name
          },
          regularRate: {
            amount: regularAmount.toString(),
            description: 'Tarifa regular de estacionamiento'
          },
          comparison: {
            savings: savings.toString(),
            savingsPercentage: `${savingsPercentage}%`,
            duration: `${duration} horas`,
            recommendation: savings.greaterThan(0) ? 
              'Verificar sello del negocio para aplicar tarifa de socio' :
              'Tarifa regular es igual o menor - verificar si aplica tarifa de socio'
          },
          stampRequired: true,
          warningMessage: 'IMPORTANTE: El boleto debe tener el sello del negocio para aplicar la tarifa de socio'
        }
      });
    } catch (error) {
      console.error('Error calculating both rates:', error);
      res.status(500).json({
        success: false,
        message: 'Error al calcular ambas tarifas',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async lookupPartnerTicket(req: Request, res: Response): Promise<void> {
    try {
      const { barcode } = req.params;

      const partnerTicket = await prisma.partnerTicket.findUnique({
        where: { barcode },
        include: {
          partnerBusiness: true
        }
      });

      if (!partnerTicket) {
        res.status(404).json({
          success: false,
          message: 'Boleto de socio no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        data: partnerTicket
      });
    } catch (error) {
      console.error('Error looking up partner ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar boleto de socio',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async getPartnerTicketsByPlate(req: Request, res: Response): Promise<void> {
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

      // Find partner tickets by plate number
      const partnerTickets = await prisma.partnerTicket.findMany({
        where: {
          plateNumber: plateNumber.toUpperCase()
        },
        include: {
          partnerBusiness: true
        },
        orderBy: {
          entryTime: 'desc'
        },
        take: 10 // Limit to last 10 tickets
      });

      res.json({
        success: true,
        data: partnerTickets,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error fetching partner tickets by plate:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar boletos de socio por placa',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async getActivePartnerTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = await prisma.partnerTicket.findMany({
        where: {
          paymentStatus: 'ACTIVE'
        },
        include: {
          partnerBusiness: true
        },
        orderBy: {
          entryTime: 'desc'
        }
      });

      res.json({
        success: true,
        data: tickets
      });
    } catch (error) {
      console.error('Error fetching active partner tickets:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener boletos de socio activos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async getPartnerTicket(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const ticket = await prisma.partnerTicket.findUnique({
        where: { id },
        include: {
          partnerBusiness: true,
          transactions: true
        }
      });

      if (!ticket) {
        res.status(404).json({
          success: false,
          message: 'Boleto de socio no encontrado'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      console.error('Error fetching partner ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener boleto de socio',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // Helper methods
  private calculatePartnerAmount(partnerTicket: any, exitTime: Date): Decimal {
    const partner = partnerTicket.partnerBusiness;
    
    if (partner.flatRate) {
      return new Decimal(partner.flatRate);
    }
    
    if (partner.hourlyRate) {
      const hoursParked = Math.ceil(
        (exitTime.getTime() - partnerTicket.entryTime.getTime()) / (1000 * 60 * 60)
      );
      
      const maxHours = partner.maxHours || hoursParked;
      const effectiveHours = Math.min(hoursParked, maxHours);
      
      return new Decimal(partner.hourlyRate).mul(effectiveHours);
    }
    
    return new Decimal(0);
  }

  private async calculateRegularParkingAmount(partnerTicket: any, exitTime: Date): Promise<Decimal> {
    // Get current pricing configuration
    const pricing = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      include: { incrementRates: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!pricing) {
      throw new BusinessLogicError(
        'Configuración de precios no encontrada',
        'PRICING_NOT_CONFIGURED',
        500
      );
    }

    const entryTime = new Date(partnerTicket.entryTime);
    const totalMinutes = Math.ceil((exitTime.getTime() - entryTime.getTime()) / (1000 * 60));
    const totalHours = totalMinutes / 60;

    // Apply minimum charge
    if (totalHours <= pricing.minimumHours) {
      return new Decimal(pricing.minimumRate);
    }

    // Calculate beyond minimum hours
    let totalAmount = new Decimal(pricing.minimumRate);
    const extraMinutes = totalMinutes - (pricing.minimumHours * 60);
    const extraIncrements = Math.ceil(extraMinutes / pricing.incrementMinutes);

    // Use increment rates if available, otherwise use base increment rate
    if (pricing.incrementRates && pricing.incrementRates.length > 0) {
      // Apply tiered pricing
      for (let i = 0; i < extraIncrements; i++) {
        const rateIndex = Math.min(i, pricing.incrementRates.length - 1);
        const rate = pricing.incrementRates[rateIndex]?.rate || pricing.incrementRate;
        totalAmount = totalAmount.plus(new Decimal(rate));
      }
    } else {
      // Apply flat increment rate
      const incrementCost = new Decimal(pricing.incrementRate).mul(extraIncrements);
      totalAmount = totalAmount.plus(incrementCost);
    }

    return totalAmount;
  }

  private async printPartnerTicket(partnerTicket: any): Promise<void> {
    // Ensure printer connection
    const status = this.printerService.getStatus();
    if (!status.connected) {
      await this.printerService.connect();
    }
    
    const partner = partnerTicket.partnerBusiness;
    const entryTime = new Date(partnerTicket.entryTime);
    
    const ticketData = {
      ticketNumber: partnerTicket.ticketNumber,
      barcode: partnerTicket.barcode,
      plateNumber: partnerTicket.plateNumber,
      entryTime: entryTime.toLocaleString('es-MX', { 
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      partnerName: partner.name,
      businessType: partner.businessType,
      rate: partner.flatRate ? 
        `$${partner.flatRate} pesos fijos` : 
        `$${partner.hourlyRate} pesos/hora`,
      maxHours: partner.maxHours ? `${partner.maxHours} horas máximo` : '',
      specialInstructions: partner.specialInstructions || '',
      customerName: partnerTicket.customerName || ''
    };

    await this.printerService.printPartnerTicket(ticketData);
  }

  // Reporting methods would go here
  async getPartnerReports(req: Request, res: Response): Promise<void> {
    // TODO: Implement partner reporting
    res.json({
      success: true,
      data: {},
      message: 'Reportes de socios pendientes de implementación'
    });
  }

  async getDailyPartnerReport(req: Request, res: Response): Promise<void> {
    // TODO: Implement daily partner report
    res.json({
      success: true,
      data: {},
      message: 'Reporte diario de socios pendiente de implementación'
    });
  }

  async getMonthlyPartnerReport(req: Request, res: Response): Promise<void> {
    // TODO: Implement monthly partner report
    res.json({
      success: true,
      data: {},
      message: 'Reporte mensual de socios pendiente de implementación'
    });
  }

  async getPartnerBusinessAnalytics(req: Request, res: Response): Promise<void> {
    // TODO: Implement partner business analytics
    res.json({
      success: true,
      data: {},
      message: 'Analíticas de socio comercial pendientes de implementación'
    });
  }

  async getPartnerTickets(req: Request, res: Response): Promise<void> {
    // TODO: Implement partner tickets listing
    res.json({
      success: true,
      data: [],
      message: 'Listado de boletos de socio pendiente de implementación'
    });
  }

  async getPartnerAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { days = '30' } = req.query;
      const daysBack = parseInt(days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get total and active partners
      const [totalPartners, activePartners] = await Promise.all([
        prisma.partnerBusiness.count(),
        prisma.partnerBusiness.count({
          where: { isActive: true }
        })
      ]);

      // Get partner tickets within date range
      const partnerTickets = await prisma.partnerTicket.findMany({
        where: {
          printedAt: {
            gte: startDate
          }
        },
        include: {
          partnerBusiness: true,
          transactions: true
        },
        orderBy: {
          printedAt: 'desc'
        }
      });

      // Calculate metrics
      const totalTickets = partnerTickets.length;
      const totalRevenue = partnerTickets
        .filter(ticket => ticket.paymentStatus === 'PAID')
        .reduce((sum, ticket) => sum.plus(ticket.paidAmount || 0), new Decimal(0));

      const avgTicketValue = totalTickets > 0 ? 
        totalRevenue.div(totalTickets) : new Decimal(0);

      // Get top partners by ticket count
      const partnerStats = new Map<string, { name: string, tickets: number, revenue: Decimal }>();
      partnerTickets.forEach(ticket => {
        const partnerId = ticket.partnerBusiness.id;
        const partnerName = ticket.partnerBusiness.name;
        const current = partnerStats.get(partnerId) || { name: partnerName, tickets: 0, revenue: new Decimal(0) };
        
        current.tickets++;
        if (ticket.paymentStatus === 'PAID' && ticket.paidAmount) {
          current.revenue = current.revenue.plus(ticket.paidAmount);
        }
        
        partnerStats.set(partnerId, current);
      });

      const topPartners = Array.from(partnerStats.entries())
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          ticketCount: stats.tickets,
          revenue: stats.revenue.toFixed(2)
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount)
        .slice(0, 5);

      // Generate monthly data for the last 6 months
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        
        const monthTickets = partnerTickets.filter(ticket => 
          ticket.printedAt >= monthStart && ticket.printedAt < monthEnd
        );
        
        const monthRevenue = monthTickets
          .filter(ticket => ticket.paymentStatus === 'PAID')
          .reduce((sum, ticket) => sum.plus(ticket.paidAmount || 0), new Decimal(0));

        monthlyData.push({
          month: monthStart.toLocaleDateString('es-MX', { 
            month: 'short', 
            year: 'numeric' 
          }),
          tickets: monthTickets.length,
          revenue: monthRevenue.toFixed(2)
        });
      }

      // Get recent activity (last 10 transactions)
      const recentActivity = partnerTickets
        .filter(ticket => ticket.paymentStatus === 'PAID')
        .slice(0, 10)
        .map(ticket => ({
          id: ticket.id,
          partnerName: ticket.partnerBusiness.name,
          plateNumber: ticket.plateNumber,
          amount: (ticket.paidAmount || new Decimal(0)).toFixed(2),
          hasStamp: ticket.hasBusinessStamp || false,
          createdAt: ticket.printedAt.toISOString()
        }));

      const analytics = {
        totalPartners,
        activePartners,
        totalTickets,
        totalRevenue: totalRevenue.toFixed(2),
        avgTicketValue: avgTicketValue.toFixed(2),
        topPartners,
        monthlyData,
        recentActivity
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting partner analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener analíticas de socios',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async exportPartnerReport(req: Request, res: Response): Promise<void> {
    try {
      const { days = '30', format = 'csv' } = req.query;
      const daysBack = parseInt(days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get partner tickets with business info
      const partnerTickets = await prisma.partnerTicket.findMany({
        where: {
          printedAt: {
            gte: startDate
          }
        },
        include: {
          partnerBusiness: true,
          transactions: true
        },
        orderBy: {
          printedAt: 'desc'
        }
      });

      if (format === 'csv') {
        // Generate CSV content
        const csvHeaders = [
          'Fecha Entrada',
          'Fecha Salida',
          'Socio Comercial',
          'Tipo de Negocio',
          'Placa',
          'Cliente',
          'Monto Pagado',
          'Tiene Sello',
          'Estado',
          'Referencia'
        ];

        const csvRows = partnerTickets.map(ticket => [
          ticket.entryTime.toLocaleDateString('es-MX'),
          ticket.exitTime?.toLocaleDateString('es-MX') || '',
          ticket.partnerBusiness.name,
          ticket.partnerBusiness.businessType,
          ticket.plateNumber,
          ticket.customerName || '',
          ticket.paidAmount?.toFixed(2) || '0.00',
          ticket.hasBusinessStamp ? 'Sí' : 'No',
          ticket.paymentStatus === 'PAID' ? 'Pagado' : 
          ticket.paymentStatus === 'ACTIVE' ? 'Activo' : 'Cancelado',
          ticket.businessReference || ''
        ]);

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-socios-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\ufeff' + csvContent); // UTF-8 BOM for Excel compatibility
      } else {
        res.status(400).json({
          success: false,
          message: 'Formato no soportado. Use format=csv'
        });
      }
    } catch (error) {
      console.error('Error exporting partner report:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar reporte de socios',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  async processPartnerLostTicket(req: Request, res: Response): Promise<void> {
    try {
      const { plateNumber, cashReceived, operatorId } = req.body;
      
      // Find active partner ticket by plate number
      const activePartnerTicket = await prisma.partnerTicket.findFirst({
        where: {
          plateNumber: plateNumber.toUpperCase(),
          paymentStatus: 'ACTIVE'
        },
        include: {
          partnerBusiness: true
        }
      });

      if (!activePartnerTicket) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NO_ACTIVE_PARTNER_TICKET_FOUND',
            message: 'No se encontró un boleto de socio activo para esta placa.',
            context: {
              plateNumber: plateNumber.toUpperCase(),
              suggestion: 'Verifique que el boleto de socio esté activo y que el número de placa sea correcto.'
            },
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Get pricing configuration for lost ticket fee
      const pricing = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!pricing) {
        res.status(500).json({
          success: false,
          message: 'Configuración de precios no encontrada'
        });
        return;
      }

      const lostTicketFee = Money.fromNumber(parseFloat(pricing.lostTicketFee.toString()));
      const cashGiven = Money.fromNumber(cashReceived);

      // Validate payment amount
      if (cashGiven.lessThan(lostTicketFee)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PAYMENT',
            message: 'El monto recibido es insuficiente para la tarifa por boleto extraviado',
            context: {
              required: lostTicketFee.formatPesos(),
              received: cashGiven.formatPesos(),
              shortfall: lostTicketFee.subtract(cashGiven).formatPesos()
            }
          }
        });
        return;
      }

      const changeAmount = cashGiven.subtract(lostTicketFee);
      const exitTime = new Date();

      // Process partner lost ticket fee
      const result = await prisma.$transaction(async (tx) => {
        // Update partner ticket status
        const updatedPartnerTicket = await tx.partnerTicket.update({
          where: { id: activePartnerTicket.id },
          data: {
            paymentStatus: 'PAID',
            exitTime,
            paidAmount: lostTicketFee.toString(),
            hasBusinessStamp: false,
            chargedRegularRate: false
          },
          include: {
            partnerBusiness: true
          }
        });

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            type: 'LOST_TICKET',
            amount: lostTicketFee.toString(),
            partnerTicketId: activePartnerTicket.id,
            description: `Boleto de socio extraviado - ${activePartnerTicket.partnerBusiness.name}`,
            operatorId: operatorId || 'operator1',
            paymentMethod: 'CASH'
          }
        });

        return { ticket: updatedPartnerTicket, transaction };
      });

      await auditLogger('PARTNER_LOST_TICKET_PROCESSED', operatorId, {
        entityType: 'PartnerTicket',
        entityId: activePartnerTicket.id,
        newValue: result.ticket,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        data: {
          transactionId: result.transaction.id,
          ticketNumber: activePartnerTicket.ticketNumber,
          plateNumber: activePartnerTicket.plateNumber,
          partnerName: activePartnerTicket.partnerBusiness.name,
          entryTime: activePartnerTicket.entryTime.toISOString(),
          exitTime: exitTime.toISOString(),
          penalty: lostTicketFee.formatPesos(),
          cashReceived: cashGiven.formatPesos(),
          changeGiven: changeAmount.formatPesos(),
          paymentTime: new Date().toISOString(),
          message: 'Boleto de socio extraviado procesado exitosamente'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error processing partner lost ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar boleto de socio extraviado',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}

const partnerController = new PartnerController();
export default partnerController;