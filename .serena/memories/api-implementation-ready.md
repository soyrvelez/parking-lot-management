# API Implementation Ready - Comprehensive Development Guide

## Hardware Integration Status ✅ COMPLETE

**Current State**: All hardware services are fully implemented and validated
- **116 tests passing** across hardware integration layer
- **BarcodeScannerService**: USB HID input handling, Code 39 validation, manual entry fallback
- **ThermalPrinterService**: Epson TM-T20III integration, print queue with retry mechanism
- **Print Jobs**: Entry tickets, payment receipts, error recovery
- **Scanner Integration**: Focus management, timeout handling, Spanish error messages

**Key Integration Points**:
```typescript
// Scanner usage in controllers
const scanResult = await BarcodeScannerService.getInstance().scanBarcode();
if (!scanResult.success) {
  return handleManualEntry(scanResult.error);
}

// Printer usage in controllers  
await ThermalPrinterService.getInstance().printTicket({
  plateNumber: ticket.plateNumber,
  entryTime: ticket.entryTime,
  barcode: ticket.barcode,
  pricing: pricingInfo
});
```

## API Development Plan - 6 Categories & 20+ Endpoints

### 1. **Core Parking Operations** `/api/parking/*` ✅ IMPLEMENTED
- `POST /entry` - Create parking entry with hardware integration
- `POST /exit` - Process exit and calculate fees  
- `POST /payment` - Process cash payments with change calculation
- `GET /calculate/:ticketId` - Calculate parking fees
- `GET /status/:ticketId` - Get ticket status and payment info
- `POST /lost-ticket` - Handle lost ticket fee processing

### 2. **Cash Register Management** `/api/cash/*` ✅ IMPLEMENTED  
- `POST /open` - Open register with opening balance
- `POST /close` - Close register with discrepancy detection
- `POST /adjustment` - Deposits/withdrawals (admin only)
- `GET /status` - Current register status
- `POST /count` - Cash denomination counting
- `GET /history` - Register history with filtering

### 3. **Pension Management** `/api/pension/*` - PENDING
- `POST /customers` - Register monthly customers
- `GET /customers` - List active pension customers  
- `PUT /customers/:id` - Update customer info
- `POST /payment/:customerId` - Process monthly payments
- `GET /customers/:plateNumber` - Lookup by plate

### 4. **Administration** `/api/admin/*` - PENDING
- `GET /dashboard` - Real-time metrics and KPIs
- `GET /reports/daily` - Daily revenue reports
- `GET /reports/monthly` - Monthly summaries
- `POST /pricing` - Update pricing configuration
- `GET /audit` - Audit trail with filtering
- `POST /backup` - System backup operations

### 5. **Hardware Control** `/api/hardware/*` - PENDING
- `GET /status` - All hardware status check
- `POST /printer/test` - Test print functionality
- `POST /scanner/test` - Test scanner functionality  
- `POST /printer/queue/retry` - Retry failed print jobs
- `GET /printer/queue` - View print queue status

### 6. **Shift Management** `/api/shifts/*` - PENDING
- `POST /start` - Start operator shift
- `POST /end` - End shift with reconciliation
- `GET /current` - Current shift status
- `GET /history` - Shift history and reports

## Integration Requirements - Critical Implementation Patterns

### **Money Class Integration** (Decimal.js precision)
```typescript
import { Money } from '../../shared/utils/money';

// Always use Money for financial calculations
const parkingFee = new Money(baseRate).add(incrementalFee);
const change = amountPaid.subtract(totalDue);

// Format for responses  
res.json({
  total: parkingFee.formatPesos(), // "$25.50 pesos"
  change: change.formatCompact()   // "$4.50"
});

// Database storage
await prisma.transaction.create({
  data: {
    amount: parkingFee.toDatabase() // "25.50" string
  }
});
```

### **i18n Integration** (Mexican Spanish)
```typescript
import { i18n } from '../../shared/localization';

// Error messages
res.status(400).json({
  success: false,
  error: {
    code: 'INVALID_PLATE',
    message: i18n.t('validation.invalid_plate_format'),
    timestamp: new Date().toISOString()
  }
});

// Success messages
res.json({
  success: true,
  data: { /* response data */ },
  message: i18n.t('parking.entry_successful')
});

// Date formatting
entryTime: i18n.formatDateTime(ticket.entryTime)
```

