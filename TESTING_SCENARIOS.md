# Operator Interface Testing Scenarios

## 🚀 Environment Status
- **Backend API**: ✅ Running on http://localhost:4000
- **Frontend UI**: ✅ Running on http://localhost:3001
- **Database**: ✅ PostgreSQL with test data
- **Hardware Service**: ✅ Real-time monitoring active

## 📋 Test Data Available
- **Active Ticket**: `PARK123456` (ABC123, 2 hours, owes ~$35)
- **Paid Ticket**: `PARK789012` (XYZ789, already paid)
- **Pension Customer**: `MEX456` (Juan Pérez García)

---

## 🎯 Priority Testing Scenarios

### 1. Scanner Input & Visual Feedback
**Goal**: Validate barcode scanning experience
1. Open http://localhost:3001
2. Scanner input should auto-focus (blue border)
3. Type `PARK123456` quickly (simulate scanner)
4. Watch for:
   - ✨ Visual ring animation on input
   - ⚡ Auto-submit after 8+ characters
   - ✅ Success message: "¡Boleto encontrado!"
   - 🔄 Auto-redirect to payment section

### 2. Keyboard Shortcuts (F5-F12)
**Goal**: Test operator efficiency features
1. Navigate to payment section (scan PARK123456)
2. Test quick payment amounts:
   - `F5`: Should add $100
   - `F6`: Should add $200  
   - `F7`: Should add $500
   - `F8`: Should add $1000
   - `F9`: Should clear amount
3. Test payment confirmation:
   - `F12`: Should confirm payment (same as clicking button)

### 3. Complete Payment Workflow
**Goal**: End-to-end transaction processing
1. Scan `PARK123456`
2. Verify ticket info shows:
   - Plate: ABC123
   - Entry time: ~2 hours ago
   - Total: ~$35 MXN
3. Use `F5` twice to add $200
4. Verify change calculation: ~$165
5. Press `F12` to confirm payment
6. Watch for:
   - ✅ Success message in Spanish
   - 🖨️ Print receipt simulation
   - 🔄 Auto-return to scan mode

### 4. Hardware Status Monitoring
**Goal**: Real-time hardware visibility
1. Check bottom status bar
2. Verify indicators show:
   - 🌐 Network: "En línea" (green dot)
   - 🖨️ Printer: "Desconectada" (red dot - no printer at IP)
   - 📱 Scanner: "Listo" (green dot)
   - 💾 Database: "Activa" (green dot)
3. Wait 30 seconds and verify status updates

### 5. Spanish Localization
**Goal**: 100% Mexican Spanish interface
1. Check all UI text is in Spanish
2. Test error scenarios:
   - Type invalid barcode `INVALID123`
   - Verify error: "Boleto o cliente de pensión no encontrado"
3. Verify currency formatting: "$ XX.XX MXN"
4. Check date/time in Mexican format

---

## 🔧 Hardware Simulation Tests

### Printer Connectivity Test
```bash
# Test real printer connectivity (will fail - expected)
curl http://localhost:4000/api/hardware/status | jq '.data.printer'
```
**Expected**: `"connected": false` (no printer at 192.168.1.100)

### Scanner Input Simulation
1. Type barcodes slowly vs. quickly
2. Test manual entry with Enter key
3. Verify auto-focus behavior
4. Test with multiple rapid scans

---

## 📊 Performance Validation

### Response Time Targets
- **Barcode lookup**: < 1 second
- **Payment processing**: < 2 seconds  
- **Hardware status**: < 500ms (cached)
- **UI navigation**: Instant

### Load Testing
1. Rapid barcode scanning (10 scans in 30 seconds)
2. Quick keyboard shortcut usage (F5-F9 repeatedly)
3. Multiple payment flows back-to-back
4. Monitor browser console for errors

---

## 🎮 Usability Testing

### Touch-Friendly Design
1. All buttons minimum 80px height ✓
2. Large scanner input field ✓
3. Clear visual hierarchy ✓
4. High contrast colors ✓

### Keyboard vs Touch Operation
1. Test complete workflow using only keyboard (F1-F12)
2. Test complete workflow using only mouse/trackpad
3. Test mixed keyboard/touch usage
4. Verify no conflicts between input methods

### Error Recovery
1. Test invalid inputs gracefully handled
2. Verify Spanish error messages
3. Test network disconnection scenarios
4. Validate fallback behaviors

---

## 🏁 Acceptance Criteria

### ✅ Must Pass
- [ ] Scanner auto-focus and visual feedback
- [ ] All F5-F12 keyboard shortcuts functional
- [ ] Payment calculation and change correct
- [ ] Hardware status shows real connectivity
- [ ] 100% Spanish UI and error messages
- [ ] Sub-30-second transaction times
- [ ] No JavaScript errors in console

### 🎯 Performance Benchmarks
- [ ] Barcode scan to payment: < 10 seconds
- [ ] Payment completion: < 20 seconds
- [ ] Hardware status updates: Every 30 seconds
- [ ] Memory usage stable during extended use

### 🛡️ Error Handling
- [ ] Invalid barcodes show Spanish errors
- [ ] Network failures handled gracefully
- [ ] Printer offline doesn't block payments
- [ ] Scanner input focus maintained

---

## 🚨 Known Limitations (Expected)
- **Printer**: Shows "Desconectada" (no physical printer)
- **Scanner**: Simulated via keyboard input
- **Network Test**: Manual disconnection testing required
- **Hardware**: Status monitoring works but hardware simulation only

---

## 🎉 Success Indicators
If testing passes, the operator interface is ready for:
- ✅ Production deployment
- ✅ Operator training
- ✅ Hardware integration
- ✅ Daily parking lot operations

**Next Steps After Testing**: Hardware setup, operator training, production deployment