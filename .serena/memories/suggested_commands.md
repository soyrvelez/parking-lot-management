# Suggested Commands for Development

## Development Commands
```bash
npm run dev                 # Start both backend and frontend dev servers
npm run dev:backend        # Start only backend server with nodemon
npm run dev:frontend       # Start only frontend Next.js server
```

## Testing Commands
```bash
npm run test               # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run test:e2e          # Run Playwright end-to-end tests
npm run test:printer      # Test thermal printer connection
```

## Code Quality Commands
```bash
npm run lint              # Run ESLint on all TypeScript files
npm run lint:fix         # Auto-fix ESLint issues
npm run type-check       # Run TypeScript type checking (no emit)
```

## Database Commands
```bash
npx prisma generate      # Generate Prisma client
npx prisma db push      # Push schema changes to database
npx prisma migrate dev  # Create and apply database migration
npx prisma studio       # Open Prisma Studio GUI
npm run db:seed         # Seed database with test data
```

## Build & Deploy Commands
```bash
npm run build           # Build both backend and frontend
npm run build:backend   # Build backend TypeScript to JavaScript
npm run build:frontend  # Build Next.js production bundle
npm start               # Start production server
```

## System Commands (macOS/Darwin)
```bash
git status              # Check git status
git add .               # Stage all changes
git commit -m "msg"     # Commit with message
ls -la                  # List files with details
grep -r "pattern" .     # Search for pattern in files
find . -name "*.ts"     # Find TypeScript files
```