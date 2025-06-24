# 🖨️ Hardware Testing Guide for macOS Development

## Overview
This guide helps you test the Epson TM-T20III printer and Honeywell Voyager 1250g scanner on your Mac before deploying to the ThinkPad.

---

## 🚀 Quick Start

### 1. Run Automated Test Script
```bash
cd /Users/velez/dev/parking-lot-management
./scripts/test-hardware-mac.sh
```

This script will:
- ✅ Test network connectivity to printer
- ✅ Check USB scanner detection
- ✅ Create Node.js test scripts
- ✅ Update .env configuration

---

## 🖨️ Testing Epson TM-T20III Printer

### Prerequisites
- Printer connected to same network as your Mac
- Printer IP address (usually 192.168.1.100)
- Port 9100 accessible (standard raw printing port)

### Method 1: Direct Network Test (Recommended)
```bash
# Test printer connectivity
ping 192.168.1.100

# Test raw printing port
nc -zv 192.168.1.100 9100

# Send direct test print
node scripts/test-printer-direct.js 192.168.1.100
```

### Method 2: Using Application Integration
```bash
# Install printer dependency
npm install node-thermal-printer

# Update .env file
echo 'PRINTER_INTERFACE_TYPE="tcp"' >> .env
echo 'PRINTER_HOST="192.168.1.100"' >> .env
echo 'PRINTER_PORT=9100' >> .env

# Run application test
npm run test:printer
```

### Method 3: Manual Network Test
```bash
# Create test file
echo -e "\x1B@Test Print from Mac\n\n\n\x1DVA\x00" > test.prn

# Send to printer
nc 192.168.1.100 9100 < test.prn
```

### Expected Results
- ✅ Printer should print test receipt
- ✅ Spanish characters (ñ, á, é, etc.) display correctly
- ✅ Barcode prints properly
- ✅ Paper cuts automatically

---

## 🔍 Testing Honeywell Voyager 1250g Scanner

### Prerequisites
- Scanner connected via USB to Mac
- Scanner configured for keyboard emulation (default)
- Scanner LED showing ready state

### Method 1: System Detection
```bash
# List USB devices
system_profiler SPUSBDataType | grep -i honeywell

# Check HID devices
ioreg -p IOUSB -l | grep -i honeywell

# Expected output:
# Vendor ID: 0x0c2e (Honeywell)
# Product ID: 0x0b61 (Voyager 1250g)
```

### Method 2: Terminal Input Test
```bash
# Open terminal and run:
./scripts/test-hardware-mac.sh

# Select scanner test
# Scanner will act as keyboard
# Scan any barcode - it should appear in terminal
```

### Method 3: Browser Test
1. Open any text field in browser
2. Click in the field
3. Scan a barcode
4. Barcode data should appear as typed text

### Expected Results
- ✅ Scanner LED is active (red/white)
- ✅ Scanning produces beep sound
- ✅ Barcode appears as keyboard input
- ✅ Code 39 barcodes read correctly

---

## 🧪 Full System Integration Test

### 1. Start Development Environment
```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start frontend
npm run dev:frontend
```

### 2. Configure Hardware in .env
```bash
# Edit .env file
PRINTER_INTERFACE_TYPE="tcp"
PRINTER_HOST="192.168.1.100"
PRINTER_PORT=9100
PRINTER_TIMEOUT=5000
```

### 3. Test Complete Flow
1. Navigate to http://localhost:3001
2. Create new parking entry
3. **Print ticket** - Should print on Epson
4. **Scan ticket** - Use Honeywell scanner
5. Process payment
6. **Print receipt** - Should print exit receipt

---

## 🔧 Troubleshooting

### Printer Issues

#### "Cannot connect to printer"
```bash
# Check network connectivity
ping 192.168.1.100

# Check if printer port is open
nmap -p 9100 192.168.1.100

# Test with telnet
telnet 192.168.1.100 9100
```

#### "Printer connected but not printing"
- Check printer has paper
- Verify printer is not in error state
- Try power cycling the printer
- Print configuration page from printer

#### "Special characters not printing correctly"
- Ensure UTF-8 encoding in printer settings
- Use LATIN character set for Spanish
- Test with simplified character set first

### Scanner Issues

#### "Scanner not detected"
```bash
# Reset USB
sudo killall -STOP -c usbd

# List all USB devices
ls /dev/tty.* | grep -i usb

# Check System Information
# Apple Menu > About This Mac > System Report > USB
```

#### "Scanner detected but not reading"
- Check scanner LED is on
- Try different barcode types
- Clean scanner window
- Test with manufacturer's barcode samples

#### "Scanned data appears garbled"
- Check scanner configuration (should be keyboard emulation)
- Verify Code 39 symbology is enabled
- Test with simple numeric barcodes first

---

## 📊 Test Checklist

### Network Printer Testing
- [ ] Ping printer successfully
- [ ] Port 9100 accessible
- [ ] Direct print test works
- [ ] Spanish characters print correctly
- [ ] Barcode prints and scans
- [ ] Paper cuts properly

### USB Scanner Testing
- [ ] Scanner detected in System Information
- [ ] LED indicator active
- [ ] Beeps when scanning
- [ ] Data appears as keyboard input
- [ ] Code 39 barcodes work
- [ ] Scans into application correctly

### Integration Testing
- [ ] Printer works from application
- [ ] Scanner input accepted by app
- [ ] Full entry/exit flow completes
- [ ] Receipts format correctly
- [ ] No timeout errors

---

## 🎯 Next Steps

### After Successful Testing:

1. **Document Working Configuration**
   ```bash
   # Save working config
   cp .env .env.working-mac
   ```

2. **Note Hardware Details**
   - Printer IP: _______________
   - Scanner detected as: _______________
   - Any special settings: _______________

3. **Prepare for ThinkPad**
   - Same printer IP will work on Ubuntu
   - Scanner should work plug-and-play
   - Copy working .env settings

### Migration to Ubuntu:
- Network printer setup identical
- Scanner will use /dev/hidraw0 or similar
- Test scripts included in deployment

---

## 📝 Quick Reference Commands

```bash
# Printer Tests
ping 192.168.1.100                          # Test connectivity
nc -zv 192.168.1.100 9100                  # Test port
node scripts/test-printer-direct.js         # Direct print test

# Scanner Tests  
system_profiler SPUSBDataType               # List USB devices
ioreg -p IOUSB -l | grep -i honeywell      # Find scanner
cat > /dev/null                            # Read scanner input

# Full Test
./scripts/test-hardware-mac.sh              # Run all tests
```

---

## 🆘 Support

If hardware tests fail:

1. **Check physical connections**
   - Printer: Ethernet cable, power, paper
   - Scanner: USB cable, power from USB

2. **Verify network**
   - Mac and printer on same subnet
   - No firewall blocking port 9100

3. **Review application logs**
   ```bash
   # Check for errors
   npm run dev:backend 2>&1 | grep -i "print\|scan"
   ```

4. **Test with minimal setup**
   - Use direct test scripts first
   - Add complexity gradually

---

*Hardware Test Guide v1.0*
*December 2024*