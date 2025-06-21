/**
 * Thermal Printer Service Tests
 * 
 * Comprehensive test suite for Epson TM-T20III integration including:
 * - Connection management with retry logic
 * - Print queue processing  
 * - Spanish receipt formatting
 * - Error handling and recovery
 * - Hardware health monitoring
 */

import { ThermalPrinterService } from '../thermal-printer.service';
import { ReceiptData, PrinterConfig, HARDWARE_CONSTANTS } from '../../../../shared/types/hardware';
import { i18n } from '../../../../shared/localization';

// Mock the node-thermal-printer module
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

describe('ThermalPrinterService', () => {
  let printerService: ThermalPrinterService;
  
  const testConfig: Partial<PrinterConfig> = {
    host: '192.168.1.100',
    port: 9100,
    timeout: 1000,
    retryAttempts: 2,
    retryDelay: 100,
    paperWidth: 32,
    encoding: 'utf8'
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

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultService = new ThermalPrinterService();
      const status = defaultService.getStatus();
      
      expect(status.connected).toBe(false);
      expect(status.queueLength).toBe(0);
      expect(status.totalPrintJobs).toBe(0);
      
      defaultService.destroy();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        host: '192.168.1.200',
        port: 9101,
        paperWidth: 40
      };
      
      const customService = new ThermalPrinterService(customConfig);
      expect(customService).toBeDefined();
      
      customService.destroy();
    });
  });

  describe('Connection Management', () => {
    it('should connect successfully on first attempt', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      
      const result = await printerService.connect();
      
      expect(result).toBe(true);
      expect(mockPrinter.isPrinterConnected).toHaveBeenCalledTimes(1);
      
      const status = printerService.getStatus();
      expect(status.connected).toBe(true);
      expect(status.online).toBe(true);
    });

    it('should retry connection on failure', async () => {
      mockPrinter.isPrinterConnected
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(true);
      
      const result = await printerService.connect();
      
      expect(result).toBe(true);
      expect(mockPrinter.isPrinterConnected).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retry attempts', async () => {
      mockPrinter.isPrinterConnected.mockRejectedValue(new Error('Connection failed'));
      
      // Listen for expected error to prevent unhandled error warning
      printerService.on('error', () => {
        // Expected error - do nothing
      });
      
      const result = await printerService.connect();
      
      expect(result).toBe(false);
      expect(mockPrinter.isPrinterConnected).toHaveBeenCalledTimes(testConfig.retryAttempts);
      
      const status = printerService.getStatus();
      expect(status.connected).toBe(false);
    });

    it('should disconnect properly', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      await printerService.connect();
      
      await printerService.disconnect();
      
      const status = printerService.getStatus();
      expect(status.connected).toBe(false);
      expect(status.online).toBe(false);
    });
  });

  describe('Receipt Formatting', () => {
    beforeEach(async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockResolvedValue(true);
      await printerService.connect();
    });

    it('should format entry ticket in Spanish', async () => {
      const entryData: ReceiptData = {
        ...sampleReceiptData,
        type: 'ENTRY'
      };
      
      const result = await printerService.printEntryTicket(entryData);
      expect(result).toBe(true);
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockPrinter.println).toHaveBeenCalled();
      
      // Check that Spanish text was used
      const printedContent = mockPrinter.println.mock.calls[0][0];
      expect(printedContent).toContain('ESTACIONAMIENTO');
      expect(printedContent).toContain('BOLETO DE ENTRADA');
      expect(printedContent).toContain('Boleto: T-001234');
      expect(printedContent).toContain('Placa: ABC-123');
      expect(printedContent).toContain('Conserve su recibo');
    });

    it('should format payment receipt in Spanish', async () => {
      const result = await printerService.printPaymentReceipt(sampleReceiptData);
      expect(result).toBe(true);
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      expect(printedContent).toContain('RECIBO DE PAGO');
      expect(printedContent).toContain('Total a Pagar: $76 pesos');
      expect(printedContent).toContain('Su Cambio: $24 pesos');
      expect(printedContent).toContain('Método de Pago: Efectivo');
      expect(printedContent).toContain('Tiempo Total: 2 horas 30 minutos');
    });

    it('should format lost ticket receipt in Spanish', async () => {
      const lostTicketData: ReceiptData = {
        ...sampleReceiptData,
        type: 'LOST_TICKET',
        totalAmount: 150.00,
        change: 50.00
      };
      
      const result = await printerService.printLostTicketReceipt(lostTicketData);
      expect(result).toBe(true);
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      expect(printedContent).toContain('BOLETO EXTRAVIADO');
      expect(printedContent).toContain('Tarifa Boleto Extraviado: $150 pesos');
      expect(printedContent).toContain('Su Cambio: $50 pesos');
    });

    it('should format test receipt', async () => {
      const result = await printerService.printTestReceipt();
      expect(result).toBe(true);
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      expect(printedContent).toContain('IMPRESIÓN DE PRUEBA');
      expect(printedContent).toContain('Impresora Conectada');
      expect(printedContent).toContain('Prueba Exitosa');
    });

    it('should center text correctly for 58mm paper (32 chars)', () => {
      const service = new ThermalPrinterService({ paperWidth: 32 });
      
      // Test centering with different text lengths
      const centerText = (service as any).centerText.bind(service);
      
      expect(centerText('TEST')).toBe('              TEST'); // 14 spaces + 4 chars = 18
      expect(centerText('LONGER TEXT HERE')).toBe('        LONGER TEXT HERE'); // 16 chars, 8 spaces padding
      
      service.destroy();
    });
  });

  describe('Print Queue Management', () => {
    beforeEach(async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockResolvedValue(true);
      await printerService.connect();
    });

    it('should process queue in order', async () => {
      const jobs = [
        printerService.printTestReceipt(),
        printerService.printTestReceipt(),
        printerService.printTestReceipt()
      ];
      
      await Promise.all(jobs);
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockPrinter.execute).toHaveBeenCalledTimes(3);
      
      const status = printerService.getStatus();
      expect(status.totalPrintJobs).toBe(3);
      expect(status.queueLength).toBe(0);
    });

    it('should clear queue', async () => {
      // Disconnect to prevent automatic queue processing
      await printerService.disconnect();
      
      await printerService.printTestReceipt();
      await printerService.printTestReceipt();
      
      let status = printerService.getStatus();
      expect(status.queueLength).toBeGreaterThan(0);
      
      printerService.clearQueue();
      
      status = printerService.getStatus();
      expect(status.queueLength).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors with Spanish messages', async () => {
      mockPrinter.isPrinterConnected.mockRejectedValue(new Error('Network error'));
      
      const errors: any[] = [];
      printerService.on('error', (error) => errors.push(error));
      
      await printerService.connect();
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Conexión Fallida');
    });

    it('should handle print execution errors', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockRejectedValue(new Error('Paper jam'));
      
      await printerService.connect();
      
      const errors: any[] = [];
      printerService.on('error', (error) => errors.push(error));
      
      await printerService.printTestReceipt();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(errors.some(e => e.code === 'EXECUTION_ERROR')).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    it('should update status regularly', () => {
      const status = printerService.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('online');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('totalPrintJobs');
      expect(status).toHaveProperty('lastUpdate');
      expect(status.lastUpdate).toBeInstanceOf(Date);
    });

    it('should detect disconnection during health check', async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      await printerService.connect();
      
      // Initially connected
      expect(printerService.getStatus().connected).toBe(true);
      
      // Simulate disconnection
      mockPrinter.isPrinterConnected.mockResolvedValue(false);
      
      let disconnected = false;
      printerService.on('disconnected', () => {
        disconnected = true;
      });
      
      // Trigger health check manually
      await (printerService as any).performHealthCheck();
      
      expect(disconnected).toBe(true);
      expect(printerService.getStatus().connected).toBe(false);
    });
  });

  describe('Spanish Integration', () => {
    beforeEach(async () => {
      mockPrinter.isPrinterConnected.mockResolvedValue(true);
      mockPrinter.execute.mockResolvedValue(true);
      await printerService.connect();
    });

    it('should use Spanish translations for all user-facing text', async () => {
      await printerService.printPaymentReceipt(sampleReceiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Check Spanish translations are used
      expect(printedContent).toContain(i18n.t('receipt.parking_title'));
      expect(printedContent).toContain(i18n.t('receipt.payment_receipt'));
      expect(printedContent).toContain(i18n.t('customer.thank_you'));
      expect(printedContent).toContain(i18n.t('customer.drive_safely'));
    });

    it('should format currency in Mexican pesos', async () => {
      const receiptData = {
        ...sampleReceiptData,
        totalAmount: 125.50,
        change: 74.50
      };
      
      await printerService.printPaymentReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      expect(printedContent).toContain('$125.50 pesos');
      expect(printedContent).toContain('$74.50 pesos');
    });

    it('should format datetime in Mexico City timezone', async () => {
      await printerService.printEntryTicket(sampleReceiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Should contain formatted Mexico City time
      expect(printedContent).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
    });
  });
});

