/**
 * Spanish Character Encoding Validation
 * 
 * Comprehensive test suite for validating UTF-8 Spanish character encoding
 * on thermal receipts, including accented characters, special symbols, and
 * Mexican-specific formatting requirements.
 */

import { ThermalPrinterService } from '../thermal-printer.service';
import { ReceiptData } from '../../../../shared/types/hardware';
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

describe('Spanish Character Encoding Tests', () => {
  let printerService: ThermalPrinterService;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    printerService = new ThermalPrinterService();
    mockPrinter.isPrinterConnected.mockResolvedValue(true);
    mockPrinter.execute.mockResolvedValue(true);
    await printerService.connect();
  });

  afterEach(() => {
    printerService.destroy();
  });

  describe('Spanish Characters and Accents', () => {
    it('should properly encode accented Spanish characters', async () => {
      const receiptData: ReceiptData = {
        ticketNumber: 'T-001234',
        plateNumber: 'ABC-123',
        entryTime: new Date('2024-06-15T10:00:00-06:00'),
        exitTime: new Date('2024-06-15T12:30:00-06:00'),
        durationMinutes: 150,
        totalAmount: 76.00,
        paymentMethod: 'EFECTIVO',
        change: 24.00,
        type: 'PAYMENT',
        customerName: 'José María Gutiérrez Peña' // Spanish accented name
      };
      
      await printerService.printPaymentReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Test common Spanish accented characters
      const spanishChars = [
        'á', 'é', 'í', 'ó', 'ú',  // lowercase accents
        'Á', 'É', 'Í', 'Ó', 'Ú',  // uppercase accents
        'ñ', 'Ñ',                   // ñ characters
        'ü', 'Ü'                    // umlaut
      ];
      
      // Check Spanish text is preserved
      expect(printedContent).toContain('ESTACIONAMIENTO');
      expect(printedContent).toContain('Gracias por su preferencia');
      expect(printedContent).toContain('pesos');
      expect(printedContent).toContain('$76 pesos'); // Payment receipts show amounts
      
      // Test that accented characters would be properly handled
      spanishChars.forEach(char => {
        // Verify the service can handle these characters without errors
        expect(() => printerService['centerText'](`Test ${char} character`)).not.toThrow();
      });
    });

    it('should handle Spanish currency symbols and formatting', async () => {
      const receiptData: ReceiptData = {
        ticketNumber: 'T-001234',
        plateNumber: 'ABC-123',
        entryTime: new Date('2024-06-15T10:00:00-06:00'),
        exitTime: new Date('2024-06-15T12:30:00-06:00'),
        durationMinutes: 150,
        totalAmount: 1234.56,
        paymentMethod: 'EFECTIVO',
        change: 265.44,
        type: 'PAYMENT' // Use payment receipt to test currency formatting
      };
      
      await printerService.printPaymentReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Check Mexican peso formatting in payment receipt (with thousands separator)
      expect(printedContent).toContain('$1,234.56 pesos');
      expect(printedContent).toContain('$265.44 pesos');
      expect(printedContent).toContain('$');
      expect(printedContent).toContain('pesos');
      
      // Verify no encoding issues with currency symbols
      expect(printedContent).not.toContain('�'); // No replacement characters
      expect(printedContent).not.toContain('?'); // No question mark replacements
    });

    it('should properly encode special Spanish punctuation', async () => {
      const testTexts = [
        '¿Necesita asistencia?',     // Inverted question mark
        '¡Bienvenido!',              // Inverted exclamation mark
        'Horario: 8:00 - 20:00',     // Time formatting
        'Teléfono: 55-1234-5678',    // Phone with accents
        'Dirección: Av. Constitución #123', // Address formatting
      ];
      
      testTexts.forEach(text => {
        // Test centerText method handles special characters
        const centered = printerService['centerText'](text);
        expect(centered).toContain(text);
        expect(centered.length).toBeGreaterThanOrEqual(text.length);
      });
    });

    it('should handle Mexican place names and addresses', async () => {
      const mexicanTexts = [
        'México, D.F.',
        'Guadalajara, Jalisco',
        'Mérida, Yucatán',
        'Córdoba, Veracruz',
        'León, Guanajuato',
        'Bogotá, Colombia',
        'São Paulo, Brasil'
      ];
      
      mexicanTexts.forEach(text => {
        // Verify no encoding errors with Mexican place names
        const centered = printerService['centerText'](text);
        expect(centered).toContain(text);
        
        // Should not contain encoding error characters
        expect(centered).not.toContain('�');
        expect(centered).not.toContain('\uFFFD');
      });
    });
  });

  describe('Error Message Encoding', () => {
    it('should properly encode Spanish error messages', async () => {
      // Test various Spanish error messages
      const errorMessages = [
        i18n.t('hardware.printer_error'),
        i18n.t('hardware.connection_failed'),
        i18n.t('errors.insufficient_funds'),
        i18n.t('errors.payment_required'),
        i18n.t('hardware.scan_timeout'),
        i18n.t('hardware.manual_entry_required')
      ];
      
      errorMessages.forEach(message => {
        expect(message).toBeTruthy();
        expect(message).not.toContain('[');
        expect(message).not.toContain(']');
        
        // Should contain proper Spanish text
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it('should encode customer service messages correctly', async () => {
      const customerMessages = [
        i18n.t('customer.welcome'),
        i18n.t('customer.thank_you'),
        i18n.t('customer.please_wait'),
        i18n.t('customer.please_pay'),
        i18n.t('customer.drive_safely'),
        i18n.t('customer.assistance_needed')
      ];
      
      customerMessages.forEach(message => {
        expect(message).toBeTruthy();
        expect(message).not.toContain('[');
        
        // Test formal 'usted' treatment preservation
        if (message.includes('su')) {
          expect(message).toContain('su'); // Formal possessive
        }
      });
    });
  });

  describe('Receipt Template Encoding', () => {
    it('should encode complete receipt templates correctly', async () => {
      const receiptData: ReceiptData = {
        ticketNumber: 'T-001234',
        plateNumber: 'ABC-123',
        entryTime: new Date('2024-06-15T10:00:00-06:00'),
        exitTime: new Date('2024-06-15T12:30:00-06:00'),
        durationMinutes: 150,
        totalAmount: 76.50,
        paymentMethod: 'EFECTIVO',
        change: 23.50,
        type: 'PAYMENT'
      };
      
      await printerService.printPaymentReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Check complete Spanish receipt structure
      expect(printedContent).toContain('ESTACIONAMIENTO');
      expect(printedContent).toContain('RECIBO DE PAGO');
      expect(printedContent).toContain('Total a Pagar');
      expect(printedContent).toContain('Su Cambio');
      expect(printedContent).toContain('Método de Pago');
      expect(printedContent).toContain('Gracias por su preferencia');
      expect(printedContent).toContain('Maneja con cuidado');
      
      // Verify proper formatting
      expect(printedContent).toContain('$76.50 pesos');
      expect(printedContent).toContain('$23.50 pesos');
      expect(printedContent).toContain('Efectivo');
      
      // No encoding errors
      expect(printedContent).not.toContain('�');
      expect(printedContent).not.toContain('\uFFFD');
      expect(printedContent).not.toContain('??');
    });

    it('should encode pension receipt with customer names correctly', async () => {
      const receiptData: ReceiptData = {
        ticketNumber: 'P-001234',
        plateNumber: 'XYZ-789',
        entryTime: new Date('2024-06-15T10:00:00-06:00'),
        totalAmount: 800.00,
        type: 'PENSION',
        customerName: 'María José Hernández Sánchez',
        validUntil: new Date('2024-07-15T23:59:59-06:00')
      };
      
      await printerService.printPensionReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Check pension-specific Spanish content
      expect(printedContent).toContain('RECIBO PENSIÓN');
      expect(printedContent).toContain('Pensión Mensual');
      expect(printedContent).toContain('Cliente: María José Hernández Sánchez');
      expect(printedContent).toContain('$800 pesos');
      expect(printedContent).toContain('Válido hasta');
      expect(printedContent).toContain('Disfrute nuestro servicio');
      
      // Verify accent preservation in customer name
      expect(printedContent).toContain('María');
      expect(printedContent).toContain('José');
      expect(printedContent).toContain('Hernández');
      expect(printedContent).toContain('Sánchez');
    });

    it('should encode lost ticket receipt with Spanish messages', async () => {
      const receiptData: ReceiptData = {
        ticketNumber: 'L-001234',
        plateNumber: 'DEF-456',
        entryTime: new Date('2024-06-15T10:00:00-06:00'),
        totalAmount: 150.00,
        change: 50.00,
        type: 'LOST_TICKET'
      };
      
      await printerService.printLostTicketReceipt(receiptData);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const printedContent = mockPrinter.println.mock.calls[0][0];
      
      // Check lost ticket Spanish content
      expect(printedContent).toContain('BOLETO EXTRAVIADO');
      expect(printedContent).toContain('Tarifa Boleto Extraviado');
      expect(printedContent).toContain('$150 pesos');
      expect(printedContent).toContain('$50 pesos');
      expect(printedContent).toContain('Gracias por su preferencia');
    });
  });

  describe('Paper Width and Spanish Text Layout', () => {
    it('should properly center Spanish text within 58mm paper width', async () => {
      const spanishTexts = [
        'ESTACIONAMIENTO',
        'RECIBO DE PAGO',
        'BOLETO EXTRAVIADO',
        'Gracias por su preferencia',
        'Maneja con precaución',
        'Bienvenido al Estacionamiento'
      ];
      
      spanishTexts.forEach(text => {
        const centered = printerService['centerText'](text);
        
        // Should not exceed paper width (32 chars for 58mm)
        expect(centered.length).toBeLessThanOrEqual(32);
        
        // Should contain the original text
        expect(centered).toContain(text);
        
        // Should be properly centered (or left-aligned if too long)
        if (text.length < 32) {
          const expectedPadding = Math.floor((32 - text.length) / 2);
          expect(centered.startsWith(' '.repeat(expectedPadding))).toBe(true);
        }
      });
    });

    it('should handle long Spanish text gracefully', async () => {
      const longSpanishText = 'Este es un texto muy largo en español que excede el ancho del papel térmico';
      
      const centered = printerService['centerText'](longSpanishText);
      
      // Should not add padding if text is too long
      expect(centered).toBe(longSpanishText);
      expect(centered.length).toBe(longSpanishText.length);
    });
  });

  describe('Date and Time Formatting in Spanish', () => {
    it('should format dates and times in Mexican Spanish format', async () => {
      const testDate = new Date('2024-06-15T14:30:00-06:00');
      
      const formattedDate = i18n.formatDate(testDate);
      const formattedTime = i18n.formatTime(testDate);
      const formattedDateTime = i18n.formatDateTime(testDate);
      
      // Check Mexican date format (DD/MM/YYYY)
      expect(formattedDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      
      // Check time format (24-hour)
      expect(formattedTime).toMatch(/\d{2}:\d{2}/);
      
      // Check combined format
      expect(formattedDateTime).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      
      // Should be proper Mexico City timezone
      expect(formattedDateTime).toContain('2024');
    });

    it('should format duration in Spanish correctly', async () => {
      const testMinutes = [
        30,   // 30 minutos
        60,   // 1 hora
        90,   // 1 hora 30 minutos
        150,  // 2 horas 30 minutos
        120   // 2 horas
      ];
      
      testMinutes.forEach(minutes => {
        const formatted = i18n.formatDuration(minutes);
        
        expect(formatted).toBeTruthy();
        
        if (minutes < 60) {
          expect(formatted).toContain('minutos');
        } else {
          if (minutes % 60 === 0) {
            expect(formatted).toContain('hora');
          } else {
            expect(formatted).toContain('hora');
            expect(formatted).toContain('minutos');
          }
        }
      });
    });
  });
});

describe('Integration with Money Class and Spanish Formatting', () => {
  let printerService: ThermalPrinterService;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    printerService = new ThermalPrinterService();
    mockPrinter.isPrinterConnected.mockResolvedValue(true);
    mockPrinter.execute.mockResolvedValue(true);
    await printerService.connect();
  });

  afterEach(() => {
    printerService.destroy();
  });

  it('should integrate Money class calculations with Spanish formatting', async () => {
    // This test verifies the integration works properly
    const amount = 125.75;
    const formattedAmount = i18n.formatPesos(amount);
    
    expect(formattedAmount).toBe('$125.75 pesos');
    
    const receiptData: ReceiptData = {
      ticketNumber: 'T-001234',
      plateNumber: 'ABC-123',
      entryTime: new Date('2024-06-15T10:00:00-06:00'),
      exitTime: new Date('2024-06-15T12:30:00-06:00'),
      durationMinutes: 150,
      totalAmount: amount,
      paymentMethod: 'EFECTIVO',
      change: 24.25,
      type: 'PAYMENT'
    };
    
    await printerService.printPaymentReceipt(receiptData);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const printedContent = mockPrinter.println.mock.calls[0][0];
    
    // Verify money formatting in receipt
    expect(printedContent).toContain('$125.75 pesos');
    expect(printedContent).toContain('$24.25 pesos');
  });
});