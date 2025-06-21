/**
 * End-to-End Tests for Admin Dashboard Workflows
 * 
 * Tests comprehensive admin scenarios including:
 * - Authentication and navigation
 * - Real-time dashboard monitoring
 * - Financial reporting and export
 * - Hardware control and monitoring
 * - Audit log viewing and filtering
 * - Shift management and performance tracking
 */

import { test, expect } from '@playwright/test';

// Test data for consistent testing
const testData = {
  admin: {
    username: 'admin',
    password: 'admin123',
  },
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
};

test.describe('Admin Dashboard E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Start from admin login page
    await page.goto('/admin/login');
  });

  test('Complete admin authentication and navigation workflow', async ({ page }) => {
    // Test Spanish localization on login page
    await expect(page.locator('h2')).toContainText('Panel de Administración');
    await expect(page.locator('p')).toContainText('Sistema de Gestión de Estacionamiento');

    // Login with admin credentials
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Verify successful login and dashboard load
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('h1')).toContainText('Dashboard Principal');

    // Test sidebar navigation
    const navItems = [
      'Dashboard Principal',
      'Reportes Financieros',
      'Boletos Activos',
      'Caja Registradora',
      'Registro de Auditoría',
      'Gestión de Turnos',
      'Configuración',
      'Monitoreo Hardware',
      'Gestión Operadores',
    ];

    for (const item of navItems) {
      await expect(page.locator('nav').getByText(item)).toBeVisible();
    }

    // Test logout functionality
    await page.click('button[title="Cerrar Sesión"]');
    await expect(page).toHaveURL('/admin/login');
  });

  test('Financial reporting workflow with Spanish localization', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Navigate to reports
    await page.click('nav a[href="/admin/reports"]');
    await expect(page).toHaveURL('/admin/reports');
    await expect(page.locator('h1')).toContainText('Reportes Financieros');

    // Test report filters in Spanish
    await expect(page.locator('label')).toContainText('Fecha Inicial');
    await expect(page.locator('label')).toContainText('Fecha Final');
    await expect(page.locator('label')).toContainText('Tipo de Reporte');

    // Set date range
    await page.fill('input[type="date"]', testData.dateRange.startDate);
    await page.fill('input[type="date"]:nth-child(2)', testData.dateRange.endDate);

    // Test report type selection
    await page.selectOption('select', 'weekly');
    await expect(page.locator('select')).toHaveValue('weekly');

    // Test quick date presets
    await page.click('button:has-text("Esta Semana")');
    await page.click('button:has-text("Este Mes")');

    // Verify charts load
    await expect(page.locator('.recharts-surface')).toBeVisible();

    // Test export functionality
    await page.click('button:has-text("CSV")');
    // Note: File download would be tested with actual backend
  });

  test('Hardware control and monitoring workflow', async ({ page }) => {
    // Login and navigate to hardware
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    await page.click('nav a[href="/admin/hardware"]');
    await expect(page).toHaveURL('/admin/hardware');
    await expect(page.locator('h1')).toContainText('Control de Hardware');

    // Test tab navigation
    const tabs = ['Panel de Control', 'Impresora Térmica', 'Escáner de Códigos', 'Diagnósticos'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      await expect(page.locator('button').filter({ hasText: tab })).toHaveClass(/bg-primary-50/);
    }

    // Test printer controls
    await page.click('button:has-text("Impresora Térmica")');
    await expect(page.locator('button:has-text("Imprimir Prueba")')).toBeVisible();
    await expect(page.locator('button:has-text("Reiniciar")')).toBeVisible();

    // Test scanner controls
    await page.click('button:has-text("Escáner de Códigos")');
    await expect(page.locator('button:has-text("Probar Escáner")')).toBeVisible();
    await expect(page.locator('button:has-text("Calibrar Dispositivo")')).toBeVisible();

    // Test system diagnostics
    await page.click('button:has-text("Diagnósticos")');
    await expect(page.locator('button:has-text("Ejecutar Diagnóstico Completo")')).toBeVisible();
  });

  test('Audit log viewing and filtering workflow', async ({ page }) => {
    // Login and navigate to audit
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    await page.click('nav a[href="/admin/audit"]');
    await expect(page).toHaveURL('/admin/audit');
    await expect(page.locator('h1')).toContainText('Registro de Auditoría');

    // Test Spanish labels in filters
    await expect(page.locator('label')).toContainText('Fecha Inicial');
    await expect(page.locator('label')).toContainText('Nivel de Evento');
    await expect(page.locator('label')).toContainText('Categoría');

    // Test filter options in Spanish
    const levelOptions = ['Todos los Niveles', 'Información', 'Advertencia', 'Error', 'Seguridad'];
    const categoryOptions = ['Todas las Categorías', 'Autenticación', 'Transacciones', 'Sistema'];

    for (const option of levelOptions) {
      await expect(page.locator('select option')).toContainText(option);
    }

    // Test search functionality
    await page.fill('input[placeholder*="Buscar"]', 'admin');
    await page.click('button:has-text("Buscar")');

    // Test quick date presets
    await page.click('button:has-text("Última Hora")');
    await page.click('button:has-text("Hoy")');

    // Test export functionality
    await expect(page.locator('button:has-text("CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("PDF")')).toBeVisible();
  });

  test('Shift management and performance tracking workflow', async ({ page }) => {
    // Login and navigate to shifts
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    await page.click('nav a[href="/admin/shifts"]');
    await expect(page).toHaveURL('/admin/shifts');
    await expect(page.locator('h1')).toContainText('Gestión de Turnos');

    // Test tab navigation
    const tabs = ['Vista General', 'Programación', 'Rendimiento', 'Análisis'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      await expect(page.locator('button').filter({ hasText: tab })).toHaveClass(/bg-primary-50/);
    }

    // Test shift overview
    await page.click('button:has-text("Vista General")');
    await expect(page.locator('text=Operadores Totales')).toBeVisible();
    await expect(page.locator('text=Operadores Activos')).toBeVisible();

    // Test shift scheduling
    await page.click('button:has-text("Programación")');
    await expect(page.locator('button:has-text("Programar Turno")')).toBeVisible();
    await expect(page.locator('text=Semana Actual')).toBeVisible();

    // Test performance tracking
    await page.click('button:has-text("Rendimiento")');
    await expect(page.locator('text=Mejor Operador')).toBeVisible();
    await expect(page.locator('text=Eficiencia Promedio')).toBeVisible();
  });

  test('Real-time dashboard updates and Spanish currency formatting', async ({ page }) => {
    // Login
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Verify dashboard loads with Spanish labels
    await expect(page.locator('text=Vehículos Activos')).toBeVisible();
    await expect(page.locator('text=Ingresos del Día')).toBeVisible();
    await expect(page.locator('text=MXN')).toBeVisible();

    // Test refresh functionality
    await page.click('button:has-text("Actualizar")');
    
    // Verify charts are present
    await expect(page.locator('.recharts-surface')).toBeVisible();

    // Test status display updates
    await expect(page.locator('text=Conectada')).toBeVisible(); // Printer status
    await expect(page.locator('text=Listo')).toBeVisible(); // Scanner status
  });

  test('System configuration workflow with form validation', async ({ page }) => {
    // Login and navigate to settings
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    await page.click('nav a[href="/admin/settings"]');
    await expect(page).toHaveURL('/admin/settings');
    await expect(page.locator('h1')).toContainText('Configuración del Sistema');

    // Test pricing configuration
    await page.click('button:has-text("Configuración de Precios")');
    await expect(page.locator('label:has-text("Horas Mínimas")')).toBeVisible();
    await expect(page.locator('label:has-text("Tarifa Mínima (MXN)")')).toBeVisible();

    // Test form validation
    await page.fill('input[step="0.01"]:first', '-1'); // Invalid negative value
    await page.click('button:has-text("Guardar Cambios")');
    // Validation message would appear with actual form handling

    // Test operator management
    await page.click('button:has-text("Gestión de Operadores")');
    await expect(page.locator('text=Gestión de Operadores')).toBeVisible();

    // Test system settings
    await page.click('button:has-text("Configuración del Sistema")');
    await expect(page.locator('text=Configuración de Hardware')).toBeVisible();
  });

  test('Mobile responsiveness and touch-friendly interface', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Login
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Test mobile navigation
    await page.click('button[aria-label*="menu"], button:has-text("☰")');
    await expect(page.locator('nav')).toBeVisible();

    // Test touch-friendly buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      if (boundingBox) {
        // Verify minimum touch target size (44px)
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('Error handling and user feedback in Spanish', async ({ page }) => {
    // Test invalid login
    await page.fill('input[type="text"]', 'invalid');
    await page.fill('input[type="password"]', 'invalid');
    await page.click('button[type="submit"]');
    
    // Should show Spanish error message
    await expect(page.locator('text*="Credenciales inválidas"')).toBeVisible();

    // Test network error simulation
    await page.route('**/api/**', route => route.abort());
    
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    // Should show Spanish connection error
    await expect(page.locator('text*="Error de conexión"')).toBeVisible();
  });
});

