# Operador Interface Testing Checklist

## Pre-Test Setup

### 1. Environment Preparation
- [ ] Ensure PostgreSQL is running on localhost:5432
- [ ] Database `parking_lot` exists and is accessible
- [ ] Run `npx prisma db push` to sync schema
- [ ] Run `npx prisma db seed` to populate test data
- [ ] Start backend server: `npm run dev:backend` (port 4000)
- [ ] Start frontend server: `npm run dev:frontend` (port 3000)

### 2. Hardware Simulation
- [ ] Verify printer IP configuration (192.168.1.100:9100 in .env)
- [ ] Scanner input will use keyboard simulation
- [ ] Hardware status monitoring will check real printer connectivity

## Operator Workflow Tests

### A. Scanner Input & Visual Feedback
1. **Auto-focus Test**
   - [ ] Scanner input field auto-focuses on page load
   - [ ] Input field has blue border (scanner-input class)
   - [ ] Placeholder text shows "Escanee o ingrese código"

2. **Scan Simulation**
   - [ ] Type barcode quickly: `PARK123456`
   - [ ] Verify visual ring animation on scan
   - [ ] Auto-submit triggers after 8 characters
   - [ ] Success message: "¡Boleto encontrado!" (green, auto-dismiss 3s)
   - [ ] Error message: "Boleto o cliente de pensión no encontrado" (red, auto-dismiss 5s)
   - [ ] Last scan timestamp appears below

3. **Manual Entry**
   - [ ] Type barcode slowly and press Enter
   - [ ] "Presione Enter" hint appears when typing
   - [ ] Same visual feedback as auto-scan

### B. Keyboard Shortcuts
1. **Navigation (F1-F4)**
   - [ ] F1: Switch to Scan mode
   - [ ] F2: Switch to Entry mode
   - [ ] F3: Switch to Pension mode
   - [ ] F4: Switch to Payment mode (only if ticket loaded)
   - [ ] ESC: Return to Scan mode

2. **Payment Shortcuts (F5-F12)**
   - [ ] F5: Add $100 to payment amount
   - [ ] F6: Add $200 to payment amount
   - [ ] F7: Add $500 to payment amount
   - [ ] F8: Add $1000 to payment amount
   - [ ] F9: Clear payment amount
   - [ ] F10: Print receipt (future implementation)
   - [ ] F11: Add $50 to payment amount
   - [ ] F12: Confirm payment (same as Enter in payment)

### C. Payment Interface
1. **Touch-Friendly Design**
   - [ ] All buttons minimum 80px height
   - [ ] Quick amount buttons show green color
   - [ ] Clear button shows red color
   - [ ] Tooltips show keyboard shortcuts (F5, F6, F7, F9)

2. **Payment Calculation**
   - [ ] Enter ticket shows total amount
   - [ ] Quick buttons add to payment amount
   - [ ] Change calculation shows in blue box
   - [ ] Insufficient payment disables confirm button
   - [ ] Payment button shows "Confirmar Pago (F12)"

3. **Visual States**
   - [ ] Processing shows spinner animation
   - [ ] Success message shows with check icon
   - [ ] Error messages in Spanish
   - [ ] Auto-redirect after successful payment

### D. Hardware Status Monitoring
1. **Status Bar (Bottom)**
   - [ ] Shows current statistics on left
   - [ ] Hardware status indicators on right
   - [ ] Updates every 30 seconds

2. **Hardware Indicators**
   - [ ] Network: Green = "En línea", Red = "Sin conexión"
   - [ ] Printer: Green = "Lista", Yellow = "Papel bajo", Red = "Desconectada"
   - [ ] Scanner: Green = "Listo", Yellow = "Preparando", Red = "Desconectado"
   - [ ] Database: Green = "Activa", Red = "Sin conexión"

3. **Real-time Updates**
   - [ ] Disconnect network to see status change
   - [ ] Printer status checks actual TCP connection
   - [ ] Status refreshes every 30 seconds

### E. Spanish Localization
1. **UI Elements**
   - [ ] All navigation tabs in Spanish
   - [ ] All buttons labeled in Spanish
   - [ ] Status messages in Spanish
   - [ ] Error messages in Spanish

2. **Date/Time Formatting**
   - [ ] Times show in 24-hour format
   - [ ] Timezone: America/Mexico_City
   - [ ] Currency: $ symbol with MXN

### F. Complete Workflow Test

1. **New Vehicle Entry (F2)**
   - [ ] Enter plate number (uppercase enforced)
   - [ ] Print ticket simulation
   - [ ] Success message in Spanish
   - [ ] Return to scan mode

2. **Payment Flow**
   - [ ] Scan ticket barcode
   - [ ] Auto-redirect to payment
   - [ ] Shows entry time and duration
   - [ ] Calculate parking fee
   - [ ] Use F5/F6/F7 for quick payment
   - [ ] F12 to confirm
   - [ ] Print receipt simulation
   - [ ] Auto-return to scan mode

3. **Pension Customer**
   - [ ] Scan pension barcode
   - [ ] Redirect to pension section
   - [ ] Show customer details
   - [ ] Process monthly payment
   - [ ] Print receipt

4. **Lost Ticket**
   - [ ] Manual entry mode
   - [ ] Enter plate number
   - [ ] Pay lost ticket fee
   - [ ] Process payment

## Performance Tests

1. **Response Times**
   - [ ] Barcode lookup < 1 second
   - [ ] Payment processing < 2 seconds
   - [ ] Hardware status update < 500ms

2. **Concurrent Operations**
   - [ ] Multiple quick scans handled properly
   - [ ] Keyboard shortcuts don't interfere
   - [ ] No UI freezing during operations

## Edge Cases

1. **Error Handling**
   - [ ] Network disconnection shows error
   - [ ] Invalid barcode shows Spanish error
   - [ ] Payment API failure handled gracefully
   - [ ] Printer offline doesn't block payment

2. **Input Validation**
   - [ ] Empty barcode prevented
   - [ ] Invalid payment amounts rejected
   - [ ] Plate number format enforced

## Post-Test Verification

1. **Database State**
   - [ ] Tickets created with correct status
   - [ ] Payments recorded accurately
   - [ ] Transaction logs complete

2. **System Logs**
   - [ ] No JavaScript errors in console
   - [ ] API calls successful
   - [ ] Hardware status logged

## Test Data

### Sample Barcodes
- Active Ticket: `PARK123456`
- Paid Ticket: `PARK789012`  
- Pension Customer: `PENS001234`
- Invalid: `INVALID123`

### Test Scenarios
1. Normal payment: 2 hours parking = $35 MXN
2. Quick payment: Use F5 ($100) for $35 ticket = $65 change
3. Multiple amounts: F5 + F6 = $300 total
4. Clear and retry: Enter amount, F9 to clear, enter new

## Notes

- Hardware monitoring requires printer at configured IP
- Scanner simulation uses keyboard input
- All amounts in Mexican Pesos (MXN)
- Times in Mexico City timezone
- Touch operation via trackpad or mouse

## Sign-off

- [ ] Operator Interface: Production Ready
- [ ] Keyboard Shortcuts: Fully Functional
- [ ] Hardware Monitoring: Operational
- [ ] Spanish Localization: Complete
- [ ] Performance: Acceptable for Daily Use

Tested by: _________________ Date: _________________