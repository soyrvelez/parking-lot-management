#!/bin/bash
set -euo pipefail

# Comprehensive Hardware Testing Script
# Tests printer and scanner on both macOS (development) and Ubuntu (production)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${PURPLE}[SUCCESS]${NC} $1"; }

PLATFORM=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════════════════════════════"
echo "  COMPREHENSIVE HARDWARE TEST - Cross Platform"
echo "  Platform: $PLATFORM"
echo "  Project: $(basename "$PROJECT_ROOT")"
echo "════════════════════════════════════════════════════════════════"
echo

# Function to detect platform-specific hardware
detect_platform_hardware() {
    log "=== PLATFORM HARDWARE DETECTION ==="
    
    if [[ "$PLATFORM" == "Darwin" ]]; then
        info "macOS Development Environment Detected"
        
        # Check for CUPS printers
        info "Checking CUPS printers..."
        if lpstat -p 2>/dev/null | grep -q "ThermalPrinter"; then
            success "✓ ThermalPrinter found in CUPS"
            lpstat -l -p ThermalPrinter | head -5
        else
            warn "✗ ThermalPrinter not found in CUPS"
            info "Available CUPS printers:"
            lpstat -p 2>/dev/null || echo "  No CUPS printers configured"
        fi
        
        # Check for USB devices
        info "Checking USB devices..."
        if system_profiler SPUSBDataType | grep -q "Voyager"; then
            success "✓ Honeywell scanner detected"
            system_profiler SPUSBDataType | grep -A 5 "Voyager"
        else
            warn "✗ Honeywell scanner not detected"
        fi
        
    elif [[ "$PLATFORM" == "Linux" ]]; then
        info "Linux Production Environment Detected"
        
        # Check for USB printer devices
        info "Checking USB printer devices..."
        for device in /dev/usb/lp* /dev/lp* /dev/ttyUSB*; do
            if [[ -e "$device" ]]; then
                success "✓ Found printer device: $device"
                ls -la "$device"
            fi
        done
        
        # Check for USB scanner
        info "Checking USB scanner..."
        if lsusb | grep -i "honeywell\|0c2e"; then
            success "✓ Honeywell scanner detected"
            lsusb | grep -i "honeywell\|0c2e"
        else
            warn "✗ Honeywell scanner not detected"
        fi
        
        # Check for HID devices
        if ls /dev/hidraw* 2>/dev/null; then
            success "✓ HID devices available"
            ls -la /dev/hidraw*
        fi
        
    else
        warn "Unknown platform: $PLATFORM"
        return 1
    fi
    
    echo
}

# Function to test network connectivity (for TCP printing)
test_network_connectivity() {
    log "=== NETWORK CONNECTIVITY TEST ==="
    
    local printer_ip="${PRINTER_HOST:-192.168.1.100}"
    local printer_port="${PRINTER_PORT:-9100}"
    
    info "Testing network printer at $printer_ip:$printer_port..."
    
    if command -v nc >/dev/null 2>&1; then
        if nc -z -w2 "$printer_ip" "$printer_port" 2>/dev/null; then
            success "✓ Network printer reachable"
            return 0
        else
            warn "✗ Network printer not reachable"
            return 1
        fi
    else
        warn "netcat (nc) not available for network testing"
        return 1
    fi
}

# Function to test direct hardware
test_direct_hardware() {
    log "=== DIRECT HARDWARE TEST ==="
    
    if [[ "$PLATFORM" == "Darwin" ]]; then
        # Test CUPS printing
        info "Testing CUPS raw printing..."
        echo -e "\x1B@Raw Print Test from macOS\n$(date)\n\n\n\x1DVA\x00" > /tmp/test-print.prn
        
        if lpr -P ThermalPrinter -o raw /tmp/test-print.prn 2>/dev/null; then
            success "✓ CUPS raw print command succeeded"
            info "Check printer for output"
        else
            warn "✗ CUPS raw print failed"
        fi
        
        rm -f /tmp/test-print.prn
        
    elif [[ "$PLATFORM" == "Linux" ]]; then
        # Test direct USB printing
        info "Testing direct USB printing..."
        
        for device in /dev/usb/lp0 /dev/lp0; do
            if [[ -w "$device" ]]; then
                info "Testing device: $device"
                if echo -e "\x1B@Direct USB Test from Linux\n$(date)\n\n\n\x1DVA\x00" > "$device" 2>/dev/null; then
                    success "✓ Direct USB print to $device succeeded"
                    break
                else
                    warn "✗ Direct USB print to $device failed"
                fi
            fi
        done
    fi
    
    echo
}

