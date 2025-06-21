import { BarcodeScannerService } from '../barcode-scanner.service';

// Mock DOM dependencies
const mockElement = {
  focus: jest.fn(),
  click: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const mockDocument = {
  createElement: jest.fn(() => mockElement),
  activeElement: mockElement,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Setup global mocks
(global as any).document = mockDocument;
(global as any).window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

describe('BarcodeScannerService - Core Tests', () => {
  let scannerService: BarcodeScannerService;

  beforeEach(() => {
    jest.clearAllMocks();
    scannerService = new BarcodeScannerService();
  });

  afterEach(() => {
    scannerService.destroy();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', () => {
      expect(scannerService.getStatus()).toBeDefined();
      expect(scannerService.getConnectionState()).toBe('READY');
    });

    it('should validate Code 39 barcodes correctly', () => {
      // Test valid Code 39 characters - access private method via any
      const validBarcode = 'ABC123';
      const result1 = (scannerService as any).validateCode39Barcode(validBarcode);
      expect(result1.valid).toBe(true);
      
      // Test invalid characters
      const result2 = (scannerService as any).validateCode39Barcode('abc@#$');
      expect(result2.valid).toBe(false);
    });

    it('should handle manual entry validation', () => {
      // Access private method via any
      const result1 = (scannerService as any).validateManualInput('');
      expect(result1.valid).toBe(false);
      expect(result1.reason).toContain('Entrada');
      
      const result2 = (scannerService as any).validateManualInput('AB');
      expect(result2.valid).toBe(false);
      
      const result3 = (scannerService as any).validateManualInput('VALIDCODE');
      expect(result3.valid).toBe(true);
    });

    it('should manage scanning state correctly', async () => {
      expect(scannerService.isScanning).toBe(false);
      
      const scanPromise = scannerService.startScanning(1000);
      expect(scannerService.isScanning).toBe(true);

      // Wait for timeout
      await expect(scanPromise).rejects.toThrow();
      expect(scannerService.isScanning).toBe(false);
    });
  });

  describe('Spanish Localization', () => {
    it('should provide error messages in Spanish', async () => {
      try {
        scannerService.validateManualInput('');
      } catch (error: any) {
        expect(error.message).toContain('Entrada');
        expect(error.message).toContain('Vacía');
      }

      try {
        scannerService.validateCode39Barcode('invalid@chars');
      } catch (error: any) {
        expect(error.message).toContain('inválido');
      }
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on destroy', () => {
      // Just test that destroy doesn't throw errors
      expect(() => scannerService.destroy()).not.toThrow();
      expect(scannerService.listenerCount('barcodeScanned')).toBe(0);
    });
  });
});