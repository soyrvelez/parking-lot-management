#!/bin/bash
set -euo pipefail

# Test Hardware on macOS Development Environment - USB FOCUS
# This script helps test Epson printer (USB) and Honeywell scanner (USB)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

echo "======================================"
echo "  USB HARDWARE TEST - macOS Dev"
echo "======================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    error "This script is designed for macOS"
    exit 1
fi

# Function to test USB printer
test_usb_printer() {
    log "=== TESTING EPSON TM-T20III USB PRINTER ==="
    
    info "Scanning for USB printers..."
    echo ""
    
    # List USB devices - look for Epson
    system_profiler SPUSBDataType | grep -A 10 -i "epson\|tm-t20\|thermal" || {
        warn "Epson printer not detected via system_profiler"
        echo ""
        info "All connected USB devices:"
        system_profiler SPUSBDataType | grep -E "Product ID:|Vendor ID:|Manufacturer:|^\s+.*:$" | grep -B1 -A2 "0x"
    }
    
    # Check for printer devices
    info "Checking printer devices..."
    ls -la /dev/usb/lp* 2>/dev/null || warn "No /dev/usb/lp* devices found"
    ls -la /dev/tty.usb* 2>/dev/null || warn "No /dev/tty.usb* devices found"
    ls -la /dev/cu.usb* 2>/dev/null || warn "No /dev/cu.usb* devices found"
    
    # Check CUPS printers
    info "Checking CUPS printers..."
    lpstat -p -d 2>/dev/null || warn "No CUPS printers configured"
    
    # macOS typically uses CUPS for USB printers
    echo ""
    warn "Note: macOS typically requires CUPS driver for USB thermal printers"
    echo "Options for testing:"
    echo "1. Install Epson TM-T20III CUPS driver from Epson website"
    echo "2. Use direct serial communication if printer supports it"
    echo "3. Test on Linux/Windows where raw USB is easier"
    echo ""
    
    # Try to find any Epson in ioreg
    info "Checking USB registry for Epson devices..."
    ioreg -p IOUSB -l | grep -i epson -A 5 -B 5 || echo "No Epson devices in USB registry"
    
    return 0
}

# Function to test USB scanner (same as before)
test_usb_scanner() {
    log "=== TESTING HONEYWELL VOYAGER 1250g SCANNER ==="
    
    # List USB devices
    info "Scanning for Honeywell USB devices..."
    echo ""
    system_profiler SPUSBDataType | grep -A 5 -i "honeywell\|voyager\|1250" || {
        warn "Honeywell scanner not detected via system_profiler"
        echo ""
        info "Looking for HID barcode scanners..."
        system_profiler SPUSBDataType | grep -A 5 -B 2 "Barcode\|Scanner\|HID"
    }
    
    # Check for HID devices
    info "Checking HID devices..."
    if command -v hidutil &> /dev/null; then
        hidutil list | grep -i "honeywell\|0x0c2e" || {
            warn "Scanner not found in HID devices"
            echo "All HID devices:"
            hidutil list | head -20
        }
    fi
    
    # Test keyboard input simulation
    info "Testing scanner as keyboard input..."
    echo ""
    echo "SCANNER TEST:"
    echo "1. Make sure scanner is connected via USB"
    echo "2. Scanner should show a light (red or white)"
    echo "3. Scan any barcode"
    echo "4. The barcode should appear below:"
    echo ""
    echo -n "Waiting for scan (press Ctrl+C to cancel): "
    
    # Wait for input with timeout
    if read -t 30 barcode; then
        log "✓ Scanner working! Scanned: $barcode"
        return 0
    else
        warn "No scan detected after 30 seconds"
        return 1
    fi
}

# Function to create USB test info
create_usb_test_info() {
    log "Creating USB testing information..."
    
    cat > USB_PRINTER_TEST_INFO.md << 'EOF'
# USB Printer Testing on macOS

## Challenge with macOS
macOS doesn't easily support raw USB printing like Linux does. The Epson TM-T20III 
on macOS typically requires one of these approaches:

### Option 1: CUPS Driver (Recommended for Mac)
1. Download Epson TM-T20III driver from Epson website
2. Install via System Preferences > Printers & Scanners
3. Print using CUPS commands:
   ```bash
   lpr -P "TM-T20III" test-file.txt
   ```

### Option 2: Serial over USB
Some thermal printers appear as serial devices:
```bash
ls /dev/cu.usbserial*
ls /dev/tty.usbserial*

# If found, test with:
echo "Test print" > /dev/cu.usbserial-xxxxx
```

### Option 3: Use Virtual Machine
Run Ubuntu in VirtualBox/VMware and pass through USB:
- Raw USB access works in Linux
- Test with: echo "test" > /dev/usb/lp0

### Option 4: Direct Development on Linux
Since deployment is on Ubuntu, consider:
- Dual boot Mac with Ubuntu
- Use a Linux development machine
- Use the actual ThinkPad for testing

## For ThinkPad Deployment
On Ubuntu, USB printing is straightforward:
```bash
# Check for printer
ls /dev/usb/lp0

# Test print
echo -e "Test\n\n\n" > /dev/usb/lp0
```

## What We Know Works
- Scanner: Works perfectly as HID keyboard on Mac
- Printer: Will work on Ubuntu with USB (/dev/usb/lp0)
- Both devices are USB and will work on ThinkPad
EOF

    log "✓ Created USB_PRINTER_TEST_INFO.md"
}

# Main execution
main() {
    echo "This script tests USB devices on macOS"
    echo "Note: USB raw printing is limited on macOS"
    echo ""
    
    # Test printer
    read -p "Test USB printer detection? (y/n): " test_printer
    if [[ "$test_printer" == "y" ]]; then
        test_usb_printer
    fi
    
    echo ""
    
    # Test scanner
    read -p "Test USB scanner? (y/n): " test_scanner
    if [[ "$test_scanner" == "y" ]]; then
        test_usb_scanner || warn "Scanner test incomplete"
    fi
    
    echo ""
    
    # Create info file
    read -p "Create USB testing info file? (y/n): " create_info
    if [[ "$create_info" == "y" ]]; then
        create_usb_test_info
    fi
    
    echo ""
    log "=== USB HARDWARE TEST COMPLETE ==="
    echo ""
    echo "Summary:"
    echo "- Scanner: Should work perfectly on Mac (HID keyboard)"
    echo "- Printer: Limited on Mac, will work great on Ubuntu"
    echo "- Both connect via USB to ThinkPad in production"
    echo ""
    echo "Recommendation:"
    echo "1. Test scanner functionality on Mac ✓"
    echo "2. Verify printer USB detection on Mac"
    echo "3. Full printer testing on Ubuntu/ThinkPad"
}

# Run main function
main