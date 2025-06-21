# Financial Audit

Perform comprehensive financial audit of the parking lot system: $ARGUMENTS

## Audit Categories:
1. **calculations** - Verify all money calculations use Decimal.js
2. **transactions** - Audit transaction integrity
3. **balances** - Verify cash register balances
4. **reports** - Validate financial report accuracy
5. **precision** - Check decimal precision throughout system

## Steps:
1. Scan codebase for floating point arithmetic
2. Verify all financial calculations use Decimal.js
3. Check transaction atomicity and rollback handling
4. Validate cash register balance tracking
5. Test financial report generation accuracy
6. Verify currency formatting and localization
7. Generate audit report with findings

## Arguments:
- `calculations` - Audit calculation methods only
- `transactions` - Audit transaction handling
- `balances` - Audit balance tracking
- `reports` - Audit report generation
- `all` - Complete financial audit

## Usage: /project:financial-audit all