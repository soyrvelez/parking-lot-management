import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import { Money } from '../../shared/utils/money';

const prisma = new PrismaClient();

// Mock hardware services
jest.mock('../services/scanner/barcode-scanner.service');
jest.mock('../services/printer/thermal-printer.service');

describe('Parking API Endpoints', () => {
  beforeAll(async () => {
    // Ensure test database is clean
    await prisma.ticket.deleteMany();
    await prisma.transaction.deleteMany();
    
    // Create default pricing configuration
    await prisma.pricingConfig.create({
      data: {
        minimumHours: 1,
        minimumRate: 25.00,
        incrementMinutes: 15,
        incrementRate: 5.00,
        dailySpecialHours: 8,
        dailySpecialRate: 100.00,
        monthlyRate: 800.00,
        lostTicketFee: 150.00
      }
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.pricingConfig.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/parking/entry', () => {
    it('should create a new parking entry successfully', async () => {
      const entryData = {
        plateNumber: 'ABC-123',
        vehicleType: 'car',
        operatorId: 'OP001',
        notes: 'Test entry'
      };

      const response = await request(app)
        .post('/api/parking/entry')
        .send(entryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plateNumber).toBe('ABC-123');
      expect(response.body.data.ticketNumber).toMatch(/^T-\d{6}$/);
      expect(response.body.data.barcode).toContain('ABC-123');
      expect(response.body.data.message).toContain('exitosamente');
    });

    it('should reject entry for vehicle already inside', async () => {
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
      expect(response.body.error.message).toContain('ya se encuentra');
    });

    it('should validate plate number format', async () => {
      const entryData = {
        plateNumber: 'INVALID@PLATE',
        vehicleType: 'car',
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/entry')
        .send(entryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/parking/calculate', () => {
    let testTicketNumber: string;

    beforeAll(async () => {
      // Create a test ticket for calculation
      const entryTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const ticket = await prisma.ticket.create({
        data: {
          id: 'T-TEST01',
          plateNumber: 'XYZ-789',
          entryTime,
          status: 'ACTIVE',
          barcode: 'T-TEST01-XYZ-789'
        }
      });
      testTicketNumber = ticket.id;
    });

    it('should calculate parking fee correctly', async () => {
      const calculateData = {
        ticketNumber: testTicketNumber
      };

      const response = await request(app)
        .post('/api/parking/calculate')
        .send(calculateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plateNumber).toBe('XYZ-789');
      expect(response.body.data.pricing.total).toContain('$');
      expect(response.body.data.paymentRequired).toBe(true);
    });

    it('should reject calculation for non-existent ticket', async () => {
      const calculateData = {
        ticketNumber: 'T-FAKE01'
      };

      const response = await request(app)
        .post('/api/parking/calculate')
        .send(calculateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TICKET_NOT_FOUND');
    });
  });

  describe('POST /api/parking/payment', () => {
    let paymentTicketNumber: string;

    beforeAll(async () => {
      // Create another test ticket for payment
      const entryTime = new Date(Date.now() - 1.5 * 60 * 60 * 1000); // 1.5 hours ago
      const ticket = await prisma.ticket.create({
        data: {
          id: 'T-PAY01',
          plateNumber: 'PAY-123',
          entryTime,
          status: 'ACTIVE',
          barcode: 'T-PAY01-PAY-123'
        }
      });
      paymentTicketNumber = ticket.id;
    });

    it('should process payment successfully', async () => {
      const paymentData = {
        ticketNumber: paymentTicketNumber,
        cashReceived: 50.00,
        operatorId: 'OP001',
        paymentMethod: 'efectivo'
      };

      const response = await request(app)
        .post('/api/parking/payment')
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plateNumber).toBe('PAY-123');
      expect(response.body.data.totalAmount).toContain('$');
      expect(response.body.data.changeGiven).toContain('$');
      expect(response.body.data.message).toContain('exitosamente');
    });

    it('should reject insufficient payment', async () => {
      // Create another ticket for insufficient payment test
      const entryTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const ticket = await prisma.ticket.create({
        data: {
          id: 'T-INSUF',
          plateNumber: 'INSUF-01',
          entryTime,
          status: 'ACTIVE',
          barcode: 'T-INSUF-INSUF-01'
        }
      });

      const paymentData = {
        ticketNumber: ticket.id,
        cashReceived: 10.00, // Insufficient amount
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/payment')
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PAYMENT');
    });
  });

  describe('POST /api/parking/exit', () => {
    it('should authorize exit for paid ticket', async () => {
      const exitData = {
        ticketNumber: paymentTicketNumber,
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/exit')
        .send(exitData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.gateOpened).toBe(true);
      expect(response.body.data.message).toContain('autorizada');
    });

    it('should reject exit for unpaid ticket', async () => {
      const exitData = {
        ticketNumber: testTicketNumber, // Still unpaid
        operatorId: 'OP001'
      };

      const response = await request(app)
        .post('/api/parking/exit')
        .send(exitData)
        .expect(402);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYMENT_REQUIRED');
    });
  });

  describe('GET /api/parking/status', () => {
    it('should return current parking lot status', async () => {
      const response = await request(app)
        .get('/api/parking/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activeVehicles).toBeDefined();
      expect(response.body.data.todayRevenue).toBeDefined();
      expect(response.body.data.hardware).toBeDefined();
    });
  });

  describe('Spanish Localization', () => {
    it('should return error messages in Spanish', async () => {
      const response = await request(app)
        .post('/api/parking/entry')
        .send({}) // Empty request to trigger validation
        .expect(400);

      expect(response.body.error.message).toContain('inválidos');
      expect(response.body.error.details[0].message).toContain('requerido');
    });
  });

  describe('Financial Precision', () => {
    it('should maintain decimal precision in calculations', async () => {
      // Create ticket with specific timing for precise calculation
      const entryTime = new Date(Date.now() - 105 * 60 * 1000); // 1 hour 45 minutes ago
      const ticket = await prisma.ticket.create({
        data: {
          id: 'T-PREC01',
          plateNumber: 'PREC-01',
          entryTime,
          status: 'ACTIVE',
          barcode: 'T-PREC01-PREC-01'
        }
      });

      const response = await request(app)
        .post('/api/parking/calculate')
        .send({ ticketNumber: ticket.id })
        .expect(200);

      // Should be $25 (1 hour minimum) + $15 (3 × 15-min increments) = $40
      const total = response.body.data.pricing.total;
      expect(total).toBe('$40.00 pesos');
    });
  });
});