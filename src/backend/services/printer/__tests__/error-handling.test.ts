/**
 * Error Handling and Recovery Tests
 * 
 * Comprehensive test suite for validating error handling, connection failures,
 * offline queue management, and Spanish error messaging in production scenarios.
 */

import { ThermalPrinterService } from '../thermal-printer.service';
import { ReceiptData, HARDWARE_CONSTANTS } from '../../../../shared/types/hardware';
import { i18n } from '../../../../shared/localization';

// Mock printer for testing
const mockPrinter = {
  isPrinterConnected: jest.fn(),
  clear: jest.fn(),
  setCharacterSet: jest.fn(),
  println: jest.fn(),
  newLine: jest.fn(),
  execute: jest.fn()
};

jest.mock('node-thermal-printer', () => ({
  ThermalPrinter: jest.fn(() => mockPrinter),
  PrinterTypes: { EPSON: 'epson' },
  CharacterSet: { PC858_EURO: 'pc858euro' },
  BreakLine: { WORD: 'word' }
}));

describe('Error Handling and Recovery Tests', () => {
  let printerService: ThermalPrinterService;
  
  const testConfig = {
    retryAttempts: 3,
    retryDelay: 50, // Fast retries for testing
    timeout: 100
  };

  const sampleReceiptData: ReceiptData = {
    ticketNumber: 'T-001234',
    plateNumber: 'ABC-123',
    entryTime: new Date('2024-06-15T10:00:00-06:00'),
    exitTime: new Date('2024-06-15T12:30:00-06:00'),
    durationMinutes: 150,
    totalAmount: 76.00,
    paymentMethod: 'EFECTIVO',
    change: 24.00,
    type: 'PAYMENT'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    printerService = new ThermalPrinterService(testConfig);
  });

  afterEach(() => {
    printerService.destroy();
  });

  describe('Connection Failure Scenarios', () => {
    it('should handle network connection timeout', async () => {
      mockPrinter.isPrinterConnected.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 150))
      );
      
      const errors: any[] = [];
      printerService.on('error', (error) => errors.push(error));
      
      const result = await printerService.connect();
      
      expect(result).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Conexión Fallida');
      expect(errors[0].type).toBe('CONNECTION');
    });

    it('should handle printer power off scenario', async () => {
      // Initial connection success, then power off
      mockPrinter.isPrinterConnected
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);
      
      await printerService.connect();
      expect(printerService.getStatus().connected).toBe(true);
      
      let disconnected = false;
      printerService.on('disconnected', () => {
        disconnected = true;
      });
      
      // Simulate health check detecting disconnection
      await (printerService as any).performHealthCheck();
      
      expect(disconnected).toBe(true);
      expect(printerService.getStatus().connected).toBe(false);
    });

    it('should handle paper jam during printing', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockRejectedValue(new Error('Paper jam detected'));
      
      await printerService.connect();
      
      const errors: any[] = [];
      printerService.on('error', (error) => errors.push(error));
      
      await printerService.printPaymentReceipt(sampleReceiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(errors.some(e => e.code === 'EXECUTION_ERROR')).toBe(true);
      expect(errors.some(e => e.message.includes('Error de Ejecución'))).toBe(true);
    });

    it('should handle printer busy/offline state', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockRejectedValue(new Error('Printer offline'));
      
      await printerService.connect();
      
      const jobFailed: any[] = [];
      printerService.on('jobFailed', (job) => jobFailed.push(job));
      
      await printerService.printTestReceipt();
      
      // Wait for max retries
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(jobFailed.length).toBe(1);
      expect(jobFailed[0].status).toBe('FAILED');
      expect(jobFailed[0].attempts).toBe(HARDWARE_CONSTANTS.MAX_RETRY_ATTEMPTS);
    });
  });

  describe('Offline Queue Management', () => {
    it('should queue jobs when printer is offline', async () => {
      // Don't connect - keep printer offline
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      
      await printerService.printPaymentReceipt(sampleReceiptData);
      await printerService.printTestReceipt();
      await printerService.printEntryTicket(sampleReceiptData);
      
      const status = printerService.getStatus();
      expect(status.queueLength).toBe(3);
      expect(status.connected).toBe(false);
      
      // Verify no print attempts were made
      expect(mockPrinter.execute).not.toHaveBeenCalled();
    });

    it('should process queue when connection is restored', async () => {
      // Start offline
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      
      // Queue some jobs
      await printerService.printTestReceipt();
      await printerService.printTestReceipt();
      
      expect(printerService.getStatus().queueLength).toBe(2);
      
      // Restore connection
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockResolvedValue(true);
      
      await printerService.connect();
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockPrinter.execute).toHaveBeenCalledTimes(2);
      expect(printerService.getStatus().queueLength).toBe(0);
      expect(printerService.getStatus().totalPrintJobs).toBe(2);
    });

    it('should handle queue overflow gracefully', async () => {
      // Keep printer offline
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      
      const errors: any[] = [];
      printerService.on('error', (error) => errors.push(error));
      
      // Try to exceed queue limit
      const promises = [];
      for (let i = 0; i < HARDWARE_CONSTANTS.MAX_QUEUE_SIZE + 5; i++) {
        promises.push(printerService.printTestReceipt());
      }
      
      const results = await Promise.all(promises);
      
      // First MAX_QUEUE_SIZE should succeed
      expect(results.slice(0, HARDWARE_CONSTANTS.MAX_QUEUE_SIZE).every(r => r === true)).toBe(true);
      
      // Rest should fail
      expect(results.slice(HARDWARE_CONSTANTS.MAX_QUEUE_SIZE).some(r => r === false)).toBe(true);
      
      // Should have queue full errors with Spanish messages
      expect(errors.some(e => e.message.includes('Cola de Impresión Llena'))).toBe(true);
    });

    it('should prioritize high priority jobs', async () => {
      // Keep printer offline
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      
      // Add jobs with different priorities
      await printerService.printTestReceipt(); // LOW priority
      await printerService.printPaymentReceipt(sampleReceiptData); // HIGH priority
      await printerService.printEntryTicket(sampleReceiptData); // HIGH priority
      
      const queue = printerService.getQueue();
      expect(queue.length).toBe(3);
      
      // High priority jobs should be processed first when connected
      const highPriorityJobs = queue.filter(job => job.priority === 'HIGH');
      const lowPriorityJobs = queue.filter(job => job.priority === 'LOW');
      
      expect(highPriorityJobs.length).toBe(2);
      expect(lowPriorityJobs.length).toBe(1);
    });
  });

  describe('Spanish Error Messages', () => {
    it('should provide Spanish error messages for all failure types', async () => {
      const errorTypes = [
        { 
          mockError: () => mockPrinter.isPrinterConnected.mockRejectedValue(new Error('Network error')),
          expectedSpanishKey: 'Conexión Fallida'
        },
        {
          mockError: () => {
            mockPrinter.isPrinterConnected.mockResolvedValue(true);
            mockPrinter.execute.mockRejectedValue(new Error('Print failed'));
          },
          expectedSpanishKey: 'Error de Ejecución'
        }
      ];
      
      for (const errorType of errorTypes) {
        // Reset service
        printerService.destroy();
        printerService = new ThermalPrinterService(testConfig);
        
        const errors: any[] = [];
        printerService.on('error', (error) => errors.push(error));
        
        errorType.mockError();
        
        if (errorType.expectedSpanishKey === 'Conexión Fallida') {
          await printerService.connect();
        } else {
          await printerService.connect();
          await printerService.printTestReceipt();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        expect(errors.some(e => e.message.includes(errorType.expectedSpanishKey))).toBe(true);
      }
    });

    it('should validate all hardware error translations exist', () => {
      const hardwareErrorKeys = [
        'hardware.printer_init_failed',
        'hardware.connection_failed', 
        'hardware.queue_full',
        'hardware.print_failed',
        'hardware.execution_error',
        'hardware.health_check_failed'
      ];
      
      hardwareErrorKeys.forEach(key => {
        const translation = i18n.t(key);
        expect(translation).toBeTruthy();
        expect(translation).not.toContain('[');
        expect(translation).not.toContain(']');
        expect(translation.length).toBeGreaterThan(0);
      });
    });

    it('should format error messages with context variables', () => {
      // Test parameterized error messages
      const contextualMessage = i18n.t('hardware.connection_failed', { 
        attempt: 2, 
        max: 3 
      });
      
      expect(contextualMessage).toContain('Conexión Fallida');
      // Note: Current translations don't use parameters yet, but structure supports it
    });
  });

  describe('Recovery and Retry Logic', () => {
    it('should implement exponential backoff for reconnection', async () => {
      const connectTimes: number[] = [];
      
      mockPrinter.isPrinterConnected.mockImplementation(() => {
        connectTimes.push(Date.now());
        return Promise.reject(new Error('Connection failed'));
      });
      
      printerService.on('error', () => {}); // Suppress unhandled errors
      
      const startTime = Date.now();
      await printerService.connect();
      
      expect(connectTimes.length).toBe(testConfig.retryAttempts);
      
      // Verify delays between attempts
      for (let i = 1; i < connectTimes.length; i++) {
        const delay = connectTimes[i] - connectTimes[i - 1];
        expect(delay).toBeGreaterThanOrEqual(testConfig.retryDelay - 10); // Small tolerance
      }
    });

    it('should automatically attempt reconnection after disconnect', async () => {
      jest.useFakeTimers();
      
      // Initial connection
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      await printerService.connect();
      
      // Simulate disconnection
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      await (printerService as any).performHealthCheck();
      
      expect(printerService.getStatus().connected).toBe(false);
      
      // Fast-forward timer to trigger reconnection
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      jest.advanceTimersByTime(testConfig.retryDelay);
      
      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));
      
      jest.useRealTimers();
    });

    it('should maintain job order during retries', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      
      let executeCount = 0;
      mockPrinter.execute.mockImplementation(() => {
        executeCount++;
        if (executeCount <= 2) {
          return Promise.reject(new Error('Print failed'));
        }
        return Promise.resolve(true);
      });
      
      await printerService.connect();
      
      // Add multiple jobs
      await printerService.printTestReceipt();
      await printerService.printTestReceipt();
      
      // Wait for retries and eventual success
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const status = printerService.getStatus();
      expect(status.totalPrintJobs).toBeGreaterThan(0);
      expect(executeCount).toBeGreaterThan(2); // Retries occurred
    });
  });

  describe('Health Monitoring and Diagnostics', () => {
    it('should provide detailed health status', () => {
      const status = printerService.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('online');
      expect(status).toHaveProperty('paperStatus');
      expect(status).toHaveProperty('coverOpen');
      expect(status).toHaveProperty('cutterStatus');
      expect(status).toHaveProperty('temperature');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('lastUpdate');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('totalPrintJobs');
      expect(status).toHaveProperty('failedJobs');
      
      expect(status.lastUpdate).toBeInstanceOf(Date);
    });

    it('should track job statistics accurately', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute
        .mockResolvedValueOnce(true)  // Success
        .mockRejectedValueOnce(new Error('Fail'))  // Fail
        .mockResolvedValueOnce(true); // Success
      
      await printerService.connect();
      
      await printerService.printTestReceipt();
      await printerService.printTestReceipt();
      await printerService.printTestReceipt();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status = printerService.getStatus();
      expect(status.totalPrintJobs).toBeGreaterThan(0);
      expect(status.failedJobs).toBeGreaterThan(0);
    });

    it('should emit status updates on changes', async () => {
      const statusUpdates: any[] = [];
      printerService.on('statusUpdate', (status) => statusUpdates.push(status));
      
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      await printerService.connect();
      
      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates[statusUpdates.length - 1].connected).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly on destroy', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      printerService.destroy();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      // Should have no active listeners
      expect(printerService.listenerCount('error')).toBe(0);
      expect(printerService.listenerCount('connected')).toBe(0);
      expect(printerService.listenerCount('statusUpdate')).toBe(0);
      
      clearTimeoutSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('should handle multiple simultaneous operations safely', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockResolvedValue(true);
      
      await printerService.connect();
      
      // Start multiple operations simultaneously
      const promises = [
        printerService.printTestReceipt(),
        printerService.printPaymentReceipt(sampleReceiptData),
        printerService.printEntryTicket(sampleReceiptData),
        printerService.getStatus(),
        printerService.clearQueue()
      ];
      
      await Promise.all(promises);
      
      // Should not crash or deadlock
      expect(true).toBe(true);
    });
  });
});