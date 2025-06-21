/**
 * Administration API Test Suite
 * Comprehensive TDD tests for admin dashboard, reporting, and system management
 */

import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import { Money } from '../../shared/utils/money';
import { i18n } from '../../shared/localization';

const prisma = new PrismaClient();

describe('Administration API Endpoints', () => {
  let adminToken: string;
  let operatorToken: string;
  let testOperatorId: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Clean test database
    await prisma.auditLog.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.cashRegister.deleteMany();
    await prisma.admin.deleteMany();
    
    // Create test admin user
    const testAdmin = await prisma.admin.create({
      data: {
        email: 'admin@test.com',
        password: '$2b$10$hashedpassword', // Mock hashed password
        name: 'Test Administrator',
        role: 'ADMIN',
        isActive: true
      }
    });
    testAdminId = testAdmin.id;

    // Create test operator user
    const testOperator = await prisma.admin.create({
      data: {
        email: 'operator@test.com',
        password: '$2b$10$hashedpassword',
        name: 'Test Operator',
        role: 'MANAGER',
        isActive: true
      }
    });
    testOperatorId = testOperator.id;

    // Mock JWT tokens (in real implementation, these would be generated properly)
    adminToken = 'Bearer mock-admin-token';
    operatorToken = 'Bearer mock-operator-token';

    // Create test data for reports
    await createTestReportData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestReportData() {
    // Create pricing configuration
    const pricing = await prisma.pricingConfig.create({
      data: {
        minimumHours: 1,
        minimumRate: new Money('25.00').toNumber(),
        incrementMinutes: 15,
        incrementRate: new Money('5.00').toNumber(),
        monthlyRate: new Money('800.00').toNumber(),
        lostTicketFee: new Money('150.00').toNumber(),
        isActive: true
      }
    });

    // Create cash register for today
    const cashRegister = await prisma.cashRegister.create({
      data: {
        openingBalance: new Money('500.00').toNumber(),
        currentBalance: new Money('750.00').toNumber(),
        operatorId: testOperatorId,
        status: 'OPEN',
        shiftStart: new Date()
      }
    });

    // Create test tickets and transactions
    const testTicket1 = await prisma.ticket.create({
      data: {
        id: 'TEST-001',
        plateNumber: 'ABC-123',
        barcode: 'TEST-001-ABC-123',
        entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        exitTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        totalAmount: new Money('35.00').toNumber(),
        status: 'PAID',
        paidAt: new Date(Date.now() - 30 * 60 * 1000),
        operatorId: testOperatorId
      }
    });

    const testTicket2 = await prisma.ticket.create({
      data: {
        id: 'TEST-002',
        plateNumber: 'XYZ-789',
        barcode: 'TEST-002-XYZ-789',
        entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        exitTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        totalAmount: new Money('50.00').toNumber(),
        status: 'PAID',
        paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        operatorId: testOperatorId
      }
    });

    // Create transactions
    await prisma.transaction.create({
      data: {
        type: 'PARKING',
        amount: new Money('35.00').toNumber(),
        description: 'Pago de estacionamiento',
        ticketId: testTicket1.id,
        operatorId: testOperatorId
      }
    });

    await prisma.transaction.create({
      data: {
        type: 'PARKING',
        amount: new Money('50.00').toNumber(),
        description: 'Pago de estacionamiento',
        ticketId: testTicket2.id,
        operatorId: testOperatorId
      }
    });

    // Create audit log entries
    await prisma.auditLog.create({
      data: {
        entityType: 'Ticket',
        entityId: testTicket1.id,
        action: 'PAYMENT_PROCESSED',
        newValue: { amount: '35.00', status: 'PAID' },
        performedBy: testOperatorId,
        ticketId: testTicket1.id
      }
    });
  }

  describe('GET /api/admin/dashboard', () => {
    it('should return real-time dashboard metrics with Spanish formatting', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      
      const metrics = response.body.data.metrics;
      expect(metrics).toHaveProperty('activeVehicles');
      expect(metrics).toHaveProperty('todayRevenue');
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('averageDuration');
      expect(metrics).toHaveProperty('peakHours');
      
      // Verify Spanish formatting
      expect(metrics.todayRevenue).toMatch(/\$\d+\.\d{2} pesos/);
      expect(metrics.averageDuration).toMatch(/\d+ horas?|\d+ minutos?/);
      
      // Verify message in Spanish
      expect(response.body.data.message).toMatch(/métricas del panel|dashboard|tiempo real/i);
    });

    it('should include hardware status in dashboard metrics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.data.metrics).toHaveProperty('hardwareStatus');
      const hardware = response.body.data.metrics.hardwareStatus;
      
      expect(hardware).toHaveProperty('printer');
      expect(hardware).toHaveProperty('scanner');
      expect(hardware.printer).toHaveProperty('status');
      expect(hardware.scanner).toHaveProperty('status');
    });

    it('should reject unauthorized access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', operatorToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(response.body.error.message).toMatch(/permisos insuficientes|acceso denegado/i);
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('GET /api/admin/reports/daily', () => {
    it('should return daily revenue report with Money class precision', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/admin/reports/daily?date=${today}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      
      const report = response.body.data.report;
      expect(report).toHaveProperty('date');
      expect(report).toHaveProperty('revenue');
      expect(report).toHaveProperty('transactions');
      expect(report).toHaveProperty('averageDuration');
      expect(report).toHaveProperty('peakHours');
      expect(report).toHaveProperty('vehicleCount');
      
      // Verify Money class formatting
      expect(report.revenue.total).toMatch(/\$\d+\.\d{2} pesos/);
      expect(report.revenue.cash).toMatch(/\$\d+\.\d{2} pesos/);
      
      // Verify Spanish labels
      expect(response.body.data.message).toMatch(/reporte diario|informe del día/i);
    });

    it('should handle date range filtering with Mexico City timezone', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/admin/reports/daily?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.report).toHaveProperty('dateRange');
      expect(response.body.data.report.dateRange.start).toBeDefined();
      expect(response.body.data.report.dateRange.end).toBeDefined();
    });

    it('should provide CSV export option', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/admin/reports/daily?date=${today}&format=csv`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
      
      // Verify CSV contains Spanish headers
      expect(response.text).toMatch(/Fecha|Ingresos|Transacciones|Duración/);
    });
  });

  describe('GET /api/admin/reports/monthly', () => {
    it('should return monthly trend analysis with Money class totals', async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const response = await request(app)
        .get(`/api/admin/reports/monthly?month=${currentMonth}&year=${currentYear}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      
      const report = response.body.data.report;
      expect(report).toHaveProperty('month');
      expect(report).toHaveProperty('year');
      expect(report).toHaveProperty('totalRevenue');
      expect(report).toHaveProperty('dailyAverages');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('topDays');
      
      // Verify Money class precision in totals
      expect(report.totalRevenue).toMatch(/\$\d+\.\d{2} pesos/);
      expect(report.dailyAverages.revenue).toMatch(/\$\d+\.\d{2} pesos/);
      
      // Verify Spanish formatting
      expect(response.body.data.message).toMatch(/reporte mensual|informe del mes/i);
    });

    it('should include trend analysis and comparisons', async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const response = await request(app)
        .get(`/api/admin/reports/monthly?month=${currentMonth}&year=${currentYear}`)
        .set('Authorization', adminToken)
        .expect(200);

      const trends = response.body.data.report.trends;
      expect(trends).toHaveProperty('revenueGrowth');
      expect(trends).toHaveProperty('transactionGrowth');
      expect(trends).toHaveProperty('averageDurationChange');
      
      // Verify percentage formatting in Spanish
      if (trends.revenueGrowth) {
        expect(trends.revenueGrowth).toMatch(/[\+\-]?\d+\.\d+%/);
      }
    });
  });

  describe('GET /api/admin/audit', () => {
    it('should return searchable audit log with Spanish descriptions', async () => {
      const response = await request(app)
        .get('/api/admin/audit?limit=10')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('auditLog');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('pagination');
      
      const auditEntries = response.body.data.auditLog;
      expect(Array.isArray(auditEntries)).toBe(true);
      
      if (auditEntries.length > 0) {
        const entry = auditEntries[0];
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('performedBy');
        expect(entry).toHaveProperty('entityType');
        
        // Verify Spanish descriptions
        expect(entry.description).toMatch(/procesado|creado|actualizado|eliminado/i);
      }
    });

    it('should support filtering by entity type and date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      
      const response = await request(app)
        .get(`/api/admin/audit?entityType=Ticket&startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters).toHaveProperty('entityType', 'Ticket');
      expect(response.body.data.filters).toHaveProperty('dateRange');
    });

    it('should support search functionality with Spanish terms', async () => {
      const response = await request(app)
        .get('/api/admin/audit?search=pago')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('searchTerm', 'pago');
      
      // Verify search results contain Spanish terms
      if (response.body.data.auditLog.length > 0) {
        const descriptions = response.body.data.auditLog.map((entry: any) => entry.description);
        expect(descriptions.some((desc: string) => desc.toLowerCase().includes('pago'))).toBe(true);
      }
    });
  });

  describe('GET /api/admin/health', () => {
    it('should return comprehensive system health status', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('systemHealth');
      
      const health = response.body.data.systemHealth;
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('hardware');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('uptime');
      
      // Verify database health
      expect(health.database).toHaveProperty('status');
      expect(health.database).toHaveProperty('connectionCount');
      expect(health.database).toHaveProperty('responseTime');
      
      // Verify hardware status with Spanish descriptions
      expect(health.hardware.printer).toHaveProperty('status');
      expect(health.hardware.scanner).toHaveProperty('status');
      expect(health.hardware.printer.description).toMatch(/conectada|desconectada|error/i);
      expect(health.hardware.scanner.description).toMatch(/listo|ocupado|error/i);
    });

    it('should include service monitoring and performance metrics', async () => {
      const response = await request(app)
        .get('/api/admin/health')
        .set('Authorization', adminToken)
        .expect(200);

      const services = response.body.data.systemHealth.services;
      expect(services).toHaveProperty('api');
      expect(services).toHaveProperty('auth');
      expect(services).toHaveProperty('localization');
      
      expect(services.api).toHaveProperty('status');
      expect(services.api).toHaveProperty('responseTime');
      expect(services.localization).toHaveProperty('loadedTranslations');
    });
  });

  describe('POST /api/admin/operators', () => {
    it('should create new operator with Spanish validation', async () => {
      const newOperator = {
        email: 'nuevo.operador@test.com',
        name: 'Nuevo Operador',
        role: 'MANAGER',
        password: 'securePassword123'
      };

      const response = await request(app)
        .post('/api/admin/operators')
        .set('Authorization', adminToken)
        .send(newOperator)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('operator');
      expect(response.body.data.operator).toHaveProperty('id');
      expect(response.body.data.operator.email).toBe(newOperator.email);
      expect(response.body.data.operator.name).toBe(newOperator.name);
      
      // Verify Spanish success message
      expect(response.body.data.message).toMatch(/operador creado|usuario registrado/i);
    });

    it('should validate email format with Spanish error messages', async () => {
      const invalidOperator = {
        email: 'invalid-email',
        name: 'Test Operator',
        role: 'MANAGER',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/admin/operators')
        .set('Authorization', adminToken)
        .send(invalidOperator)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toMatch(/formato de correo|email inválido/i);
    });

    it('should prevent duplicate email addresses', async () => {
      const duplicateOperator = {
        email: 'admin@test.com', // Already exists
        name: 'Duplicate Operator',
        role: 'MANAGER',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/admin/operators')
        .set('Authorization', adminToken)
        .send(duplicateOperator)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
      expect(response.body.error.message).toMatch(/email ya existe|correo duplicado/i);
    });
  });

  describe('GET /api/admin/operators', () => {
    it('should list all operators with Spanish formatting', async () => {
      const response = await request(app)
        .get('/api/admin/operators')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('operators');
      expect(response.body.data).toHaveProperty('total');
      
      const operators = response.body.data.operators;
      expect(Array.isArray(operators)).toBe(true);
      
      if (operators.length > 0) {
        const operator = operators[0];
        expect(operator).toHaveProperty('id');
        expect(operator).toHaveProperty('email');
        expect(operator).toHaveProperty('name');
        expect(operator).toHaveProperty('role');
        expect(operator).toHaveProperty('isActive');
        expect(operator).toHaveProperty('lastLogin');
        expect(operator).not.toHaveProperty('password'); // Ensure password is not exposed
        
        // Verify Spanish role translations
        if (operator.roleDisplay) {
          expect(operator.roleDisplay).toMatch(/administrador|operador|gerente/i);
        }
      }
    });

    it('should support pagination and filtering', async () => {
      const response = await request(app)
        .get('/api/admin/operators?page=1&limit=5&role=MANAGER')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 5);
      expect(response.body.data.pagination).toHaveProperty('total');
    });
  });

  describe('PUT /api/admin/operators/:id', () => {
    it('should update operator information with Spanish validation', async () => {
      const updateData = {
        name: 'Operador Actualizado',
        role: 'ADMIN',
        isActive: true
      };

      const response = await request(app)
        .put(`/api/admin/operators/${testOperatorId}`)
        .set('Authorization', adminToken)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.operator.name).toBe(updateData.name);
      expect(response.body.data.operator.role).toBe(updateData.role);
      expect(response.body.data.message).toMatch(/actualizado|modificado/i);
    });

    it('should handle non-existent operator IDs', async () => {
      const response = await request(app)
        .put('/api/admin/operators/non-existent-id')
        .set('Authorization', adminToken)
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OPERATOR_NOT_FOUND');
      expect(response.body.error.message).toMatch(/operador no encontrado|usuario no existe/i);
    });
  });

  describe('Error Handling and Spanish Localization', () => {
    it('should handle server errors with Spanish messages', async () => {
      // Test endpoint that might cause server error
      const response = await request(app)
        .get('/api/admin/dashboard?invalid=true')
        .set('Authorization', adminToken);

      if (response.status === 500) {
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toMatch(/error del servidor|error interno/i);
      }
    });

    it('should provide consistent Spanish error formatting across all endpoints', async () => {
      const endpoints = [
        '/api/admin/dashboard',
        '/api/admin/reports/daily',
        '/api/admin/reports/monthly',
        '/api/admin/audit',
        '/api/admin/health',
        '/api/admin/operators'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401); // No authorization

        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');
        
        // Verify timestamp is ISO format
        expect(response.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });
});