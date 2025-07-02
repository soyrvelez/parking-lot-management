#!/bin/bash

# Deployment Validation Script
# Tests all components of the parking system deployment

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; ((TESTS_FAILED++)); }
warn() { echo -e "${YELLOW}[WARNING] $1${NC}"; ((TESTS_WARNING++)); }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }
pass() { echo -e "${GREEN}✓ $1${NC}"; ((TESTS_PASSED++)); }

# Test categories
test_system_configuration() {
    echo ""
    log "=== TESTING SYSTEM CONFIGURATION ==="
    
    # Test locale
    if locale | grep -q "LANG=es_MX.UTF-8"; then
        pass "Spanish Mexico locale configured"
    else
        error "Spanish Mexico locale not configured"
    fi
    
    # Test timezone
    if timedatectl | grep -q "America/Mexico_City"; then
        pass "Mexico City timezone configured"
    else
        error "Mexico City timezone not configured"
    fi
    
    # Test operator user
    if id "operador" &>/dev/null; then
        pass "Operator user exists"
        
        # Check user restrictions
        if groups operador | grep -q "sudo\|admin"; then
            error "Operator user has admin privileges (security risk)"
        else
            pass "Operator user properly restricted"
        fi
    else
        error "Operator user does not exist"
    fi
}

test_display_manager() {
    echo ""
    log "=== TESTING DISPLAY MANAGER ==="
    
    # Check LightDM installation
    if dpkg -l lightdm >/dev/null 2>&1; then
        pass "LightDM installed"
    else
        error "LightDM not installed"
        return
    fi
    
    # Check if LightDM is default
    if [ -f /etc/X11/default-display-manager ]; then
        if grep -q "lightdm" /etc/X11/default-display-manager; then
            pass "LightDM set as default display manager"
        else
            error "LightDM not set as default display manager"
        fi
    else
        error "No default display manager configured"
    fi
    
    # Check autologin configuration
    if [ -f /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf ]; then
        if grep -q "autologin-user=operador" /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf; then
            pass "Autologin configured for operator"
        else
            error "Autologin not properly configured"
        fi
    else
        warn "Kiosk configuration file not found"
    fi
    
    # Check if LightDM service is enabled
    if systemctl is-enabled lightdm >/dev/null 2>&1; then
        pass "LightDM service enabled"
    else
        error "LightDM service not enabled"
    fi
}

test_kiosk_configuration() {
    echo ""
    log "=== TESTING KIOSK CONFIGURATION ==="
    
    # Check OpenBox installation
    if dpkg -l openbox >/dev/null 2>&1; then
        pass "OpenBox window manager installed"
    else
        error "OpenBox not installed"
    fi
    
    # Check kiosk autostart
    if [ -f /home/operador/.config/openbox/autostart ]; then
        pass "OpenBox autostart configured"
        
        # Check if it's executable
        if [ -x /home/operador/.config/openbox/autostart ]; then
            pass "Autostart script is executable"
        else
            error "Autostart script not executable"
        fi
    else
        error "OpenBox autostart not configured"
    fi
    
    # Check kiosk launcher
    if [ -f /opt/parking-kiosk-launcher.sh ]; then
        pass "Kiosk launcher script exists"
        
        if [ -x /opt/parking-kiosk-launcher.sh ]; then
            pass "Kiosk launcher is executable"
        else
            error "Kiosk launcher not executable"
        fi
    else
        error "Kiosk launcher script not found"
    fi
    
    # Check Chromium installation
    if dpkg -l chromium-browser >/dev/null 2>&1; then
        pass "Chromium browser installed"
    else
        error "Chromium browser not installed"
    fi
}

test_application_deployment() {
    echo ""
    log "=== TESTING APPLICATION DEPLOYMENT ==="
    
    # Check application directory
    if [ -d /opt/parking-system ]; then
        pass "Application directory exists"
    else
        error "Application directory not found"
        return
    fi
    
    # Check Node.js installation
    if command -v node >/dev/null 2>&1; then
        node_version=$(node --version)
        pass "Node.js installed: $node_version"
    else
        error "Node.js not installed"
    fi
    
    # Check systemd service
    if [ -f /etc/systemd/system/parking-system.service ]; then
        pass "Parking system service configured"
        
        if systemctl is-enabled parking-system >/dev/null 2>&1; then
            pass "Parking system service enabled"
        else
            warn "Parking system service not enabled"
        fi
        
        if systemctl is-active parking-system >/dev/null 2>&1; then
            pass "Parking system service running"
        else
            warn "Parking system service not running"
        fi
    else
        error "Parking system service not configured"
    fi
    
    # Test application health endpoint
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        pass "Application responding to health checks"
    else
        warn "Application not responding (may need to start service)"
    fi
}

