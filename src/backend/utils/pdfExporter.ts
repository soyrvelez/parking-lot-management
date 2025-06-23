import PDFDocument from 'pdfkit';
import moment from 'moment-timezone';
import { PassThrough } from 'stream';

// PDF styling constants
const COLORS = {
  primary: '#1f2937',
  secondary: '#6b7280',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444'
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique'
};

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface ReportOptions {
  title: string;
  subtitle?: string;
  period: string;
  generatedBy: string;
  company?: CompanyInfo;
}

export class PdfExporter {
  private doc: PDFKit.PDFDocument;
  private currentY: number = 0;
  private pageMargin = 50;
  private pageWidth: number;
  private pageHeight: number;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: this.pageMargin,
      info: {
        Title: 'Reporte de Estacionamiento',
        Author: 'Sistema de Gestión de Estacionamiento',
        Subject: 'Reporte Financiero',
        Creator: 'Parking Management System'
      }
    });
    
    this.pageWidth = this.doc.page.width - (this.pageMargin * 2);
    this.pageHeight = this.doc.page.height - (this.pageMargin * 2);
    this.currentY = this.pageMargin;
  }

  /**
   * Generate a complete PDF buffer from the document
   */
  public async generateBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new PassThrough();
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      
      this.doc.pipe(stream);
      this.doc.end();
    });
  }

  /**
   * Add header with company branding and report info
   */
  public addHeader(options: ReportOptions): void {
    // Company header
    if (options.company) {
      this.doc
        .fontSize(20)
        .font(FONTS.bold)
        .fillColor(COLORS.primary)
        .text(options.company.name, this.pageMargin, this.currentY);
      
      this.currentY += 25;
      
      this.doc
        .fontSize(10)
        .font(FONTS.regular)
        .fillColor(COLORS.secondary)
        .text(options.company.address, this.pageMargin, this.currentY)
        .text(`Tel: ${options.company.phone} | Email: ${options.company.email}`, this.pageMargin, this.currentY + 12);
      
      this.currentY += 40;
    }

    // Report title
    this.doc
      .fontSize(18)
      .font(FONTS.bold)
      .fillColor(COLORS.primary)
      .text(options.title, this.pageMargin, this.currentY, { align: 'center' });
    
    this.currentY += 25;

    if (options.subtitle) {
      this.doc
        .fontSize(14)
        .font(FONTS.regular)
        .fillColor(COLORS.secondary)
        .text(options.subtitle, this.pageMargin, this.currentY, { align: 'center' });
      
      this.currentY += 20;
    }

    // Report metadata
    const currentDate = moment().tz('America/Mexico_City').format('DD/MM/YYYY HH:mm:ss');
    
    this.doc
      .fontSize(10)
      .font(FONTS.regular)
      .fillColor(COLORS.secondary)
      .text(`Período: ${options.period}`, this.pageMargin, this.currentY)
      .text(`Generado: ${currentDate}`, this.pageMargin, this.currentY + 12)
      .text(`Por: ${options.generatedBy}`, this.pageMargin, this.currentY + 24);
    
    this.currentY += 50;

    // Add separator line
    this.addHorizontalLine();
    this.currentY += 20;
  }

  /**
   * Add a horizontal separator line
   */
  public addHorizontalLine(): void {
    this.doc
      .strokeColor(COLORS.secondary)
      .lineWidth(0.5)
      .moveTo(this.pageMargin, this.currentY)
      .lineTo(this.pageMargin + this.pageWidth, this.currentY)
      .stroke();
  }

  /**
   * Add a section header
   */
  public addSectionHeader(title: string): void {
    this.checkPageSpace(30);
    
    this.doc
      .fontSize(14)
      .font(FONTS.bold)
      .fillColor(COLORS.primary)
      .text(title, this.pageMargin, this.currentY);
    
    this.currentY += 25;
  }

  /**
   * Add summary statistics in a grid layout
   */
  public addSummaryStats(stats: { label: string; value: string; color?: string }[]): void {
    this.checkPageSpace(120);
    
    const cols = 2;
    const colWidth = this.pageWidth / cols;
    const startY = this.currentY;

    stats.forEach((stat, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = this.pageMargin + (col * colWidth);
      const y = startY + (row * 60);

      // Background box
      this.doc
        .fillColor('#f8fafc')
        .rect(x, y, colWidth - 10, 50)
        .fill();

      // Value
      this.doc
        .fontSize(18)
        .font(FONTS.bold)
        .fillColor(stat.color || COLORS.primary)
        .text(stat.value, x + 10, y + 8, { width: colWidth - 30, align: 'center' });

      // Label
      this.doc
        .fontSize(10)
        .font(FONTS.regular)
        .fillColor(COLORS.secondary)
        .text(stat.label, x + 10, y + 32, { width: colWidth - 30, align: 'center' });
    });

    const rows = Math.ceil(stats.length / cols);
    this.currentY += (rows * 60) + 20;
  }

  /**
   * Add a data table with headers and rows
   */
  public addTable(headers: string[], rows: string[][], options?: {
    columnWidths?: number[];
    headerBgColor?: string;
    alternateBg?: boolean;
  }): void {
    const tableOptions = {
      columnWidths: options?.columnWidths || headers.map(() => this.pageWidth / headers.length),
      headerBgColor: options?.headerBgColor || COLORS.primary,
      alternateBg: options?.alternateBg !== false
    };

    this.checkPageSpace(50 + (rows.length * 25));

    let tableY = this.currentY;

    // Table header
    this.doc
      .fillColor(tableOptions.headerBgColor)
      .rect(this.pageMargin, tableY, this.pageWidth, 25)
      .fill();

    let x = this.pageMargin;
    headers.forEach((header, index) => {
      this.doc
        .fontSize(10)
        .font(FONTS.bold)
        .fillColor('white')
        .text(header, x + 5, tableY + 8, { 
          width: tableOptions.columnWidths[index] - 10, 
          align: 'left' 
        });
      x += tableOptions.columnWidths[index];
    });

    tableY += 25;

    // Table rows
    rows.forEach((row, rowIndex) => {
      if (tableOptions.alternateBg && rowIndex % 2 === 1) {
        this.doc
          .fillColor('#f8fafc')
          .rect(this.pageMargin, tableY, this.pageWidth, 20)
          .fill();
      }

      let cellX = this.pageMargin;
      row.forEach((cell, cellIndex) => {
        this.doc
          .fontSize(9)
          .font(FONTS.regular)
          .fillColor(COLORS.primary)
          .text(cell, cellX + 5, tableY + 6, { 
            width: tableOptions.columnWidths[cellIndex] - 10, 
            align: cellIndex === 0 ? 'left' : 'right' 
          });
        cellX += tableOptions.columnWidths[cellIndex];
      });

      tableY += 20;
    });

    this.currentY = tableY + 20;
  }

  /**
   * Add a simple chart representation (text-based for now)
   */
  public addSimpleChart(title: string, data: { label: string; value: number; percentage: number }[]): void {
    this.checkPageSpace(100 + (data.length * 25));
    
    this.addSectionHeader(title);

    data.forEach((item) => {
      const barWidth = (item.percentage / 100) * (this.pageWidth - 150);
      
      // Label
      this.doc
        .fontSize(10)
        .font(FONTS.regular)
        .fillColor(COLORS.primary)
        .text(item.label, this.pageMargin, this.currentY, { width: 120 });

      // Bar background
      this.doc
        .fillColor('#f1f5f9')
        .rect(this.pageMargin + 125, this.currentY + 2, this.pageWidth - 150, 12)
        .fill();

      // Bar fill
      if (barWidth > 0) {
        this.doc
          .fillColor(COLORS.accent)
          .rect(this.pageMargin + 125, this.currentY + 2, barWidth, 12)
          .fill();
      }

      // Value
      this.doc
        .fontSize(9)
        .font(FONTS.bold)
        .fillColor(COLORS.primary)
        .text(`${item.value} (${item.percentage.toFixed(1)}%)`, 
               this.pageMargin + this.pageWidth - 80, this.currentY + 3, 
               { width: 75, align: 'right' });

      this.currentY += 20;
    });

    this.currentY += 10;
  }

  /**
   * Add footer with page numbers
   */
  public addFooter(): void {
    const bottomY = this.doc.page.height - 30;
    
    this.doc
      .fontSize(8)
      .font(FONTS.regular)
      .fillColor(COLORS.secondary)
      .text(`Página ${this.doc.bufferedPageRange().count}`, 
             this.pageMargin, bottomY, 
             { width: this.pageWidth, align: 'center' });
  }

  /**
   * Check if there's enough space on current page, add new page if needed
   */
  private checkPageSpace(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.doc.page.height - this.pageMargin - 50) {
      this.doc.addPage();
      this.currentY = this.pageMargin;
    }
  }

  /**
   * Get the current document instance
   */
  public getDocument(): PDFKit.PDFDocument {
    return this.doc;
  }
}

