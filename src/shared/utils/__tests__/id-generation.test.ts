/**
 * ID Generation Tests
 * 
 * Tests for thread-safe, collision-resistant ID generation utilities.
 */

import { 
  IdGenerator, 
  generateTicketNumber, 
  generateTransactionId, 
  generateLostTicketId,
  generateBarcode,
  withRetry,
  withAtomicRetry,
  DEFAULT_RETRY_CONFIG
} from '../id-generation';
import { performance } from 'perf_hooks';

describe('ID Generation Utilities', () => {
  let idGenerator: IdGenerator;

  beforeEach(() => {
    idGenerator = IdGenerator.getInstance();
    idGenerator.resetCounters();
  });

  describe('UUID Generation', () => {
    test('should generate valid UUID v4', () => {
      const uuid = idGenerator.generateUUID();
      
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique UUIDs', () => {
      const uuids = Array.from({ length: 1000 }, () => idGenerator.generateUUID());
      const uniqueUuids = new Set(uuids);
      
      expect(uniqueUuids.size).toBe(1000);
    });
  });

  describe('NanoID Generation', () => {
    test('should generate nanoid with default length', () => {
      const nanoId = idGenerator.generateNanoId();
      
      expect(nanoId).toHaveLength(21);
      expect(nanoId).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    test('should generate nanoid with custom length', () => {
      const nanoId = idGenerator.generateNanoId(10);
      
      expect(nanoId).toHaveLength(10);
    });

    test('should generate unique nanoids', () => {
      const nanoIds = Array.from({ length: 1000 }, () => idGenerator.generateNanoId());
      const uniqueNanoIds = new Set(nanoIds);
      
      expect(uniqueNanoIds.size).toBe(1000);
    });
  });

  describe('Human-Readable ID Generation', () => {
    test('should generate human-readable ID with prefix', () => {
      const id = idGenerator.generateHumanReadableId('TEST');
      
      expect(id).toMatch(/^TEST-\d{8}-\d{3}$/);
    });

    test('should handle sequence increment for same timestamp', () => {
      // Override Date.now to simulate same timestamp
      const originalNow = Date.now;
      const fixedTimestamp = 1234567890123;
      Date.now = jest.fn(() => fixedTimestamp);

      const id1 = idGenerator.generateHumanReadableId('TEST');
      const id2 = idGenerator.generateHumanReadableId('TEST');
      const id3 = idGenerator.generateHumanReadableId('TEST');

      expect(id1).toBe('TEST-67890123-000');
      expect(id2).toBe('TEST-67890123-001');
      expect(id3).toBe('TEST-67890123-002');

      // Restore Date.now
      Date.now = originalNow;
    });

    test('should reset sequence for new timestamp', async () => {
      const id1 = idGenerator.generateHumanReadableId('TEST');
      
      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const id2 = idGenerator.generateHumanReadableId('TEST');
      
      // Both should end with -000 (sequence reset)
      expect(id1).toMatch(/-000$/);
      expect(id2).toMatch(/-000$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Specific ID Generators', () => {
    test('should generate ticket numbers', () => {
      const ticketNumber = generateTicketNumber();
      
      expect(ticketNumber).toMatch(/^T-\d{8}-\d{3}$/);
    });

    test('should generate transaction IDs', () => {
      const transactionId = generateTransactionId();
      
      expect(transactionId).toMatch(/^TXN-[A-Za-z0-9_-]{12}$/);
    });

    test('should generate lost ticket IDs', () => {
      const lostTicketId = generateLostTicketId();
      
      expect(lostTicketId).toMatch(/^L-\d{8}-\d{3}$/);
    });

    test('should generate barcodes', () => {
      const barcode = generateBarcode('T-12345678-000', 'ABC-123');
      
      expect(barcode).toBe('T-12345678-000-ABC-123');
    });
  });

  describe('Sequence-Based Generation', () => {
    test('should generate sequence IDs with counter', () => {
      const id1 = idGenerator.generateSequenceId('SEQ');
      const id2 = idGenerator.generateSequenceId('SEQ');
      const id3 = idGenerator.generateSequenceId('SEQ');

      expect(id1).toMatch(/^SEQ-[a-z0-9]+-0001$/);
      expect(id2).toMatch(/^SEQ-[a-z0-9]+-0002$/);
      expect(id3).toMatch(/^SEQ-[a-z0-9]+-0003$/);
    });

    test('should maintain separate counters for different prefixes', () => {
      const id1 = idGenerator.generateSequenceId('A');
      const id2 = idGenerator.generateSequenceId('B');
      const id3 = idGenerator.generateSequenceId('A');

      expect(id1).toMatch(/-0001$/);
      expect(id2).toMatch(/-0001$/);
      expect(id3).toMatch(/-0002$/);
    });
  });

  describe('Concurrency Testing', () => {
    test('should handle concurrent ID generation without collisions', async () => {
      const promises = Array.from({ length: 100 }, async (_, i) => {
        // Add small random delays to simulate real concurrency
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return {
          ticket: generateTicketNumber(),
          transaction: generateTransactionId(),
          lost: generateLostTicketId()
        };
      });

      const results = await Promise.all(promises);
      
      // Check ticket numbers for uniqueness
      const ticketNumbers = results.map(r => r.ticket);
      const uniqueTickets = new Set(ticketNumbers);
      expect(uniqueTickets.size).toBe(100);

      // Check transaction IDs for uniqueness
      const transactionIds = results.map(r => r.transaction);
      const uniqueTransactions = new Set(transactionIds);
      expect(uniqueTransactions.size).toBe(100);

      // Check lost ticket IDs for uniqueness
      const lostTicketIds = results.map(r => r.lost);
      const uniqueLostTickets = new Set(lostTicketIds);
      expect(uniqueLostTickets.size).toBe(100);
    });

    test('should maintain performance under load', async () => {
      const startTime = performance.now();
      
      const promises = Array.from({ length: 1000 }, () => generateTicketNumber());
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      
      // All should be unique
      const unique = new Set(results);
      expect(unique.size).toBe(1000);
    });
  });

  describe('Retry Logic', () => {
    test('should retry operation on transient failure', async () => {
      let attempts = 0;
      const mockOperation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('unique constraint failed');
        }
        return 'success';
      });

      const result = await withRetry(mockOperation, {
        maxAttempts: 5,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    test('should fail after max attempts', async () => {
      const mockOperation = jest.fn(async () => {
        throw new Error('unique constraint failed');
      });

      await expect(withRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false
      })).rejects.toThrow('unique constraint failed');

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const mockOperation = jest.fn(async () => {
        throw new Error('validation error');
      });

      await expect(withRetry(mockOperation)).rejects.toThrow('validation error');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    test('should calculate exponential backoff with jitter', async () => {
      const delays: number[] = [];
      const originalSetTimeout = setTimeout;
      
      // Mock setTimeout to capture delays
      (global as any).setTimeout = jest.fn((callback: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for test
      });

      const mockOperation = jest.fn(async () => {
        throw new Error('connection timeout');
      });

      await expect(withRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        jitter: true
      })).rejects.toThrow();

      // Should have 2 delays (3 attempts - 1)
      expect(delays).toHaveLength(2);
      
      // First delay should be around 100ms (with jitter: 50-100ms)
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThanOrEqual(100);
      
      // Second delay should be around 200ms (with jitter: 100-200ms)
      expect(delays[1]).toBeGreaterThanOrEqual(100);
      expect(delays[1]).toBeLessThanOrEqual(200);

      // Restore setTimeout
      (global as any).setTimeout = originalSetTimeout;
    });
  });

  describe('Atomic Transaction Wrapper', () => {
    test('should wrap transaction with retry logic', async () => {
      let attempts = 0;
      const mockPrisma = {
        $transaction: jest.fn(async (operation: Function) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('unique constraint failed');
          }
          return operation({});
        })
      };

      const result = await withAtomicRetry(
        mockPrisma,
        async (tx) => 'transaction success',
        {
          maxAttempts: 3,
          baseDelay: 10,
          maxDelay: 100,
          jitter: false
        }
      );

      expect(result).toBe('transaction success');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Singleton Pattern', () => {
    test('should maintain singleton instance', () => {
      const instance1 = IdGenerator.getInstance();
      const instance2 = IdGenerator.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should maintain state across calls', () => {
      const generator1 = IdGenerator.getInstance();
      generator1.generateSequenceId('TEST'); // Counter = 1
      
      const generator2 = IdGenerator.getInstance();
      const id = generator2.generateSequenceId('TEST'); // Should be counter = 2
      
      expect(id).toMatch(/-0002$/);
    });
  });
});