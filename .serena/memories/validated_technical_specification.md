# Validated Technical Specification - Parking Lot Management System

## Overview
This specification incorporates feedback from specialized review agents covering financial handling, API design, hardware integration, and Spanish localization.

## 1. Enhanced Database Schema

### Financial Data Improvements
```prisma
// Enhanced schema with audit trails and proper relations
model Ticket {
  id           String    @id @default(cuid())
  plateNumber  String
  barcode      String    @unique
  entryTime    DateTime  @default(now())
  exitTime     DateTime?
  totalAmount  Decimal?  @db.Decimal(12, 2) @default(0)
  status       TicketStatus @default(ACTIVE)
  printedAt    DateTime  @default(now())
  paidAt       DateTime?
  needsReprint Boolean   @default(false)
  failureReason String?
  gracePeriodUntil DateTime?
  
  // Relations
  transactions Transaction[]
  auditLogs    AuditLog[]
  
  // Constraints
  @@check(totalAmount >= 0, name: "positive_amount")
  @@check(totalAmount <= 9999.99, name: "max_amount")
  @@map("tickets")
}

model IncrementRate {
  id              String        @id @default(cuid())
  pricingConfigId String
  pricingConfig   PricingConfig @relation(fields: [pricingConfigId], references: [id])
  incrementNumber Int
  rate            Decimal       @db.Decimal(10, 2)
  @@unique([pricingConfigId, incrementNumber])
  @@map("increment_rates")
}

model CashFlow {
  id             String       @id @default(cuid())
  cashRegisterId String
  cashRegister   CashRegister @relation(fields: [cashRegisterId], references: [id])
  type           CashFlowType
  amount         Decimal      @db.Decimal(12, 2)
  reason         String?
  performedBy    String?
  timestamp      DateTime     @default(now())
  @@map("cash_flows")
}

model AuditLog {
  id          String   @id @default(cuid())
  entityType  String
  entityId    String
  action      String
  oldValue    Json?
  newValue    Json?
  performedBy String?
  ipAddress   String?
  timestamp   DateTime @default(now())
  
  // Relations
  ticket      Ticket?  @relation(fields: [ticketId], references: [id])
  ticketId    String?
  
  @@index([entityType, entityId])
  @@index([timestamp])
  @@map("audit_logs")
}

enum CashFlowType {
  WITHDRAWAL
  DEPOSIT
}
```

## 2. Robust API Architecture

### Core Endpoints with Real-World Considerations
```typescript
// Entry Flow
POST /api/tickets/entry
POST /api/pension/check/{plateNumber}
GET /api/tickets/active/{plateNumber}

// Payment Flow  
POST /api/tickets/calculate
POST /api/tickets/payment
POST /api/tickets/lost
POST /api/tickets/recalculate

// Exit & Gate Control
POST /api/tickets/validate-exit
POST /api/gates/open
POST /api/gates/status

// Shift Management
POST /api/shifts/start
POST /api/shifts/end

// Hardware Integration
POST /api/tickets/manual-entry
POST /api/tickets/reprint
POST /api/sync/offline-transactions

// Emergency Operations
POST /api/gates/emergency
POST /api/queue/entry
POST /api/occupancy/update
```

### Error Handling Standards
```typescript
interface ApiError {
  error: {
    code: string;
    message: string; // In Spanish
    details: Record<string, any>;
    timestamp: string;
    traceId: string;
  }
}

// Example error codes:
// TICKET_NOT_FOUND, PRINTER_OFFLINE, INSUFFICIENT_CHANGE
// INVALID_BARCODE, HARDWARE_FAILURE, PAYMENT_TIMEOUT
```

## 3. Financial Operations with Decimal.js

### Money Handling Utility
```typescript
export class Money {
  private value: Decimal;
  
  constructor(amount: string | number | Decimal) {
    this.value = new Decimal(amount);
    this.validate();
  }
  
  private validate(): void {
    if (this.value.isNaN() || !this.value.isFinite()) {
      throw new Error('Invalid monetary amount');
    }
    if (this.value.lessThan(0)) {
      throw new Error('Negative amounts not allowed');
    }
    if (this.value.decimalPlaces() > 2) {
      throw new Error('Maximum 2 decimal places allowed');
    }
  }
  
  add(other: Money): Money { return new Money(this.value.plus(other.value)); }
  subtract(other: Money): Money { /* with validation */ }
  multiply(factor: number): Money { return new Money(this.value.times(factor)); }
  round(): Money { return new Money(this.value.toFixed(2)); }
  format(): string { return `$${this.value.toFixed(2)} MXN`; }
}
```

### Transaction Service with Atomicity
```typescript
export class TransactionService {
  async processPayment(ticketId: string, amountReceived: Money, operatorId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // Lock ticket, validate, calculate change
      // Update cash register with balance tracking
      // Create audit trail
      // Handle printer failure gracefully
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'Serializable'
    });
  }
}
```

## 4. Hardware Integration Architecture

