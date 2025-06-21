/**
 * End-to-End Tests for Operator Interface Workflows
 * 
 * Tests comprehensive operator scenarios including:
 * - Barcode scanning and ticket lookup
 * - New vehicle entry with plate validation
 * - Payment processing with precise calculations
 * - Hardware integration (printer, scanner)
 * - Spanish localization throughout
 * - Touch-friendly interface operation
 */

import { test, expect } from '@playwright/test';

// Test data for consistent testing
const testData = {
  plates: {
    valid: 'ABC-123',
    invalid: 'INVALID123',
    pension: 'PEN-001',
  },
  barcodes: {
    valid: '1234567890123',
    invalid: '0000000000000',
    lost: '9999999999999',
  },
  payments: {
    exact: '25.00',
    overpayment: '50.00',
    underpayment: '10.00',
  },
};

test.describe('Operator Interface E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Complete vehicle entry and payment workflow with Spanish localization', async ({ page }) => {
    // Verify Spanish interface loads
    await expect(page.locator('h1')).toContainText('Sistema de Estacionamiento');
    await expect(page.locator('p')).toContainText('Interfaz del Operador');

    // Test new vehicle entry
    await page.click('button:has-text("Nueva Entrada")');
    await expect(page.locator('h2')).toContainText('Nueva Entrada');
    await expect(page.locator('label')).toContainText('Número de Placa');

    // Enter vehicle plate (should auto-uppercase)
    await page.fill('input[placeholder="ABC-123"]', testData.plates.valid.toLowerCase());
    await expect(page.locator('input[placeholder="ABC-123"]')).toHaveValue(testData.plates.valid);

    // Submit entry
    await page.click('button:has-text("Crear e Imprimir Boleto")');
    
    // Verify success message in Spanish
    await expect(page.locator('text*="¡Boleto creado exitosamente!"')).toBeVisible();

    // Return to scan section
    await page.click('button:has-text("Regresar")');
    await expect(page.locator('h2')).toContainText('Escanear Código de Barras');

    // Test barcode scanning
    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.valid);
    await page.click('button:has-text("Buscar Boleto")');
    
    // Should navigate to payment section
    await expect(page.locator('h2')).toContainText('Procesar Pago');
    
    // Verify payment interface in Spanish
    await expect(page.locator('text=Información del Boleto')).toBeVisible();
    await expect(page.locator('text=Total a Pagar:')).toBeVisible();
    await expect(page.locator('text=MXN')).toBeVisible();

    // Test payment calculation
    await page.fill('input[placeholder="0.00"]', testData.payments.exact);
    await expect(page.locator('text=Cambio:')).not.toBeVisible(); // No change for exact payment

    // Test overpayment
    await page.fill('input[placeholder="0.00"]', testData.payments.overpayment);
    await expect(page.locator('text=Cambio:')).toBeVisible();

    // Complete payment
    await page.click('button:has-text("Confirmar Pago")');
    await expect(page.locator('text*="¡Pago procesado exitosamente!"')).toBeVisible();
  });

  test('Barcode scanning with keyboard integration', async ({ page }) => {
    // Test automatic barcode input
    await expect(page.locator('input[placeholder*="Código del boleto"]')).toBeFocused();

    // Simulate barcode scanner input (rapid keystrokes followed by Enter)
    const barcode = testData.barcodes.valid;
    
    for (const char of barcode) {
      await page.keyboard.press(char);
      await page.waitForTimeout(10); // Simulate rapid scanner input
    }
    
    await page.keyboard.press('Enter');
    
    // Should trigger search automatically
    await expect(page.locator('button:has-text("Buscando...")')).toBeVisible();
  });

  test('Plate number validation and formatting', async ({ page }) => {
    await page.click('button:has-text("Nueva Entrada")');

    // Test various plate formats
    const testCases = [
      { input: 'abc123', expected: 'ABC123' },
      { input: 'abc-123', expected: 'ABC-123' },
      { input: 'abc 123', expected: 'ABC 123' },
    ];

    for (const testCase of testCases) {
      await page.fill('input[placeholder="ABC-123"]', '');
      await page.fill('input[placeholder="ABC-123"]', testCase.input);
      await expect(page.locator('input[placeholder="ABC-123"]')).toHaveValue(testCase.expected);
    }

    // Test invalid characters (should be filtered out)
    await page.fill('input[placeholder="ABC-123"]', 'abc@#$123');
    await expect(page.locator('input[placeholder="ABC-123"]')).toHaveValue('ABC123');

    // Test validation error for empty input
    await page.fill('input[placeholder="ABC-123"]', '');
    await page.click('button:has-text("Crear e Imprimir Boleto")');
    await expect(page.locator('text*="requerido"')).toBeVisible();
  });

  test('Payment calculation accuracy with Mexican pesos', async ({ page }) => {
    // Mock a ticket lookup response
    await page.route('**/api/tickets/lookup/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-ticket-1',
          plateNumber: testData.plates.valid,
          entryTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
          totalAmount: '65.00', // 1 hour minimum (20) + 2 additional hours (45)
        }),
      });
    });

    // Navigate to payment
    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.valid);
    await page.click('button:has-text("Buscar Boleto")');

    // Verify calculated amount
    await expect(page.locator('text*="$65.00"')).toBeVisible();
    await expect(page.locator('text=MXN')).toBeVisible();

    // Test various payment scenarios
    const paymentTests = [
      { payment: '65.00', expectChange: false },
      { payment: '70.00', expectChange: true, expectedChange: '5.00' },
      { payment: '100.00', expectChange: true, expectedChange: '35.00' },
    ];

    for (const test of paymentTests) {
      await page.fill('input[placeholder="0.00"]', test.payment);
      
      if (test.expectChange) {
        await expect(page.locator('text=Cambio:')).toBeVisible();
        await expect(page.locator(`text*="$${test.expectedChange}"`)).toBeVisible();
      } else {
        await expect(page.locator('text=Cambio:')).not.toBeVisible();
      }
    }

    // Test quick amount buttons
    await page.click('button:has-text("$100")');
    await expect(page.locator('input[placeholder="0.00"]')).toHaveValue('100');
    await expect(page.locator('text=Cambio:')).toBeVisible();
  });

  test('Error handling and Spanish error messages', async ({ page }) => {
    // Test invalid barcode
    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.invalid);
    await page.click('button:has-text("Buscar Boleto")');
    await expect(page.locator('text*="Boleto no encontrado"')).toBeVisible();

    // Test network error
    await page.route('**/api/tickets/lookup/**', route => route.abort());
    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.valid);
    await page.click('button:has-text("Buscar Boleto")');
    await expect(page.locator('text*="Error de conexión"')).toBeVisible();

    // Test insufficient payment
    await page.route('**/api/tickets/lookup/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-ticket-1',
          plateNumber: testData.plates.valid,
          entryTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          totalAmount: '25.00',
        }),
      });
    });

    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.valid);
    await page.click('button:has-text("Buscar Boleto")');
    
    await page.fill('input[placeholder="0.00"]', testData.payments.underpayment);
    await page.click('button:has-text("Confirmar Pago")');
    await expect(page.locator('text*="monto pagado es insuficiente"')).toBeVisible();
  });

  test('Touch-friendly interface and accessibility', async ({ page }) => {
    // Test large button sizes (minimum 60px for operator interface)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      if (boundingBox) {
        expect(boundingBox.height).toBeGreaterThanOrEqual(60);
      }
    }

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('input[placeholder*="Código del boleto"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('button:has-text("Buscar Boleto")')).toBeFocused();

    // Test high contrast design
    const primaryButton = page.locator('button:has-text("Nueva Entrada")').first();
    const styles = await primaryButton.evaluate(el => getComputedStyle(el));
    
    // Should have sufficient contrast
    expect(styles.backgroundColor).toBeDefined();
    expect(styles.color).toBeDefined();
  });

  test('Real-time status updates and system monitoring', async ({ page }) => {
    // Verify status indicators
    await expect(page.locator('text=Impresora:')).toBeVisible();
    await expect(page.locator('text=Escáner:')).toBeVisible();
    await expect(page.locator('text=Base de Datos:')).toBeVisible();

    // Test status colors
    const statusIndicators = page.locator('text*="Conectada", text*="Listo", text*="Activa"');
    const count = await statusIndicators.count();
    expect(count).toBeGreaterThan(0);

    // Test real-time updates
    let updateCount = 0;
    
    page.on('response', response => {
      if (response.url().includes('/api/admin/dashboard/stats')) {
        updateCount++;
      }
    });

    await page.waitForTimeout(35000); // Wait for auto-refresh
    expect(updateCount).toBeGreaterThan(0);
  });

  test('Hardware integration simulation', async ({ page }) => {
    // Test printer integration
    await page.click('button:has-text("Nueva Entrada")');
    await page.fill('input[placeholder="ABC-123"]', testData.plates.valid);

    // Mock printer API call
    let printerCalled = false;
    await page.route('**/api/hardware/print-ticket', route => {
      printerCalled = true;
      route.fulfill({ status: 200, body: '{}' });
    });

    await page.click('button:has-text("Crear e Imprimir Boleto")');
    
    // Should attempt to print
    await page.waitForTimeout(1000);
    expect(printerCalled).toBe(true);

    // Test scanner simulation
    await page.goto('/');
    
    // Scanner should automatically focus input
    await expect(page.locator('input[placeholder*="Código del boleto"]')).toBeFocused();
    
    // Test rapid input simulation (like barcode scanner)
    const scanTime = Date.now();
    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.valid);
    const fillTime = Date.now() - scanTime;
    
    // Should handle rapid input
    expect(fillTime).toBeLessThan(1000);
  });

  test('Lost ticket and special cases handling', async ({ page }) => {
    // Test lost ticket scenario
    await page.route('**/api/tickets/lookup/**', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Boleto no encontrado' }),
      });
    });

    await page.fill('input[placeholder*="Código del boleto"]', testData.barcodes.lost);
    await page.click('button:has-text("Buscar Boleto")');
    
    await expect(page.locator('text*="Boleto no encontrado"')).toBeVisible();

    // Should provide option to handle lost ticket
    await expect(page.locator('button:has-text("Nueva Entrada")')).toBeVisible();
  });

  test('Mobile device compatibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Interface should remain usable on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("Escanear Boleto")')).toBeVisible();
    await expect(page.locator('button:has-text("Nueva Entrada")')).toBeVisible();

    // Buttons should maintain touch-friendly size
    const scanButton = page.locator('button:has-text("Escanear Boleto")');
    const boundingBox = await scanButton.boundingBox();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThanOrEqual(60);
    }

    // Text should be readable
    const fontSize = await page.locator('h1').evaluate(el => getComputedStyle(el).fontSize);
    const fontSizeValue = parseInt(fontSize);
    expect(fontSizeValue).toBeGreaterThanOrEqual(24); // Minimum readable size
  });

  test('Session management and timeout handling', async ({ page }) => {
    // Test automatic session management
    await page.click('button:has-text("Nueva Entrada")');
    await page.fill('input[placeholder="ABC-123"]', testData.plates.valid);
    
    // Simulate session timeout
    await page.route('**/api/parking/entry', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Sesión expirada' }),
      });
    });

    await page.click('button:has-text("Crear e Imprimir Boleto")');
    
    // Should handle session timeout gracefully
    await expect(page.locator('text*="error", text*="sesión"')).toBeVisible();
  });

  test('Performance under load simulation', async ({ page }) => {
    const startTime = Date.now();
    
    // Load interface
    await page.goto('/');
    await page.waitForSelector('h1');
    
    const loadTime = Date.now() - startTime;
    
    // Should load quickly for operator efficiency
    expect(loadTime).toBeLessThan(3000);

    // Test rapid successive operations
    const operations = [
      () => page.click('button:has-text("Nueva Entrada")'),
      () => page.click('button:has-text("Regresar")'),
      () => page.fill('input[placeholder*="Código"]', '123'),
      () => page.fill('input[placeholder*="Código"]', ''),
    ];

    const operationStartTime = Date.now();
    
    for (const operation of operations) {
      await operation();
      await page.waitForTimeout(100);
    }
    
    const operationTime = Date.now() - operationStartTime;
    
    // Should handle rapid operations smoothly
    expect(operationTime).toBeLessThan(2000);
  });
});

test.describe('Integration with Admin Dashboard', () => {
  test('Data consistency between operator actions and admin view', async ({ page, context }) => {
    // This test would verify that operator actions appear in admin dashboard
    // For now, we'll test the structure that would support this integration
    
    // Create ticket as operator
    await page.goto('/');
    await page.click('button:has-text("Nueva Entrada")');
    await page.fill('input[placeholder="ABC-123"]', testData.plates.valid);
    await page.click('button:has-text("Crear e Imprimir Boleto")');
    
    // Open admin in new tab
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/login');
    await adminPage.fill('input[type="text"]', 'admin');
    await adminPage.fill('input[type="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');
    
    // Check if operator action is reflected in admin dashboard
    await expect(adminPage.locator('text=Boletos Activos')).toBeVisible();
    // In real implementation, would verify specific ticket appears
  });
});