/**
 * Generate a summary report PDF
 */
export async function generateSummaryReportPdf(data: any, options: ReportOptions): Promise<Buffer> {
  const exporter = new PdfExporter();
  
  // Add header
  exporter.addHeader(options);
  
  // Summary statistics
  const summaryStats = [
    { label: 'Ingresos Totales', value: data.totalRevenue || '$0.00', color: COLORS.success },
    { label: 'Transacciones', value: data.totalTransactions?.toString() || '0', color: COLORS.primary },
    { label: 'Ticket Promedio', value: data.averageTicketValue || '$0.00', color: COLORS.accent },
    { label: 'Ocupación Máxima', value: data.peakOccupancy || '0%', color: COLORS.warning }
  ];
  
  exporter.addSummaryStats(summaryStats);
  
  // Peak hours chart
  if (data.peakHours && data.peakHours.length > 0) {
    const chartData = data.peakHours.map((hour: any) => ({
      label: `${hour.hour}:00`,
      value: hour.count,
      percentage: (hour.count / Math.max(...data.peakHours.map((h: any) => h.count))) * 100
    }));
    
    exporter.addSimpleChart('Horas Pico de Actividad', chartData);
  }
  
  // Transaction breakdown
  if (data.transactionChart && data.transactionChart.length > 0) {
    const transactionData = data.transactionChart.map((item: any) => ({
      label: item.type,
      value: item.count,
      percentage: (item.count / data.totalTransactions) * 100
    }));
    
    exporter.addSimpleChart('Distribución por Tipo de Transacción', transactionData);
  }
  
  // Add footer
  exporter.addFooter();
  
  return exporter.generateBuffer();
}

