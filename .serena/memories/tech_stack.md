# Technology Stack

## Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- **Financial**: Decimal.js for money calculations
- **Hardware**: 
  - node-thermal-printer for Epson TM-T20III
  - JsBarcode for Code 39 generation
- **Time**: moment-timezone for Mexico City timezone
- **Auth**: JWT authentication

## Frontend
- **Framework**: Next.js 14+ with TypeScript
- **UI Components**: Shadcn/ui design system
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand state management

## Testing & Quality
- **Test Runner**: Jest with ts-jest
- **E2E Testing**: Playwright
- **Linting**: ESLint with TypeScript plugin
- **Type Checking**: TypeScript strict mode
- **Code Formatting**: Prettier

## Development Tools
- **Package Manager**: npm (>=8.0.0)
- **Node Version**: >=18.0.0
- **Build Tools**: TypeScript compiler, Next.js build
- **Database Tools**: Prisma CLI