/**
 * Secure CSV Exporter
 * Prevents CSV injection attacks and formats data for Mexican Spanish
 */

import { Money } from '../../shared/utils/money';

/**
 * Escape CSV value to prevent injection attacks
 * Follows RFC 4180 standards
 */
export function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  let stringValue = String(value);

  // Check if value needs escaping
  const needsQuoting = 
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.includes('\t') ||
    stringValue.startsWith(' ') ||
    stringValue.endsWith(' ');

  // Always quote potentially dangerous formulas
  const isDangerous = 
    stringValue.startsWith('=') ||
    stringValue.startsWith('+') ||
    stringValue.startsWith('-') ||
    stringValue.startsWith('@') ||
    stringValue.startsWith('\t') ||
    stringValue.startsWith('\r');

  if (isDangerous) {
    // Add space prefix to prevent formula execution
    stringValue = ' ' + stringValue;
  }

  if (needsQuoting || isDangerous) {
    // Escape quotes by doubling them
    stringValue = stringValue.replace(/"/g, '""');
    // Wrap in quotes
    return `"${stringValue}"`;
  }

  return stringValue;
}

/**
 * Generate CSV header row
 */
export function generateCsvHeader(headers: string[]): string {
  return headers.map(escapeCsvValue).join(',');
}

/**
 * Generate CSV data row
 */
export function generateCsvRow(values: any[]): string {
  return values.map(escapeCsvValue).join(',');
}

/**
 * Generate complete CSV content with BOM for Excel compatibility
 */
export function generateCsvContent(headers: string[], rows: any[][]): string {
  // UTF-8 BOM for proper Spanish character display in Excel
  const BOM = '\uFEFF';
  
  const headerRow = generateCsvHeader(headers);
  const dataRows = rows.map(row => generateCsvRow(row));
  
  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Format daily report as secure CSV
 */
export function formatDailyReportCsv(reportData: any): string {
  const headers = [
    'Fecha',
    'Ingresos Totales',
    'Efectivo',
    'Boletos Extraviados',
    'Pensiones',
    'Total Transacciones',
    'Vehículos Totales',
    'Vehículos Completados',
    'Vehículos Activos',
    'Duración Promedio',
    'Hora Pico',
    'Transacciones Hora Pico'
  ];

  const rows: any[][] = [];

  // Add summary row
  rows.push([
    reportData.date,
    reportData.revenue.total,
    reportData.revenue.cash,
    reportData.revenue.lostTickets,
    reportData.revenue.pension,
    reportData.transactions.total,
    reportData.vehicles.total,
    reportData.vehicles.completed,
    reportData.vehicles.active,
    reportData.averageDuration,
    reportData.peakHours[0]?.hour ? `${reportData.peakHours[0].hour}:00` : 'N/A',
    reportData.peakHours[0]?.count || 0
  ]);

  // Add transaction breakdown if available
  if (reportData.transactions.byType && reportData.transactions.byType.length > 0) {
    rows.push([]); // Empty row
    rows.push(['Desglose por Tipo de Transacción']);
    rows.push(['Tipo', 'Cantidad', 'Total']);
    
    reportData.transactions.byType.forEach((type: any) => {
      rows.push([
        type.typeDisplay,
        type.count,
        reportData.revenue.breakdown[type.type]?.amount || '$0.00'
      ]);
    });
  }

  // Add hourly breakdown if available
  if (reportData.peakHours && reportData.peakHours.length > 0) {
    rows.push([]); // Empty row
    rows.push(['Actividad por Hora']);
    rows.push(['Hora', 'Vehículos']);
    
    reportData.peakHours.forEach((hour: any) => {
      rows.push([
        `${hour.hour}:00`,
        hour.count
      ]);
    });
  }

  return generateCsvContent(headers, rows);
}

/**
 * Format monthly report as secure CSV
 */
export function formatMonthlyReportCsv(reportData: any): string {
  const headers = [
    'Mes',
    'Año',
    'Ingresos Totales',
    'Total Transacciones',
    'Total Vehículos',
    'Duración Promedio',
    'Promedio Diario - Ingresos',
    'Promedio Diario - Transacciones',
    'Promedio Diario - Vehículos',
    'Crecimiento Ingresos',
    'Crecimiento Transacciones'
  ];

  const mainRow = [
    reportData.monthName,
    reportData.year,
    reportData.totalRevenue,
    reportData.totalTransactions,
    reportData.totalVehicles,
    reportData.averageDuration,
    reportData.dailyAverages.revenue,
    reportData.dailyAverages.transactions,
    reportData.dailyAverages.vehicles,
    reportData.trends.revenueGrowth || 'N/A',
    reportData.trends.transactionGrowth || 'N/A'
  ];

  const rows: any[][] = [mainRow];

  // Add top performing days
  if (reportData.topDays && reportData.topDays.length > 0) {
    rows.push([]); // Empty row
    rows.push(['Días con Mayor Actividad']);
    rows.push(['Fecha', 'Ingresos', 'Transacciones', 'Vehículos']);
    
    reportData.topDays.forEach((day: any) => {
      rows.push([
        day.date,
        day.revenue,
        day.transactions,
        day.vehicles
      ]);
    });
  }

  return generateCsvContent(headers, rows);
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators and dangerous characters
  return filename
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\.+/g, '.')
    .substring(0, 255); // Limit length
}