/**
 * Generate a transaction history PDF
 */
export async function generateTransactionHistoryPdf(data: any, options: ReportOptions): Promise<Buffer> {
  const exporter = new PdfExporter();
  
  // Add header
  exporter.addHeader(options);
  
  // Summary
  exporter.addSectionHeader('Resumen del Período');
  
  const summaryStats = [
    { label: 'Total Transacciones', value: data.summary?.totalCount?.toString() || '0' },
    { label: 'Ingresos del Período', value: data.summary?.totalRevenue || '$0.00', color: COLORS.success }
  ];
  
  exporter.addSummaryStats(summaryStats);
  
  // Transaction table
  if (data.transactions && data.transactions.length > 0) {
    exporter.addSectionHeader('Detalle de Transacciones');
    
    const headers = ['Fecha/Hora', 'Tipo', 'Placa', 'Monto', 'Estado'];
    const columnWidths = [120, 80, 80, 80, 80];
    
    const rows = data.transactions.map((transaction: any) => [
      moment(transaction.timestamp).tz('America/Mexico_City').format('DD/MM/YY HH:mm'),
      transaction.type || 'N/A',
      transaction.plateNumber || 'N/A',
      transaction.amount || '$0.00',
      transaction.status || 'N/A'
    ]);
    
    exporter.addTable(headers, rows, { columnWidths });
  }
  
  // Add footer
  exporter.addFooter();
  
  return exporter.generateBuffer();
}