### **Hardware Service Integration**
```typescript
// Scanner integration pattern
try {
  const scanResult = await BarcodeScannerService.getInstance().scanBarcode();
  if (scanResult.success) {
    const ticket = await findTicketByBarcode(scanResult.data);
  } else {
    // Handle manual entry fallback
    return res.status(400).json({
      error: { message: i18n.t('scanner.manual_entry_required') }
    });
  }
} catch (error) {
  // Hardware unavailable - graceful degradation
}

// Printer integration pattern  
try {
  await ThermalPrinterService.getInstance().printPaymentReceipt({
    ticketNumber: ticket.id,
    amount: payment.formatPesos(),
    change: changeAmount.formatPesos(),
    timestamp: i18n.formatDateTime(new Date())
  });
} catch (printError) {
  // Log error but don't fail transaction
  console.error('Print failed:', printError);
  // Transaction still succeeds
}
```

## Spanish Response Framework - Standardized Patterns

### **Error Response Structure**
```typescript
{
  success: false,
  error: {
    code: 'ERROR_CODE',           // English constant
    message: 'Spanish message',    // User-facing Spanish
    timestamp: '2023-01-01T12:00:00.000Z',
    details?: { /* additional context */ }
  }
}
```

### **Success Response Structure**  
```typescript
{
  success: true,
  data: { /* response payload */ },
  message?: 'Spanish success message',
  timestamp?: '2023-01-01T12:00:00.000Z'
}
```

### **Validation Error Handling**
```typescript
// Zod schema with Spanish messages
const entrySchema = z.object({
  plateNumber: z.string()
    .min(1, 'Número de placa requerido')
    .regex(/^[A-Z0-9-]+$/, 'Formato de placa inválido')
});

// Middleware integration
router.post('/entry', 
  validateRequest(entrySchema),
  parkingController.createEntry
);
```

## Express.js Application Structure ✅ IMPLEMENTED

### **Core Setup** (`src/backend/app.ts`)
```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Security middleware stack
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Route registration
app.use('/api/parking', parkingRoutes);
app.use('/api/cash', cashRoutes);
// Add additional routes as implemented
```

### **Middleware Stack** (Order critical)
1. **Security**: Helmet, CORS, Rate limiting
2. **Parsing**: JSON body parser, URL encoding  
3. **Logging**: Request/response logging with Spanish errors
4. **Authentication**: JWT validation for protected routes
5. **Validation**: Zod schema validation with Spanish messages
6. **Error Handling**: Global error handler (must be last)

## Database Integration - Prisma Patterns

### **Financial Transaction Pattern**
```typescript
// Use Prisma transactions for financial operations
await prisma.$transaction(async (tx) => {
  // Update ticket
  const updatedTicket = await tx.ticket.update({
    where: { id: ticketId },
    data: { 
      status: 'PAID',
      totalAmount: payment.toDatabase(),
      paidAt: new Date()
    }
  });
  
  // Create transaction record
  await tx.transaction.create({
    data: {
      type: 'PARKING',
      amount: payment.toDatabase(),
      ticketId: updatedTicket.id,
      operatorId: req.user.id
    }
  });
  
  // Update cash register
  await tx.cashRegister.update({
    where: { operatorId: req.user.id, status: 'OPEN' },
    data: { currentBalance: newBalance.toDatabase() }
  });
});
```

## Next Steps - Implementation Priority

### **Phase 1: Foundation Complete** ✅
- [x] Hardware integration (scanner, printer)
- [x] Money class with Decimal.js precision
- [x] Spanish localization framework  
- [x] Express.js app structure
- [x] Core parking operations
- [x] Cash register management

### **Phase 2: Business Operations** - START HERE
1. **Pension Management** - Monthly customer system
2. **Shift Management** - Operator workflows
3. **Hardware Control APIs** - Direct hardware management

### **Phase 3: Administration**
4. **Admin Dashboard APIs** - Reporting and metrics
5. **Backup/Recovery** - Data management
6. **Advanced Reporting** - Business intelligence

### **Phase 4: Production Ready**
7. **Performance optimization**
8. **Security hardening** 
9. **Monitoring integration**
10. **Deployment preparation**

## Critical Implementation Notes

### **Testing Strategy**
- Unit tests for controllers using supertest
- Integration tests with test database
- Hardware simulation for offline development
- Spanish message validation in all test cases

### **Security Requirements**
- JWT authentication for all protected routes
- Role-based access control (operator vs admin)
- Input validation with Zod schemas
- Rate limiting to prevent abuse
- Audit logging for all financial operations

### **Performance Considerations**  
- Database connection pooling
- Print queue management for reliability
- Graceful hardware failure handling
- Response caching where appropriate

### **Operational Requirements**
- Comprehensive error logging in Spanish
- Hardware status monitoring
- Automatic backup procedures
- Recovery mechanisms for failed operations

**Status**: Ready for immediate API development with complete hardware foundation and established patterns.