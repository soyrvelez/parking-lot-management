#!/bin/bash
set -euo pipefail

# Test Hardware on macOS Development Environment
# This script helps test Epson printer and Honeywell scanner before ThinkPad deployment

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
echo "  HARDWARE TEST - macOS Development"
echo "======================================"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    error "This script is designed for macOS"
    exit 1
fi

# Function to test network printer
test_network_printer() {
    log "=== TESTING EPSON TM-T20III NETWORK PRINTER ==="
    
    read -p "Enter printer IP address (default: 192.168.1.100): " PRINTER_IP
    PRINTER_IP=${PRINTER_IP:-192.168.1.100}
    
    # Test network connectivity
    info "Testing connectivity to printer at $PRINTER_IP..."
    if ping -c 3 -t 2 $PRINTER_IP > /dev/null 2>&1; then
        log "✓ Printer is reachable on network"
    else
        error "✗ Cannot reach printer at $PRINTER_IP"
        warn "Please check:"
        echo "  1. Printer is powered on"
        echo "  2. Printer is connected to same network"
        echo "  3. IP address is correct (check printer config page)"
        return 1
    fi
    
    # Test raw socket connection
    info "Testing printer port 9100..."
    if nc -z -w2 $PRINTER_IP 9100 2>/dev/null; then
        log "✓ Printer port 9100 is open"
    else
        error "✗ Cannot connect to printer port 9100"
        warn "The printer may not support raw socket printing"
        return 1
    fi
    
    # Update .env file for testing
    if [ -f .env ]; then
        info "Updating .env for network printer testing..."
        sed -i.bak 's/PRINTER_INTERFACE_TYPE=.*/PRINTER_INTERFACE_TYPE="tcp"/' .env
        sed -i.bak "s/PRINTER_HOST=.*/PRINTER_HOST=\"$PRINTER_IP\"/" .env
        log "✓ .env updated with printer configuration"
    else
        warn ".env file not found, creating test configuration..."
        cat > .env.test << EOF
PRINTER_INTERFACE_TYPE="tcp"
PRINTER_HOST="$PRINTER_IP"
PRINTER_PORT=9100
PRINTER_TIMEOUT=5000
PRINTER_RETRY_ATTEMPTS=3
PRINTER_PAPER_WIDTH=32
EOF
        log "✓ Created .env.test for printer testing"
    fi
    
    return 0
}

