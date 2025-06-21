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
    vehicle_already_inside: string;
    entry_successful: string;
    ticket_not_found: string;
    ticket_already_processed: string;
    barcode_mismatch: string;
    free_period: string;
    payment_required: string;
    insufficient_payment: string;
    payment_successful: string;
    payment_required_for_exit: string;
    exit_successful: string;
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
    queue_full: string;
    print_failed: string;
    execution_error: string;
    health_check_failed: string;
    test_print: string;
    test_successful: string;
    scan_already_active: string;
    empty_scan_buffer: string;
    invalid_barcode: string;
    manual_entry_already_active: string;
    manual_entry_timeout: string;
    no_manual_entry_active: string;
    invalid_manual_input: string;
    enter_manually_placeholder: string;
    barcode_too_short: string;
    barcode_too_long: string;
    invalid_code39_characters: string;
    empty_input: string;
    focus_element_not_found: string;
    scanner_destroyed: string;
  };
  
  // Payment and transaction translations
  payment: {
    insufficient_amount: string;
    insufficient_lost_ticket_fee: string;
    payment_successful: string;
    payment_failed: string;
    change_amount: string;
  };
  
  // Transaction descriptions
  transaction: {
    parking_payment: string;
    lost_ticket_fee: string;
    pension_payment: string;
    refund: string;
    parking: string;
    pension: string;
    lost_ticket: string;
    lost_ticket_fee_no_original: string;
    withdrawal: string;
    deposit: string;
    adjustment: string;
    opening_balance: string;
    closing_balance: string;
  };
  
  // Pension customer translations
  pension: {
    inactive_customer: string;
    expired_customer: string;
    valid_customer: string;
    renewal_required: string;
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
    plate_too_long: string;
    plate_invalid_format: string;
    barcode_too_short: string;
    barcode_too_long: string;
    barcode_invalid_chars: string;
    amount_positive: string;
    amount_too_large: string;
    amount_invalid: string;
    ticket_required: string;
    operator_required: string;
    field_invalid: string;
    request_invalid: string;
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
    keep_receipt: string;
    enjoy_service: string;
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
    parking_title: string;
    entry_ticket: string;
    payment_receipt: string;
    lost_ticket: string;
    pension_receipt: string;
    ticket_number: string;
    plate_number: string;
    entry_time: string;
    exit_time: string;
    total_time: string;
    total_amount: string;
    payment_method: string;
    change_given: string;
    lost_ticket_fee: string;
    customer_name: string;
    monthly_pension: string;
    valid_until: string;
  };
  
  // Payment Methods
  paymentMethods: {
    efectivo: string;
    pension: string;
  };
  
  // Authentication
  auth: {
    token_required: string;
    token_invalid: string;
    authentication_failed: string;
    insufficient_permissions: string;
  };
  
  // Cash Register Management
  cash: {
    register_already_open: string;
    register_opened_successfully: string;
    no_open_register: string;
    register_balanced: string;
    register_discrepancy_detected: string;
    deposit_successful: string;
    withdrawal_successful: string;
    register_status_active: string;
    count_completed: string;
    history_retrieved: string;
  };
  
  // System Messages
  system: {
    health_check_ok: string;
    server_started: string;
    server_healthy: string;
    shutdown_initiated: string;
    shutdown_complete: string;
    pricing_not_configured: string;
    feature_coming_soon: string;
  };
  
  // Database Errors
  database: {
    operation_failed: string;
    duplicate_entry: string;
    record_not_found: string;
    foreign_key_constraint: string;
  };
  
  // Administration
  admin: {
    dashboard_loading: string;
    dashboard_metrics_retrieved: string;
    dashboard_error: string;
    peak_hour_description: string;
    no_peak_data: string;
    daily_report_generated: string;
    monthly_report_generated: string;
    report_generation_error: string;
    audit_log_retrieved: string;
    audit_log_error: string;
    system_health_retrieved: string;
    health_check_error: string;
    database_healthy: string;
    database_error: string;
    auth_service_healthy: string;
    operator_created_successfully: string;
    operator_updated_successfully: string;
    operator_not_found: string;
    email_already_exists: string;
    operators_retrieved: string;
    operators_retrieval_error: string;
    hourly_activity: string;
  };
  
  // Audit Log Actions
  audit: {
    payment_processed: string;
    vehicle_entry: string;
    vehicle_exit: string;
    ticket_created: string;
    ticket_updated: string;
    cash_register_opened: string;
    cash_register_closed: string;
    cash_adjustment: string;
    operator_created: string;
    operator_updated: string;
    lost_ticket_processed: string;
    system_backup: string;
  };
  
  // User Roles
  roles: {
    admin: string;
    manager: string;
    viewer: string;
    operator: string;
  };
  
  // Months for reports
  months: string[];
  
  // Additional Validation Messages
  validationExtended: {
    operator_id_required: string;
    invalid_amount: string;
    description_required: string;
    count_must_be_positive: string;
  };
  
  // System Error Messages
  systemErrors: {
    rate_limit_exceeded: string;
    endpoint_not_found: string;
    internal_server_error: string;
    insufficient_funds: string;
    cash_register_error: string;
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