# Code Style and Conventions

## TypeScript Conventions
- **Strict Mode**: TypeScript strict mode is enabled
- **Type Safety**: Avoid `any` types (ESLint warns on explicit any)
- **Imports**: Use path aliases (@/, @/backend/, @/frontend/, @/shared/)
- **File Extensions**: .ts for backend/logic, .tsx for React components

## Naming Conventions
- **Files**: kebab-case (e.g., `ticket-service.ts`)
- **React Components**: PascalCase files and exports
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Database Models**: PascalCase (Prisma convention)

## Code Organization
- **Backend**: Routes → Middleware → Services → Models pattern
- **Frontend**: Pages → Components → Hooks → Stores pattern
- **Shared**: Types and utilities used by both frontend/backend
- **Tests**: Located in `tests/` directory or `__tests__` folders

## Key Patterns
1. **Error Handling**: Comprehensive try-catch with Spanish error messages
2. **Validation**: Zod schemas for all API inputs
3. **Money**: ALWAYS use Decimal.js, never native numbers
4. **Dates**: Use moment-timezone for Mexico City time
5. **State**: Zustand for global state, React hooks for local

## Spanish Language
- All user-facing strings in Mexican Spanish
- Error messages in Spanish
- Comments in English (for development)
- Database fields in English

## Security Patterns
- JWT authentication for admin routes
- Input validation on all endpoints
- Rate limiting on API
- Transaction logging for audit trail