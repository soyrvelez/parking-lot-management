import { i18n, t } from '../localization';

describe('Enhanced Localization Features', () => {
  beforeEach(() => {
    // Clear cache between tests to ensure clean state
    i18n.clearCache();
  });

  describe('Customer Service Messages (Formal "usted" treatment)', () => {
    it('should provide formal customer greetings', () => {
      expect(t('customer.welcome')).toBe('Bienvenido al Estacionamiento');
      expect(t('customer.thank_you')).toBe('Gracias por su preferencia');
      expect(t('customer.thank_you_payment')).toBe('Gracias por su pago');
    });

    it('should provide polite customer instructions', () => {
      expect(t('customer.please_wait')).toBe('Por favor espere un momento');
      expect(t('customer.please_pay')).toBe('Por favor realice su pago');
      expect(t('customer.please_scan')).toBe('Por favor escanee su boleto');
    });

    it('should provide customer service phrases', () => {
      expect(t('customer.have_receipt')).toBe('Conserve su recibo');
      expect(t('customer.drive_safely')).toBe('Maneja con cuidado');
      expect(t('customer.assistance_needed')).toBe('¿Necesita asistencia?');
      expect(t('customer.call_attendant')).toBe('Llame al encargado');
    });
  });

  describe('Hardware Recovery Messages', () => {
    it('should provide enhanced hardware status messages', () => {
      expect(t('hardware.receipt_printing')).toBe('Imprimiendo Recibo...');
      expect(t('hardware.scan_timeout')).toBe('Tiempo Agotado. Ingrese Manualmente.');
      expect(t('hardware.hardware_maintenance')).toBe('Mantenimiento del Sistema');
      expect(t('hardware.connection_restored')).toBe('Conexión Restablecida');
      expect(t('hardware.manual_entry_required')).toBe('Entrada Manual Requerida');
    });
  });

  describe('Receipt Template System', () => {
    it('should provide complete receipt template labels', () => {
      expect(t('receipt.header_line1')).toBe('=== ESTACIONAMIENTO ===');
      expect(t('receipt.header_line2')).toBe('BOLETO DE SALIDA');
      expect(t('receipt.separator_line')).toBe('========================');
      expect(t('receipt.entry_time_label')).toBe('Entrada:');
      expect(t('receipt.exit_time_label')).toBe('Salida:');
      expect(t('receipt.duration_label')).toBe('Tiempo Total:');
      expect(t('receipt.total_label')).toBe('Total a Pagar:');
      expect(t('receipt.payment_method_label')).toBe('Método de Pago:');
      expect(t('receipt.change_label')).toBe('Su Cambio:');
      expect(t('receipt.footer_thank_you')).toBe('Gracias por su visita');
      expect(t('receipt.footer_drive_safely')).toBe('Maneje con precaución');
    });

    it('should generate complete thermal receipt with Spanish formatting', () => {
      const receiptData = {
        ticketNumber: 'T-001234',
        plateNumber: 'ABC-123',
        entryTime: new Date('2024-06-15T09:30:00Z'),
        exitTime: new Date('2024-06-15T11:45:00Z'),
        durationMinutes: 135, // 2 hours 15 minutes
        totalAmount: 42.50,
        paymentMethod: 'Efectivo',
        change: 7.50
      };

      const receipt = i18n.generateReceiptTemplate(receiptData);
      
      expect(receipt).toContain('=== ESTACIONAMIENTO ===');
      expect(receipt).toContain('BOLETO DE SALIDA');
      expect(receipt).toContain('Boleto: T-001234');
      expect(receipt).toContain('Placa: ABC-123');
      expect(receipt).toContain('Tiempo Total: 2 horas 15 minutos');
      expect(receipt).toContain('Total a Pagar: $42.50 pesos');
      expect(receipt).toContain('Método de Pago: Efectivo');
      expect(receipt).toContain('Su Cambio: $7.50 pesos');
      expect(receipt).toContain('Gracias por su visita');
      expect(receipt).toContain('Maneje con precaución');
    });

    it('should generate receipt without change when not needed', () => {
      const receiptData = {
        ticketNumber: 'T-001235',
        plateNumber: 'XYZ-789',
        entryTime: new Date('2024-06-15T14:00:00Z'),
        exitTime: new Date('2024-06-15T15:00:00Z'),
        durationMinutes: 60,
        totalAmount: 25.00,
        paymentMethod: 'Efectivo'
      };

      const receipt = i18n.generateReceiptTemplate(receiptData);
      
      expect(receipt).toContain('Total a Pagar: $25 pesos');
      expect(receipt).toContain('Método de Pago: Efectivo');
      expect(receipt).not.toContain('Su Cambio:');
    });
  });

  describe('Performance Optimization', () => {
    it('should cache translation lookups for performance', () => {
      // First lookup
      const firstResult = t('parking.ticket');
      expect(firstResult).toBe('Boleto');
      
      // Check cache has the result
      const cacheStats = i18n.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
      expect(cacheStats.keys).toContain('parking.ticket');
      
      // Second lookup should use cache
      const secondResult = t('parking.ticket');
      expect(secondResult).toBe('Boleto');
      expect(secondResult).toBe(firstResult);
    });

    it('should cache missing translation keys', () => {
      const missingResult = t('nonexistent.key');
      expect(missingResult).toBe('[nonexistent.key]');
      
      const cacheStats = i18n.getCacheStats();
      expect(cacheStats.keys).toContain('nonexistent.key');
      
      // Second lookup should use cached miss
      const secondMissingResult = t('nonexistent.key');
      expect(secondMissingResult).toBe('[nonexistent.key]');
    });

    it('should use cached formatters for performance', () => {
      // Multiple currency formatting calls should reuse formatter
      const amount1 = i18n.formatCurrency(25.50);
      const amount2 = i18n.formatCurrency(100.75);
      const amount3 = i18n.formatCurrency(1234.56);
      
      expect(amount1).toBe('$25.50');
      expect(amount2).toBe('$100.75');
      expect(amount3).toBe('$1,234.56');
    });

    it('should handle formatter errors gracefully', () => {
      // Test with invalid date
      const invalidDate = new Date('invalid');
      const formattedDate = i18n.formatDate(invalidDate);
      
      // Should fallback gracefully, not throw error
      expect(typeof formattedDate).toBe('string');
      expect(formattedDate.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle invalid key paths gracefully', () => {
      expect(t('')).toBe('[]');
      expect(t(null as any)).toBe('[null]');
      expect(t(undefined as any)).toBe('[undefined]');
      expect(t(123 as any)).toBe('[123]');
    });

    it('should provide fallback formatting for invalid amounts', () => {
      const result = i18n.formatCurrency(NaN);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle timezone errors gracefully', () => {
      const offset = i18n.getTimezoneOffset();
      expect(typeof offset).toBe('string');
      expect(offset.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Business Workflow Integration', () => {
    it('should support complete customer interaction workflow', () => {
      // Customer arrival
      const welcome = t('customer.welcome');
      const scanInstruction = t('customer.please_scan');
      
      // Payment process
      const paymentRequest = t('customer.please_pay');
      const processing = t('status.processing');
      const thankYou = t('customer.thank_you_payment');
      
      // Receipt generation
      const receiptData = {
        ticketNumber: 'T-001236',
        plateNumber: 'DEF-456',
        entryTime: new Date('2024-06-15T10:00:00Z'),
        exitTime: new Date('2024-06-15T12:30:00Z'),
        durationMinutes: 150,
        totalAmount: 55.25,
        paymentMethod: t('parking.cash'),
        change: 44.75
      };
      
      const receipt = i18n.generateReceiptTemplate(receiptData);
      
      // Customer departure
      const keepReceipt = t('customer.have_receipt');
      const driveSafely = t('customer.drive_safely');
      
      // Verify all messages are in Spanish
      expect(welcome).toBe('Bienvenido al Estacionamiento');
      expect(scanInstruction).toBe('Por favor escanee su boleto');
      expect(paymentRequest).toBe('Por favor realice su pago');
      expect(processing).toBe('Procesando...');
      expect(thankYou).toBe('Gracias por su pago');
      expect(receipt).toContain('2 horas 30 minutos');
      expect(receipt).toContain('$55.25 pesos');
      expect(keepReceipt).toBe('Conserve su recibo');
      expect(driveSafely).toBe('Maneja con cuidado');
    });

    it('should support hardware failure workflow', () => {
      // Hardware issues
      const printerError = t('hardware.printer_error');
      const connectionFailed = t('hardware.connection_failed');
      const retrying = t('hardware.retry_connection');
      const connectionRestored = t('hardware.connection_restored');
      
      // Scanner issues
      const scanTimeout = t('hardware.scan_timeout');
      const manualEntry = t('hardware.manual_entry_required');
      const assistance = t('customer.assistance_needed');
      
      expect(printerError).toBe('Error de Impresora');
      expect(connectionFailed).toBe('Conexión Fallida');
      expect(retrying).toBe('Reintentando Conexión');
      expect(connectionRestored).toBe('Conexión Restablecida');
      expect(scanTimeout).toBe('Tiempo Agotado. Ingrese Manualmente.');
      expect(manualEntry).toBe('Entrada Manual Requerida');
      expect(assistance).toBe('¿Necesita asistencia?');
    });
  });
});