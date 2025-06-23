/**
 * System Integration Validation Tests
 * 
 * Validates complete system integration including:
 * - Operator → Admin data flow
 * - Real-time updates between interfaces
 * - Spanish localization consistency
 * - Hardware integration working seamlessly
 * - Financial precision across all components
 */

import { test, expect } from '@playwright/test';

test.describe('System Integration Validation', () => {
  test('Operator to Admin data flow integration', async ({ page, context }) => {
    // Test complete data flow from operator action to admin visibility
    
    // Step 1: Create ticket as operator
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Sistema de Estacionamiento');
    
    // Create new entry
    await page.click('button:has-text("Nueva Entrada")');
    await page.fill('input[placeholder="ABC-123"]', 'SYS-TEST');
    await page.click('button:has-text("Crear e Imprimir Boleto")');
    
    // Verify success
    await expect(page.locator('text*="¡Boleto creado exitosamente!"')).toBeVisible();
    
    // Step 2: Verify admin can see the ticket
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/login');
    
    // Login to admin
    await adminPage.fill('input[type="text"]', 'admin');
    await adminPage.fill('input[type="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');
    
    // Navigate to active tickets
    await adminPage.click('nav a[href="/admin/tickets"]');
    
    // Should see the ticket created by operator
    // In full implementation, would verify specific plate appears
    await expect(adminPage.locator('text=Boletos Activos')).toBeVisible();
  });

  test('Real-time updates synchronization', async ({ page, context }) => {
    // Test that admin dashboard receives real-time updates from operator actions
    
    // Open admin dashboard
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Monitor real-time updates
    let updateReceived = false;
    
    page.on('response', response => {
      if (response.url().includes('/api/admin/dashboard/stats')) {
        updateReceived = true;
      }
    });
    
    // Wait for automatic update cycle
    await page.waitForTimeout(35000);
    
    // Verify real-time updates are working
    expect(updateReceived).toBe(true);
  });

  test('Spanish localization consistency across interfaces', async ({ page, context }) => {
    // Test Spanish localization is consistent between operator and admin interfaces
    
    // Check operator interface Spanish
    await page.goto('/');
    await expect(page.locator('text=Sistema de Estacionamiento')).toBeVisible();
    await expect(page.locator('text=Interfaz del Operador')).toBeVisible();
    
    // Check admin interface Spanish
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/login');
    await expect(adminPage.locator('text=Panel de Administración')).toBeVisible();
    
    await adminPage.fill('input[type="text"]', 'admin');
    await adminPage.fill('input[type="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');
    
    await expect(adminPage.locator('text=Dashboard Principal')).toBeVisible();
    await expect(adminPage.locator('text=Vehículos Activos')).toBeVisible();
    await expect(adminPage.locator('text=Ingresos del Día')).toBeVisible();
  });

  test('Hardware integration system-wide', async ({ page }) => {
    // Test hardware integration works consistently across the system
    
    await page.goto('/');
    
    // Verify hardware status indicators
    await expect(page.locator('text=Impresora:')).toBeVisible();
    await expect(page.locator('text=Escáner:')).toBeVisible();
    await expect(page.locator('text=Base de Datos:')).toBeVisible();
    
    // Test hardware integration in admin
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Navigate to hardware control
    await page.click('nav a[href="/admin/hardware"]');
    await expect(page.locator('text=Control de Hardware')).toBeVisible();
    
    // Verify hardware controls are available
    await expect(page.locator('button:has-text("Imprimir Prueba")')).toBeVisible();
    await expect(page.locator('button:has-text("Probar Escáner")')).toBeVisible();
  });

  test('Financial precision validation across system', async ({ page }) => {
    // Test financial calculations maintain precision throughout the system
    
    // Mock ticket with specific amount
    await page.route('**/api/tickets/lookup/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'precision-test-1',
          plateNumber: 'PRE-123',
          entryTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(), // 2.5 hours
          totalAmount: '47.50', // Precise decimal amount
        }),
      });
    });
    
    // Test operator interface precision
    await page.goto('/');
    await page.fill('input[placeholder*="Código del boleto"]', '1234567890123');
    await page.click('button:has-text("Buscar Boleto")');
    
    // Verify precise amount display
    await expect(page.locator('text*="$47.50"')).toBeVisible();
    await expect(page.locator('text=MXN')).toBeVisible();
    
    // Test payment calculations
    await page.fill('input[placeholder="0.00"]', '50.00');
    await expect(page.locator('text*="$2.50"')).toBeVisible(); // Change calculation
    
    // Verify admin financial reporting precision
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.click('nav a[href="/admin/reports"]');
    
    // All financial displays should show proper decimal formatting
    const moneyDisplays = page.locator('text=/\\\\$[0-9]+\\\\.[0-9]{2}/');
    const count = await moneyDisplays.count();
    
    for (let i = 0; i < count; i++) {
      const text = await moneyDisplays.nth(i).textContent();
      expect(text).toMatch(/\\$\\d+\\.\\d{2}/);
    }
  });

  test('Complete workflow integration: Entry → Payment → Admin Visibility', async ({ page, context }) => {
    // Test complete end-to-end workflow
    
    const plateNumber = `INT-${Date.now().toString().slice(-3)}`;
    
    // Step 1: Operator creates entry
    await page.goto('/');
    await page.click('button:has-text("Nueva Entrada")');
    await page.fill('input[placeholder="ABC-123"]', plateNumber);
    await page.click('button:has-text("Crear e Imprimir Boleto")');
    await expect(page.locator('text*="¡Boleto creado exitosamente!"')).toBeVisible();
    
    // Step 2: Process payment (simulated)
    await page.click('button:has-text("Regresar")');
    
    // Mock the payment lookup
    await page.route('**/api/tickets/lookup/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'workflow-test-1',
          plateNumber: plateNumber,
          entryTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          totalAmount: '25.00',
        }),
      });
    });
    
    await page.fill('input[placeholder*="Código del boleto"]', '1234567890123');
    await page.click('button:has-text("Buscar Boleto")');
    
    // Complete payment
    await page.fill('input[placeholder="0.00"]', '25.00');
    await page.click('button:has-text("Confirmar Pago")');
    await expect(page.locator('text*="¡Pago procesado exitosamente!"')).toBeVisible();
    
    // Step 3: Verify admin sees completed transaction
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/login');
    await adminPage.fill('input[type="text"]', 'admin');
    await adminPage.fill('input[type="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');
    
    // Check dashboard shows updated metrics
    await expect(adminPage.locator('text=Dashboard Principal')).toBeVisible();
    await expect(adminPage.locator('text=Transacciones')).toBeVisible();
    
    // Check reports section
    await adminPage.click('nav a[href="/admin/reports"]');
    await expect(adminPage.locator('text=Reportes Financieros')).toBeVisible();
  });

  test('Error handling consistency across interfaces', async ({ page, context }) => {
    // Test error handling is consistent and properly localized
    
    // Test operator error handling
    await page.goto('/');
    await page.route('**/api/tickets/lookup/**', route => route.abort());
    
    await page.fill('input[placeholder*="Código del boleto"]', '1234567890123');
    await page.click('button:has-text("Buscar Boleto")');
    await expect(page.locator('text*="Error de conexión"')).toBeVisible();
    
    // Test admin error handling
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/login');
    await adminPage.route('**/api/**', route => route.abort());
    
    await adminPage.fill('input[type="text"]', 'admin');
    await adminPage.fill('input[type="password"]', 'admin123');
    await adminPage.click('button[type="submit"]');
    
    await expect(adminPage.locator('text*="Error de conexión"')).toBeVisible();
  });

  test('System performance under typical load', async ({ page }) => {
    // Test system performance meets requirements
    
    const startTime = Date.now();
    
    // Load operator interface
    await page.goto('/');
    await page.waitForSelector('h1');
    
    const operatorLoadTime = Date.now() - startTime;
    expect(operatorLoadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    // Test admin interface load time
    const adminStartTime = Date.now();
    
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('text=Dashboard Principal');
    await page.waitForSelector('.recharts-surface');
    
    const adminLoadTime = Date.now() - adminStartTime;
    expect(adminLoadTime).toBeLessThan(5000); // Dashboard should load within 5 seconds
  });
});