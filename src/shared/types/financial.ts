/**
 * Shared TypeScript types for financial operations
 * Ensures type safety across frontend and backend
 */

import { Money } from '../utils/money';

// Currency configuration for Mexican Pesos
export interface CurrencyConfig {
  code: 'MXN';
  symbol: '$';
  decimalPlaces: 2;
  thousandsSeparator: ',';
  decimalSeparator: '.';
  maxBillValue: number;
  minTransactionAmount: number;
  maxTransactionAmount: number;
}

// Pricing calculation breakdown
export interface PricingBreakdown {
  minimumCharge: Money;
  additionalIncrements: number;
  incrementCharges: Money;
  totalMinutes: number;
  dailySpecialApplied: boolean;
  specialDiscount?: Money;
  totalAmount: Money;
}

// Payment transaction details
export interface PaymentDetails {
  ticketId: string;
  amount: Money;
  amountPaid: Money;
  change: Money;
  paymentMethod: 'CASH' | 'PENSION';
  operatorId: string;
  timestamp: Date;
}

// Cash register reconciliation
export interface CashReconciliation {
  openingBalance: Money;
  expectedBalance: Money;
  countedBalance: Money;
  discrepancy: Money;
  isValid: boolean;
  transactions: Money[];
  deposits: Money[];
  withdrawals: Money[];
}

// Financial transaction record
export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  amount: Money;
  description?: string;
  balanceBefore?: Money;
  balanceAfter?: Money;
  changeGiven?: Money;
  paymentMethod?: string;
  timestamp: Date;
  operatorId?: string;
  ticketId?: string;
  pensionId?: string;
}

// Transaction types
export type TransactionType = 
  | 'PARKING'
  | 'PENSION'
  | 'LOST_TICKET'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'CLOSING_BALANCE';

// Localization Types
export interface LocaleConfig {
  language: 'es-MX';
  country: 'MX';
  timezone: 'America/Mexico_City';
  currency: 'MXN';
  dateFormat: 'DD/MM/YYYY';
  timeFormat: '24h';
}

export interface TranslationKey {
  // Parking Operations
  parking: {
    ticket: string;
    entry: string;
    exit: string;
    payment: string;
    cash: string;
    change: string;
    total: string;
    time: string;
    plate: string;
    parking_lot: string;
    receipt: string;
    lost_ticket: string;
    pension: string;
    monthly: string;
  };
  
  // Hardware Status
  hardware: {
    printer_connected: string;
    printer_disconnected: string;
    printer_error: string;
    scanner_ready: string;
    scanner_error: string;
    hardware_check: string;
    connection_failed: string;
    retry_connection: string;
    receipt_printing: string;
    scan_timeout: string;
    hardware_maintenance: string;
    connection_restored: string;
    manual_entry_required: string;
  };
  
  // Business Logic Errors
  errors: {
    insufficient_funds: string;
    ticket_not_found: string;
    invalid_barcode: string;
    payment_required: string;
    cash_register_error: string;
    calculation_error: string;
    transaction_failed: string;
    invalid_amount: string;
    exceeds_maximum: string;
    hardware_unavailable: string;
  };
  
  // Time and Date
  time: {
    minutes: string;
    hours: string;
    days: string;
    today: string;
    yesterday: string;
    morning: string;
    afternoon: string;
    evening: string;
    night: string;
  };
  
  // Currency and Numbers
  currency: {
    pesos: string;
    centavos: string;
    free: string;
    owed: string;
    paid: string;
    due: string;
    balance: string;
    total_collected: string;
  };
  
  // UI Actions
  actions: {
    scan: string;
    print: string;
    calculate: string;
    pay: string;
    cancel: string;
    retry: string;
    confirm: string;
    continue: string;
    back: string;
    clear: string;
    enter_manually: string;
  };
  
  // Status Messages
  status: {
    processing: string;
    completed: string;
    failed: string;
    waiting: string;
    printing: string;
    calculating: string;
    scanning: string;
    connecting: string;
  };
  
  // Validation Messages
  validation: {
    required_field: string;
    invalid_format: string;
    plate_required: string;
    amount_required: string;
    scan_barcode: string;
    enter_plate: string;
  };
  
  // Customer Service (Formal 'usted' treatment)
  customer: {
    welcome: string;
    thank_you: string;
    please_wait: string;
    please_pay: string;
    please_scan: string;
    thank_you_payment: string;
    have_receipt: string;
    drive_safely: string;
    assistance_needed: string;
    call_attendant: string;
  };
  
  // Receipt Templates
  receipt: {
    header_line1: string;
    header_line2: string;
    separator_line: string;
    entry_time_label: string;
    exit_time_label: string;
    duration_label: string;
    rate_label: string;
    total_label: string;
    payment_method_label: string;
    change_label: string;
    footer_thank_you: string;
    footer_drive_safely: string;
  };
}

// Cash flow types
export type CashFlowType = 
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'ADJUSTMENT'
  | 'OPENING_BALANCE'
  | 'CLOSING_BALANCE';

// Financial validation errors
export interface FinancialError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

// Audit log entry for financial operations
export interface FinancialAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  performedBy?: string;
  ipAddress?: string;
  timestamp: Date;
}

// Constants for financial operations
const FINANCIAL_CONSTANTS = {
  CURRENCY: 'MXN' as const,
  DECIMAL_PLACES: 2,
  MAX_AMOUNT: 9999.99,
  MIN_AMOUNT: 0.01,
  MAX_BILL_VALUE: 500.00,
  LOST_TICKET_FEE: 50.00,
  GRACE_PERIOD_MINUTES: 15,
  
  // Common denominations for change calculation
  DENOMINATIONS: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.01] as const,
  
  // Validation patterns
  MONEY_REGEX: /^\d+(\.\d{1,2})?$/,
  PLATE_REGEX: /^[A-Z]{3}-[0-9]{3}$/
} as const;

// Export for convenience
export { FINANCIAL_CONSTANTS };