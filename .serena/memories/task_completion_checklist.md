# Task Completion Checklist

When completing any development task, ensure you:

## 1. Code Quality Checks
- [ ] Run `npm run lint` and fix any ESLint errors
- [ ] Run `npm run type-check` to ensure TypeScript types are correct
- [ ] Verify all money calculations use Decimal.js
- [ ] Check that all user-facing text is in Mexican Spanish

## 2. Testing
- [ ] Write tests BEFORE implementation (TDD approach)
- [ ] Run `npm run test` to ensure all tests pass
- [ ] For new features, add integration tests
- [ ] Test edge cases, especially for financial calculations

## 3. Database Changes
- [ ] Run `npx prisma generate` if schema changed
- [ ] Run `npx prisma db push` to update database
- [ ] Test database operations with transactions

## 4. Hardware Integration
- [ ] If printer-related: Test with `npm run test:printer`
- [ ] If scanner-related: Test barcode input handling
- [ ] Ensure graceful failure handling

## 5. Security Review
- [ ] Validate all inputs with Zod schemas
- [ ] Check authentication/authorization on admin routes
- [ ] Ensure no sensitive data in logs
- [ ] Verify atomic transactions for financial operations

## 6. Documentation
- [ ] Add JSDoc comments for complex functions
- [ ] Update API documentation if endpoints changed
- [ ] Mark any TODOs clearly for future development

## 7. Final Verification
- [ ] Run `npm run dev` and test the feature manually
- [ ] Verify Spanish language consistency
- [ ] Check responsive design (admin interface)
- [ ] Test error scenarios and recovery