describe('Hardware Integration Validation', () => {
  it('should validate Epson TM-T20III specific settings', () => {
    const service = new ThermalPrinterService();
    
    // Verify default configuration matches Epson TM-T20III specs
    expect(service['config'].host).toBe('192.168.1.100');
    expect(service['config'].port).toBe(9100);
    expect(service['config'].paperWidth).toBe(32); // 58mm = 32 chars
    expect(service['config'].encoding).toBe('utf8');
    
    service.destroy();
  });

  it('should handle 58mm paper width constraints', () => {
    const service = new ThermalPrinterService({ paperWidth: 32 });
    
    const centerText = (service as any).centerText.bind(service);
    
    // Test that text doesn't exceed paper width
    const longText = 'This is a very long text that exceeds the paper width significantly';
    const centered = centerText(longText);
    
    // Should handle gracefully (no padding if text is too long)
    expect(centered.length).toBeGreaterThanOrEqual(longText.length);
    
    service.destroy();
  });

  it('should use correct character set for Spanish characters', async () => {
    const CharacterSet = require('node-thermal-printer').CharacterSet;
    
    const service = new ThermalPrinterService();
    
    mockPrinter.isPrinterConnected.mockResolvedValue(true);
    mockPrinter.execute.mockResolvedValue(true);
    
    // Clear previous mock calls
    jest.clearAllMocks();
    
    await service.connect();
    await service.printTestReceipt();
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Verify correct character set for Spanish characters
    expect(mockPrinter.setCharacterSet).toHaveBeenCalledWith(CharacterSet.PC858_EURO);
    
    // Verify feed lines are added (should be exactly 3 for this single print job)
    expect(mockPrinter.newLine).toHaveBeenCalledTimes(HARDWARE_CONSTANTS.PRINTER.FEED_LINES);
    
    service.destroy();
  });
});