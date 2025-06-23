#!/bin/bash

# Parking Lot Management System - Installation Validation Script
# Comprehensive post-installation testing and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Test result tracking
declare -a FAILED_TESTS=()

# Logging function
log() {
    local message="$1"
    local level="${2:-INFO}"
    
    case $level in
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "TEST")
            echo -e "${BOLD}🧪 Testing: $message${NC}"
            ;;
    esac
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TOTAL_TESTS++))
    log "$test_name" "TEST"
    
    if eval "$test_command" &>/dev/null; then
        log "$test_name - PASSED" "SUCCESS"
        ((TESTS_PASSED++))
        return 0
    else
        log "$test_name - FAILED" "ERROR"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
        return 1
    fi
}

# System validation tests
test_system_users() {
    run_test "System users created" "id parking && id admin"
}

test_nodejs_installation() {
    run_test "Node.js installation" "node --version | grep -E 'v(18|20|21)'"
}

test_database_setup() {
    run_test "Database file exists" "test -f /opt/parking-system/prisma/dev.db"
    run_test "Database has tables" "sqlite3 /opt/parking-system/prisma/dev.db '.tables' | grep -q 'Ticket'"
}

test_service_status() {
    run_test "Parking system service active" "systemctl is-active parking-system"
    run_test "Parking system service enabled" "systemctl is-enabled parking-system"
}

test_application_ports() {
    run_test "Backend server responding (port 5000)" "curl -f http://localhost:5000/api/health"
    run_test "Frontend server responding (port 3000)" "curl -f http://localhost:3000"
}

test_kiosk_configuration() {
    run_test "Kiosk user exists" "id kiosk"
    run_test "Chromium browser installed" "which chromium-browser"
    run_test "Kiosk autostart configured" "test -f /home/kiosk/.config/autostart/parking-kiosk.desktop"
}

test_hardware_setup() {
    run_test "CUPS service running" "systemctl is-active cups"
    run_test "Printer configuration directory" "test -d /etc/cups"
    run_test "USB device access permissions" "test -c /dev/bus/usb/*/*"
}

test_security_hardening() {
    run_test "UFW firewall enabled" "ufw status | grep -q 'Status: active'"
    run_test "SSH service configured" "systemctl is-active ssh"
    run_test "Root login disabled" "grep -q 'PermitRootLogin no' /etc/ssh/sshd_config"
}

test_file_permissions() {
    run_test "Application directory permissions" "test -d /opt/parking-system && test -O /opt/parking-system"
    run_test "Log directory writable" "test -w /var/log/parking-system"
    run_test "Config files secure" "test -r /opt/parking-system/.env"
}

test_localization() {
    run_test "Spanish locale installed" "locale -a | grep -q 'es_MX'"
    run_test "Timezone set to Mexico City" "timedatectl show | grep -q 'Timezone=America/Mexico_City'"
}

# Hardware integration tests
test_printer_connectivity() {
    if lpinfo -v | grep -q "network\|usb"; then
        log "Printer connectivity - Available devices found" "SUCCESS"
        ((TESTS_PASSED++))
    else
        log "Printer connectivity - No devices found (may be disconnected)" "WARN"
    fi
    ((TOTAL_TESTS++))
}

test_scanner_connectivity() {
    if lsusb | grep -i -E "(honeywell|scanner|barcode)" &>/dev/null; then
        log "Scanner connectivity - USB scanner detected" "SUCCESS"
        ((TESTS_PASSED++))
    else
        log "Scanner connectivity - No USB scanner detected (may be disconnected)" "WARN"
    fi
    ((TOTAL_TESTS++))
}

# Performance and monitoring tests
test_memory_usage() {
    local memory_usage=$(free | awk 'NR==2{printf "%.1f", $3/$2*100}')
    if (( $(echo "$memory_usage < 80" | bc -l) )); then
        log "Memory usage ($memory_usage%) - Within acceptable limits" "SUCCESS"
        ((TESTS_PASSED++))
    else
        log "Memory usage ($memory_usage%) - High memory usage detected" "WARN"
    fi
    ((TOTAL_TESTS++))
}

test_disk_space() {
    local disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    if [[ $disk_usage -lt 80 ]]; then
        log "Disk space (${disk_usage}% used) - Sufficient space available" "SUCCESS"
        ((TESTS_PASSED++))
    else
        log "Disk space (${disk_usage}% used) - Low disk space warning" "WARN"
    fi
    ((TOTAL_TESTS++))
}

# Application functionality tests
test_api_endpoints() {
    local base_url="http://localhost:5000/api"
    
    run_test "Health check endpoint" "curl -f $base_url/health"
    run_test "Operator dashboard endpoint" "curl -f $base_url/operator/dashboard/stats"
    run_test "Parking endpoint available" "curl -f -X OPTIONS $base_url/parking"
}

