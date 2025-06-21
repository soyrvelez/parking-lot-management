/**
 * Hardware Integration Types
 * Defines interfaces for thermal printer and barcode scanner integration
 */

export interface PrinterConfig {
  host: string;
  port: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  paperWidth: number; // Characters per line (58mm = 32 chars)
  encoding: string;
}

export interface PrintJob {
  id: string;
  type: 'ENTRY_TICKET' | 'PAYMENT_RECEIPT' | 'LOST_TICKET' | 'PENSION_RECEIPT' | 'TEST_PRINT';
  content: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
  status: 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  error?: string;
}

export interface PrinterStatus {
  connected: boolean;
  online: boolean;
  paperStatus: 'OK' | 'LOW' | 'OUT' | 'JAM' | 'UNKNOWN';
  coverOpen: boolean;
  cutterStatus: 'OK' | 'ERROR' | 'UNKNOWN';
  temperature: 'NORMAL' | 'HIGH' | 'UNKNOWN';
  lastError?: string;
  lastUpdate: Date;
  queueLength: number;
  totalPrintJobs: number;
  failedJobs: number;
}

export interface ReceiptData {
  ticketNumber: string;
  plateNumber: string;
  entryTime: Date;
  exitTime?: Date;
  durationMinutes?: number;
  totalAmount: number;
  paymentMethod?: 'EFECTIVO' | 'PENSION';
  change?: number;
  cashReceived?: number; // Amount of cash received
  lostTicketFee?: number; // Fee for lost ticket
  type: 'ENTRY' | 'PAYMENT' | 'LOST_TICKET' | 'PENSION';
  customerName?: string; // For pension customers
  validUntil?: Date; // For pension receipts
}

export interface ScannerConfig {
  device: string;
  timeout: number;
  barcodeFormat: 'CODE39' | 'CODE128' | 'QR';
  autoFocus: boolean;
  inputElement?: string; // CSS selector for input focus
}

export interface ScanResult {
  code: string;
  format: string;
  timestamp: Date;
  quality: number;
  source: 'SCANNER' | 'MANUAL';
}

export interface HardwareError {
  type: 'PRINTER' | 'SCANNER' | 'CONNECTION';
  code: string;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  resolved: boolean;
  resolutionTime?: Date;
}

export interface ScannerStatus {
  connected: boolean;
  ready: boolean;
  lastScan?: Date;
  totalScans: number;
  failedScans: number;
  timeoutCount: number;
  manualEntryCount: number;
  focusActive: boolean;
  lastUpdate: Date;
}

export interface HardwareHealth {
  printer: PrinterStatus;
  scanner: ScannerStatus;
  lastHealthCheck: Date;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE';
  errors: HardwareError[];
}

// Constants for hardware configuration
export const HARDWARE_CONSTANTS = {
  PRINTER: {
    DEFAULT_HOST: '192.168.1.100',
    DEFAULT_PORT: 9100,
    DEFAULT_TIMEOUT: 5000,
    DEFAULT_RETRY_ATTEMPTS: 3,
    DEFAULT_RETRY_DELAY: 2000,
    PAPER_WIDTH_58MM: 32, // Characters
    ENCODING: 'utf8',
    LINE_SEPARATOR: '\n',
    CUT_COMMAND: '\x1D\x56\x42\x00', // ESC/POS cut command
    FEED_LINES: 3
  },
  SCANNER: {
    DEFAULT_TIMEOUT: 30000, // 30 seconds
    BARCODE_FORMAT: 'CODE39',
    FOCUS_SELECTOR: '#barcode-input'
  },
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
  MAX_QUEUE_SIZE: 100,
  MAX_RETRY_ATTEMPTS: 5
} as const;
             
             export interface ManualEntryOptions {
               timeoutMs: number;
               placeholder: string;
               validationPattern?: RegExp;
               maxLength?: number;
               allowCancel: boolean;
             }
             
             export interface FocusManagerOptions {
               targetSelector: string;
               aggressiveMode: boolean;
               blurTimeout: number;
               retryInterval: number;
               maxRetries: number;
             }
export type PrinterConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type ScannerConnectionState = 'READY' | 'SCANNING' | 'DISCONNECTED' | 'ERROR';