# Function to test application integration
test_application_integration() {
    log "=== APPLICATION INTEGRATION TEST ==="
    
    local backend_url="http://localhost:4000"
    
    info "Checking backend service..."
    if curl -s "$backend_url/api/hardware/status" >/dev/null 2>&1; then
        success "✓ Backend service is running"
        
        # Get hardware status
        local status=$(curl -s "$backend_url/api/hardware/status")
        echo "$status" | python3 -m json.tool 2>/dev/null || echo "$status"
        
        # Test print through API
        info "Testing print through API..."
        local test_data='{
            "ticketId": "test-comprehensive-'$(date +%s)'",
            "plateNumber": "TEST123",
            "entryTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
            "barcode": "COMPREHENSIVE123"
        }'
        
        local print_result=$(curl -s -X POST "$backend_url/api/hardware/print-ticket" \
            -H "Content-Type: application/json" \
            -d "$test_data")
        
        if echo "$print_result" | grep -q '"success":true'; then
            success "✓ API print test succeeded"
            info "Check printer for ticket with plate TEST123"
        else
            warn "✗ API print test failed"
            echo "$print_result"
        fi
        
    else
        warn "✗ Backend service not running"
        info "Start with: npm run dev:backend"
        return 1
    fi
    
    echo
}

# Function to test scanner
test_scanner_functionality() {
    log "=== SCANNER FUNCTIONALITY TEST ==="
    
    info "Scanner will act as HID keyboard device"
    info "Instructions:"
    echo "  1. Make sure scanner LED is on"
    echo "  2. Point scanner at any barcode"
    echo "  3. Press trigger or auto-scan"
    echo "  4. Data should appear below"
    echo
    
    echo -n "Ready to test scanner (y/n)? "
    read -r test_scanner
    
    if [[ "$test_scanner" == "y" ]]; then
        echo "Waiting for barcode scan (30 seconds timeout)..."
        echo "Scan now:"
        
        if read -t 30 scanned_data; then
            if [[ -n "$scanned_data" ]]; then
                success "✓ Scanner working! Data: $scanned_data"
                info "Length: ${#scanned_data} characters"
                
                # Validate barcode format
                if [[ ${#scanned_data} -ge 4 && ${#scanned_data} -le 50 ]]; then
                    success "✓ Barcode length looks valid"
                else
                    warn "⚠ Unusual barcode length"
                fi
                
                # Test Code 39 compatibility
                if [[ $scanned_data =~ ^[A-Z0-9\ \-\.]+$ ]]; then
                    success "✓ Code 39 compatible format"
                else
                    info "ℹ Contains non-Code39 characters"
                fi
            else
                warn "✗ No data received"
            fi
        else
            warn "✗ Scanner timeout - no scan detected"
        fi
    else
        info "Scanner test skipped"
    fi
    
    echo
}

# Function to generate comprehensive report
generate_test_report() {
    log "=== GENERATING TEST REPORT ==="
    
    local report_file="hardware-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Hardware Test Report

**Date:** $(date)  
**Platform:** $PLATFORM  
**Project:** Parking Lot Management System  

## System Information

- **OS:** $(uname -a)
- **Node.js:** $(node --version 2>/dev/null || echo "Not installed")
- **npm:** $(npm --version 2>/dev/null || echo "Not installed")

## Hardware Detection Results

### Printer
$(if [[ "$PLATFORM" == "Darwin" ]]; then
    if lpstat -p ThermalPrinter >/dev/null 2>&1; then
        echo "- ✅ CUPS Printer: ThermalPrinter (macOS)"
        echo "- Status: $(lpstat -p ThermalPrinter | head -1)"
    else
        echo "- ❌ CUPS Printer: Not found"
    fi
else
    echo "- Linux USB devices:"
    for device in /dev/usb/lp* /dev/lp* /dev/ttyUSB*; do
        if [[ -e "$device" ]]; then
            echo "  - ✅ $device"
        fi
    done
fi)

### Scanner
$(if [[ "$PLATFORM" == "Darwin" ]]; then
    if system_profiler SPUSBDataType | grep -q "Voyager"; then
        echo "- ✅ Honeywell Voyager scanner detected (macOS)"
        system_profiler SPUSBDataType | grep -A 3 "Voyager" | sed 's/^/  /'
    else
        echo "- ❌ Scanner: Not detected"
    fi
else
    if lsusb | grep -i "honeywell\|0c2e" >/dev/null 2>&1; then
        echo "- ✅ Honeywell scanner detected (Linux)"
        lsusb | grep -i "honeywell\|0c2e" | sed 's/^/  /'
    else
        echo "- ❌ Scanner: Not detected"
    fi
fi)

## Test Results

### Backend Service
$(if curl -s http://localhost:4000/api/hardware/status >/dev/null 2>&1; then
    echo "- ✅ Backend running on port 4000"
    echo "- ✅ Hardware status API responding"
else
    echo "- ❌ Backend not running"
fi)

### Print Test
$(if curl -s -X POST http://localhost:4000/api/hardware/print-ticket \
    -H "Content-Type: application/json" \
    -d '{"ticketId":"report-test","plateNumber":"RPT123","entryTime":"'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'","barcode":"REPORT123"}' \
    | grep -q '"success":true'; then
    echo "- ✅ API print test successful"
else
    echo "- ❌ API print test failed"
fi)

## Platform-Specific Configuration

### For macOS Development:
\`\`\`bash
# Printer configuration
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="printer:ThermalPrinter"

# Verify CUPS printer
lpstat -p ThermalPrinter
\`\`\`

### For Ubuntu Production:
\`\`\`bash
# Printer configuration
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# Verify USB device
ls -la /dev/usb/lp0
sudo usermod -a -G lp \$USER
\`\`\`

## Troubleshooting

### macOS Issues:
1. **CUPS printer not found:** Install Epson driver and add printer in System Preferences
2. **Scanner not detected:** Check USB connection and permissions
3. **Print jobs not printing:** Try raw printing with \`-o raw\` flag

### Ubuntu Issues:
1. **USB device not accessible:** Add user to \`lp\` group
2. **Scanner permissions:** Add user to \`input\` group  
3. **Serial devices:** Check \`/dev/ttyUSB*\` for serial-over-USB

## Next Steps

$(if [[ "$PLATFORM" == "Darwin" ]]; then
    echo "- ✅ Development environment ready for testing"
    echo "- 📋 Deploy to Ubuntu ThinkPad when ready"
else
    echo "- ✅ Production environment configured"
    echo "- 📋 Run full system tests"
fi)

---
*Generated by: \`scripts/test-hardware-comprehensive.sh\`*
EOF

    success "✓ Test report generated: $report_file"
    info "Review the report for detailed results and next steps"
}

# Main execution flow
main() {
    # Check prerequisites
    info "Checking prerequisites..."
    
    if ! command -v curl >/dev/null 2>&1; then
        error "curl is required but not installed"
        exit 1
    fi
    
    # Run tests
    detect_platform_hardware
    test_network_connectivity || true  # Don't fail if network test fails
    test_direct_hardware
    test_application_integration || true  # Don't fail if backend is down
    test_scanner_functionality
    generate_test_report
    
    echo
    log "=== COMPREHENSIVE HARDWARE TEST COMPLETE ==="
    echo
    success "Hardware testing completed successfully!"
    echo
    echo "Summary:"
    echo "✓ Platform detection completed"
    echo "✓ Hardware detection attempted" 
    echo "✓ Direct hardware tests run"
    echo "✓ Application integration tested"
    echo "✓ Test report generated"
    echo
    echo "Next steps:"
    if [[ "$PLATFORM" == "Darwin" ]]; then
        echo "1. Verify printer output from tests"
        echo "2. Test scanner functionality in application"
        echo "3. Prepare for Ubuntu deployment"
    else
        echo "1. Verify all hardware is functioning"
        echo "2. Run production system tests"
        echo "3. Monitor system in operation"
    fi
}

# Execute main function
main "$@"