import { Money } from '../utils/money';
import { i18n, t } from '../localization';

/**
 * Comprehensive parking scenario demonstration
 * Shows localization + financial systems working together
 */
describe('Parking Scenario Demonstration', () => {
  
  /**
   * Parking fee calculation based on business rules:
   * - First hour: $25.00 (minimum charge)
   * - Additional time: $8.50 per 15-minute increment
   * - 2 hours 30 minutes = 1 hour + 6 increments (90 minutes additional)
   */
  function calculateParkingFee(durationMinutes: number): Money {
    const minimumFee = new Money(25.00); // First hour
    const incrementRate = new Money(8.50); // Per 15-minute increment
    
    if (durationMinutes <= 60) {
      return minimumFee;
    }
    
    const additionalMinutes = durationMinutes - 60;
    const increments = Math.ceil(additionalMinutes / 15);
    const additionalFee = incrementRate.multiply(increments);
    
    return minimumFee.add(additionalFee);
  }

  describe('Complete Parking Scenario: Vehicle ABC-123', () => {
    it('should demonstrate complete Spanish parking workflow', () => {
      // === VEHICLE ENTRY ===
      const plateNumber = 'ABC-123';
      const entryTime = new Date('2024-06-15T16:00:00Z'); // 10:00 AM Mexico City (UTC-6)
      const ticketNumber = 'T-001234';
      
      // Convert to Mexico City time for display
      const entryTimeLocal = i18n.formatTime(entryTime);
      
      console.log('\n=== ENTRADA DE VEHÍCULO ===');
      console.log(`${t('customer.welcome')}`);
      console.log(`${t('parking.plate')}: ${plateNumber}`);
      console.log(`${t('parking.ticket')}: ${ticketNumber}`);
      console.log(`Vehículo registrado a las ${entryTimeLocal}`);
      console.log(`${t('customer.have_receipt')}`);
      
      // Verify entry message formatting
      expect(t('customer.welcome')).toBe('Bienvenido al Estacionamiento');
      expect(entryTimeLocal).toMatch(/\d{2}:\d{2}/);
      
      // === VEHICLE EXIT (2.5 hours later) ===
      const exitTime = new Date(entryTime.getTime() + (2.5 * 60 * 60 * 1000)); // +2.5 hours
      const durationMinutes = Math.floor((exitTime.getTime() - entryTime.getTime()) / (1000 * 60));
      
      const exitTimeLocal = i18n.formatTime(exitTime);
      const durationFormatted = i18n.formatDuration(durationMinutes);
      
      console.log('\n=== SALIDA DE VEHÍCULO ===');
      console.log(`${t('parking.ticket')}: ${ticketNumber}`);
      console.log(`${t('parking.plate')}: ${plateNumber}`);
      console.log(`${t('receipt.entry_time_label')} ${entryTimeLocal}`);
      console.log(`${t('receipt.exit_time_label')} ${exitTimeLocal}`);
      console.log(`Tiempo total: ${durationFormatted}`);
      
      // Verify duration calculation
      expect(durationMinutes).toBe(150); // 2.5 hours = 150 minutes
      expect(durationFormatted).toBe('2 horas 30 minutos');
      
      // === FEE CALCULATION ===
      const parkingFee = calculateParkingFee(durationMinutes);
      const totalAmount = parkingFee.toNumber();
      const formattedTotal = i18n.formatPesos(totalAmount);
      
      console.log('\n=== CÁLCULO DE TARIFA ===');
      console.log(`${t('receipt.duration_label')} ${durationFormatted}`);
      console.log(`${t('receipt.rate_label')} $25 pesos (1ra hora) + $8.50 pesos x 6 incrementos`);
      console.log(`Total a pagar: ${formattedTotal}`);
      
      // Verify fee calculation: $25.00 + ($8.50 × 6) = $76.00
      expect(totalAmount).toBe(76.00);
      expect(formattedTotal).toBe('$76 pesos');
      
      // === PAYMENT PROCESS ===
      const customerPayment = new Money(100.00);
      const change = customerPayment.subtract(parkingFee);
      
      const paymentFormatted = i18n.formatPesos(customerPayment.toNumber());
      const changeFormatted = i18n.formatPesos(change.toNumber());
      
      console.log('\n=== PROCESO DE PAGO ===');
      console.log(`${t('customer.please_pay')}`);
      console.log(`${t('status.processing')}`);
      console.log(`${t('receipt.payment_method_label')} ${t('parking.cash')}`);
      console.log(`Pago recibido: ${paymentFormatted}`);
      console.log(`Cambio: ${changeFormatted}`);
      console.log(`${t('customer.thank_you_payment')}`);
      
      // Verify payment calculation
      expect(change.toNumber()).toBe(24.00);
      expect(paymentFormatted).toBe('$100 pesos');
      expect(changeFormatted).toBe('$24 pesos');
      
      // === RECEIPT GENERATION ===
      const receiptData = {
        ticketNumber,
        plateNumber,
        entryTime,
        exitTime,
        durationMinutes,
        totalAmount,
        paymentMethod: t('parking.cash'),
        change: change.toNumber()
      };
      
      const receipt = i18n.generateReceiptTemplate(receiptData);
      
      console.log('\n=== RECIBO GENERADO ===');
      console.log(receipt);
      
      // Verify receipt contains all required elements
      expect(receipt).toContain('=== ESTACIONAMIENTO ===');
      expect(receipt).toContain(`Boleto: ${ticketNumber}`);
      expect(receipt).toContain(`Placa: ${plateNumber}`);
      expect(receipt).toContain('2 horas 30 minutos');
      expect(receipt).toContain('$76 pesos');
      expect(receipt).toContain('Efectivo');
      expect(receipt).toContain('$24 pesos');
      expect(receipt).toContain('Gracias por su visita');
      
      // === CUSTOMER DEPARTURE ===
      console.log('\n=== DESPEDIDA DEL CLIENTE ===');
      console.log(`${t('customer.have_receipt')}`);
      console.log(`${t('customer.drive_safely')}`);
      console.log(`${t('customer.thank_you')}`);
      
      expect(t('customer.have_receipt')).toBe('Conserve su recibo');
      expect(t('customer.drive_safely')).toBe('Maneja con cuidado');
      expect(t('customer.thank_you')).toBe('Gracias por su preferencia');
    });

    it('should demonstrate lost ticket scenario', () => {
      const plateNumber = 'XYZ-789';
      const lostTicketFee = new Money(150.00);
      
      console.log('\n=== ESCENARIO: BOLETO EXTRAVIADO ===');
      console.log(`${t('parking.plate')}: ${plateNumber}`);
      console.log(`${t('parking.lost_ticket')}`);
      console.log(`${t('errors.payment_required')}: ${i18n.formatPesos(lostTicketFee.toNumber())}`);
      
      const customerPayment = new Money(200.00);
      const change = customerPayment.subtract(lostTicketFee);
      
      console.log(`${t('customer.please_pay')}`);
      console.log(`Pago recibido: ${i18n.formatPesos(customerPayment.toNumber())}`);
      console.log(`Cambio: ${i18n.formatPesos(change.toNumber())}`);
      console.log(`${t('customer.thank_you_payment')}`);
      
      // Verify lost ticket calculation
      expect(lostTicketFee.toNumber()).toBe(150.00);
      expect(change.toNumber()).toBe(50.00);
    });

    it('should demonstrate monthly pension scenario', () => {
      const customerName = 'Juan Pérez';
      const plateNumber = 'DEF-456';
      const monthlyRate = new Money(800.00);
      
      console.log('\n=== ESCENARIO: PENSIÓN MENSUAL ===');
      console.log(`Cliente: ${customerName}`);
      console.log(`${t('parking.plate')}: ${plateNumber}`);
      console.log(`${t('parking.pension')} ${t('parking.monthly')}`);
      console.log(`${t('receipt.total_label')} ${i18n.formatPesos(monthlyRate.toNumber())}`);
      
      const today = new Date();
      const startDate = i18n.formatDate(today);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const endDate = i18n.formatDate(nextMonth);
      
      console.log(`Vigencia: ${startDate} a ${endDate}`);
      console.log(`${t('status.completed')}`);
      console.log(`${t('customer.thank_you')}`);
      
      expect(monthlyRate.toNumber()).toBe(800.00);
    });

    it('should demonstrate hardware error scenario', () => {
      const plateNumber = 'GHI-789';
      
      console.log('\n=== ESCENARIO: ERRORES DE HARDWARE ===');
      
      // Scanner timeout
      console.log(`${t('hardware.scan_timeout')}`);
      console.log(`${t('hardware.manual_entry_required')}`);
      console.log(`${t('parking.plate')}: ${plateNumber} (ingresado manualmente)`);
      
      // Printer error during receipt
      console.log(`${t('hardware.printer_error')}`);
      console.log(`${t('hardware.retry_connection')}`);
      console.log(`${t('status.processing')}`);
      console.log(`${t('hardware.connection_restored')}`);
      console.log(`${t('hardware.receipt_printing')}`);
      
      // Customer assistance
      console.log(`${t('customer.assistance_needed')}`);
      console.log(`${t('customer.call_attendant')}`);
      
      expect(t('hardware.scan_timeout')).toBe('Tiempo Agotado. Ingrese Manualmente.');
      expect(t('hardware.manual_entry_required')).toBe('Entrada Manual Requerida');
      expect(t('hardware.printer_error')).toBe('Error de Impresora');
      expect(t('customer.assistance_needed')).toBe('¿Necesita asistencia?');
    });
  });

  describe('Financial Precision Verification', () => {
    it('should maintain exact precision through all operations', () => {
      // Complex calculation scenario
      const baseRate = new Money(25.00);
      const incrementRate = new Money(8.50);
      const numIncrements = 6;
      
      // Calculate total: $25.00 + ($8.50 × 6) = $76.00
      const incrementTotal = incrementRate.multiply(numIncrements);
      const totalFee = baseRate.add(incrementTotal);
      
      // Payment with change
      const payment = new Money(100.00);
      const change = payment.subtract(totalFee);
      
      // Verify precision throughout
      expect(incrementTotal.toNumber()).toBe(51.00);
      expect(totalFee.toNumber()).toBe(76.00);
      expect(change.toNumber()).toBe(24.00);
      
      // Verify Spanish formatting maintains precision
      expect(i18n.formatPesos(totalFee.toNumber())).toBe('$76 pesos');
      expect(i18n.formatPesos(change.toNumber())).toBe('$24 pesos');
      expect(i18n.formatCurrency(totalFee.toNumber())).toBe('$76.00');
    });

    it('should handle edge cases with precision', () => {
      // Test with fractional increments
      const baseRate = new Money(25.00);
      const incrementRate = new Money(8.50);
      
      // 73 minutes = 1 hour 13 minutes = 1 increment (rounded up)
      const durationMinutes = 73;
      const additionalMinutes = durationMinutes - 60;
      const increments = Math.ceil(additionalMinutes / 15); // = 1
      
      const totalFee = baseRate.add(incrementRate.multiply(increments));
      
      expect(totalFee.toNumber()).toBe(33.50);
      expect(i18n.formatPesos(totalFee.toNumber())).toBe('$33.50 pesos');
    });
  });

  describe('Mexico City Timezone Integration', () => {
    it('should correctly handle Mexico City timezone conversions', () => {
      // Create specific times in different seasons
      const summerTime = new Date('2024-06-15T16:00:00Z'); // UTC June (DST)
      const winterTime = new Date('2024-01-15T16:00:00Z'); // UTC January (Standard)
      
      const summerFormatted = i18n.formatDateTime(summerTime);
      const winterFormatted = i18n.formatDateTime(winterTime);
      
      // Both should show Mexico City local time
      expect(summerFormatted).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      expect(winterFormatted).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      
      console.log(`Verano (CDT): ${summerFormatted}`);
      console.log(`Invierno (CST): ${winterFormatted}`);
    });
  });
});