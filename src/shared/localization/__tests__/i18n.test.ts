import { i18n, t } from '../i18n';

describe('I18n System', () => {
  describe('Translation Keys', () => {
    it('should return correct Spanish translations for parking operations', () => {
      expect(t('parking.ticket')).toBe('Boleto');
      expect(t('parking.cash')).toBe('Efectivo');
      expect(t('parking.change')).toBe('Cambio');
      expect(t('parking.parking_lot')).toBe('Estacionamiento');
      expect(t('parking.lost_ticket')).toBe('Boleto Extraviado');
      expect(t('parking.pension')).toBe('Pensión');
    });

    it('should return correct hardware status translations', () => {
      expect(t('hardware.printer_connected')).toBe('Impresora Conectada');
      expect(t('hardware.printer_disconnected')).toBe('Impresora Desconectada');
      expect(t('hardware.scanner_ready')).toBe('Escáner Listo');
      expect(t('hardware.connection_failed')).toBe('Conexión Fallida');
    });

    it('should return correct error messages', () => {
      expect(t('errors.insufficient_funds')).toBe('Fondos Insuficientes');
      expect(t('errors.ticket_not_found')).toBe('Boleto No Encontrado');
      expect(t('errors.invalid_barcode')).toBe('Código de Barras Inválido');
      expect(t('errors.payment_required')).toBe('Pago Requerido');
    });

    it('should return correct action translations', () => {
      expect(t('actions.scan')).toBe('Escanear');
      expect(t('actions.print')).toBe('Imprimir');
      expect(t('actions.pay')).toBe('Pagar');
      expect(t('actions.enter_manually')).toBe('Ingresar Manualmente');
    });

    it('should return key path in brackets for missing translations', () => {
      expect(t('nonexistent.key')).toBe('[nonexistent.key]');
      expect(t('parking.invalid_key')).toBe('[parking.invalid_key]');
    });
  });

  describe('Currency Formatting', () => {
    it('should format Mexican pesos correctly', () => {
      expect(i18n.formatCurrency(25.50)).toBe('$25.50');
      expect(i18n.formatCurrency(100)).toBe('$100.00');
      expect(i18n.formatCurrency(0)).toBe('$0.00');
      expect(i18n.formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format peso amounts with Mexican notation', () => {
      expect(i18n.formatPesos(0)).toBe('gratis');
      expect(i18n.formatPesos(25)).toBe('$25 pesos');
      expect(i18n.formatPesos(25.50)).toBe('$25.50 pesos');
      expect(i18n.formatPesos(100.75)).toBe('$100.75 pesos');
    });
  });

  describe('Date and Time Formatting', () => {
    const testDate = new Date('2024-06-15T14:30:00Z');

    it('should format dates in Mexican format (DD/MM/YYYY)', () => {
      const formatted = i18n.formatDate(testDate);
      // Format depends on Mexico City timezone conversion
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should format time in 24-hour format', () => {
      const formatted = i18n.formatTime(testDate);
      // Format depends on Mexico City timezone conversion
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('should format datetime with Mexico City timezone', () => {
      const formatted = i18n.formatDateTime(testDate);
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
    });

    it('should provide current Mexico City time', () => {
      const now = i18n.now();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });
  });

  describe('Duration Formatting', () => {
    it('should format minutes correctly', () => {
      expect(i18n.formatDuration(30)).toBe('30 minutos');
      expect(i18n.formatDuration(45)).toBe('45 minutos');
      expect(i18n.formatDuration(1)).toBe('1 minutos');
    });

    it('should format hours correctly', () => {
      expect(i18n.formatDuration(60)).toBe('1 hora');
      expect(i18n.formatDuration(120)).toBe('2 horas');
      expect(i18n.formatDuration(180)).toBe('3 horas');
    });

    it('should format hours and minutes correctly', () => {
      expect(i18n.formatDuration(75)).toBe('1 hora 15 minutos');
      expect(i18n.formatDuration(150)).toBe('2 horas 30 minutos');
      expect(i18n.formatDuration(185)).toBe('3 horas 5 minutos');
    });
  });

  describe('Locale Configuration', () => {
    it('should have correct locale settings', () => {
      const locale = i18n.getLocale();
      expect(locale.language).toBe('es-MX');
      expect(locale.country).toBe('MX');
      expect(locale.timezone).toBe('America/Mexico_City');
      expect(locale.currency).toBe('MXN');
      expect(locale.dateFormat).toBe('DD/MM/YYYY');
      expect(locale.timeFormat).toBe('24h');
    });

    it('should return timezone information', () => {
      const timezone = i18n.getTimezoneOffset();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = i18n;
      const instance2 = i18n;
      expect(instance1).toBe(instance2);
    });
  });
});

describe('Translation Coverage', () => {
  it('should have all required translation categories', () => {
    const categoryTests = [
      { category: 'parking', key: 'ticket' },
      { category: 'hardware', key: 'printer_connected' },
      { category: 'errors', key: 'insufficient_funds' },
      { category: 'time', key: 'minutes' },
      { category: 'currency', key: 'pesos' },
      { category: 'actions', key: 'scan' },
      { category: 'status', key: 'processing' },
      { category: 'validation', key: 'required_field' }
    ];

    for (const { category, key } of categoryTests) {
      expect(t(`${category}.${key}`)).not.toBe(`[${category}.${key}]`);
    }
  });

  it('should have consistent Spanish terminology', () => {
    // Verify key Spanish terms are used correctly
    expect(t('parking.ticket')).toBe('Boleto'); // Not "ticket"
    expect(t('parking.cash')).toBe('Efectivo'); // Not "dinero"
    expect(t('parking.change')).toBe('Cambio'); // Not "vuelto"
    expect(t('parking.parking_lot')).toBe('Estacionamiento'); // Not "parking"
  });
});