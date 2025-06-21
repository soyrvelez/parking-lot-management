import request from 'supertest';
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';

// Mock Prisma with realistic responses
const mockTicketData = {
  id: 'T-123456',
  plateNumber: 'ABC-123',
  entryTime: new Date('2024-06-15T10:00:00Z'),
  status: 'ACTIVE',
  barcode: 'T-123456-ABC-123',
  vehicleType: 'car'
};

const mockPricingConfig = {
  minimumHours: 1,
  minimumRate: 25.00,
  incrementMinutes: 15,
  incrementRate: 5.00,
  dailySpecialHours: 8,
  dailySpecialRate: 100.00,
  monthlyRate: 800.00,
  lostTicketFee: 150.00
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    ticket: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(5)
    },
    transaction: {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 250.50 } })
    },
    pricingConfig: {
      findFirst: jest.fn().mockResolvedValue(mockPricingConfig)
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
  }))
}));

// Mock hardware services
const mockPrinterService = {
  printEntryTicket: jest.fn().mockResolvedValue(true),
  printPaymentReceipt: jest.fn().mockResolvedValue(true),
  addToPrintQueue: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ connected: true, online: true })
};

const mockScannerService = {
  getStatus: jest.fn().mockReturnValue({ connected: true, ready: true })
};

jest.mock('../services/scanner/barcode-scanner.service', () => ({
  BarcodeScannerService: jest.fn().mockImplementation(() => mockScannerService)
}));

jest.mock('../services/printer/thermal-printer.service', () => ({
  ThermalPrinterService: jest.fn().mockImplementation(() => mockPrinterService)
}));