### Printer Service with Resilience
```typescript
class PrinterService {
  private printer: ThermalPrinter;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 3;
  
  async printTicket(ticketData: TicketData): Promise<boolean> {
    // TCP connection with retry logic
    // 58mm paper formatting (32 characters width)
    // Barcode generation with Code 39
    // Graceful failure with queue for reprint
  }
  
  async handlePrintError(error: any): Promise<void> {
    // Reconnection attempts
    // Error logging with structured data
    // Admin notification system
  }
}
```

### Scanner Integration with Focus Management
```typescript
export const useBarcodeScanner = ({ onScan, onError, enabled }) => {
  // USB HID input detection
  // Rapid typing pattern recognition
  // Code 39 validation
  // Debouncing for duplicate scans
  // Hidden input focus maintenance
};
```

### Fallback Mechanisms
```typescript
class FallbackService {
  async handlePrinterFailure(ticketData: TicketData): Promise<void> {
    // Queue for reprint
    // Generate PDF backup
    // Notify operator with clear Spanish instructions
  }
  
  async handleScannerFailure(): Promise<void> {
    // Enable manual plate entry mode
    // Mexican license plate validation
  }
}
```

## 5. Spanish Localization Framework

### Translation Structure
```typescript
interface TranslationKeys {
  parking: {
    ticket: { scan: string; print: string; lost: string; };
    payment: { amount_due: string; cash_received: string; };
    vehicle: { plate_number: string; entry_time: string; };
  };
  hardware: {
    printer: { offline: string; paper_jam: string; };
    scanner: { not_found: string; invalid_barcode: string; };
  };
  business: {
    payment: { overpayment: string; large_bill: string; };
    ticket: { already_paid: string; not_found: string; };
  };
}
```

### Mexican Spanish Conventions
```typescript
export const esMX: TranslationKeys = {
  parking: {
    ticket: {
      scan: "Escanear boleto",
      print: "Imprimir boleto", 
      lost: "Boleto extraviado"
    },
    payment: {
      amount_due: "Total a pagar",
      cash_received: "Efectivo recibido"
    }
  },
  // Formal "usted" for customers
  // "Boleto" not "ticket" 
  // "Estacionamiento" not "parking"
};
```

### Date/Time and Currency Formatting
```typescript
export const formatDateTime = (date: Date): string => {
  return moment(date).tz('America/Mexico_City').format('DD/MM/YYYY HH:mm:ss');
};

export const formatCurrency = (amount: Decimal): string => {
  return `$${amount.toFixed(2)} MXN`;
};
```

## 6. Security and Reliability Measures

### Authentication System
- JWT tokens for admin access
- Session-based for operator interface
- Rate limiting on all endpoints
- Input validation with Zod schemas

### Hardware Security
- Locked operator workstation (kiosk mode)
- Scanner input validation and sanitization
- Printer connection encryption (if supported)
- USB device management

### Data Protection
- Database transaction rollback on failures
- Comprehensive audit logging
- Encrypted sensitive data storage
- Backup and recovery procedures

## 7. Testing Strategy

### Financial Operations Testing
```typescript
describe('Money Operations', () => {
  test('prevents floating point errors', () => {
    const a = new Money('0.1');
    const b = new Money('0.2');
    expect(a.add(b).toString()).toBe('0.30');
  });
  
  test('handles Mexican peso edge cases', () => {
    // Test maximum amounts, rounding, centavos
  });
});
```

### Hardware Integration Testing
- Mock printer/scanner for development
- Hardware failure simulation
- Performance testing under load
- End-to-end workflow validation

### Localization Testing
- Complete Spanish text coverage
- Date/time format validation
- Currency display consistency
- Thermal printer character encoding

## 8. Performance Considerations

### Database Optimization
- Indexed queries for frequent operations
- Connection pooling for concurrent users
- Batch operations for reporting
- Cached pricing configurations

### Hardware Performance
- Thermal printer: <2 second print time
- Scanner: <100ms recognition time
- Queue management for busy periods
- Offline mode for network failures

## 9. Deployment Architecture

### Production Environment
- Ubuntu LTS on operator workstation
- Docker containers for easy deployment
- PostgreSQL for production database
- Redis for session management

### Monitoring and Maintenance
- Hardware health monitoring
- Financial reconciliation alerts
- Performance metrics collection
- Automated backup procedures

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Database setup with enhanced schema
2. Money utility class with Decimal.js
3. Basic API structure with error handling
4. Spanish localization framework

### Phase 2: Hardware Integration (Week 2)
1. Printer service with resilience
2. Scanner integration with fallbacks
3. Manual entry alternatives
4. Health monitoring system

### Phase 3: Business Logic (Week 3)
1. Ticket management workflows
2. Payment processing with atomicity
3. Pricing calculation engine
4. Cash register management

### Phase 4: User Interfaces (Week 4)
1. Operator interface (single screen)
2. Admin dashboard foundation
3. Real-time status updates
4. Error recovery flows

### Phase 5: Advanced Features (Week 5-6)
1. Pension customer management
2. Reporting and analytics
3. Daily specials logic
4. Audit trail visualization

### Phase 6: Testing & Deployment (Week 7-8)
1. Comprehensive testing suite
2. Hardware integration validation
3. Security audit and hardening
4. Production deployment and monitoring

This validated specification addresses all critical concerns raised by the review agents and provides a solid foundation for implementation.