# Run Test Suite

Execute comprehensive tests for the parking lot management system: $ARGUMENTS

## Test Categories:
1. **Unit Tests**: Services, utilities, calculations
2. **Integration Tests**: API endpoints, database operations  
3. **E2E Tests**: Complete user workflows
4. **Hardware Tests**: Printer, scanner simulation
5. **Financial Tests**: Decimal precision, edge cases

## Steps:
1. Run TypeScript type checking
2. Execute unit tests with coverage
3. Run integration tests against test database
4. Execute E2E tests with Playwright
5. Validate financial calculation accuracy
6. Test hardware integration (if available)
7. Generate comprehensive test report

## Arguments: 
- `all` - Run all tests
- `unit` - Run only unit tests
- `integration` - Run only integration tests  
- `e2e` - Run only E2E tests
- `financial` - Run only financial calculation tests
- `hardware` - Test printer/scanner integration

## Usage: /project:run-tests all