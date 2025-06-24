#!/bin/bash
set -euo pipefail

# Platform-Specific Configuration Script
# Automatically configures .env for optimal hardware settings based on platform

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[CONFIG]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

PLATFORM=$(uname -s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

echo "════════════════════════════════════════════════════════════════"
echo "  PLATFORM CONFIGURATION TOOL"
echo "  Platform: $PLATFORM"
echo "════════════════════════════════════════════════════════════════"
echo

# Function to backup existing .env
backup_env() {
    if [[ -f "$ENV_FILE" ]]; then
        local backup_file="${ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
        cp "$ENV_FILE" "$backup_file"
        log "Backed up existing .env to: $(basename "$backup_file")"
    fi
}

# Function to configure for macOS
configure_macos() {
    log "Configuring for macOS Development Environment"
    
    # Check for CUPS printer
    local cups_printer=""
    if lpstat -p 2>/dev/null | grep -q "ThermalPrinter"; then
        cups_printer="ThermalPrinter"
        log "Found CUPS printer: $cups_printer"
    else
        warn "ThermalPrinter not found in CUPS"
        info "Please install Epson driver and add printer to System Preferences"
        cups_printer="ThermalPrinter"  # Use default name
    fi
    
    # Update .env for macOS
    cat > "$ENV_FILE" << EOF
# Database Configuration
DATABASE_URL="postgresql://velez@localhost:5432/parking_lot"
DATABASE_URL_PRODUCTION="postgresql://user:password@host:5432/database"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"

# Financial Configuration
CURRENCY="MXN"
DECIMAL_PRECISION=2
MAX_TRANSACTION_AMOUNT=9999.99
MIN_TRANSACTION_AMOUNT=0.01
ENABLE_FINANCIAL_AUDIT=true
FINANCIAL_ROUNDING_MODE="HALF_UP"

# Hardware Configuration - Thermal Printer (macOS CUPS)
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="printer:$cups_printer"
PRINTER_TIMEOUT=5000
PRINTER_RETRY_ATTEMPTS=3
PRINTER_PAPER_WIDTH=32

# Network Printer Configuration (Alternative)
PRINTER_HOST="192.168.1.100"
PRINTER_PORT=9100

# Application Configuration
NODE_ENV="development"
API_PORT=4000
FRONTEND_PORT=3001
LOG_LEVEL="debug"

# Security Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="http://localhost:3001"
FRONTEND_URL="http://localhost:3001"

# Cash Register Configuration
MAX_BILL_VALUE=500
LOST_TICKET_FEE=50.00
GRACE_PERIOD_MINUTES=15

# macOS Specific Notes:
# - Printer uses CUPS system for USB thermal printer
# - Scanner detected as USB HID device (Honeywell Voyager)
# - Raw printing enabled for thermal receipts
EOF

    log "✓ macOS configuration complete"
    info "Key settings:"
    info "  - Printer: CUPS USB ($cups_printer)"
    info "  - Scanner: USB HID detection"
    info "  - Environment: Development"
}

# Function to configure for Ubuntu
configure_ubuntu() {
    log "Configuring for Ubuntu Production Environment"
    
    # Check for USB printer devices
    local usb_device="/dev/usb/lp0"
    if [[ -e "/dev/usb/lp0" ]]; then
        usb_device="/dev/usb/lp0"
        log "Found USB printer: $usb_device"
    elif [[ -e "/dev/lp0" ]]; then
        usb_device="/dev/lp0"
        log "Found printer device: $usb_device"
    elif [[ -e "/dev/ttyUSB0" ]]; then
        usb_device="/dev/ttyUSB0"
        log "Found serial USB device: $usb_device"
    else
        warn "No USB printer device found"
        info "Will use default: /dev/usb/lp0"
    fi
    
    # Update .env for Ubuntu
    cat > "$ENV_FILE" << EOF
# Database Configuration
DATABASE_URL="postgresql://parking_user:parking_password@localhost:5432/parking_lot"
DATABASE_URL_PRODUCTION="postgresql://parking_user:parking_password@localhost:5432/parking_lot"

# JWT Configuration
JWT_SECRET="$(openssl rand -hex 32)"
JWT_EXPIRES_IN="24h"

# Financial Configuration
CURRENCY="MXN"
DECIMAL_PRECISION=2
MAX_TRANSACTION_AMOUNT=999999.99
MIN_TRANSACTION_AMOUNT=0.01
ENABLE_FINANCIAL_AUDIT=true
FINANCIAL_ROUNDING_MODE="HALF_UP"

# Hardware Configuration - Thermal Printer (Ubuntu USB)
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="$usb_device"
PRINTER_TIMEOUT=5000
PRINTER_RETRY_ATTEMPTS=3
PRINTER_PAPER_WIDTH=32

# Network Printer Configuration (Alternative)
PRINTER_HOST="192.168.1.100"
PRINTER_PORT=9100

# Application Configuration
NODE_ENV="production"
API_PORT=4000
FRONTEND_PORT=3001
LOG_LEVEL="info"

# Security Configuration
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="http://localhost:3001"
FRONTEND_URL="http://localhost:3001"

# Cash Register Configuration
MAX_BILL_VALUE=500
LOST_TICKET_FEE=50.00
GRACE_PERIOD_MINUTES=15

# Ubuntu Specific Notes:
# - Printer uses direct USB device access
# - Scanner detected as /dev/hidraw* device
# - User must be in 'lp' and 'input' groups
# - Raw ESC/POS commands for thermal printing
EOF

    log "✓ Ubuntu configuration complete"
    info "Key settings:"
    info "  - Printer: Direct USB ($usb_device)"
    info "  - Scanner: HID raw device"
    info "  - Environment: Production"
    
    # Additional Ubuntu setup instructions
    warn "Additional Ubuntu setup required:"
    echo "  sudo usermod -a -G lp,input \$USER"
    echo "  sudo udevadm control --reload-rules"
    echo "  # Then logout and login again"
}

# Function to test configuration
test_configuration() {
    log "Testing configuration..."
    
    if [[ -f "$ENV_FILE" ]]; then
        info "Configuration file created successfully"
        
        # Show key settings
        echo
        info "Key printer settings:"
        grep "PRINTER_" "$ENV_FILE" | head -5
        
        echo
        info "Database settings:"
        grep "DATABASE_URL=" "$ENV_FILE" | head -1
        
        echo
        info "Environment:"
        grep "NODE_ENV=" "$ENV_FILE"
        
    else
        warn "Configuration file not created"
        return 1
    fi
}

# Function to show next steps
show_next_steps() {
    echo
    log "=== NEXT STEPS ==="
    
    if [[ "$PLATFORM" == "Darwin" ]]; then
        echo "macOS Development:"
        echo "1. Verify CUPS printer is installed:"
        echo "   lpstat -p ThermalPrinter"
        echo
        echo "2. Test hardware:"
        echo "   ./scripts/test-hardware-comprehensive.sh"
        echo
        echo "3. Start development server:"
        echo "   npm run dev"
        echo
        echo "4. Test in browser:"
        echo "   http://localhost:3001"
        
    elif [[ "$PLATFORM" == "Linux" ]]; then
        echo "Ubuntu Production:"
        echo "1. Add user to required groups:"
        echo "   sudo usermod -a -G lp,input \$USER"
        echo
        echo "2. Set up udev rules (optional):"
        echo "   sudo cp scripts/99-thermal-printer.rules /etc/udev/rules.d/"
        echo "   sudo udevadm control --reload-rules"
        echo
        echo "3. Test hardware:"
        echo "   ./scripts/test-hardware-comprehensive.sh"
        echo
        echo "4. Start production server:"
        echo "   npm run build && npm start"
        echo
        echo "5. Configure kiosk mode:"
        echo "   # See THINKPAD_DEPLOYMENT_CHECKLIST.md"
    fi
    
    echo
    info "Configuration complete! Review and test hardware before deployment."
}

# Main execution
main() {
    echo "Platform detected: $PLATFORM"
    echo
    
    # Backup existing configuration
    backup_env
    
    # Configure based on platform
    case "$PLATFORM" in
        "Darwin")
            configure_macos
            ;;
        "Linux")
            configure_ubuntu
            ;;
        *)
            warn "Unsupported platform: $PLATFORM"
            warn "Manual configuration required"
            exit 1
            ;;
    esac
    
    # Test the configuration
    test_configuration
    
    # Show next steps
    show_next_steps
}

# Execute main function
main "$@"