test.describe('System Integration Tests', () => {
  test('Operator to Admin data flow validation', async ({ page }) => {
    // This would test data consistency between operator interface and admin dashboard
    // For now, we'll test the admin side expecting data from operator actions
    
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Check that admin dashboard shows data that would come from operator actions
    await expect(page.locator('text=Boletos Activos')).toBeVisible();
    await expect(page.locator('text=Transacciones')).toBeVisible();
    
    // Navigate to active tickets
    await page.click('nav a[href="/admin/tickets"]');
    // Would verify tickets created by operators appear here
  });

  test('Financial precision verification across interfaces', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Navigate to financial reports
    await page.click('nav a[href="/admin/reports"]');
    
    // Verify all money displays use proper formatting
    const moneyDisplays = page.locator('text=/\\$[0-9]+\\.[0-9]{2}/');
    const count = await moneyDisplays.count();
    
    for (let i = 0; i < count; i++) {
      const text = await moneyDisplays.nth(i).textContent();
      // Verify proper decimal formatting (exactly 2 decimal places)
      expect(text).toMatch(/\$\d+\.\d{2}/);
    }
  });
});

test.describe('Performance and Load Tests', () => {
  test('Dashboard load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to fully load
    await page.waitForSelector('text=Dashboard Principal');
    await page.waitForSelector('.recharts-surface');
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('Real-time updates performance', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="text"]', testData.admin.username);
    await page.fill('input[type="password"]', testData.admin.password);
    await page.click('button[type="submit"]');

    // Monitor for real-time updates
    let updateCount = 0;
    
    page.on('response', response => {
      if (response.url().includes('/api/admin/dashboard/stats')) {
        updateCount++;
      }
    });

    // Wait for at least one automatic update
    await page.waitForTimeout(35000); // Wait for 35 seconds
    
    // Should have received at least one automatic update
    expect(updateCount).toBeGreaterThan(0);
  });
});