/**
 * Generate a detailed report PDF combining summary and transactions
 */
export async function generateDetailedReportPdf(data: any, options: ReportOptions): Promise<Buffer> {
  const exporter = new PdfExporter();
  
  // Add header
  exporter.addHeader(options);
  
  // Summary section
  exporter.addSectionHeader('Resumen Financiero');
  
  const summaryStats = [
    { label: 'Ingresos Totales', value: data.totalRevenue || '$0.00', color: COLORS.success },
    { label: 'Transacciones', value: data.totalTransactions?.toString() || '0', color: COLORS.primary },
    { label: 'Ticket Promedio', value: data.averageTicketValue || '$0.00', color: COLORS.accent },
    { label: 'Ocupación Máxima', value: data.peakOccupancy || '0%', color: COLORS.warning }
  ];
  
  exporter.addSummaryStats(summaryStats);
  
  // Revenue by type section
  if (data.revenueByType && data.revenueByType.length > 0) {
    exporter.addSectionHeader('Ingresos por Tipo');
    
    const headers = ['Tipo de Transacción', 'Cantidad', 'Monto Total', 'Porcentaje'];
    const rows = data.revenueByType.map((item: any) => [
      item.type,
      item.count.toString(),
      item.revenue,
      `${item.percentage.toFixed(1)}%`
    ]);
    
    exporter.addTable(headers, rows, {
      columnWidths: [140, 80, 100, 100]
    });
  }
  
  // Hourly breakdown section
  if (data.hourlyBreakdown && data.hourlyBreakdown.length > 0) {
    exporter.addSectionHeader('Distribución por Hora');
    
    const headers = ['Hora', 'Entradas', 'Salidas', 'Ingresos'];
    const rows = data.hourlyBreakdown.map((hour: any) => [
      `${hour.hour}:00`,
      hour.entries.toString(),
      hour.exits.toString(),
      hour.revenue
    ]);
    
    exporter.addTable(headers, rows, {
      columnWidths: [80, 90, 90, 160]
    });
  }
  
  // Recent transactions section (limited to top 20)
  if (data.recentTransactions && data.recentTransactions.length > 0) {
    exporter.addSectionHeader('Transacciones Recientes (Últimas 20)');
    
    const headers = ['Fecha/Hora', 'Tipo', 'Placa', 'Duración', 'Monto'];
    const rows = data.recentTransactions.slice(0, 20).map((transaction: any) => [
      moment(transaction.timestamp).tz('America/Mexico_City').format('DD/MM HH:mm'),
      transaction.type || 'N/A',
      transaction.plateNumber || 'N/A',
      transaction.duration || 'N/A',
      transaction.amount || '$0.00'
    ]);
    
    exporter.addTable(headers, rows, {
      columnWidths: [90, 70, 70, 70, 120]
    });
  }
  
  // Statistics footer
  if (data.statistics) {
    exporter.addSectionHeader('Estadísticas del Período');
    
    const stats = [
      { label: 'Tiempo Promedio de Estancia', value: data.statistics.averageStayTime || 'N/A' },
      { label: 'Hora Pico', value: data.statistics.peakHour || 'N/A' },
      { label: 'Tickets Perdidos', value: data.statistics.lostTickets?.toString() || '0' },
      { label: 'Pensiones Activas', value: data.statistics.activePensions?.toString() || '0' }
    ];
    
    exporter.addSummaryStats(stats);
  }
  
  // Add footer
  exporter.addFooter();
  
  return exporter.generateBuffer();
}

/**
 * Sanitize filename for security
 */
export function sanitizePdfFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\-_\.]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100);
}