import { Money } from '../utils/money';
import { i18n, t } from '../localization';

describe('Money + i18n Integration Tests', () => {
  describe('Money Class with Spanish Formatting', () => {
    it('should integrate Money amounts with i18n currency formatting', () => {
      // Create various Money instances
      const smallAmount = new Money(15.75);
      const largeAmount = new Money(1234.50);
      const zeroAmount = new Money(0);
      const wholeAmount = new Money(100);

      // Test i18n formatting of Money amounts
      expect(i18n.formatCurrency(smallAmount.toNumber())).toBe('$15.75');
      expect(i18n.formatCurrency(largeAmount.toNumber())).toBe('$1,234.50');
      expect(i18n.formatCurrency(zeroAmount.toNumber())).toBe('$0.00');
      expect(i18n.formatCurrency(wholeAmount.toNumber())).toBe('$100.00');

      // Test peso notation
      expect(i18n.formatPesos(smallAmount.toNumber())).toBe('$15.75 pesos');
      expect(i18n.formatPesos(largeAmount.toNumber())).toBe('$1,234.50 pesos');
      expect(i18n.formatPesos(zeroAmount.toNumber())).toBe('gratis');
      expect(i18n.formatPesos(wholeAmount.toNumber())).toBe('$100 pesos');
    });

    it('should format Money arithmetic results correctly', () => {
      const baseRate = new Money(25.50);
      const increment = new Money(8.75);
      
      const total = baseRate.add(increment);
      const discount = total.subtract(new Money(5.00));
      
      expect(i18n.formatPesos(total.toNumber())).toBe('$34.25 pesos');
      expect(i18n.formatPesos(discount.toNumber())).toBe('$29.25 pesos');
    });

    it('should handle Money validation with i18n error messages', () => {
      // Test maximum amount validation
      expect(() => new Money(10000)).toThrow();
      
      // Test that we can format error scenarios
      const maxAmount = new Money(9999.99);
      expect(i18n.formatPesos(maxAmount.toNumber())).toBe('$9,999.99 pesos');
      
      // Test change calculation formatting
      const payment = new Money(100);
      const cost = new Money(67.50);
      const change = payment.subtract(cost);
      
      expect(i18n.formatPesos(change.toNumber())).toBe('$32.50 pesos');
    });
  });

  describe('Parking Scenario Integration', () => {
    it('should calculate and format a complete parking fee transaction', () => {
      // Simulate parking fee calculation
      const minimumFee = new Money(25.00); // 1 hour minimum
      const incrementalFee = new Money(8.50); // per 15-minute increment
      const additionalIncrements = 3; // 45 minutes additional
      
      // Calculate total (1hr 45min parking)
      const incrementTotal = incrementalFee.multiply(additionalIncrements);
      const totalFee = minimumFee.add(incrementTotal);
      
      // Format in Spanish
      const formattedTotal = i18n.formatPesos(totalFee.toNumber());
      const duration = i18n.formatDuration(105); // 1hr 45min = 105 minutes
      
      expect(totalFee.toNumber()).toBe(50.50);
      expect(formattedTotal).toBe('$50.50 pesos');
      expect(duration).toBe('1 hora 45 minutos');
      
      // Create a receipt summary
      const receiptData = {
        total: `${t('parking.total')}: ${formattedTotal}`,
        duration: `${t('parking.time')}: ${duration}`,
        payment: `${t('parking.payment')}: ${t('parking.cash')}`
      };
      
      expect(receiptData.total).toBe('Total: $50.50 pesos');
      expect(receiptData.duration).toBe('Tiempo: 1 hora 45 minutos');
      expect(receiptData.payment).toBe('Pago: Efectivo');
    });

    it('should handle payment and change calculation with Spanish formatting', () => {
      const parkingFee = new Money(47.25);
      const customerPayment = new Money(100.00);
      
      // Calculate change
      const change = customerPayment.subtract(parkingFee);
      
      // Format transaction details in Spanish
      const transaction = {
        fee: `${t('parking.total')}: ${i18n.formatPesos(parkingFee.toNumber())}`,
        payment: `${t('parking.payment')}: ${i18n.formatPesos(customerPayment.toNumber())}`,
        change: `${t('parking.change')}: ${i18n.formatPesos(change.toNumber())}`,
        method: `${t('actions.pay')}: ${t('parking.cash')}`
      };
      
      expect(transaction.fee).toBe('Total: $47.25 pesos');
      expect(transaction.payment).toBe('Pago: $100 pesos');
      expect(transaction.change).toBe('Cambio: $52.75 pesos');
      expect(transaction.method).toBe('Pagar: Efectivo');
      
      // Verify change calculation precision
      expect(change.toNumber()).toBe(52.75);
    });

    it('should format lost ticket fee scenario', () => {
      const lostTicketFee = new Money(150.00);
      
      const lostTicketMessage = {
        title: t('parking.lost_ticket'),
        fee: `${t('errors.payment_required')}: ${i18n.formatPesos(lostTicketFee.toNumber())}`,
        payment: `${t('parking.payment')}: ${t('parking.cash')}`
      };
      
      expect(lostTicketMessage.title).toBe('Boleto Extraviado');
      expect(lostTicketMessage.fee).toBe('Pago Requerido: $150 pesos');
      expect(lostTicketMessage.payment).toBe('Pago: Efectivo');
    });

    it('should format monthly pension payment', () => {
      const monthlyRate = new Money(800.00);
      
      const pensionDetails = {
        type: t('parking.pension'),
        period: t('parking.monthly'),
        amount: i18n.formatPesos(monthlyRate.toNumber()),
        status: t('status.completed')
      };
      
      expect(pensionDetails.type).toBe('Pensión');
      expect(pensionDetails.period).toBe('Mensual');
      expect(pensionDetails.amount).toBe('$800 pesos');
      expect(pensionDetails.status).toBe('Completado');
    });
  });

  describe('Receipt Formatting Integration', () => {
    it('should create a complete Spanish parking receipt', () => {
      const entryTime = new Date('2024-06-15T09:30:00Z');
      const exitTime = new Date('2024-06-15T11:45:00Z');
      const parkingFee = new Money(42.50);
      const plateNumber = 'ABC-123';
      
      // Calculate duration
      const durationMinutes = Math.floor((exitTime.getTime() - entryTime.getTime()) / (1000 * 60));
      
      const receipt = {
        header: t('parking.parking_lot'),
        ticketNumber: `${t('parking.ticket')}: #12345`,
        plate: `${t('parking.plate')}: ${plateNumber}`,
        entry: `${t('parking.entry')}: ${i18n.formatDateTime(entryTime)}`,
        exit: `${t('parking.exit')}: ${i18n.formatDateTime(exitTime)}`,
        duration: `${t('parking.time')}: ${i18n.formatDuration(durationMinutes)}`,
        total: `${t('parking.total')}: ${i18n.formatPesos(parkingFee.toNumber())}`,
        payment: `${t('parking.payment')}: ${t('parking.cash')}`,
        footer: `${t('parking.receipt')} - ${i18n.getTimezoneOffset()}`
      };
      
      expect(receipt.header).toBe('Estacionamiento');
      expect(receipt.ticketNumber).toBe('Boleto: #12345');
      expect(receipt.plate).toBe('Placa: ABC-123');
      expect(receipt.entry).toMatch(/Entrada: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      expect(receipt.exit).toMatch(/Salida: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      expect(receipt.duration).toBe('Tiempo: 2 horas 15 minutos');
      expect(receipt.total).toBe('Total: $42.50 pesos');
      expect(receipt.payment).toBe('Pago: Efectivo');
      expect(receipt.footer).toMatch(/Recibo - .+/);
    });

    it('should handle error scenarios with Spanish messages', () => {
      const insufficientPayment = new Money(20.00);
      const requiredAmount = new Money(35.75);
      const shortfall = requiredAmount.subtract(insufficientPayment);
      
      const errorMessage = {
        error: t('errors.insufficient_funds'),
        required: `${t('parking.total')}: ${i18n.formatPesos(requiredAmount.toNumber())}`,
        received: `${t('parking.payment')}: ${i18n.formatPesos(insufficientPayment.toNumber())}`,
        missing: `${t('currency.owed')}: ${i18n.formatPesos(shortfall.toNumber())}`,
        action: t('errors.payment_required')
      };
      
      expect(errorMessage.error).toBe('Fondos Insuficientes');
      expect(errorMessage.required).toBe('Total: $35.75 pesos');
      expect(errorMessage.received).toBe('Pago: $20 pesos');
      expect(errorMessage.missing).toBe('debe: $15.75 pesos');
      expect(errorMessage.action).toBe('Pago Requerido');
    });
  });

  describe('Hardware Integration Formatting', () => {
    it('should format hardware status messages in Spanish', () => {
      const printerStatus = {
        connected: t('hardware.printer_connected'),
        disconnected: t('hardware.printer_disconnected'),
        error: t('hardware.printer_error'),
        retry: t('hardware.retry_connection')
      };
      
      const scannerStatus = {
        ready: t('hardware.scanner_ready'),
        error: t('hardware.scanner_error'),
        manual: t('actions.enter_manually')
      };
      
      expect(printerStatus.connected).toBe('Impresora Conectada');
      expect(printerStatus.disconnected).toBe('Impresora Desconectada');
      expect(printerStatus.error).toBe('Error de Impresora');
      expect(printerStatus.retry).toBe('Reintentando Conexión');
      
      expect(scannerStatus.ready).toBe('Escáner Listo');
      expect(scannerStatus.error).toBe('Error de Escáner');
      expect(scannerStatus.manual).toBe('Ingresar Manualmente');
    });
  });
});