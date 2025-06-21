import request from 'supertest';

// Mock Prisma client to avoid database dependency
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    ticket: {
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    },
    transaction: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn()
    },
    pricingConfig: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn()
  }))
}));

// Mock hardware services
jest.mock('../services/scanner/barcode-scanner.service');
jest.mock('../services/printer/thermal-printer.service');

import app from '../app';

describe('Express API - Basic Tests', () => {
  describe('Health Check', () => {
    it('should respond to health check endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('normalmente');
      expect(response.body.services).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return Spanish 404 message for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown/endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENDPOINT_NOT_FOUND');
      expect(response.body.error.message).toContain('no encontrado');
      expect(response.body.error.message).toContain('/api/unknown/endpoint');
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiting configured', async () => {
      // Make a request to check headers
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Rate limit headers should be present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS configured', async () => {
      const response = await request(app)
        .options('/health')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('JSON Parsing', () => {
    it('should parse JSON requests', async () => {
      const response = await request(app)
        .post('/api/parking/entry')
        .send({ test: 'data' })
        .expect(400); // Will fail validation but should parse JSON

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Spanish Error Messages', () => {
    it('should return validation errors in Spanish', async () => {
      const response = await request(app)
        .post('/api/parking/entry')
        .send({}) // Empty request to trigger validation
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('inválidos');
    });
  });
});