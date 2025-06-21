/**
 * CSV Security Test Suite
 * Validates protection against CSV injection attacks
 */

import { 
  escapeCsvValue, 
  generateCsvHeader, 
  generateCsvRow,
  sanitizeFilename,
  formatDailyReportCsv 
} from '../utils/csvExporter';

describe('CSV Export Security', () => {
  describe('CSV Injection Prevention', () => {
    it('should escape formula injection attempts', () => {
      const maliciousValues = [
        '=1+1',
        '+1+1',
        '-1+1',
        '@SUM(A1:A10)',
        '\t=1+1',
        '\r=1+1'
      ];

      maliciousValues.forEach(value => {
        const escaped = escapeCsvValue(value);
        expect(escaped).toMatch(/^".*"$/); // Should be quoted
        expect(escaped).not.toMatch(/^[=+\-@\t\r]/); // Should not start with dangerous chars
      });
    });

    it('should properly escape quotes', () => {
      const value = 'Test "quoted" value';
      const escaped = escapeCsvValue(value);
      expect(escaped).toBe('"Test ""quoted"" value"');
    });

    it('should handle commas correctly', () => {
      const value = 'Test, with, commas';
      const escaped = escapeCsvValue(value);
      expect(escaped).toBe('"Test, with, commas"');
    });

    it('should handle newlines correctly', () => {
      const value = 'Test\nwith\nnewlines';
      const escaped = escapeCsvValue(value);
      expect(escaped).toBe('"Test\nwith\nnewlines"');
    });

    it('should handle null and undefined safely', () => {
      expect(escapeCsvValue(null)).toBe('');
      expect(escapeCsvValue(undefined)).toBe('');
    });

    it('should handle leading/trailing spaces', () => {
      const value = ' test ';
      const escaped = escapeCsvValue(value);
      expect(escaped).toBe('" test "');
    });
  });

  describe('CSV Generation', () => {
    it('should generate secure headers', () => {
      const headers = ['Fecha', 'Total=SUM(B:B)', 'Descripción'];
      const headerRow = generateCsvHeader(headers);
      
      expect(headerRow).toContain('"Total=SUM(B:B)"');
      expect(headerRow.split(',').length).toBe(3);
    });

    it('should generate secure data rows', () => {
      const row = ['2024-01-15', '=1+1', '$150.00 pesos'];
      const csvRow = generateCsvRow(row);
      
      expect(csvRow).toContain('"=1+1"');
      expect(csvRow).not.toMatch(/(?<!")[=]/); // = should always be within quotes
    });

    it('should include BOM for Spanish characters', () => {
      const reportData = {
        date: '2024-01-15',
        revenue: {
          total: '$500.00 pesos',
          cash: '$400.00 pesos',
          lostTickets: '$50.00 pesos',
          pension: '$50.00 pesos'
        },
        transactions: {
          total: 25,
          byType: []
        },
        vehicles: {
          total: 20,
          completed: 18,
          active: 2
        },
        averageDuration: '2 horas 15 minutos',
        peakHours: [{ hour: 14, count: 8 }]
      };

      const csv = formatDailyReportCsv(reportData);
      expect(csv.charCodeAt(0)).toBe(0xFEFF); // UTF-8 BOM
    });
  });

  describe('Filename Sanitization', () => {
    it('should remove path traversal attempts', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        'file/with/slashes.csv',
        'file\\with\\backslashes.csv'
      ];

      maliciousFilenames.forEach(filename => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
      });
    });

    it('should handle special characters', () => {
      const filename = 'report:2024-01-15*?.csv';
      const sanitized = sanitizeFilename(filename);
      
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('*');
      expect(sanitized).not.toContain('?');
      expect(sanitized).toContain('.csv');
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300) + '.csv';
      const sanitized = sanitizeFilename(longFilename);
      
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });
  });

  describe('Report CSV Formatting', () => {
    it('should escape all values in daily report', () => {
      const reportData = {
        date: '2024-01-15',
        revenue: {
          total: '=$A$1',
          cash: '$400.00 pesos',
          lostTickets: '@SUM(A1:A10)',
          pension: '+cmd|"/c calc"!A1'
        },
        transactions: {
          total: 25,
          byType: [{
            type: 'PARKING',
            typeDisplay: 'Estacionamiento',
            count: 20
          }]
        },
        vehicles: {
          total: 20,
          completed: 18,
          active: 2
        },
        averageDuration: '2 horas',
        peakHours: [{ hour: 14, count: 8 }],
        revenue: {
          breakdown: {
            PARKING: { amount: '$400.00 pesos' }
          }
        }
      };

      const csv = formatDailyReportCsv(reportData);
      
      // Check that dangerous values are quoted
      expect(csv).toContain('"=$A$1"');
      expect(csv).toContain('"@SUM(A1:A10)"');
      expect(csv).toContain('"+cmd|"/c calc"!A1"');
      
      // Ensure no unescaped formulas
      const lines = csv.split('\n');
      lines.forEach(line => {
        // Skip BOM on first line
        const checkLine = line.charCodeAt(0) === 0xFEFF ? line.substring(1) : line;
        expect(checkLine).not.toMatch(/^[=+\-@]/);
      });
    });
  });
});