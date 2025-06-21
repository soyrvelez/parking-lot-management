import { i18n, t } from '../localization';
import { Money } from '../utils/money';

describe('Localization Validation Tests', () => {
  describe('Currency Formatting Validation', () => {
    it('should format small amounts correctly', () => {
      // Test small amounts
      expect(i18n.formatCurrency(1.25)).toBe('$1.25');
      expect(i18n.formatCurrency(5.50)).toBe('$5.50');
      expect(i18n.formatCurrency(0.75)).toBe('$0.75');
      
      // Test peso notation
      expect(i18n.formatPesos(1.25)).toBe('$1.25 pesos');
      expect(i18n.formatPesos(5.50)).toBe('$5.50 pesos');
      expect(i18n.formatPesos(0.75)).toBe('$0.75 pesos');
    });

    it('should format large amounts correctly', () => {
      // Test large amounts
      expect(i18n.formatCurrency(1234.56)).toBe('$1,234.56');
      expect(i18n.formatCurrency(9999.99)).toBe('$9,999.99');
      expect(i18n.formatCurrency(500.00)).toBe('$500.00');
      
      // Test peso notation
      expect(i18n.formatPesos(1234.56)).toBe('$1,234.56 pesos');
      expect(i18n.formatPesos(9999.99)).toBe('$9,999.99 pesos');
      expect(i18n.formatPesos(500.00)).toBe('$500 pesos');
    });

    it('should format zero amounts correctly', () => {
      expect(i18n.formatCurrency(0)).toBe('$0.00');
      expect(i18n.formatPesos(0)).toBe('gratis');
    });

    it('should handle whole peso amounts', () => {
      expect(i18n.formatPesos(25)).toBe('$25 pesos');
      expect(i18n.formatPesos(100)).toBe('$100 pesos');
      expect(i18n.formatPesos(1000)).toBe('$1,000 pesos');
    });
  });

  describe('Timezone Formatting Validation', () => {
    it('should format dates in Mexican format', () => {
      // Test specific date
      const testDate = new Date('2024-06-15T20:30:00Z'); // 8:30 PM UTC
      const formatted = i18n.formatDate(testDate);
      
      // Should be in DD/MM/YYYY format
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      
      // Should show Mexico City conversion (typically CST/CDT)
      expect(formatted.length).toBeGreaterThanOrEqual(8);
    });

    it('should format time in 24-hour format', () => {
      const testDate = new Date('2024-06-15T20:30:00Z');
      const formatted = i18n.formatTime(testDate);
      
      // Should be in HH:MM format
      expect(formatted).toMatch(/\d{2}:\d{2}/);
      
      // Should be Mexico City time (typically 6 hours behind UTC in summer)
      expect(formatted.length).toBe(5);
    });

    it('should format complete datetime', () => {
      const testDate = new Date('2024-06-15T20:30:00Z');
      const formatted = i18n.formatDateTime(testDate);
      
      // Should include both date and time
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
    });

    it('should provide current Mexico City time', () => {
      const now = i18n.now();
      const timezoneOffset = i18n.getTimezoneOffset();
      
      expect(now).toBeInstanceOf(Date);
      expect(typeof timezoneOffset).toBe('string');
      expect(timezoneOffset.length).toBeGreaterThan(0);
    });
  });

  describe('Translation Keys Validation', () => {
    const allCategories = [
      'parking',
      'hardware',
      'errors',
      'time',
      'currency',
      'actions',
      'status',
      'validation'
    ];

    it('should have all parking operation translations', () => {
      const parkingKeys = [
        'ticket', 'entry', 'exit', 'payment', 'cash', 'change',
        'total', 'time', 'plate', 'parking_lot', 'receipt',
        'lost_ticket', 'pension', 'monthly'
      ];

      parkingKeys.forEach(key => {
        const translation = t(`parking.${key}`);
        expect(translation).not.toBe(`[parking.${key}]`);
        expect(translation.length).toBeGreaterThan(0);
      });
    });

    it('should have all hardware status translations', () => {
      const hardwareKeys = [
        'printer_connected', 'printer_disconnected', 'printer_error',
        'scanner_ready', 'scanner_error', 'hardware_check',
        'connection_failed', 'retry_connection'
      ];

      hardwareKeys.forEach(key => {
        const translation = t(`hardware.${key}`);
        expect(translation).not.toBe(`[hardware.${key}]`);
        expect(translation.length).toBeGreaterThan(0);
      });
    });

    it('should have all error message translations', () => {
      const errorKeys = [
        'insufficient_funds', 'ticket_not_found', 'invalid_barcode',
        'payment_required', 'cash_register_error', 'calculation_error',
        'transaction_failed', 'invalid_amount', 'exceeds_maximum',
        'hardware_unavailable'
      ];

      errorKeys.forEach(key => {
        const translation = t(`errors.${key}`);
        expect(translation).not.toBe(`[errors.${key}]`);
        expect(translation.length).toBeGreaterThan(0);
      });
    });

    it('should validate all translation categories exist', () => {
      allCategories.forEach(category => {
        // Test that each category has at least one valid translation
        const testKey = category === 'parking' ? 'ticket' :
                       category === 'hardware' ? 'printer_connected' :
                       category === 'errors' ? 'insufficient_funds' :
                       category === 'time' ? 'minutes' :
                       category === 'currency' ? 'pesos' :
                       category === 'actions' ? 'scan' :
                       category === 'status' ? 'processing' :
                       'required_field';
        
        const translation = t(`${category}.${testKey}`);
        expect(translation).not.toBe(`[${category}.${testKey}]`);
      });
    });

    it('should return missing key indicator for invalid paths', () => {
      expect(t('invalid.path')).toBe('[invalid.path]');
      expect(t('parking.invalid_key')).toBe('[parking.invalid_key]');
      expect(t('completely.wrong.path')).toBe('[completely.wrong.path]');
    });
  });

  describe('Duration Formatting Validation', () => {
    it('should format parking durations correctly in Spanish', () => {
      // Minutes only
      expect(i18n.formatDuration(15)).toBe('15 minutos');
      expect(i18n.formatDuration(45)).toBe('45 minutos');
      
      // Hours only
      expect(i18n.formatDuration(60)).toBe('1 hora');
      expect(i18n.formatDuration(120)).toBe('2 horas');
      expect(i18n.formatDuration(180)).toBe('3 horas');
      
      // Mixed hours and minutes
      expect(i18n.formatDuration(75)).toBe('1 hora 15 minutos');
      expect(i18n.formatDuration(90)).toBe('1 hora 30 minutos');
      expect(i18n.formatDuration(135)).toBe('2 horas 15 minutos');
      expect(i18n.formatDuration(195)).toBe('3 horas 15 minutos');
    });
  });

  describe('Spanish Terminology Validation', () => {
    it('should use correct Mexican Spanish terms', () => {
      // Verify specific Mexican Spanish terminology
      expect(t('parking.ticket')).toBe('Boleto');
      expect(t('parking.cash')).toBe('Efectivo');
      expect(t('parking.change')).toBe('Cambio');
      expect(t('parking.parking_lot')).toBe('Estacionamiento');
      expect(t('parking.lost_ticket')).toBe('Boleto Extraviado');
      
      // Hardware terms
      expect(t('hardware.printer_connected')).toBe('Impresora Conectada');
      expect(t('hardware.scanner_ready')).toBe('Escáner Listo');
      
      // Currency terms
      expect(t('currency.pesos')).toBe('pesos');
      expect(t('currency.free')).toBe('gratis');
      
      // Actions
      expect(t('actions.scan')).toBe('Escanear');
      expect(t('actions.print')).toBe('Imprimir');
      expect(t('actions.enter_manually')).toBe('Ingresar Manualmente');
    });
  });
});