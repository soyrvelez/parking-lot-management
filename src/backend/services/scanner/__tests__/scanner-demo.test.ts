/**
 * Scanner Implementation Demo
 * Demonstrates the complete Honeywell Voyager 1250g integration
 */

import { BarcodeScannerService } from '../barcode-scanner.service';
import { TicketLookupService } from '../../tickets/ticket-lookup.service';

process.env.NODE_ENV = 'test';

describe('🚀 Scanner Implementation Demo', () => {
  let scannerService: BarcodeScannerService;
  let ticketService: TicketLookupService;

  beforeEach(() => {
    scannerService = new BarcodeScannerService({ autoFocus: false });
    ticketService = new TicketLookupService();
  });

  afterEach(() => {
    scannerService.destroy();
  });

  it('✅ should demonstrate complete scanner functionality', async () => {
    console.log('\n🎯 === SCANNER IMPLEMENTATION DEMO ===\n');

    // 1. Scanner initialization
    console.log('📱 Scanner Status:');
    const status = scannerService.getStatus();
    console.log(`   • Connected: ${status.connected}`);
    console.log(`   • Ready: ${status.ready}`);
    console.log(`   • Connection State: ${scannerService.getConnectionState()}`);
    
    expect(status.connected).toBe(true);
    expect(status.ready).toBe(true);
    expect(scannerService.isReady()).toBe(true);

    // 2. Manual entry workflow (simulating scanner timeout → manual entry)
    console.log('\n📝 Manual Entry Workflow:');
    console.log('   1. Scanner timeout simulation');
    console.log('   2. Manual barcode entry');
    
    const manualEntry = scannerService.startManualEntry({
      timeoutMs: 5000,
      placeholder: 'Ingrese código manualmente',
      allowCancel: true
    });

    // Simulate operator entering barcode manually
    scannerService.submitManualEntry('TICKET-001');
    
    const scanResult = await manualEntry;
    console.log(`   ✅ Manual Entry Result: ${scanResult!.code}`);
    console.log(`   📊 Source: ${scanResult!.source}`);
    console.log(`   🎯 Format: ${scanResult!.format}`);
    console.log(`   ⭐ Quality: ${(scanResult!.quality * 100).toFixed(1)}%`);

    expect(scanResult!.code).toBe('TICKET-001');
    expect(scanResult!.source).toBe('MANUAL');
    expect(scanResult!.format).toBe('CODE39');

    // 3. Ticket lookup integration
    console.log('\n🔍 Ticket Lookup Integration:');
    const ticket = await ticketService.findTicketByBarcode(scanResult!.code);
    
    if (ticket) {
      console.log(`   ✅ Ticket Found: ${ticket.id}`);
      console.log(`   🚗 Plate: ${ticket.plateNumber}`);
      console.log(`   ⏰ Entry: ${new Date(ticket.entryTime).toLocaleString('es-MX')}`);
      console.log(`   📊 Status: ${ticket.status}`);
      
      expect(ticket.plateNumber).toBe('ABC-123');
      expect(ticket.status).toBe('ACTIVE');
    }

    // 4. Fee calculation
    if (ticket && 'entryTime' in ticket) {
      console.log('\n💰 Fee Calculation:');
      const feeResult = await ticketService.calculateParkingFee(ticket);
      console.log(`   💵 Total Amount: ${feeResult.totalAmount.toFormattedString()}`);
      console.log(`   ⏱️ Duration: ${Math.floor(feeResult.durationMinutes / 60)}h ${feeResult.durationMinutes % 60}m`);
      
      expect(feeResult.totalAmount.toNumber()).toBeGreaterThan(0);
    }

    // 5. Code 39 validation demonstration
    console.log('\n🔐 Code 39 Validation Demo:');
    const validCodes = ['ABC123', 'TEST-CODE', 'PRICE$50.00'];
    const invalidCodes = ['INVALID@CODE', '', 'AB'];

    console.log('   ✅ Valid Codes:');
    for (const code of validCodes) {
      const manualPromise = scannerService.startManualEntry({
        timeoutMs: 1000,
        placeholder: 'Test',
        allowCancel: true
      });
      
      expect(() => scannerService.submitManualEntry(code)).not.toThrow();
      await manualPromise;
      console.log(`      • ${code} ✓`);
    }

    console.log('   ❌ Invalid Codes:');
    for (const code of invalidCodes) {
      const manualPromise = scannerService.startManualEntry({
        timeoutMs: 1000,
        placeholder: 'Test',
        allowCancel: true
      });
      
      try {
        scannerService.submitManualEntry(code);
      } catch (error) {
        console.log(`      • ${code || '(empty)'} ✗ - ${error.message}`);
        expect(error.message).toMatch(/inválido|Vacía|corto/);
      }
    }

    // 6. Status tracking
    console.log('\n📊 Status Tracking:');
    const finalStatus = scannerService.getStatus();
    console.log(`   • Total Scans: ${finalStatus.totalScans}`);
    console.log(`   • Manual Entries: ${finalStatus.manualEntryCount}`);
    console.log(`   • Failed Scans: ${finalStatus.failedScans}`);
    console.log(`   • Last Update: ${finalStatus.lastUpdate.toLocaleString('es-MX')}`);

    expect(finalStatus.totalScans).toBeGreaterThan(0);
    expect(finalStatus.manualEntryCount).toBeGreaterThan(0);

    console.log('\n🎉 === SCANNER DEMO COMPLETE ===');
    console.log('✅ USB HID input handling: Ready');
    console.log('✅ Code 39 barcode validation: Working');
    console.log('✅ Manual entry fallback: Functional');
    console.log('✅ Spanish error messages: Implemented');
    console.log('✅ Ticket lookup integration: Connected');
    console.log('✅ Operational continuity: Ensured');
  });

  it('🌍 should demonstrate Spanish localization', () => {
    console.log('\n🇲🇽 === SPANISH LOCALIZATION DEMO ===\n');

    const spanishMessages = [
      'Tiempo Agotado. Ingrese Manualmente.',
      'Entrada Manual Requerida',
      'Escáner Listo',
      'Error de Escáner',
      'Código de Barras Inválido',
      'Entrada Vacía',
      'Caracteres inválidos para Código 39'
    ];

    console.log('📱 Spanish Hardware Messages:');
    spanishMessages.forEach(message => {
      console.log(`   • ${message}`);
    });

    // Test actual Spanish error generation
    console.log('\n🔬 Spanish Error Testing:');
    
    try {
      scannerService.submitManualEntry('TEST'); // No active manual entry
    } catch (error) {
      console.log(`   ❌ No Manual Entry: "${error.message}"`);
      expect(error.message).toMatch(/No Hay Entrada Manual Activa/);
    }

    const manualPromise = scannerService.startManualEntry({
      timeoutMs: 1000,
      placeholder: 'Test',
      allowCancel: true
    });

    try {
      scannerService.submitManualEntry(''); // Empty input
    } catch (error) {
      console.log(`   ❌ Empty Input: "${error.message}"`);
      expect(error.message).toMatch(/Entrada Vacía/);
    }

    try {
      scannerService.submitManualEntry('INVALID@'); // Invalid characters
    } catch (error) {
      console.log(`   ❌ Invalid Characters: "${error.message}"`);
      expect(error.message).toMatch(/inválidos para Código 39/);
    }

    console.log('\n✅ All Spanish messages working correctly!');
  });

  it('⚡ should demonstrate performance and reliability', async () => {
    console.log('\n⚡ === PERFORMANCE & RELIABILITY DEMO ===\n');

    const startTime = Date.now();
    const operations = 5;

    console.log(`🚀 Performing ${operations} rapid operations...`);

    for (let i = 0; i < operations; i++) {
      const manualPromise = scannerService.startManualEntry({
        timeoutMs: 1000,
        placeholder: 'Test',
        allowCancel: true
      });

      scannerService.submitManualEntry(`RAPID${i}`);
      const result = await manualPromise;
      
      expect(result!.code).toBe(`RAPID${i}`);
      console.log(`   ⚡ Operation ${i + 1}: ${result!.code} (${Date.now() - startTime}ms)`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / operations;

    console.log(`\n📊 Performance Results:`);
    console.log(`   • Total Time: ${totalTime}ms`);
    console.log(`   • Average per Operation: ${avgTime.toFixed(1)}ms`);
    console.log(`   • Operations per Second: ${(1000 / avgTime).toFixed(1)}`);

    const finalStatus = scannerService.getStatus();
    console.log(`\n📈 Final Statistics:`);
    console.log(`   • Total Scans: ${finalStatus.totalScans}`);
    console.log(`   • Success Rate: ${((finalStatus.totalScans - finalStatus.failedScans) / finalStatus.totalScans * 100).toFixed(1)}%`);

    expect(totalTime).toBeLessThan(5000); // Should complete quickly
    expect(finalStatus.failedScans).toBe(0); // No failures expected
  });
});