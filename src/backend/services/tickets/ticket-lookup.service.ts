/**
 * Ticket Lookup Service
 * Handles ticket validation, fee calculation, and payment processing
 */

import { EventEmitter } from 'events';
import { Money } from '../../../shared/utils/money';
import { generateTransactionId } from '../../../shared/utils/id-generation';
import { i18n } from '../../../shared/localization';

export interface Ticket {
  id: string;
  plateNumber: string;
  entryTime: Date;
  exitTime?: Date;
  barcode: string;
  status: 'ACTIVE' | 'PAID' | 'LOST' | 'CANCELLED' | 'REFUNDED';
  totalAmount?: number;
  paymentMethod?: 'EFECTIVO' | 'PENSION';
  paidAt?: Date;
  operatorId?: string;
}

export interface PensionCustomer {
  id: string;
  name: string;
  phone?: string;
  plateNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  monthlyRate: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  barcode: string;
}

export interface ParkingTransaction {
  id: string;
  type: 'PARKING' | 'PENSION' | 'LOST_TICKET' | 'REFUND';
  ticketId?: string;
  pensionCustomerId?: string;
  amount: Money;
  paymentMethod: 'EFECTIVO' | 'PENSION';
  timestamp: Date;
  operatorId?: string;
  description: string;
}

export interface PricingConfig {
  minimumHours: number;
  minimumRate: Money;
  incrementMinutes: number;
  incrementRates: Money[];
  dailySpecialHours?: number;
  dailySpecialRate?: Money;
  monthlyRate: Money;
  lostTicketFee: Money;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  totalAmount: Money;
  amountPaid: Money;
  change: Money;
  receipt: {
    ticketNumber: string;
    plateNumber: string;
    entryTime: Date;
    exitTime: Date;
    durationMinutes: number;
    totalAmount: Money;
    paymentMethod: string;
    change: Money;
  };
}

export class TicketLookupService extends EventEmitter {
  private pricingConfig: PricingConfig;
  private tickets: Map<string, Ticket> = new Map();
  private pensionCustomers: Map<string, PensionCustomer> = new Map();
  private transactions: ParkingTransaction[] = [];

  constructor() {
    super();
    
    this.pricingConfig = {
      minimumHours: 1,
      minimumRate: Money.fromPesos(25),
      incrementMinutes: 15,
      incrementRates: [
        Money.fromPesos(8.50),  // 2nd hour
        Money.fromPesos(8.50),  // 3rd hour
        Money.fromPesos(12.75), // 4th hour+
      ],
      dailySpecialHours: 8,
      dailySpecialRate: Money.fromPesos(80),
      monthlyRate: Money.fromPesos(800),
      lostTicketFee: Money.fromPesos(150)
    };

    this.initializeTestData();
  }

  private initializeTestData(): void {
    // Add some test tickets
    this.tickets.set('TICKET-001', {
      id: 'T-001',
      plateNumber: 'ABC-123',
      entryTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
      barcode: 'TICKET-001',
      status: 'ACTIVE'
    });

    this.tickets.set('TICKET-PAID', {
      id: 'T-002',
      plateNumber: 'XYZ-789',
      entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      exitTime: new Date(Date.now() - 30 * 60 * 1000), // Paid 30 min ago
      barcode: 'TICKET-PAID',
      status: 'PAID',
      totalAmount: 59.25,
      paymentMethod: 'EFECTIVO',
      paidAt: new Date(Date.now() - 30 * 60 * 1000)
    });

    // Add test pension customer
    this.pensionCustomers.set('PENSION-001', {
      id: 'P-001',
      name: 'María José Hernández Sánchez',
      phone: '55-1234-5678',
      plateNumber: 'DEF-456',
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      monthlyRate: 800,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-07-01'),
      isActive: true,
      barcode: 'PENSION-001'
    });
  }

  public async findTicketByBarcode(barcode: string): Promise<Ticket | PensionCustomer | null> {
    // First check regular tickets
    const ticket = this.tickets.get(barcode);
    if (ticket) {
      this.emit('ticketFound', { type: 'TICKET', ticket });
      return ticket;
    }

    // Then check pension customers
    const pensionCustomer = this.pensionCustomers.get(barcode);
    if (pensionCustomer) {
      this.emit('ticketFound', { type: 'PENSION', customer: pensionCustomer });
      return { ...pensionCustomer, type: 'PENSION' } as any;
    }

    this.emit('ticketNotFound', { barcode });
    return null;
  }