# Function to test USB scanner
test_usb_scanner() {
    log "=== TESTING HONEYWELL VOYAGER 1250g SCANNER ==="
    
    # List USB devices
    info "Scanning for USB devices..."
    echo ""
    system_profiler SPUSBDataType | grep -A 5 -i "honeywell\|voyager\|1250" || {
        warn "Honeywell scanner not detected via system_profiler"
        echo ""
        info "All connected USB devices:"
        system_profiler SPUSBDataType | grep -E "Product ID:|Vendor ID:|Manufacturer:|^\s+.*:$" | grep -B1 -A2 "0x"
    }
    
    # Check for HID devices
    info "Checking HID devices..."
    if command -v hidutil &> /dev/null; then
        hidutil list | grep -i "honeywell\|0x0c2e" || {
            warn "Scanner not found in HID devices"
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

# Function to create test Node.js script
create_node_test_script() {
    log "Creating Node.js hardware test script..."
    
    cat > test-hardware.js << 'EOF'
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const readline = require('readline');

// Load environment variables
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function testPrinter() {
  console.log('\n=== THERMAL PRINTER TEST ===\n');
  
  const config = {
    type: PrinterTypes.EPSON,
    interface: process.env.PRINTER_INTERFACE_TYPE === 'tcp' 
      ? `tcp://${process.env.PRINTER_HOST}:${process.env.PRINTER_PORT || 9100}`
      : process.env.PRINTER_DEVICE_PATH || '/dev/usb/lp0',
    characterSet: 'LATIN',
    removeSpecialCharacters: false,
    width: 32,
    options: {
      timeout: parseInt(process.env.PRINTER_TIMEOUT || '5000')
    }
  };
  
  console.log('Printer configuration:', config);
  
  const printer = new ThermalPrinter(config);
  
  try {
    const isConnected = await printer.isPrinterConnected();
    console.log('Printer connected:', isConnected);
    
    if (!isConnected) {
      throw new Error('Printer not connected');
    }
    
    // Print test receipt
    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println('PRUEBA DE IMPRESORA');
    printer.bold(false);
    printer.println('Test Receipt / Recibo de Prueba');
    printer.drawLine();
    
    printer.alignLeft();
    printer.println(`Fecha: ${new Date().toLocaleString('es-MX')}`);
    printer.println(`Sistema: macOS Development`);
    printer.println(`Modelo: Epson TM-T20III`);
    printer.drawLine();
    
    printer.alignCenter();
    printer.println('Caracteres Especiales:');
    printer.println('ñ Ñ á é í ó ú ¿ ¡ $ €');
    printer.drawLine();
    
    // Print barcode
    printer.printBarcode('TEST123456', 'CODE39');
    printer.println('TEST123456');
    
    printer.cut();
    
    await printer.execute();
    console.log('\n✓ Test receipt printed successfully!');
    
  } catch (error) {
    console.error('\n✗ Printer error:', error.message);
    return false;
  }
  
  return true;
}

async function testScanner() {
  console.log('\n=== BARCODE SCANNER TEST ===\n');
  console.log('1. Make sure scanner is connected');
  console.log('2. Scanner should act as keyboard input');
  console.log('3. Scan any barcode when prompted\n');
  
  return new Promise((resolve) => {
    rl.question('Ready to scan. Press ENTER to continue...', () => {
      console.log('\nWaiting for barcode scan (you have 30 seconds)...');
      
      const timeout = setTimeout(() => {
        console.log('\n✗ Scan timeout - no barcode detected');
        resolve(false);
      }, 30000);
      
      rl.question('', (barcode) => {
        clearTimeout(timeout);
        if (barcode) {
          console.log(`\n✓ Scanner working! Scanned: ${barcode}`);
          resolve(true);
        } else {
          console.log('\n✗ No barcode data received');
          resolve(false);
        }
      });
    });
  });
}

async function main() {
  console.log('PARKING SYSTEM HARDWARE TEST - macOS\n');
  
  let printerOk = false;
  let scannerOk = false;
  
  // Test printer
  const testPrinterChoice = await new Promise(resolve => {
    rl.question('Test thermal printer? (y/n): ', answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
  
  if (testPrinterChoice) {
    printerOk = await testPrinter();
  }
  
  // Test scanner  
  const testScannerChoice = await new Promise(resolve => {
    rl.question('\nTest barcode scanner? (y/n): ', answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
  
  if (testScannerChoice) {
    scannerOk = await testScanner();
  }
  
  // Summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Printer: ${printerOk ? '✓ Working' : '✗ Not working / Not tested'}`);
  console.log(`Scanner: ${scannerOk ? '✓ Working' : '✗ Not working / Not tested'}`);
  
  rl.close();
  process.exit(printerOk && scannerOk ? 0 : 1);
}

main().catch(console.error);
EOF

    log "✓ Created test-hardware.js"
}

# Function to run complete test
run_hardware_test() {
    echo ""
    echo "This script will test:"
    echo "1. Epson TM-T20III thermal printer (network)"
    echo "2. Honeywell Voyager 1250g scanner (USB)"
    echo ""
    
    # Test printer
    read -p "Test network printer? (y/n): " test_printer
    if [[ "$test_printer" == "y" ]]; then
        test_network_printer || warn "Printer test failed"
    fi
    
    echo ""
    
    # Test scanner
    read -p "Test USB scanner? (y/n): " test_scanner
    if [[ "$test_scanner" == "y" ]]; then
        test_usb_scanner || warn "Scanner test failed"
    fi
    
    echo ""
    
    # Create Node.js test script
    read -p "Create Node.js test script? (y/n): " create_script
    if [[ "$create_script" == "y" ]]; then
        create_node_test_script
        
        info "To run the Node.js test:"
        echo "  1. npm install node-thermal-printer dotenv"
        echo "  2. node test-hardware.js"
    fi
    
    echo ""
    log "=== HARDWARE TEST COMPLETE ==="
    echo ""
    echo "Next steps for ThinkPad deployment:"
    echo "1. Note the working printer IP: ${PRINTER_IP:-192.168.1.100}"
    echo "2. Verify scanner USB detection works"
    echo "3. Update production .env with tested values"
    echo "4. Test on Ubuntu before final deployment"
}

# Main execution
main() {
    # Check dependencies
    info "Checking dependencies..."
    
    if ! command -v nc &> /dev/null; then
        warn "netcat (nc) not found, some network tests will be skipped"
    fi
    
    if ! command -v node &> /dev/null; then
        warn "Node.js not found, JavaScript tests will not work"
        echo "Install with: brew install node"
    fi
    
    # Run tests
    run_hardware_test
}

# Run main function
main