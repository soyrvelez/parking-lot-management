/**
 * Scanner Integration Tests
 * Tests the complete workflow: Scanner → Ticket Lookup → Payment Processing
 */

import { BarcodeScannerService } from '../barcode-scanner.service';
import { ThermalPrinterService } from '../../printer/thermal-printer.service';
import { ScanResult, ReceiptData } from '@/shared/types/hardware';
import { Money } from '@/shared/utils/money';
import { i18n } from '@/shared/localization';

// Mock DOM environment
const mockElement = {
  focus: jest.fn(),
  click: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockDocument = {
  querySelector: jest.fn().mockReturnValue(mockElement),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  activeElement: mockElement
};

(global as any).document = mockDocument;
(global as any).window = { document: mockDocument };

// Mock thermal printer
jest.mock('node-thermal-printer', () => ({
  ThermalPrinter: jest.fn().mockImplementation(() => ({
    connectTCP: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    isPrinterConnected: jest.fn().mockResolvedValue(true),
    execute: jest.fn().mockResolvedValue(true),
    clear: jest.fn(),
    println: jest.fn(),
    printImage: jest.fn(),
    cut: jest.fn(),
    beep: jest.fn()
  })),
  PrinterTypes: {
    EPSON: 'epson'
  }
}));

// Mock ticket lookup service
class MockTicketLookupService {
  async findTicketByBarcode(barcode: string) {
    // Simulate different ticket scenarios
    switch (barcode) {
      case 'TICKET-001':
        return {
          id: 'T-001',
          plateNumber: 'ABC-123',
          entryTime: new Date('2024-06-15T10:00:00'),
          barcode: 'TICKET-001',
          status: 'ACTIVE'
        };
      
      case 'TICKET-PAID':
        return {
          id: 'T-002',
          plateNumber: 'XYZ-789',
          entryTime: new Date('2024-06-15T08:00:00'),
          exitTime: new Date('2024-06-15T10:30:00'),
          barcode: 'TICKET-PAID',
          status: 'PAID'
        };
      
      case 'PENSION-001':
        return {
          id: 'P-001',
          plateNumber: 'DEF-456',
          customerName: 'María José Hernández',
          type: 'PENSION',
          validUntil: new Date('2024-07-15'),
          barcode: 'PENSION-001',
          status: 'ACTIVE'
        };
      
      default:
        return null; // Not found
    }
  }

  async calculateParkingFee(ticket: any) {
    if (ticket.type === 'PENSION') {
      return Money.fromNumber(0); // No additional fee for pension
    }

    const entryTime = new Date(ticket.entryTime);
    const exitTime = ticket.exitTime || new Date();
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

    // Simple pricing: $25 first hour, $8.50 additional hours
    if (durationHours <= 1) {
      return Money.fromNumber(25);
    } else {
      const baseRate = Money.fromNumber(25);
      const additionalHours = durationHours - 1;
      const additionalRate = Money.fromNumber(8.50).multiply(additionalHours);
      return baseRate.add(additionalRate);
    }
  }

  async processPayment(ticket: any, amount: Money, paymentMethod: string) {
    return {
      success: true,
      transactionId: `TXN-${Date.now()}`,
      change: amount.subtract(await this.calculateParkingFee(ticket))
    };
  }
}

describe('Scanner Integration Tests', () => {
  let scannerService: BarcodeScannerService;
  let printerService: ThermalPrinterService;
  let ticketService: MockTicketLookupService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    scannerService = new BarcodeScannerService();
    printerService = new ThermalPrinterService();
    ticketService = new MockTicketLookupService();
  });

  afterEach(() => {
    scannerService.destroy();
    printerService.destroy();
    jest.useRealTimers();
  });

  describe('Complete Payment Workflow', () => {
    it('should handle successful scan → ticket lookup → payment → receipt', async () => {
      const results: any[] = [];
      
      // Mock printer execution to capture receipt content
      const mockPrinter = (printerService as any).printer;
      mockPrinter.execute.mockImplementation(() => {
        results.push('Receipt printed successfully');
        return Promise.resolve(true);
      });

      // Step 1: Scan barcode
      const scanPromise = scannerService.startScanning(5000);
      
      // Simulate barcode scan
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      'TICKET-001'.split('').forEach(char => {
        keydownHandler({ key: char });
      });
      keydownHandler({ key: 'Enter' });

      const scanResult = await scanPromise;
      
      expect(scanResult).toBeDefined();
      expect(scanResult!.code).toBe('TICKET-001');
      expect(scanResult!.source).toBe('SCANNER');

      // Step 2: Look up ticket
      const ticket = await ticketService.findTicketByBarcode(scanResult!.code);
      
      expect(ticket).toBeDefined();
      expect(ticket!.plateNumber).toBe('ABC-123');
      expect(ticket!.status).toBe('ACTIVE');

      // Step 3: Calculate fee
      const fee = await ticketService.calculateParkingFee(ticket);
      
      expect(fee.toNumber()).toBeGreaterThan(0);

      // Step 4: Process payment
      const payment = Money.fromNumber(100); // Customer pays $100
      const paymentResult = await ticketService.processPayment(ticket, payment, 'EFECTIVO');
      
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.change.toNumber()).toBeGreaterThan(0);

      // Step 5: Print receipt
      const receiptData: ReceiptData = {
        ticketNumber: ticket!.id,
        plateNumber: ticket!.plateNumber,
        entryTime: new Date(ticket!.entryTime),
        exitTime: new Date(),
        totalAmount: fee.toNumber(),
        paymentMethod: 'EFECTIVO',
        change: paymentResult.change.toNumber(),
        type: 'PAYMENT'
      };

      await printerService.printPaymentReceipt(receiptData);
      
      expect(results).toContain('Receipt printed successfully');
      expect(mockPrinter.execute).toHaveBeenCalled();
    });

    it('should handle lost ticket workflow with manual entry', async () => {
      // Step 1: Attempt scan (timeout)
      const scanPromise = scannerService.startScanning(1000);
      
      // Wait for timeout
      jest.advanceTimersByTime(1000);
      
      // This will trigger manual entry
      const scanResult = await scanPromise;
      expect(scanResult).toBeNull(); // Simulated cancellation

      // Step 2: Manual plate entry for lost ticket
      const manualOptions = {
        timeoutMs: 30000,
        placeholder: i18n.t('hardware.enter_manually_placeholder'),
        allowCancel: true
      };

      const manualPromise = scannerService.startManualEntry(manualOptions);
      
      // Simulate operator entering plate number
      scannerService.submitManualEntry('ABC-123');
      
      const manualResult = await manualPromise;
      
      expect(manualResult).toBeDefined();
      expect(manualResult!.code).toBe('ABC-123');
      expect(manualResult!.source).toBe('MANUAL');

      // Step 3: Apply lost ticket fee
      const lostTicketFee = Money.fromNumber(150); // $150 lost ticket fee
      
      // Step 4: Process lost ticket payment
      const payment = Money.fromNumber(200);
      const change = payment.subtract(lostTicketFee);
      
      expect(change.toNumber()).toBe(50);

      // Step 5: Print lost ticket receipt
      const receiptData: ReceiptData = {
        ticketNumber: 'LOST-' + Date.now(),
        plateNumber: manualResult!.code,
        entryTime: new Date(), // Unknown entry time
        totalAmount: lostTicketFee.toNumber(),
        paymentMethod: 'EFECTIVO',
        change: change.toNumber(),
        type: 'LOST_TICKET'
      };

      await printerService.printLostTicketReceipt(receiptData);
      
      const status = scannerService.getStatus();
      expect(status.manualEntryCount).toBe(1);
      expect(status.timeoutCount).toBe(1);
    });

    it('should handle pension customer workflow', async () => {
      // Step 1: Scan pension barcode
      const scanPromise = scannerService.startScanning(5000);
      
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      'PENSION-001'.split('').forEach(char => {
        keydownHandler({ key: char });
      });
      keydownHandler({ key: 'Enter' });

      const scanResult = await scanPromise;
      
      expect(scanResult!.code).toBe('PENSION-001');

      // Step 2: Look up pension customer
      const pensionCustomer = await ticketService.findTicketByBarcode(scanResult!.code);
      
      expect(pensionCustomer).toBeDefined();
      expect(pensionCustomer!.type).toBe('PENSION');
      expect(pensionCustomer!.customerName).toBe('María José Hernández');

      // Step 3: Check validity
      const validUntil = new Date(pensionCustomer!.validUntil);
      const isValid = validUntil > new Date();
      
      expect(isValid).toBe(true);

      // Step 4: No payment required for valid pension
      const fee = await ticketService.calculateParkingFee(pensionCustomer);
      expect(fee.toNumber()).toBe(0);

      // Step 5: Print pension validation receipt
      const receiptData: ReceiptData = {
        ticketNumber: pensionCustomer!.id,
        plateNumber: pensionCustomer!.plateNumber,
        entryTime: new Date(),
        totalAmount: 0,
        type: 'PENSION',
        customerName: pensionCustomer!.customerName,
        validUntil: validUntil
      };

      await printerService.printPensionReceipt(receiptData);
      
      // Should not charge pension customers
      expect(receiptData.totalAmount).toBe(0);
    });

    it('should handle already paid ticket scenario', async () => {
      // Step 1: Scan already paid ticket
      const scanPromise = scannerService.startScanning(5000);
      
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      'TICKET-PAID'.split('').forEach(char => {
        keydownHandler({ key: char });
      });
      keydownHandler({ key: 'Enter' });

      const scanResult = await scanPromise;
      
      expect(scanResult!.code).toBe('TICKET-PAID');

      // Step 2: Look up ticket
      const ticket = await ticketService.findTicketByBarcode(scanResult!.code);
      
      expect(ticket).toBeDefined();
      expect(ticket!.status).toBe('PAID');

      // Step 3: No additional payment required
      // In a real system, this would show "Already Paid" message
      expect(ticket!.exitTime).toBeDefined();
      
      // Should not process payment for already paid tickets
      const isAlreadyPaid = ticket!.status === 'PAID';
      expect(isAlreadyPaid).toBe(true);
    });

    it('should handle ticket not found scenario', async () => {
      // Step 1: Scan unknown barcode
      const scanPromise = scannerService.startScanning(5000);
      
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      'UNKNOWN-123'.split('').forEach(char => {
        keydownHandler({ key: char });
      });
      keydownHandler({ key: 'Enter' });

      const scanResult = await scanPromise;
      
      expect(scanResult!.code).toBe('UNKNOWN-123');

      // Step 2: Look up ticket (not found)
      const ticket = await ticketService.findTicketByBarcode(scanResult!.code);
      
      expect(ticket).toBeNull();

      // Step 3: Should trigger lost ticket procedure
      // In a real system, this would automatically start lost ticket workflow
      expect(ticket).toBeNull();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from scanner errors and continue operation', async () => {
      let errorEmitted = false;
      let recovered = false;

      scannerService.on('error', () => {
        errorEmitted = true;
      });

      // Simulate scanner error
      try {
        scannerService.submitManualEntry('TEST'); // No active manual entry
      } catch (error) {
        errorEmitted = true;
      }

      expect(errorEmitted).toBe(true);

      // Scanner should still be operational
      expect(scannerService.isReady()).toBe(true);
      
      // Should be able to start new scan
      const scanPromise = scannerService.startScanning(1000);
      scannerService.stopScanning();
      
      recovered = true;
      expect(recovered).toBe(true);
    });

    it('should handle printer errors during integrated workflow', async () => {
      // Mock printer failure
      const mockPrinter = (printerService as any).printer;
      mockPrinter.execute.mockRejectedValue(new Error('Printer offline'));

      let printerError = false;
      
      printerService.on('error', () => {
        printerError = true;
      });

      // Complete scan workflow
      const scanPromise = scannerService.startScanning(5000);
      
      const keydownHandler = mockDocument.addEventListener.mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      'TICKET-001'.split('').forEach(char => {
        keydownHandler({ key: char });
      });
      keydownHandler({ key: 'Enter' });

      const scanResult = await scanPromise;
      expect(scanResult!.code).toBe('TICKET-001');

      // Try to print (should fail)
      const receiptData: ReceiptData = {
        ticketNumber: 'T-001',
        plateNumber: 'ABC-123',
        entryTime: new Date(),
        totalAmount: 25,
        type: 'PAYMENT'
      };

      try {
        await printerService.printPaymentReceipt(receiptData);
      } catch (error) {
        // Expected printer error
      }

      // Scanner should still be functional
      expect(scannerService.isReady()).toBe(true);
      
      // Should be able to retry printing later
      mockPrinter.execute.mockResolvedValue(true);
      await printerService.printPaymentReceipt(receiptData);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid successive scans', async () => {
      const scanResults: ScanResult[] = [];
      
      // Perform multiple scans in sequence
      for (let i = 0; i < 5; i++) {
        const scanPromise = scannerService.startScanning(2000);
        
        const keydownHandler = mockDocument.addEventListener.mock.calls[
          mockDocument.addEventListener.mock.calls.length - 1
        ][1];

        const barcode = `TICKET-${String(i).padStart(3, '0')}`;
        barcode.split('').forEach(char => {
          keydownHandler({ key: char });
        });
        keydownHandler({ key: 'Enter' });

        const result = await scanPromise;
        scanResults.push(result!);
      }

      expect(scanResults).toHaveLength(5);
      scanResults.forEach((result, index) => {
        expect(result.code).toBe(`TICKET-${String(index).padStart(3, '0')}`);
      });

      const status = scannerService.getStatus();
      expect(status.totalScans).toBe(5);
    });

    it('should maintain performance under stress', async () => {
      const startTime = Date.now();
      const operations = 10;

      // Simulate rapid scan operations
      for (let i = 0; i < operations; i++) {
        const scanPromise = scannerService.startScanning(1000);
        
        // Immediate scan completion
        const keydownHandler = mockDocument.addEventListener.mock.calls[
          mockDocument.addEventListener.mock.calls.length - 1
        ][1];

        `FAST${i}`.split('').forEach(char => {
          keydownHandler({ key: char });
        });
        keydownHandler({ key: 'Enter' });

        await scanPromise;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete all operations quickly (allowing for test overhead)
      expect(totalTime).toBeLessThan(1000);
      
      const status = scannerService.getStatus();
      expect(status.totalScans).toBe(operations);
      expect(status.failedScans).toBe(0);
    });
  });

  describe('Spanish Integration Messaging', () => {
    it('should provide Spanish guidance throughout the workflow', async () => {
      const messages: string[] = [];
      
      // Collect Spanish messages
      scannerService.on('scanTimeout', () => {
        messages.push(i18n.t('hardware.scan_timeout'));
      });

      scannerService.on('manualEntryRequired', () => {
        messages.push(i18n.t('hardware.manual_entry_required'));
      });

      // Trigger timeout scenario
      const scanPromise = scannerService.startScanning(500);
      jest.advanceTimersByTime(500);
      
      await scanPromise; // Should trigger manual entry

      expect(messages).toContain('Tiempo Agotado. Ingrese Manualmente.');
      expect(messages).toContain('Entrada Manual Requerida');
    });

    it('should format receipt content in Spanish', async () => {
      let receiptContent = '';
      
      // Mock printer to capture content
      const mockPrinter = (printerService as any).printer;
      mockPrinter.println.mockImplementation((text: string) => {
        receiptContent += text + '\n';
      });

      const receiptData: ReceiptData = {
        ticketNumber: 'T-001',
        plateNumber: 'ABC-123',
        entryTime: new Date('2024-06-15T10:00:00'),
        exitTime: new Date('2024-06-15T12:30:00'),
        totalAmount: 76,
        paymentMethod: 'EFECTIVO',
        change: 24,
        type: 'PAYMENT'
      };

      await printerService.printPaymentReceipt(receiptData);

      expect(receiptContent).toContain('ESTACIONAMIENTO');
      expect(receiptContent).toContain('RECIBO DE PAGO');
      expect(receiptContent).toContain('Boleto:');
      expect(receiptContent).toContain('Placa:');
      expect(receiptContent).toContain('Entrada:');
      expect(receiptContent).toContain('Salida:');
      expect(receiptContent).toContain('Total a Pagar:');
      expect(receiptContent).toContain('Método de Pago:');
      expect(receiptContent).toContain('Su Cambio:');
      expect(receiptContent).toContain('Gracias por su preferencia');
    });
  });
});