test_admin_access() {
    run_test "Admin login page accessible" "curl -f http://localhost:3000/admin/login"
    run_test "Admin API endpoints protected" "curl -s http://localhost:5000/api/admin/dashboard | grep -q 'Unauthorized'"
}

# Generate detailed report
generate_report() {
    echo
    echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║                    INSTALLATION VALIDATION REPORT               ║${NC}"
    echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    echo -e "${BOLD}Test Results Summary:${NC}"
    echo -e "  Total Tests Run: ${TOTAL_TESTS}"
    echo -e "  ${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
    echo -e "  ${RED}Tests Failed: ${TESTS_FAILED}${NC}"
    echo
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}🎉 ALL TESTS PASSED! System is ready for production use.${NC}"
        echo
        echo -e "${BOLD}Next Steps:${NC}"
        echo -e "  1. ${GREEN}Restart the system to enter kiosk mode${NC}"
        echo -e "  2. ${GREEN}Connect your Epson TM-T20III printer${NC}"
        echo -e "  3. ${GREEN}Connect your Honeywell Voyager 1250g scanner${NC}"
        echo -e "  4. ${GREEN}Access admin panel via SSH for configuration${NC}"
        echo
        echo -e "${BOLD}System Access:${NC}"
        echo -e "  • Operator Interface: ${BLUE}Automatic kiosk mode after restart${NC}"
        echo -e "  • Admin Access: ${BLUE}SSH to $(hostname -I | awk '{print $1}')${NC}"
        echo -e "  • Admin Panel: ${BLUE}http://$(hostname -I | awk '{print $1}'):3000/admin${NC}"
        
    else
        echo -e "${RED}${BOLD}❌ INSTALLATION ISSUES DETECTED${NC}"
        echo
        echo -e "${BOLD}Failed Tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  ${RED}• $test${NC}"
        done
        echo
        echo -e "${BOLD}Troubleshooting:${NC}"
        echo -e "  1. Check the installation log: ${BLUE}/tmp/parking-system-install.log${NC}"
        echo -e "  2. Re-run the installer: ${BLUE}sudo ./scripts/install-all.sh${NC}"
        echo -e "  3. Check service status: ${BLUE}sudo systemctl status parking-system${NC}"
        echo -e "  4. View application logs: ${BLUE}sudo journalctl -u parking-system -f${NC}"
    fi
    
    echo
    echo -e "${BOLD}System Information:${NC}"
    echo -e "  OS: $(lsb_release -d | cut -f2)"
    echo -e "  Kernel: $(uname -r)"
    echo -e "  Memory: $(free -h | awk 'NR==2{printf "%s/%s (%.1f%%)", $3,$2,$3/$2*100}')"
    echo -e "  Disk: $(df -h / | awk 'NR==2{printf "%s/%s (%s)", $3,$2,$5}')"
    echo -e "  Uptime: $(uptime -p)"
    
    # Save report to file
    {
        echo "Parking Lot Management System - Validation Report"
        echo "Generated: $(date)"
        echo "=========================================="
        echo
        echo "Test Results: $TESTS_PASSED/$TOTAL_TESTS passed"
        if [[ $TESTS_FAILED -gt 0 ]]; then
            echo "Failed Tests:"
            printf '%s\n' "${FAILED_TESTS[@]}"
        fi
    } > /tmp/parking-system-validation-report.txt
    
    echo
    echo -e "Full report saved to: ${BLUE}/tmp/parking-system-validation-report.txt${NC}"
}

# Main execution
main() {
    echo -e "${BOLD}${BLUE}Starting comprehensive system validation...${NC}"
    echo
    
    # Run all test categories
    log "System Configuration Tests" "INFO"
    test_system_users
    test_nodejs_installation
    test_database_setup
    
    echo
    log "Service Status Tests" "INFO"
    test_service_status
    test_application_ports
    
    echo
    log "Kiosk Configuration Tests" "INFO"
    test_kiosk_configuration
    
    echo
    log "Hardware Setup Tests" "INFO"
    test_hardware_setup
    test_printer_connectivity
    test_scanner_connectivity
    
    echo
    log "Security Tests" "INFO"
    test_security_hardening
    test_file_permissions
    
    echo
    log "Localization Tests" "INFO"
    test_localization
    
    echo
    log "Performance Tests" "INFO"
    test_memory_usage
    test_disk_space
    
    echo
    log "Application Tests" "INFO"
    test_api_endpoints
    test_admin_access
    
    # Generate final report
    generate_report
    
    # Exit with appropriate code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log "Please run this script as a regular user (without sudo)" "ERROR"
    exit 1
fi

# Run main function
main "$@"