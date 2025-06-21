Parking Lot Management System - Claude Context
Project Overview
Single lot parking management system with operator interface for ticket/payment processing and admin dashboard for configuration and reporting. All operations in Mexican Spanish, timezone Mexico City, currency MXN.
Key Requirements - CRITICAL

Financial Operations: Use Decimal.js for ALL money calculations - NO floating point arithmetic
Spanish Language: All user-facing content in Mexican Spanish
Operator Simplicity: Single screen interface, minimal typing, barcode scanner primary input
Hardware Integration: Epson TM-T20III thermal printer, Honeywell Voyager 1250g scanner, Code 39 barcodes
Security: Locked-down operator workstation, remote admin access via SSH
Reliability: Atomic transactions, comprehensive error handling, no placeholder code

Development Workflow - FOLLOW STRICTLY

Plan - Analyze requirements and create detailed technical specifications
Spec - Write comprehensive API specs and data models
Test - Create tests BEFORE implementation
Implement - Build actual functionality (NO placeholders)
Comment - Clearly mark any TODO/future development areas

Technology Stack
Backend

Node.js/TypeScript with Express
Prisma ORM with SQLite (dev) / PostgreSQL (prod)
Decimal.js for financial calculations
node-thermal-printer for Epson TM-T20III
JsBarcode for Code 39 generation
moment-timezone for Mexico City time

Frontend

Next.js 14+ with TypeScript
Shadcn/ui design system
Tailwind CSS
React Hook Form + Zod validation
Zustand state management

Project Structure
src/
├── backend/
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, validation, error handling
│   ├── services/        # Business logic
│   ├── models/          # Prisma models
│   ├── utils/           # Helper functions
│   └── types/           # TypeScript types
├── frontend/
│   ├── components/      # React components
│   ├── pages/           # Next.js pages
│   ├── hooks/           # Custom hooks
│   ├── stores/          # Zustand stores
│   └── utils/           # Frontend utilities
└── shared/
    ├── types/           # Shared TypeScript types
    ├── utils/           # Shared utilities
    └── constants/       # Application constants
Key Commands
Development

npm run dev - Start development servers
npm run build - Build for production
npm run test - Run all tests
npm run test:watch - Run tests in watch mode
npm run lint - Run ESLint
npm run type-check - Run TypeScript checks

Database

npx prisma generate - Generate Prisma client
npx prisma db push - Push schema to database
npx prisma studio - Open Prisma Studio
npx prisma migrate dev - Create and apply migration

Printer Testing

npm run test:printer - Test thermal printer connection
npm run print:test-ticket - Print test ticket

Core Business Rules
Pricing Logic

1 hour minimum charge
After 1st hour: 15-minute increments with configurable rates
Daily special: Fixed hours for special price
Overage: Regular 15-min pricing after promo time
Monthly pension: Fixed monthly rate

Payment Rules

Cash only
Maximum bill: 500 pesos
Lost ticket fee: Configurable by admin
Pension: Must pay full monthly amount
Change calculation with register balance check

Ticket States

ACTIVE: Unpaid, car in lot
PAID: Payment completed
LOST: Lost ticket fee collected
CANCELLED: Admin cancellation
REFUNDED: Admin refund processed

Database Entities - Core Models
Ticket

id, plateNumber, entryTime, exitTime, totalAmount, status
barcode, printedAt, paidAt, paymentMethod

PensionCustomer

id, name, phone, plateNumber, vehicleMake, vehicleModel
monthlyRate, startDate, endDate, isActive

Transaction

id, type (PARKING|PENSION|LOST_TICKET|REFUND), amount, ticketId
timestamp, description, operatorId

PricingConfig

id, minimumHours, minimumRate, incrementMinutes, incrementRates
dailySpecialHours, dailySpecialRate, monthlyRate, lostTicketFee

CashRegister

id, openingBalance, currentBalance, lastUpdated
withdrawals[], deposits[]

Hardware Integration
Thermal Printer (Epson TM-T20III)

TCP connection (default 192.168.1.100:9100)
58mm paper width
Print tickets with barcode, timestamp, plate, rates
Print receipts with payment details

Barcode Scanner (Honeywell Voyager 1250g)

USB HID input device
Code 39 barcode reading
Automatic input focus handling

Security Requirements

JWT authentication for admin access
Rate limiting on API endpoints
Input validation with Zod schemas
Operator workstation lockdown
SSH access for remote administration
Transaction logging for audit trail

UI/UX Guidelines
Operator Interface

Large buttons, high contrast
Minimal text input required
Single screen operation
Clear status indicators
Spanish labels and messages
Touch-friendly (ThinkPad trackpad)

Admin Interface

Responsive design
Data tables with sorting/filtering
Export functionality (CSV, PDF)
Real-time updates
Dashboard with key metrics
Spanish localization

Testing Strategy

Unit tests: Services, utilities, calculations
Integration tests: API endpoints, database operations
E2E tests: Complete user workflows
Hardware tests: Printer, scanner simulation
Financial tests: Decimal precision, edge cases

Error Handling

Graceful printer/scanner failure recovery
Database transaction rollback
User-friendly Spanish error messages
Comprehensive logging
Admin notification system

Deployment Notes

Ubuntu LTS on operator workstation
Kiosk mode for operator security
Docker containers for easy deployment
Environment-specific configuration
Backup and recovery procedures

IMPORTANT REMINDERS

ALWAYS use Decimal.js for money calculations
NEVER use placeholder code - implement full functionality
Test hardware integration thoroughly
Validate all financial operations
Maintain Spanish language consistency
Document any future development needs clearly