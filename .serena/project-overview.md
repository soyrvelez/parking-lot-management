# Parking Lot Management System - Project Memory

## System Purpose
Single parking lot management system with two main interfaces:
1. **Operator Interface**: Simple, single-screen for ticket creation and payment collection
2. **Admin Interface**: Comprehensive dashboard for configuration, reporting, and management

## Critical Technical Requirements

### Financial Precision
- **MUST USE**: Decimal.js for ALL monetary calculations
- **CURRENCY**: Mexican Pesos (MXN)
- **PRECISION**: No floating point errors allowed
- **TRANSACTIONS**: Must be atomic and auditable

### Hardware Integration
- **Printer**: Epson TM-T20III thermal printer (TCP connection)
- **Scanner**: Honeywell Voyager 1250g barcode scanner
- **Barcodes**: Code 39 format
- **Paper**: 58mm thermal paper

### Language & Localization
- **Language**: Mexican Spanish for all user interfaces
- **Timezone**: America/Mexico_City
- **Currency Format**: Mexican Peso formatting
- **Date Format**: DD/MM/YYYY format

### Operator Workstation
- **Hardware**: Lenovo ThinkPad with Ubuntu LTS
- **Security**: Locked down, no OS access, kiosk mode
- **Interface**: Touch-friendly, minimal typing
- **Screen**: Single screen operation required

## Business Logic Summary

### Pricing Structure
1. **Minimum**: 1 hour minimum charge
2. **Increments**: 15-minute increments after first hour
3. **Daily Special**: Configurable hours for special price
4. **Monthly Pension**: Fixed monthly rate
5. **Lost Tickets**: Configurable lost ticket fee

### Payment Rules
- Cash only payments
- Maximum bill: 500 pesos
- Change calculation with register balance verification
- Monthly pensions must be paid in full

### Ticket Lifecycle
- ACTIVE → PAID/LOST/CANCELLED/REFUNDED
- Barcodes for scanner integration
- Thermal printing for tickets and receipts

## Development Standards
- TypeScript for type safety
- Prisma ORM for database operations
- Next.js for frontend framework
- Shadcn/ui for design system
- Comprehensive testing before implementation
- No placeholder code allowed