import app from '../app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Complete Parking Workflow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Parking Workflow: Entry → Calculate → Payment → Exit', () => {
    let ticketNumber: string;
    
    it('Step 1: Vehicle Entry - should create entry ticket successfully', async () => {
      // Mock no existing ticket
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock ticket creation
      (prisma.ticket.create as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456'
      });

      const entryData = {
        plateNumber: 'ABC-123',
        vehicleType: 'car',
        operatorId: 'OP001',
        notes: 'Test vehicle entry'
      };

      const response = await request(app)
        .post('/api/parking/entry')
        .send(entryData)
        .expect(201);

      // Validate response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data.plateNumber).toBe('ABC-123');
      expect(response.body.data.ticketNumber).toMatch(/^T-\d{6}$/);
      expect(response.body.data.barcode).toContain('ABC-123');
      expect(response.body.data.estimatedFee).toContain('$25.00 pesos');
      expect(response.body.data.message).toBe(i18n.t('parking.entry_successful'));

      // Verify database calls
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { plateNumber: 'ABC-123', status: 'ACTIVE' }
      });
      expect(prisma.ticket.create).toHaveBeenCalled();
      
      // Verify printer integration
      expect(mockPrinterService.printEntryTicket).toHaveBeenCalledWith({
        ticketNumber: expect.stringMatching(/^T-\d{6}$/),
        plateNumber: 'ABC-123',
        entryTime: expect.any(Date),
        barcode: expect.stringContaining('ABC-123'),
        estimatedFee: '$25.00 pesos'
      });

      ticketNumber = response.body.data.ticketNumber;
    });

    it('Step 2: Fee Calculation - should calculate parking fee accurately', async () => {
      // Mock finding the ticket (1.5 hours parked)
      const exitTime = new Date('2024-06-15T11:30:00Z'); // 1.5 hours after entry
      
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456'
      });

      const calculateData = {
        ticketNumber: 'T-123456',
        barcode: 'T-123456-ABC-123',
        exitTime: exitTime.toISOString()
      };

      const response = await request(app)
        .post('/api/parking/calculate')
        .send(calculateData)
        .expect(200);

      // Validate calculation accuracy
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticketNumber).toBe('T-123456');
      expect(response.body.data.plateNumber).toBe('ABC-123');
      expect(response.body.data.duration).toContain('1 hora 30 minutos');
      
      // Verify pricing calculation (1 hour minimum + 2 x 15-min increments)
      const expectedTotal = Money.fromNumber(25).add(Money.fromNumber(10)); // $35.00
      expect(response.body.data.pricing.total).toBe(expectedTotal.formatPesos());
      expect(response.body.data.pricing.minimumCharge).toBe('$25.00 pesos');
      expect(response.body.data.paymentRequired).toBe(true);

      // Verify Spanish messages
      expect(response.body.data.message).toContain('Pago requerido: $35.00 pesos');
    });

    it('Step 3: Payment Processing - should process cash payment with change', async () => {
      // Mock ticket for payment
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456'
      });

      // Mock successful payment update
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456',
        status: 'PAID',
        totalAmount: 35.00,
        paidAt: new Date(),
        exitTime: new Date('2024-06-15T11:30:00Z')
      });

      const paymentData = {
        ticketNumber: 'T-123456',
        barcode: 'T-123456-ABC-123',
        cashReceived: 50.00,
        operatorId: 'OP001',
        paymentMethod: 'efectivo'
      };

      const response = await request(app)
        .post('/api/parking/payment')
        .send(paymentData)
        .expect(200);

      // Validate payment response
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticketNumber).toBe('T-123456');
      expect(response.body.data.totalAmount).toBe('$35.00 pesos');
      expect(response.body.data.cashReceived).toBe('$50.00 pesos');
      expect(response.body.data.changeGiven).toBe('$15.00 pesos');
      expect(response.body.data.message).toBe(i18n.t('parking.payment_successful'));

      // Verify denomination breakdown
      expect(response.body.data.denominations).toBeDefined();
      
      // Verify receipt printing
      expect(mockPrinterService.printPaymentReceipt).toHaveBeenCalledWith({
        ticketNumber: 'T-123456',
        plateNumber: 'ABC-123',
        entryTime: expect.any(Date),
        exitTime: expect.any(Date),
        totalAmount: 35.00,
        cashReceived: 50.00,
        change: 15.00,
        paymentMethod: 'efectivo',
        durationMinutes: 90
      });

      // Verify database transaction
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('Step 4: Exit Authorization - should authorize exit for paid ticket', async () => {
      // Mock paid ticket
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456',
        status: 'PAID',
        totalAmount: 35.00,
        paidAt: new Date('2024-06-15T11:25:00Z'),
        exitTime: new Date('2024-06-15T11:30:00Z')
      });

      // Mock exit update
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456',
        status: 'COMPLETED',
        exitTime: new Date()
      });

      const exitData = {
        ticketNumber: 'T-123456',
        barcode: 'T-123456-ABC-123',
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/exit')
        .send(exitData)
        .expect(200);

      // Validate exit authorization
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticketNumber).toBe('T-123456');
      expect(response.body.data.plateNumber).toBe('ABC-123');
      expect(response.body.data.gateOpened).toBe(true);
      expect(response.body.data.amountPaid).toBe('$35.00 pesos');
      expect(response.body.data.message).toBe(i18n.t('parking.exit_successful'));

      // Verify ticket completion
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'T-123456' },
        data: {
          exitTime: expect.any(Date),
          status: 'COMPLETED'
        }
      });
    });
  });

  describe('Error Handling and Business Logic Validation', () => {
    it('should prevent duplicate vehicle entry', async () => {
      // Mock existing active ticket
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({
        id: 'T-000001',
        plateNumber: 'ABC-123',
        status: 'ACTIVE'
      });

      const entryData = {
        plateNumber: 'ABC-123',
        vehicleType: 'car',
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/entry')
        .send(entryData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VEHICLE_ALREADY_INSIDE');
      expect(response.body.error.message).toBe(i18n.t('parking.vehicle_already_inside'));
    });

    it('should reject insufficient payment', async () => {
      // Mock active ticket with calculated fee
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456'
      });

      const paymentData = {
        ticketNumber: 'T-123456',
        cashReceived: 20.00, // Less than required $35.00
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/payment')
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PAYMENT');
      expect(response.body.error.message).toBe(i18n.t('parking.insufficient_payment'));
    });

    it('should reject exit without payment', async () => {
      // Mock unpaid ticket
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        id: 'T-123456',
        status: 'ACTIVE' // Not paid
      });

      const exitData = {
        ticketNumber: 'T-123456',
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/exit')
        .send(exitData)
        .expect(402);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_REQUIRED');
      expect(response.body.error.message).toBe(i18n.t('parking.payment_required_for_exit'));
    });
  });

  describe('Financial Precision Tests', () => {
    it('should maintain decimal precision in complex calculations', async () => {
      // Mock ticket with precise timing (1 hour 45 minutes)
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        entryTime: new Date('2024-06-15T10:00:00Z')
      });

      const calculateData = {
        ticketNumber: 'T-123456',
        exitTime: new Date('2024-06-15T11:45:00Z').toISOString() // 1h 45min
      };

      const response = await request(app)
        .post('/api/parking/calculate')
        .send(calculateData)
        .expect(200);

      // 1 hour minimum ($25) + 3 x 15-min increments ($15) = $40.00
      const expectedTotal = Money.fromNumber(25).add(Money.fromNumber(15));
      expect(response.body.data.pricing.total).toBe('$40.00 pesos');
      
      // Verify no floating point artifacts
      expect(response.body.data.pricing.total).not.toContain('.99');
      expect(response.body.data.pricing.total).not.toContain('.01');
    });

    it('should handle change calculation precisely', async () => {
      // Test precise change calculation
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicketData);
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        ...mockTicketData,
        status: 'PAID',
        totalAmount: 27.50 // Odd amount to test precision
      });

      const paymentData = {
        ticketNumber: 'T-123456',
        cashReceived: 30.00,
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/payment')
        .send(paymentData)
        .expect(200);

      expect(response.body.data.changeGiven).toBe('$2.50 pesos');
      
      // Verify denominations are realistic
      const denominations = response.body.data.denominations;
      expect(denominations).toBeDefined();
      expect(Array.isArray(denominations)).toBe(true);
    });
  });

  describe('Spanish Localization Validation', () => {
    it('should use proper Mexican Spanish terminology', async () => {
      const response = await request(app)
        .get('/api/parking/status')
        .expect(200);

      // Check that responses use Mexican Spanish terms
      expect(JSON.stringify(response.body)).not.toContain('carro'); // Should use 'vehículo'
      expect(JSON.stringify(response.body)).not.toContain('dinero'); // Should use 'efectivo'
      expect(JSON.stringify(response.body)).not.toContain('ticket'); // Should use 'boleto'
    });

    it('should format currency in Mexican peso notation', async () => {
      (prisma.ticket.count as jest.Mock).mockResolvedValue(3);
      (prisma.transaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 125.75 }
      });

      const response = await request(app)
        .get('/api/parking/status')
        .expect(200);

      expect(response.body.data.todayRevenue).toBe('$125.75 pesos');
      expect(response.body.data.todayRevenue).toMatch(/^\$\d+\.\d{2} pesos$/);
    });
  });

  describe('Hardware Integration Validation', () => {
    it('should report hardware status correctly', async () => {
      const response = await request(app)
        .get('/api/parking/status')
        .expect(200);

      expect(response.body.data.hardware).toBeDefined();
      expect(response.body.data.hardware.scanner).toEqual({
        connected: true,
        ready: true
      });
      expect(response.body.data.hardware.printer).toEqual({
        connected: true,
        online: true
      });
    });

    it('should handle printer failures gracefully', async () => {
      // Mock printer failure
      mockPrinterService.printEntryTicket.mockRejectedValue(new Error('Printer offline'));

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ticket.create as jest.Mock).mockResolvedValue(mockTicketData);

      const entryData = {
        plateNumber: 'DEF-456',
        vehicleType: 'car',
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/entry')
        .send(entryData)
        .expect(201); // Should still succeed

      // Entry should succeed even with printer failure
      expect(response.body.success).toBe(true);
      
      // Should have added to print queue for retry
      expect(mockPrinterService.addToPrintQueue).toHaveBeenCalled();
    });
  });
});