  public async findTicketByPlateNumber(plateNumber: string): Promise<Ticket[]> {
    const tickets = Array.from(this.tickets.values())
      .filter(ticket => ticket.plateNumber.toUpperCase() === plateNumber.toUpperCase());
    
    if (tickets.length === 0) {
      this.emit('ticketNotFound', { plateNumber });
    }

    return tickets;
  }

  public async calculateParkingFee(ticket: Ticket, exitTime?: Date): Promise<{
    totalAmount: Money;
    durationMinutes: number;
    breakdown: {
      minimumCharge: Money;
      additionalCharges: { period: string; amount: Money }[];
      dailySpecial?: Money;
    };
  }> {
    const actualExitTime = exitTime || new Date();
    const entryTime = new Date(ticket.entryTime);
    const durationMs = actualExitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const durationHours = durationMinutes / 60;

    let totalAmount = this.pricingConfig.minimumRate;
    const additionalCharges: { period: string; amount: Money }[] = [];

    if (durationHours > this.pricingConfig.minimumHours) {
      const additionalTime = durationHours - this.pricingConfig.minimumHours;
      const incrementsNeeded = Math.ceil(additionalTime / (this.pricingConfig.incrementMinutes / 60));

      for (let i = 0; i < incrementsNeeded; i++) {
        const rateIndex = Math.min(i, this.pricingConfig.incrementRates.length - 1);
        const rate = this.pricingConfig.incrementRates[rateIndex];
        
        totalAmount = totalAmount.add(rate);
        additionalCharges.push({
          period: i18n.t('parking.increment_period', { 
            minutes: this.pricingConfig.incrementMinutes 
          }),
          amount: rate
        });
      }
    }

    // Check for daily special
    let dailySpecial: Money | undefined;
    if (this.pricingConfig.dailySpecialHours && 
        this.pricingConfig.dailySpecialRate &&
        durationHours >= this.pricingConfig.dailySpecialHours) {
      
      if (totalAmount.greaterThan(this.pricingConfig.dailySpecialRate)) {
        dailySpecial = this.pricingConfig.dailySpecialRate;
        totalAmount = this.pricingConfig.dailySpecialRate;
      }
    }

    const result = {
      totalAmount,
      durationMinutes,
      breakdown: {
        minimumCharge: this.pricingConfig.minimumRate,
        additionalCharges,
        dailySpecial
      }
    };

    this.emit('feeCalculated', { ticket, ...result });
    return result;
  }

  public async processPayment(
    ticket: Ticket,
    amountPaid: Money,
    paymentMethod: 'EFECTIVO' | 'PENSION' = 'EFECTIVO',
    operatorId?: string
  ): Promise<PaymentResult> {
    const exitTime = new Date();
    const feeCalculation = await this.calculateParkingFee(ticket, exitTime);
    
    if (amountPaid.lessThan(feeCalculation.totalAmount)) {
      throw new Error(i18n.t('payment.insufficient_amount', {
        required: feeCalculation.totalAmount.formatPesos(),
        provided: amountPaid.formatPesos()
      }));
    }

    const change = amountPaid.subtract(feeCalculation.totalAmount);
    const transactionId = generateTransactionId();

    // Update ticket
    ticket.exitTime = exitTime;
    ticket.status = 'PAID';
    ticket.totalAmount = feeCalculation.totalAmount.toNumber();
    ticket.paymentMethod = paymentMethod;
    ticket.paidAt = exitTime;
    ticket.operatorId = operatorId;

    // Record transaction
    const transaction: ParkingTransaction = {
      id: transactionId,
      type: 'PARKING',
      ticketId: ticket.id,
      amount: feeCalculation.totalAmount,
      paymentMethod,
      timestamp: exitTime,
      operatorId,
      description: i18n.t('transaction.parking_payment', {
        plate: ticket.plateNumber,
        duration: this.formatDuration(feeCalculation.durationMinutes)
      })
    };

    this.transactions.push(transaction);

    const paymentResult: PaymentResult = {
      success: true,
      transactionId,
      totalAmount: feeCalculation.totalAmount,
      amountPaid,
      change,
      receipt: {
        ticketNumber: ticket.id,
        plateNumber: ticket.plateNumber,
        entryTime: new Date(ticket.entryTime),
        exitTime,
        durationMinutes: feeCalculation.durationMinutes,
        totalAmount: feeCalculation.totalAmount,
        paymentMethod,
        change
      }
    };

    this.emit('paymentProcessed', paymentResult);
    return paymentResult;
  }

