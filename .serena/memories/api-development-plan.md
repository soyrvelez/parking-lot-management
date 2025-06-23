# API Development Phase - Technical Plan

## Overview
Design and implement Express.js REST API layer to orchestrate hardware services with business logic, providing Spanish-localized responses for parking lot operations.

## Core API Categories

### 1. Parking Operations APIs
**Base Route**: `/api/parking`

#### Entry Operations
- `POST /api/parking/entry`
  - Process vehicle entry with plate recognition
  - Generate ticket with barcode via printer service
  - Store entry record in database
  - Return: ticket data, barcode, entry timestamp

- `GET /api/parking/entry/status`
  - Check if entry gate is operational
  - Hardware status (scanner, printer)
  - Return: gate status, hardware health

#### Payment Operations  
- `POST /api/parking/calculate`
  - Calculate parking fee based on entry/exit times
  - Apply pricing rules (minimum, increments, daily special)
  - Validate ticket status and authenticity
  - Return: pricing breakdown, total amount, payment options

- `POST /api/parking/payment`
  - Process cash payment with change calculation
  - Update ticket status to PAID
  - Print payment receipt via printer service
  - Log transaction for audit trail
  - Return: payment confirmation, change amount, receipt data

#### Exit Operations
- `POST /api/parking/exit`
  - Validate paid ticket for exit
  - Record exit timestamp
  - Open gate control signal
  - Return: exit authorization, farewell message

#### Lost Ticket Operations
- `POST /api/parking/lost-ticket`
  - Process lost ticket with penalty fee
  - Require manual verification by operator
  - Print lost ticket receipt
  - Return: penalty amount, receipt data

### 2. Pension Management APIs
**Base Route**: `/api/pension`

- `GET /api/pension/customers`
  - List active pension customers
  - Filter by plate number, name, status
  - Return: customer list, pagination

- `POST /api/pension/entry`
  - Process pension customer entry
  - Validate monthly payment status
  - No ticket required for active pensions
  - Return: entry confirmation, customer data

- `GET /api/pension/status/:plateNumber`
  - Check pension customer status
  - Validate payment current status
  - Return: customer info, payment status, expiry date

### 3. Administration APIs
**Base Route**: `/api/admin`

#### Configuration Management
- `GET /api/admin/pricing`
  - Retrieve current pricing configuration
  - Return: rates, minimums, special pricing

- `PUT /api/admin/pricing`
  - Update pricing configuration
  - Validate business rules (minimum < incremental rates)
  - Return: updated configuration, validation results

- `GET /api/admin/settings`
  - System configuration (lot capacity, operating hours)
  - Hardware settings (printer IP, scanner timeouts)
  - Return: complete system configuration

#### Reporting APIs
- `GET /api/admin/reports/daily`
  - Daily revenue and transaction reports
  - Entry/exit counts, average duration
  - Cash register reconciliation
  - Return: comprehensive daily metrics

- `GET /api/admin/reports/transactions`
  - Transaction history with filtering
  - Date range, transaction type, amounts
  - Export capabilities (CSV, PDF)
  - Return: transaction data, summary statistics

### 4. Cash Register APIs  
**Base Route**: `/api/cash`

- `GET /api/cash/status`
  - Current cash register balance
  - Recent transactions, withdrawals, deposits
  - Return: balance, transaction history

- `POST /api/cash/deposit`
  - Record cash deposit to register
  - Update opening balance for shift
  - Return: new balance, transaction record

- `POST /api/cash/withdrawal`
  - Record cash withdrawal from register
  - Validate sufficient funds
  - Return: new balance, remaining funds

### 5. Shift Management APIs
**Base Route**: `/api/shifts`

- `POST /api/shifts/start`
  - Start operator shift with cash count
  - Initialize hardware systems
  - Return: shift ID, starting balance, hardware status

- `POST /api/shifts/end`
  - End shift with reconciliation
  - Generate shift report (transactions, cash)
  - Return: shift summary, variance report

- `GET /api/shifts/current`
  - Current shift information
  - Active operator, start time, transactions
  - Return: shift details, real-time metrics

### 6. Hardware Control APIs
**Base Route**: `/api/hardware`

#### Printer Operations
- `POST /api/hardware/printer/test`
  - Print test receipt for validation
  - Check paper, connection, Spanish encoding
  - Return: print status, hardware diagnostics

- `POST /api/hardware/printer/reprint`
  - Reprint last receipt (payment, entry, lost ticket)
  - Queue for offline printing if needed
  - Return: reprint status, queue position

#### Scanner Operations  
- `POST /api/hardware/scanner/test`
  - Test scanner functionality and focus
  - Validate Code 39 reading capability
  - Return: scanner status, test results

- `POST /api/hardware/scanner/manual`
  - Enable manual barcode entry mode
  - Fallback when scanner hardware fails
  - Return: manual entry session, timeout

#### Gate Control
- `POST /api/hardware/gate/open`
  - Manual gate control for emergencies
  - Operator override with authorization
  - Return: gate status, operator log

## Spanish Error Response Framework

### Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Boleto ya procesado para pago",
    "details": "Este boleto fue pagado el 15/06/2024 a las 14:30",
    "timestamp": "2024-06-15T20:30:00.000Z",
    "requestId": "req_abc123"
  },
  "context": {
    "ticketNumber": "T-001234",
    "plateNumber": "ABC-123",
    "operatorId": "OP001"
  }
}
```

### Error Categories with Spanish Messages
- **Validation Errors**: "Datos de entrada inválidos"
- **Business Logic**: "Regla de negocio violada" 
- **Hardware Failures**: "Error de hardware - contacte soporte"
- **Payment Issues**: "Error en procesamiento de pago"
- **Unauthorized**: "Acceso no autorizado"
- **System Errors**: "Error interno del sistema"

## API Integration Architecture

### Request Flow Pattern
1. **Request Validation**: Zod schemas with Spanish error messages
2. **Business Logic**: Service layer with Money class calculations
3. **Hardware Operations**: Printer/Scanner service orchestration
4. **Database Updates**: Prisma transactions with audit logging
5. **Response Formatting**: Spanish localized success/error responses

### Authentication & Security
- JWT tokens for admin operations
- Rate limiting per endpoint type
- Request logging for audit trail
- Operator session management
- Spanish security messages

### Error Handling Middleware
- Global error catcher with Spanish formatting
- Hardware error recovery and user notification
- Database transaction rollback on failures
- Comprehensive logging for troubleshooting

## Testing Strategy for APIs
- Unit tests for each endpoint logic
- Integration tests with mocked hardware
- Spanish error message validation
- Performance testing under load
- Hardware failure scenario testing

This API design provides comprehensive parking lot management with Spanish localization, hardware integration, and robust error handling for production deployment.