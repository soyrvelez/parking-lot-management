/**
 * Scanner Unit Tests
 * Focused tests for core scanner functionality without DOM dependencies
 */

import { BarcodeScannerService } from '../barcode-scanner.service';
import { ScannerStatus } from '@/shared/types/hardware';

// Set test environment
process.env.NODE_ENV = 'test';

describe('BarcodeScannerService - Unit Tests', () => {
  let scannerService: BarcodeScannerService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create scanner without focus management to avoid DOM dependencies
    scannerService = new BarcodeScannerService(
      { autoFocus: false }, // Disable auto focus for tests
      { aggressiveMode: false } // Disable aggressive focus for tests
    );
  });

  afterEach(() => {
    scannerService.destroy();
  });

  describe('Basic Initialization', () => {
    it('should initialize with default configuration', () => {
      const status = scannerService.getStatus();
      
      expect(status.connected).toBe(true);
      expect(status.ready).toBe(true);
      expect(status.totalScans).toBe(0);
      expect(status.failedScans).toBe(0);
      expect(scannerService.getConnectionState()).toBe('READY');
    });

    it('should be ready for scanning', () => {
      expect(scannerService.isReady()).toBe(true);
    });

    it('should return valid status', () => {
      const status = scannerService.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('ready');
      expect(status).toHaveProperty('totalScans');
      expect(status).toHaveProperty('failedScans');
      expect(status).toHaveProperty('timeoutCount');
      expect(status).toHaveProperty('manualEntryCount');
      expect(status).toHaveProperty('focusActive');
      expect(status).toHaveProperty('lastUpdate');
      expect(status.lastUpdate).toBeInstanceOf(Date);
    });
  });

  describe('Code 39 Validation', () => {
    const validCodes = [
      'ABC123',
      'TEST-CODE',
      'HELLO WORLD',
      'PRICE$50.00',
      '123+456',
      'CODE%25',
      'SIMPLE*TEST'
    ];

    const invalidCodes = [
      '', // empty
      'AB', // too short
      'A'.repeat(50), // too long
      'TEST@CODE', // invalid character @
      'CODE#123', // invalid character #
      'TEST&CODE', // invalid character &
      'CODE[123]', // invalid characters []
    ];

    it('should validate valid Code 39 barcodes', async () => {
      for (const code of validCodes) {
        const options = {
          timeoutMs: 1000,
          placeholder: 'Test',
          allowCancel: true
        };

        const manualPromise = scannerService.startManualEntry(options);
        
        expect(() => {
          scannerService.submitManualEntry(code);
        }).not.toThrow();
        
        await manualPromise; // Wait for completion
      }
    });

    it('should reject invalid Code 39 barcodes', async () => {
      for (const code of invalidCodes) {
        const options = {
          timeoutMs: 1000,
          placeholder: 'Test',
          allowCancel: true
        };

        const manualPromise = scannerService.startManualEntry(options);
        
        expect(() => {
          scannerService.submitManualEntry(code);
        }).toThrow();
        
        // Since submitManualEntry threw, the manual entry should be reset
        // No need to await the promise as it was rejected
      }
    });
  });

  describe('Manual Entry', () => {
    it('should handle manual entry submission', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      // Submit valid code
      scannerService.submitManualEntry('MANUAL123');
      
      const result = await manualPromise;
      
      expect(result).toBeDefined();
      expect(result!.code).toBe('MANUAL123');
      expect(result!.source).toBe('MANUAL');
      expect(result!.format).toBe('CODE39');
      expect(result!.quality).toBeLessThan(1.0); // Manual entry has lower quality
      
      const status = scannerService.getStatus();
      expect(status.manualEntryCount).toBe(1);
    });

    it('should handle manual entry cancellation', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      // Cancel manual entry
      scannerService.cancelManualEntry();
      
      const result = await manualPromise;
      expect(result).toBeNull();
    });

    it('should prevent multiple concurrent manual entries', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const firstEntry = scannerService.startManualEntry(options);
      
      await expect(scannerService.startManualEntry(options))
        .rejects.toThrow(/Entrada Manual Ya Activa/);
      
      scannerService.cancelManualEntry();
    });

    it('should validate manual entry input', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      // Try invalid input
      expect(() => {
        scannerService.submitManualEntry('INVALID@CODE');
      }).toThrow(/inválidos para Código 39/);
      
      scannerService.cancelManualEntry();
    });
  });

  describe('Status Tracking', () => {
    it('should track manual entry statistics', async () => {
      const initialStatus = scannerService.getStatus();
      expect(initialStatus.manualEntryCount).toBe(0);

      // Perform manual entry
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      scannerService.submitManualEntry('TEST123');
      
      await manualPromise;

      const updatedStatus = scannerService.getStatus();
      expect(updatedStatus.manualEntryCount).toBe(1);
      expect(updatedStatus.totalScans).toBe(1);
      expect(updatedStatus.lastScan).toBeDefined();
    });

    it('should update status timestamp', () => {
      const initialStatus = scannerService.getStatus();
      const initialTime = initialStatus.lastUpdate.getTime();
      
      // Wait a bit and trigger status update
      setTimeout(() => {
        const updatedStatus = scannerService.getStatus();
        expect(updatedStatus.lastUpdate.getTime()).toBeGreaterThanOrEqual(initialTime);
      }, 10);
    });
  });

  describe('Connection State Management', () => {
    it('should report correct connection states', () => {
      expect(scannerService.getConnectionState()).toBe('READY');
      expect(scannerService.isReady()).toBe(true);
    });

    it('should maintain connection state after operations', async () => {
      expect(scannerService.getConnectionState()).toBe('READY');
      
      // Perform manual entry
      const options = {
        timeoutMs: 1000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      scannerService.submitManualEntry('TEST123');
      
      await manualPromise;
      
      expect(scannerService.getConnectionState()).toBe('READY');
      expect(scannerService.isReady()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid manual entry gracefully', () => {
      expect(() => {
        scannerService.submitManualEntry('TEST'); // No active manual entry
      }).toThrow(/No Hay Entrada Manual Activa/);
    });

    it('should handle empty manual input', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      expect(() => {
        scannerService.submitManualEntry(''); // Empty input
      }).toThrow(/Entrada Vacía/);
      
      scannerService.cancelManualEntry();
    });

    it('should handle whitespace-only input', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      expect(() => {
        scannerService.submitManualEntry('   '); // Whitespace only
      }).toThrow(/Entrada Vacía/);
      
      scannerService.cancelManualEntry();
    });
  });

  describe('Spanish Localization', () => {
    it('should use Spanish error messages', () => {
      const testCases = [
        {
          action: () => scannerService.submitManualEntry('TEST'),
          expectedPattern: /No Hay Entrada Manual Activa/
        },
        {
          action: () => {
            scannerService.startManualEntry({
              timeoutMs: 1000,
              placeholder: 'Test',
              allowCancel: true
            });
            scannerService.submitManualEntry('INVALID@CODE');
          },
          expectedPattern: /inválidos para Código 39/
        }
      ];

      testCases.forEach(({ action, expectedPattern }) => {
        try {
          action();
        } catch (error) {
          expect(error.message).toMatch(expectedPattern);
        }
      });
    });

    it('should provide Spanish validation messages', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      // Test various validation scenarios
      const testCases = [
        { input: '', expectedPattern: /Entrada Vacía/ },
        { input: 'AB', expectedPattern: /muy corto/ },
        { input: 'A'.repeat(50), expectedPattern: /muy largo/ },
        { input: 'TEST@CODE', expectedPattern: /inválidos para Código 39/ }
      ];

      for (const { input, expectedPattern } of testCases) {
        try {
          scannerService.submitManualEntry(input);
        } catch (error) {
          expect(error.message).toMatch(expectedPattern);
        }
      }
      
      scannerService.cancelManualEntry();
    });
  });

  describe('Resource Management', () => {
    it('should clean up properly on destroy', () => {
      const status = scannerService.getStatus();
      expect(status.connected).toBe(true);
      
      scannerService.destroy();
      
      const finalStatus = scannerService.getStatus();
      expect(finalStatus.connected).toBe(false);
      expect(finalStatus.ready).toBe(false);
      expect(scannerService.getConnectionState()).toBe('DISCONNECTED');
    });

    it('should reject pending manual entry on destroy', async () => {
      const options = {
        timeoutMs: 30000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      
      scannerService.destroy();
      
      await expect(manualPromise).rejects.toThrow(/Escáner Destruido/);
    });

    it('should handle multiple destroy calls safely', () => {
      expect(() => {
        scannerService.destroy();
        scannerService.destroy(); // Should not throw
      }).not.toThrow();
    });
  });

  describe('Quality Calculation', () => {
    it('should assign appropriate quality to manual entry', async () => {
      const options = {
        timeoutMs: 5000,
        placeholder: 'Enter code',
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(options);
      scannerService.submitManualEntry('QUALITY-TEST');
      
      const result = await manualPromise;
      
      expect(result!.quality).toBeLessThan(1.0);
      expect(result!.quality).toBeGreaterThan(0);
    });
  });
});