  public async processLostTicket(
    plateNumber: string,
    amountPaid: Money,
    operatorId?: string
  ): Promise<PaymentResult> {
    if (amountPaid.lessThan(this.pricingConfig.lostTicketFee)) {
      throw new Error(i18n.t('payment.insufficient_lost_ticket_fee', {
        required: this.pricingConfig.lostTicketFee.formatPesos(),
        provided: amountPaid.formatPesos()
      }));
    }

    const change = amountPaid.subtract(this.pricingConfig.lostTicketFee);
    const transactionId = generateTransactionId();
    const now = new Date();

    // Create lost ticket record with generated ID
    const lostTicket: Ticket = {
      id: transactionId,
      plateNumber: plateNumber.toUpperCase(),
      entryTime: now, // Unknown entry time
      exitTime: now,
      barcode: transactionId,
      status: 'PAID',
      totalAmount: this.pricingConfig.lostTicketFee.toNumber(),
      paymentMethod: 'EFECTIVO',
      paidAt: now,
      operatorId
    };

    this.tickets.set(transactionId, lostTicket);

    // Record transaction
    const transaction: ParkingTransaction = {
      id: transactionId,
      type: 'LOST_TICKET',
      ticketId: lostTicket.id,
      amount: this.pricingConfig.lostTicketFee,
      paymentMethod: 'EFECTIVO',
      timestamp: now,
      operatorId,
      description: i18n.t('transaction.lost_ticket_fee', {
        plate: plateNumber
      })
    };

    this.transactions.push(transaction);

    const paymentResult: PaymentResult = {
      success: true,
      transactionId,
      totalAmount: this.pricingConfig.lostTicketFee,
      amountPaid,
      change,
      receipt: {
        ticketNumber: lostTicket.id,
        plateNumber: lostTicket.plateNumber,
        entryTime: now,
        exitTime: now,
        durationMinutes: 0,
        totalAmount: this.pricingConfig.lostTicketFee,
        paymentMethod: 'EFECTIVO',
        change
      }
    };

    this.emit('lostTicketProcessed', paymentResult);
    return paymentResult;
  }

  public async validatePensionCustomer(customer: PensionCustomer): Promise<{
    isValid: boolean;
    reason?: string;
    daysRemaining?: number;
  }> {
    const now = new Date();
    const endDate = new Date(customer.endDate);

    if (!customer.isActive) {
      return {
        isValid: false,
        reason: i18n.t('pension.inactive_customer')
      };
    }

    if (endDate < now) {
      const daysExpired = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isValid: false,
        reason: i18n.t('pension.expired_customer', { days: daysExpired })
      };
    }

    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isValid: true,
      daysRemaining
    };
  }

  public getPricingConfig(): PricingConfig {
    return { ...this.pricingConfig };
  }

  public updatePricingConfig(updates: Partial<PricingConfig>): void {
    this.pricingConfig = { ...this.pricingConfig, ...updates };
    this.emit('pricingConfigUpdated', this.pricingConfig);
  }

  public getTransactionHistory(limit = 100): ParkingTransaction[] {
    return this.transactions
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async getTicketsByDateRange(startDate: Date, endDate: Date): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => {
        const entryTime = new Date(ticket.entryTime);
        return entryTime >= startDate && entryTime <= endDate;
      })
      .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return i18n.t('time.minutes_only', { minutes: remainingMinutes });
    } else if (remainingMinutes === 0) {
      return i18n.t('time.hours_only', { hours });
    } else {
      return i18n.t('time.hours_and_minutes', { hours, minutes: remainingMinutes });
    }
  }
}