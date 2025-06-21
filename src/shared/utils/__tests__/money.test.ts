/**
 * Comprehensive unit tests for Money class
 * Tests financial calculations, Mexican Peso formatting, and business rules
 */

import { Money, MoneyUtils } from '../money';
import Decimal from 'decimal.js';

describe('Money Class', () => {
  describe('Constructor and Validation', () => {
    test('creates valid Money instance from string', () => {
      const money = new Money('10.50');
      expect(money.toString()).toBe('10.50');
    });

    test('creates valid Money instance from number', () => {
      const money = new Money(10.50);
      expect(money.toString()).toBe('10.50');
    });

    test('creates valid Money instance from Decimal', () => {
      const decimal = new Decimal('10.50');
      const money = new Money(decimal);
      expect(money.toString()).toBe('10.50');
    });

    test('creates valid Money instance from another Money', () => {
      const money1 = new Money('10.50');
      const money2 = new Money(money1);
      expect(money2.toString()).toBe('10.50');
    });

    test('throws error for negative amounts', () => {
      expect(() => new Money('-10.00')).toThrow('No se permiten cantidades negativas');
    });

    test('throws error for NaN values', () => {
      expect(() => new Money(NaN)).toThrow('Cantidad monetaria inválida');
    });

    test('throws error for infinite values', () => {
      expect(() => new Money(Infinity)).toThrow('Cantidad monetaria inválida');
    });

    test('throws error for amounts exceeding maximum', () => {
      expect(() => new Money('10000.00')).toThrow('Cantidad excede el máximo permitido');
    });

    test('auto-rounds more than 2 decimal places', () => {
      const money = new Money('10.123');
      expect(money.toString()).toBe('10.12'); // Auto-rounded down
      
      const money2 = new Money('10.126');
      expect(money2.toString()).toBe('10.13'); // Auto-rounded up
    });

    test('accepts zero amount', () => {
      const money = new Money('0.00');
      expect(money.toString()).toBe('0.00');
    });

    test('accepts maximum allowed amount', () => {
      const money = new Money('9999.99');
      expect(money.toString()).toBe('9999.99');
    });
  });

  describe('Arithmetic Operations', () => {
    test('adds two amounts correctly', () => {
      const a = new Money('10.25');
      const b = new Money('5.75');
      const result = a.add(b);
      expect(result.toString()).toBe('16.00');
    });

    test('prevents addition overflow', () => {
      const a = new Money('9999.99');
      const b = new Money('0.01');
      expect(() => a.add(b)).toThrow('La suma excede el monto máximo permitido');
    });

    test('subtracts two amounts correctly', () => {
      const a = new Money('10.25');
      const b = new Money('5.75');
      const result = a.subtract(b);
      expect(result.toString()).toBe('4.50');
    });

    test('prevents subtraction underflow', () => {
      const a = new Money('5.00');
      const b = new Money('10.00');
      expect(() => a.subtract(b)).toThrow('Fondos insuficientes');
    });

    test('multiplies amount by factor correctly', () => {
      const money = new Money('10.25');
      const result = money.multiply(2);
      expect(result.toString()).toBe('20.50');
    });

    test('multiplies amount by decimal factor correctly', () => {
      const money = new Money('10.00');
      const result = money.multiply(0.5);
      expect(result.toString()).toBe('5.00');
    });

    test('throws error for invalid multiplication factor', () => {
      const money = new Money('10.00');
      expect(() => money.multiply(NaN)).toThrow('Factor de multiplicación inválido');
    });

    test('divides amount correctly', () => {
      const money = new Money('10.00');
      const result = money.divide(2);
      expect(result.toString()).toBe('5.00');
    });

    test('throws error for division by zero', () => {
      const money = new Money('10.00');
      expect(() => money.divide(0)).toThrow('No se puede dividir por cero');
    });

    test('rounds to nearest centavo', () => {
      // Money automatically rounds on construction, then round() is explicit
      const money = new Money('10.005');
      expect(money.toString()).toBe('10.01'); // Auto-rounded on construction
      const result = money.round();
      expect(result.toString()).toBe('10.01');
    });
  });

  describe('Floating Point Precision Tests', () => {
    test('prevents 0.1 + 0.2 = 0.30000000000000004 error', () => {
      const a = new Money('0.1');
      const b = new Money('0.2');
      const result = a.add(b);
      expect(result.toString()).toBe('0.30');
    });

    test('handles complex calculations precisely', () => {
      const base = new Money('0.1');
      const result = base.multiply(3).add(new Money('0.3'));
      expect(result.toString()).toBe('0.60');
    });

    test('maintains precision in chain operations', () => {
      const result = new Money('10.00')
        .multiply(0.1)
        .add(new Money('0.01'))
        .subtract(new Money('0.51'));
      expect(result.toString()).toBe('0.50');
    });
  });

  describe('Comparison Operations', () => {
    test('equals comparison works correctly', () => {
      const a = new Money('10.50');
      const b = new Money('10.50');
      const c = new Money('10.51');
      
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    test('less than comparison works correctly', () => {
      const a = new Money('10.50');
      const b = new Money('10.51');
      
      expect(a.lessThan(b)).toBe(true);
      expect(b.lessThan(a)).toBe(false);
    });

    test('greater than comparison works correctly', () => {
      const a = new Money('10.51');
      const b = new Money('10.50');
      
      expect(a.greaterThan(b)).toBe(true);
      expect(b.greaterThan(a)).toBe(false);
    });

    test('zero detection works correctly', () => {
      const zero = new Money('0.00');
      const nonZero = new Money('0.01');
      
      expect(zero.isZero()).toBe(true);
      expect(nonZero.isZero()).toBe(false);
    });

    test('positive detection works correctly', () => {
      const zero = new Money('0.00');
      const positive = new Money('0.01');
      
      expect(zero.isPositive()).toBe(false);
      expect(positive.isPositive()).toBe(true);
    });
  });

  describe('Business Logic Operations', () => {
    test('calculates change correctly', () => {
      const amount = new Money('15.75');
      const paid = new Money('20.00');
      const change = amount.calculateChange(paid);
      
      expect(change.toString()).toBe('4.25');
    });

    test('throws error when payment is insufficient', () => {
      const amount = new Money('20.00');
      const paid = new Money('15.75');
      
      expect(() => amount.calculateChange(paid)).toThrow('El monto pagado es insuficiente');
    });

    test('validates bill payment correctly', () => {
      const amount = new Money('15.75');
      const bill = new Money('20.00');
      
      expect(() => amount.validateBillPayment(bill)).not.toThrow();
    });

    test('rejects bills larger than 500 pesos', () => {
      const amount = new Money('15.75');
      const largeBill = new Money('1000.00');
      
      expect(() => amount.validateBillPayment(largeBill)).toThrow('No se aceptan billetes mayores a $500 pesos');
    });

    test('rejects bills smaller than amount', () => {
      const amount = new Money('25.00');
      const smallBill = new Money('20.00');
      
      expect(() => amount.validateBillPayment(smallBill)).toThrow('El billete no cubre el monto total');
    });

    test('splits amount into denominations correctly', () => {
      const money = new Money('537.67');
      const denominations = money.splitIntoDenominations();
      
      expect(denominations['$500']).toBe(1);
      expect(denominations['$20']).toBe(1);
      expect(denominations['$10']).toBe(1);
      expect(denominations['$5']).toBe(1);
      expect(denominations['$2']).toBe(1);
      expect(denominations['$0.5']).toBe(1);
      expect(denominations['$0.1']).toBe(1);
      expect(denominations['$0.05']).toBe(1);
      expect(denominations['$0.01']).toBe(2);
    });
  });

  describe('Formatting Operations', () => {
    test('formats for Mexican locale display', () => {
      const money = new Money('1234.56');
      const formatted = money.format();
      
      // Should format as Mexican Peso currency with thousands separator
      expect(formatted).toMatch(/\$1,234\.56/);
      // Note: MX suffix depends on system locale settings
    });

    test('formats for compact display', () => {
      const money = new Money('1234.56');
      const formatted = money.formatCompact();
      
      expect(formatted).toBe('$1234.56');
    });

    test('formats for Mexican peso display', () => {
      const money = new Money('25.50');
      expect(money.formatPesos()).toBe('$25.50 pesos');
      
      const zeroMoney = Money.ZERO;
      expect(zeroMoney.formatPesos()).toBe('$0.00 pesos');
    });

    test('formats for database storage', () => {
      const money = new Money('1234.5');
      const formatted = money.toDatabase();
      
      expect(formatted).toBe('1234.50');
    });

    test('converts to JSON correctly', () => {
      const money = new Money('1234.56');
      const json = JSON.stringify({ amount: money });
      
      expect(json).toBe('{"amount":"1234.56"}');
    });
  });

  describe('Static Factory Methods', () => {
    test('creates zero amount', () => {
      const zero = Money.zero();
      expect(zero.toString()).toBe('0.00');
    });

    test('creates from centavos', () => {
      const money = Money.fromCentavos(1050);
      expect(money.toString()).toBe('10.50');
    });

    test('creates from pesos', () => {
      const money = Money.fromPesos(10.5);
      expect(money.toString()).toBe('10.50');
    });

    test('parses from formatted string', () => {
      const money = Money.parse('$1,234.56');
      expect(money.toString()).toBe('1234.56');
    });

    test('throws error for invalid parse format', () => {
      expect(() => Money.parse('invalid')).toThrow('Formato de dinero inválido');
    });

    test('validates string amounts', () => {
      expect(Money.isValid('10.50')).toBe(true);
      expect(Money.isValid('invalid')).toBe(false);
      expect(Money.isValid('-10.00')).toBe(false);
    });

    test('sums array of Money instances', () => {
      const amounts = [
        new Money('10.00'),
        new Money('20.50'),
        new Money('5.25')
      ];
      const total = Money.sum(amounts);
      
      expect(total.toString()).toBe('35.75');
    });

    test('finds minimum in array', () => {
      const amounts = [
        new Money('10.00'),
        new Money('5.25'),
        new Money('20.50')
      ];
      const min = Money.min(amounts);
      
      expect(min.toString()).toBe('5.25');
    });

    test('finds maximum in array', () => {
      const amounts = [
        new Money('10.00'),
        new Money('20.50'),
        new Money('5.25')
      ];
      const max = Money.max(amounts);
      
      expect(max.toString()).toBe('20.50');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles very small amounts', () => {
      const money = new Money('0.01');
      expect(money.toString()).toBe('0.01');
    });

    test('handles maximum allowed amount', () => {
      const money = new Money('9999.99');
      expect(money.toString()).toBe('9999.99');
    });

    test('handles string input with leading zeros', () => {
      const money = new Money('0010.50');
      expect(money.toString()).toBe('10.50');
    });

    test('handles conversion to number safely', () => {
      const money = new Money('1234.56');
      expect(money.toNumber()).toBe(1234.56);
    });

    test('provides access to underlying Decimal', () => {
      const money = new Money('1234.56');
      const decimal = money.toDecimal();
      expect(decimal.toString()).toBe('1234.56');
    });
  });
});

describe('MoneyUtils', () => {
  describe('Parking Fee Calculation', () => {
    test('calculates minimum fee for short parking', () => {
      const entryTime = new Date('2023-01-01T10:00:00');
      const exitTime = new Date('2023-01-01T10:30:00');
      const minimumRate = new Money('25.00');
      const incrementRate = new Money('5.00');
      
      const result = MoneyUtils.calculateParkingFee(
        entryTime,
        exitTime,
        minimumRate,
        incrementRate
      );
      
      expect(result.totalAmount.toString()).toBe('25.00');
      expect(result.breakdown.additionalIncrements).toBe(0);
    });

    test('calculates fee with increments for longer parking', () => {
      const entryTime = new Date('2023-01-01T10:00:00');
      const exitTime = new Date('2023-01-01T11:30:00'); // 1.5 hours
      const minimumRate = new Money('25.00');
      const incrementRate = new Money('5.00');
      
      const result = MoneyUtils.calculateParkingFee(
        entryTime,
        exitTime,
        minimumRate,
        incrementRate,
        60, // 1 hour minimum
        15  // 15 minute increments
      );
      
      // 30 minutes additional = 2 increments (15 min each)
      expect(result.breakdown.additionalIncrements).toBe(2);
      expect(result.totalAmount.toString()).toBe('35.00'); // 25 + (2 * 5)
    });

    test('rounds up partial increments', () => {
      const entryTime = new Date('2023-01-01T10:00:00');
      const exitTime = new Date('2023-01-01T11:17:00'); // 1 hour 17 minutes
      const minimumRate = new Money('25.00');
      const incrementRate = new Money('5.00');
      
      const result = MoneyUtils.calculateParkingFee(
        entryTime,
        exitTime,
        minimumRate,
        incrementRate,
        60, // 1 hour minimum
        15  // 15 minute increments
      );
      
      // 17 minutes additional = 2 increments (rounds up)
      expect(result.breakdown.additionalIncrements).toBe(2);
      expect(result.totalAmount.toString()).toBe('35.00');
    });
  });

  describe('Cash Balance Validation', () => {
    test('validates correct cash balance', () => {
      const openingBalance = new Money('500.00');
      const transactions = [new Money('25.00'), new Money('15.50')];
      const deposits = [new Money('100.00')];
      const withdrawals = [new Money('50.00')];
      const currentCounted = new Money('590.50');
      
      const result = MoneyUtils.validateCashBalance(
        openingBalance,
        transactions,
        deposits,
        withdrawals,
        currentCounted
      );
      
      expect(result.isValid).toBe(true);
      expect(result.discrepancy.toString()).toBe('0.00');
      expect(result.expected.toString()).toBe('590.50');
    });

    test('detects cash balance discrepancy', () => {
      const openingBalance = new Money('500.00');
      const transactions = [new Money('25.00')];
      const deposits: Money[] = [];
      const withdrawals: Money[] = [];
      const currentCounted = new Money('520.00'); // $5 less than expected
      
      const result = MoneyUtils.validateCashBalance(
        openingBalance,
        transactions,
        deposits,
        withdrawals,
        currentCounted
      );
      
      expect(result.isValid).toBe(false);
      expect(result.discrepancy.toString()).toBe('-5.00');
      expect(result.expected.toString()).toBe('525.00');
    });
  });
});