test_database() {
    echo ""
    log "=== TESTING DATABASE ==="
    
    # Check PostgreSQL installation
    if command -v psql >/dev/null 2>&1; then
        pg_version=$(psql --version | awk '{print $3}')
        pass "PostgreSQL installed: $pg_version"
    else
        error "PostgreSQL not installed"
        return
    fi
    
    # Check if PostgreSQL is running
    if systemctl is-active postgresql >/dev/null 2>&1; then
        pass "PostgreSQL service running"
    else
        error "PostgreSQL service not running"
    fi
    
    # Check database existence
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw parking_lot; then
        pass "Database 'parking_lot' exists"
    else
        error "Database 'parking_lot' not found"
    fi
}

test_hardware_integration() {
    echo ""
    log "=== TESTING HARDWARE INTEGRATION ==="
    
    # Check CUPS for printer
    if systemctl is-active cups >/dev/null 2>&1; then
        pass "CUPS printing service running"
    else
        warn "CUPS printing service not running"
    fi
    
    # Check printer connectivity (if configured)
    if ping -c 1 -W 2 192.168.1.100 >/dev/null 2>&1; then
        pass "Printer network address reachable"
    else
        warn "Printer at 192.168.1.100 not reachable (check network/printer)"
    fi
    
    # Check USB permissions for scanner
    if [ -f /etc/udev/rules.d/99-honeywell-scanner.rules ]; then
        pass "Scanner udev rules configured"
    else
        warn "Scanner udev rules not found"
    fi
}

test_security() {
    echo ""
    log "=== TESTING SECURITY CONFIGURATION ==="
    
    # Check SSH service
    if systemctl is-active ssh >/dev/null 2>&1; then
        pass "SSH service running (emergency access)"
    else
        warn "SSH not running (no emergency access)"
    fi
    
    # Check firewall
    if command -v ufw >/dev/null 2>&1; then
        if ufw status | grep -q "Status: active"; then
            pass "UFW firewall active"
        else
            warn "UFW firewall not active"
        fi
    else
        warn "UFW firewall not installed"
    fi
    
    # Check fail2ban
    if systemctl is-active fail2ban >/dev/null 2>&1; then
        pass "Fail2ban intrusion prevention active"
    else
        warn "Fail2ban not active"
    fi
}

test_backup_system() {
    echo ""
    log "=== TESTING BACKUP SYSTEM ==="
    
    # Check backup directory
    if [ -d /opt/parking-backups ]; then
        pass "Backup directory exists"
    else
        warn "Backup directory not found"
    fi
    
    # Check backup scripts
    if [ -f /opt/backup-parking-system.sh ]; then
        pass "Backup script exists"
    else
        warn "Backup script not found"
    fi
    
    # Check backup timer
    if systemctl is-enabled parking-backup.timer >/dev/null 2>&1; then
        pass "Automated backup timer enabled"
    else
        warn "Automated backup timer not enabled"
    fi
}

# Function to generate report
generate_report() {
    local report_file="/tmp/deployment-validation-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "PARKING SYSTEM DEPLOYMENT VALIDATION REPORT"
        echo "=========================================="
        echo "Date: $(date)"
        echo "Hostname: $(hostname)"
        echo ""
        echo "TEST SUMMARY"
        echo "------------"
        echo "Tests Passed: $TESTS_PASSED"
        echo "Tests Failed: $TESTS_FAILED"
        echo "Warnings: $TESTS_WARNING"
        echo ""
        
        if [ $TESTS_FAILED -eq 0 ]; then
            echo "RESULT: DEPLOYMENT SUCCESSFUL ✓"
        else
            echo "RESULT: DEPLOYMENT HAS ISSUES ✗"
        fi
        
        echo ""
        echo "See console output above for detailed results."
    } | tee "$report_file"
    
    echo ""
    log "Report saved to: $report_file"
}

# Main execution
main() {
    log "=== PARKING SYSTEM DEPLOYMENT VALIDATION ==="
    log "Running comprehensive system tests..."
    
    # Run all test categories
    test_system_configuration
    test_display_manager
    test_kiosk_configuration
    test_application_deployment
    test_database
    test_hardware_integration
    test_security
    test_backup_system
    
    # Generate summary
    echo ""
    log "=== TEST SUMMARY ==="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Warnings: $TESTS_WARNING"
    
    # Overall result
    echo ""
    if [ $TESTS_FAILED -eq 0 ]; then
        log "✅ DEPLOYMENT VALIDATION SUCCESSFUL"
        if [ $TESTS_WARNING -gt 0 ]; then
            warn "Some warnings were found. Review them for optimal operation."
        fi
        generate_report
        exit 0
    else
        error "❌ DEPLOYMENT VALIDATION FAILED"
        error "Please fix the failed tests before using the system in production."
        generate_report
        exit 1
    fi
}

# Check if running as root for some tests
if [[ $EUID -ne 0 ]]; then
   warn "Running as non-root. Some tests may be skipped."
fi

# Run main validation
main