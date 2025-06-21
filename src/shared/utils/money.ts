/**
 * Money utility class for handling Mexican Peso (MXN) calculations
 * Uses Decimal.js to prevent floating point arithmetic errors
 * Enforces business rules for parking lot financial operations
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for Mexican Pesos
Decimal.set({
  precision: 20,           // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP,  // Standard rounding for Mexican currency
  minE: -9e15,
  maxE: 9e15,
  toExpNeg: -7,
  toExpPos: 21
});

export class Money {
  private value: Decimal;
  
  // Business constants for Mexican parking operations
  private static readonly MAX_AMOUNT = new Decimal('9999.99');
  private static readonly MIN_AMOUNT = new Decimal('0.00');
  private static readonly MAX_BILL_VALUE = new Decimal('500.00');
  private static readonly DECIMAL_PLACES = 2;
  
  // Static zero instance for common use
  public static readonly ZERO = new Money('0.00');

  constructor(amount: string | number | Decimal | Money, allowNegative: boolean = false) {
    if (amount instanceof Money) {
      this.value = amount.value;
    } else {
      this.value = new Decimal(amount);
    }
    this.validate(allowNegative);
  }

  /**
   * Validates monetary amount according to business rules
   */
  private validate(allowNegative: boolean = false): void {
    if (this.value.isNaN() || !this.value.isFinite()) {
      throw new Error('Cantidad monetaria inválida');
    }
    
    if (!allowNegative && this.value.lessThan(Money.MIN_AMOUNT)) {
      throw new Error('No se permiten cantidades negativas');
    }
    
    if (this.value.greaterThan(Money.MAX_AMOUNT)) {
      throw new Error('Cantidad excede el máximo permitido de $9,999.99');
    }
    
    // Auto-round if more than 2 decimal places (for internal calculations)
    if (this.value.decimalPlaces() > Money.DECIMAL_PLACES) {
      this.value = this.value.toDecimalPlaces(Money.DECIMAL_PLACES, Decimal.ROUND_HALF_UP);
    }
  }

  /**
   * Addition with overflow protection
   */
  add(other: Money): Money {
    const result = this.value.plus(other.value);
    if (result.greaterThan(Money.MAX_AMOUNT)) {
      throw new Error('La suma excede el monto máximo permitido');
    }
    return new Money(result);
  }

  /**
   * Subtraction with underflow protection
   */
  subtract(other: Money): Money {
    const result = this.value.minus(other.value);
    if (result.lessThan(Money.MIN_AMOUNT)) {
      throw new Error('Fondos insuficientes');
    }
    return new Money(result);
  }

  /**
   * Multiplication with precision preservation
   */
  multiply(factor: number | Decimal): Money {
    if (typeof factor === 'number' && (isNaN(factor) || !isFinite(factor))) {
      throw new Error('Factor de multiplicación inválido');
    }
    const result = this.value.times(factor);
    return new Money(result);
  }

  /**
   * Division with precision preservation
   */
  divide(divisor: number | Decimal): Money {
    if (typeof divisor === 'number' && (isNaN(divisor) || !isFinite(divisor))) {
      throw new Error('Divisor inválido');
    }
    const divisorDecimal = new Decimal(divisor);
    if (divisorDecimal.isZero()) {
      throw new Error('No se puede dividir por cero');
    }
    const result = this.value.dividedBy(divisorDecimal);
    return new Money(result);
  }

  /**
   * Round to nearest centavo (Mexican currency standard)
   */
  round(): Money {
    return new Money(this.value.toFixed(Money.DECIMAL_PLACES));
  }

  /**
   * Compare with another Money instance
   */
  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  lessThanOrEqual(other: Money): boolean {
    return this.value.lessThanOrEqualTo(other.value);
  }

  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  /**
   * Calculate change needed for a payment
   */
  calculateChange(amountPaid: Money): Money {
    if (amountPaid.lessThan(this)) {
      throw new Error('El monto pagado es insuficiente');
    }
    return amountPaid.subtract(this);
  }

  /**
   * Validate if amount can be paid with available bills
   */
  validateBillPayment(billAmount: Money): void {
    if (billAmount.greaterThan(new Money(Money.MAX_BILL_VALUE))) {
      throw new Error('No se aceptan billetes mayores a $500 pesos');
    }
    
    if (billAmount.lessThan(this)) {
      throw new Error('El billete no cubre el monto total');
    }
  }

  /**
   * Split amount into bill denominations (for change calculation)
   */
  splitIntoDenominations(): { [key: string]: number } {
    const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.01];
    const result: { [key: string]: number } = {};
    let remaining = this.value;

    for (const denom of denominations) {
      const denomDecimal = new Decimal(denom);
      const count = remaining.dividedBy(denomDecimal).floor().toNumber();
      if (count > 0) {
        result[`$${denom}`] = count;
        remaining = remaining.minus(denomDecimal.times(count));
      }
    }

    return result;
  }

  /**
   * Format for display with Mexican peso symbol and locale
   */
  format(): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.value.toNumber());
  }

  /**
   * Format for compact display (thermal printer)
   */
  formatCompact(): string {
    return `$${this.value.toFixed(2)}`;
  }

  /**
   * Format for Mexican peso display (business receipts)
   */
  formatPesos(): string {
    return `$${this.value.toFixed(2)} pesos`;
  }

  /**
   * Format for database storage (string with exactly 2 decimal places)
   */
  toDatabase(): string {
    return this.value.toFixed(Money.DECIMAL_PLACES);
  }

  /**
   * Convert to Decimal for advanced calculations
   */
  toDecimal(): Decimal {
    return this.value;
  }

  /**
   * Convert to number (use with caution)
   */
  toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * String representation for logging and debugging
   */
  toString(): string {
    return this.value.toFixed(Money.DECIMAL_PLACES);
  }

  /**
   * JSON serialization
   */
  toJSON(): string {
    return this.toDatabase();
  }

  /**
   * Static factory methods
   */
  static zero(): Money {
    return new Money('0.00');
  }

  static fromCentavos(centavos: number): Money {
    return new Money(new Decimal(centavos).dividedBy(100));
  }

  static fromPesos(pesos: number): Money {
    return new Money(pesos);
  }

  static fromNumber(amount: number): Money {
    return new Money(amount);
  }

  /**
   * Parse from various input formats
   */
  static parse(input: string): Money {
    // Remove currency symbols and spaces
    const cleaned = input.replace(/[\$\s,]/g, '');
    
    // Validate format
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      throw new Error('Formato de dinero inválido');
    }
    
    return new Money(cleaned);
  }

  /**
   * Validate string amount without creating instance
   */
  static isValid(input: string | number): boolean {
    try {
      new Money(input);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sum an array of Money instances
   */
  static sum(amounts: Money[]): Money {
    return amounts.reduce((total, amount) => total.add(amount), Money.zero());
  }

  /**
   * Find minimum amount in array
   */
  static min(amounts: Money[]): Money {
    if (amounts.length === 0) {
      throw new Error('Cannot find minimum of empty array');
    }
    return amounts.reduce((min, amount) => amount.lessThan(min) ? amount : min);
  }

  /**
   * Find maximum amount in array
   */
  static max(amounts: Money[]): Money {
    if (amounts.length === 0) {
      throw new Error('Cannot find maximum of empty array');
    }
    return amounts.reduce((max, amount) => amount.greaterThan(max) ? amount : max);
  }
}

/**
 * Utility functions for common operations
 */
export const MoneyUtils = {
  /**
   * Calculate parking fee based on time and rates
   */
  calculateParkingFee(
    entryTime: Date,
    exitTime: Date,
    minimumRate: Money,
    incrementRate: Money,
    minimumMinutes: number = 60,
    incrementMinutes: number = 15
  ): { totalAmount: Money; breakdown: any } {
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const totalMinutes = Math.ceil(durationMs / (1000 * 60));
    
    if (totalMinutes <= minimumMinutes) {
      return {
        totalAmount: minimumRate,
        breakdown: {
          minimumCharge: minimumRate,
          additionalIncrements: 0,
          incrementCharges: Money.zero(),
          totalMinutes
        }
      };
    }
    
    const additionalMinutes = totalMinutes - minimumMinutes;
    const increments = Math.ceil(additionalMinutes / incrementMinutes);
    const incrementCharges = incrementRate.multiply(increments);
    const totalAmount = minimumRate.add(incrementCharges);
    
    return {
      totalAmount,
      breakdown: {
        minimumCharge: minimumRate,
        additionalIncrements: increments,
        incrementCharges,
        totalMinutes
      }
    };
  },

  /**
   * Validate cash register balance
   */
  validateCashBalance(
    openingBalance: Money,
    transactions: Money[],
    deposits: Money[],
    withdrawals: Money[],
    currentCounted: Money
  ): { isValid: boolean; discrepancy: Money; expected: Money } {
    const transactionTotal = Money.sum(transactions);
    const depositTotal = Money.sum(deposits);
    const withdrawalTotal = Money.sum(withdrawals);
    
    const expected = openingBalance
      .add(transactionTotal)
      .add(depositTotal)
      .subtract(withdrawalTotal);
    
    // Calculate discrepancy as current - expected (can be negative)
    const discrepancyDecimal = currentCounted.toDecimal().minus(expected.toDecimal());
    const discrepancy = new Money(discrepancyDecimal, true); // Allow negative for discrepancy
    const isValid = discrepancy.isZero();
    
    return { isValid, discrepancy, expected };
  }
};

export default Money;