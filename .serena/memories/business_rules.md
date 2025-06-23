# Core Business Rules

## Pricing Logic
1. **Minimum Charge**: 1 hour minimum for all parking
2. **Incremental Billing**: After 1st hour, charge in 15-minute increments
3. **Daily Special**: Fixed hours for special promotional rate
4. **Overage Handling**: Regular 15-min pricing applies after promo hours
5. **Monthly Pension**: Fixed monthly rate for regular customers

## Payment Rules
- **Payment Method**: Cash only (no credit cards)
- **Maximum Bill**: 500 pesos (largest accepted bill)
- **Lost Ticket Fee**: Admin-configurable amount
- **Pension Payment**: Must pay full monthly amount
- **Change Management**: Verify register has sufficient change

## Ticket States
- `ACTIVE`: Car in lot, unpaid
- `PAID`: Payment completed, can exit
- `LOST`: Lost ticket fee collected
- `CANCELLED`: Admin cancelled (with reason)
- `REFUNDED`: Admin processed refund

## Database Entities
1. **Ticket**: Parking session tracking (entry/exit, plate, amount)
2. **PensionCustomer**: Monthly pass holders
3. **Transaction**: All financial movements
4. **PricingConfig**: Configurable rates and fees
5. **CashRegister**: Track cash balance and movements

## Operational Rules
- Barcode scanner is primary input method
- Thermal printer for tickets and receipts
- All timestamps in Mexico City time
- Operator interface locked to single screen
- Admin requires authentication for access

## Financial Integrity
- Use Decimal.js for ALL calculations
- Atomic transactions for payments
- Complete audit trail of all transactions
- Daily cash register reconciliation
- No placeholder or estimated amounts