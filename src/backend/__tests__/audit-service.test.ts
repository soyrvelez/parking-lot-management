/**
 * Audit Service Test Suite
 * Validates database persistence and security of audit logging
 */

import { PrismaClient } from '@prisma/client';
import { auditService } from '../services/audit/audit.service';

const prisma = new PrismaClient();

describe('Audit Service', () => {
  beforeAll(async () => {
    // Clean audit logs for testing
    await prisma.auditLog.deleteMany({
      where: {
        entityType: { startsWith: 'TEST_' }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Persistence', () => {
    it('should persist audit logs to database', async () => {
      const testEntry = {
        entityType: 'TEST_Ticket',
        entityId: 'test-123',
        action: 'TEST_CREATED',
        performedBy: 'test-operator',
        newValue: { status: 'ACTIVE' }
      };

      await auditService.log(testEntry);

      // Verify persistence
      const savedLog = await prisma.auditLog.findFirst({
        where: {
          entityType: testEntry.entityType,
          entityId: testEntry.entityId
        }
      });

      expect(savedLog).toBeDefined();
      expect(savedLog?.action).toBe(testEntry.action);
      expect(savedLog?.performedBy).toBe(testEntry.performedBy);
      expect(savedLog?.newValue).toEqual(testEntry.newValue);
    });

    it('should handle database errors gracefully', async () => {
      const invalidEntry = {
        entityType: 'TEST_Invalid',
        entityId: null as any, // Invalid: entityId is required
        action: 'TEST_ERROR',
        performedBy: 'test-operator'
      };

      // Should not throw, just log error
      await expect(auditService.log(invalidEntry)).resolves.not.toThrow();
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log cash operations with amount', async () => {
      await auditService.logCashOperation(
        'test-operator-1',
        'CASH_REGISTER_OPENED',
        500.00,
        { shiftStart: new Date() }
      );

      const log = await prisma.auditLog.findFirst({
        where: {
          entityType: 'CashRegister',
          action: 'CASH_REGISTER_OPENED'
        },
        orderBy: { timestamp: 'desc' }
      });

      expect(log).toBeDefined();
      expect(log?.newValue).toEqual({ amount: 500 });
    });

    it('should log ticket operations with status changes', async () => {
      await auditService.logTicketOperation(
        'test-ticket-456',
        'PAYMENT_PROCESSED',
        'test-operator-2',
        'ACTIVE',
        'PAID',
        35.50
      );

      const log = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Ticket',
          entityId: 'test-ticket-456'
        },
        orderBy: { timestamp: 'desc' }
      });

      expect(log).toBeDefined();
      expect(log?.oldValue).toEqual({ status: 'ACTIVE' });
      expect(log?.newValue).toEqual({ status: 'PAID', amount: 35.50 });
    });

    it('should log admin operations with ADMIN_ prefix', async () => {
      await auditService.logAdminOperation(
        'test-admin-1',
        'USER_CREATED',
        'Operator',
        'new-operator-id',
        { email: 'test@example.com', role: 'operator' }
      );

      const log = await prisma.auditLog.findFirst({
        where: {
          action: 'ADMIN_USER_CREATED'
        },
        orderBy: { timestamp: 'desc' }
      });

      expect(log).toBeDefined();
      expect(log?.performedBy).toBe('test-admin-1');
      expect(log?.newValue).toMatchObject({ email: 'test@example.com' });
    });
  });

  describe('Query Functionality', () => {
    beforeAll(async () => {
      // Create test data
      const testLogs = [
        {
          entityType: 'TEST_Query',
          entityId: 'query-1',
          action: 'TEST_ACTION_1',
          performedBy: 'operator-1',
          timestamp: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
        },
        {
          entityType: 'TEST_Query',
          entityId: 'query-2',
          action: 'TEST_ACTION_2',
          performedBy: 'operator-2',
          timestamp: new Date()
        }
      ];

      await prisma.auditLog.createMany({ data: testLogs });
    });

    it('should filter logs by entity type', async () => {
      const logs = await auditService.queryLogs({
        entityType: 'TEST_Query'
      });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.every(log => log.entityType === 'TEST_Query')).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const logs = await auditService.queryLogs({
        entityType: 'TEST_Query',
        startDate: new Date(Date.now() - 1000 * 60 * 30), // Last 30 minutes
        endDate: new Date()
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.some(log => log.action === 'TEST_ACTION_2')).toBe(true);
    });

    it('should respect pagination limits', async () => {
      const logs = await auditService.queryLogs({
        entityType: 'TEST_Query',
        limit: 1
      });

      expect(logs.length).toBe(1);
    });
  });
});