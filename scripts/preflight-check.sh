#!/bin/bash

# Parking System - Preflight Check (Modernized)
# Purpose: Verify all requirements before starting installation
# Usage: ./preflight-check.sh

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Get script directory and source shared libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/logging.sh"
source "$SCRIPT_DIR/lib/validation.sh"

# ==============================================================================
# PREFLIGHT CHECK CONFIGURATION
# ==============================================================================

# Report file for detailed results
REPORT_FILE="/tmp/parking-preflight-report-$(date +%Y%m%d_%H%M%S).txt"

# ==============================================================================
# EXTENDED VALIDATION CHECKS
# ==============================================================================

check_hardware_compatibility() {
    log_header "HARDWARE COMPATIBILITY CHECKS"
    
    # Check CPU features
    log_info "Checking CPU compatibility..."
    if grep -q "vmx\|svm" /proc/cpuinfo; then
        record_validation "CPU Virtualization" "pass" "Virtualization support detected"
    else
        record_validation "CPU Virtualization" "warn" "No virtualization support (may affect performance)"
    fi
    
    # Check CPU cores
    local cpu_cores
    cpu_cores=$(nproc)
    if (( cpu_cores >= 2 )); then
        record_validation "CPU Cores" "pass" "$cpu_cores cores available"
    else
        record_validation "CPU Cores" "warn" "Only $cpu_cores core available (2+ recommended)"
    fi
    
    # Check available USB ports
    log_info "Checking USB connectivity..."
    if command_exists lsusb; then
        local usb_controllers
        usb_controllers=$(lsusb | grep -i "hub" | wc -l)
        if (( usb_controllers > 0 )); then
            record_validation "USB Controllers" "pass" "$usb_controllers USB controllers detected"
        else
            record_validation "USB Controllers" "warn" "No USB controllers detected"
        fi
    else
        record_validation "USB Detection" "warn" "Cannot check USB devices (lsusb not available)"
    fi
    
    # Check graphics capability
    log_info "Checking graphics capability..."
    if command_exists xrandr; then
        local displays
        displays=$(xrandr | grep " connected" | wc -l)
        if (( displays > 0 )); then
            record_validation "Display Output" "pass" "$displays display(s) connected"
        else
            record_validation "Display Output" "warn" "No displays detected"
        fi
    else
        record_validation "Display Detection" "warn" "Cannot check displays (X11 not available)"
    fi
}

check_network_configuration() {
    log_header "NETWORK CONFIGURATION CHECKS"
    
    # Check network interfaces
    log_info "Checking network interfaces..."
    local interfaces
    interfaces=$(ip link show | grep -E "^[0-9]+:" | grep -v "lo:" | wc -l)
    if (( interfaces > 0 )); then
        record_validation "Network Interfaces" "pass" "$interfaces network interfaces available"
    else
        record_validation "Network Interfaces" "fail" "No network interfaces detected"
    fi
    
    # Check default gateway
    log_info "Checking default gateway..."
    if ip route | grep -q "default"; then
        local gateway
        gateway=$(ip route | grep "default" | awk '{print $3}' | head -1)
        record_validation "Default Gateway" "pass" "Gateway: $gateway"
    else
        record_validation "Default Gateway" "fail" "No default gateway configured"
    fi
    
    # Check network speed (if possible)
    log_info "Checking network interfaces status..."
    local active_interfaces
    active_interfaces=$(ip link show | grep "state UP" | wc -l)
    if (( active_interfaces > 0 )); then
        record_validation "Active Interfaces" "pass" "$active_interfaces interfaces up"
    else
        record_validation "Active Interfaces" "fail" "No active network interfaces"
    fi
}

check_security_configuration() {
    log_header "SECURITY CONFIGURATION CHECKS"
    
    # Check firewall status
    log_info "Checking firewall configuration..."
    if command_exists ufw; then
        if ufw status | grep -q "Status: active"; then
            record_validation "UFW Firewall" "pass" "UFW firewall is active"
        else
            record_validation "UFW Firewall" "warn" "UFW firewall is inactive"
        fi
    else
        record_validation "UFW Firewall" "warn" "UFW not installed"
    fi
    
    # Check AppArmor
    log_info "Checking AppArmor status..."
    if command_exists aa-status; then
        if aa-status --enabled >/dev/null 2>&1; then
            record_validation "AppArmor" "pass" "AppArmor is enabled"
        else
            record_validation "AppArmor" "warn" "AppArmor is not enabled"
        fi
    else
        record_validation "AppArmor" "warn" "AppArmor not available"
    fi
    
    # Check system updates
    log_info "Checking system update status..."
    if command_exists apt; then
        local updates_available
        updates_available=$(apt list --upgradable 2>/dev/null | grep -c "upgradable")
        if (( updates_available == 0 )); then
            record_validation "System Updates" "pass" "System is up to date"
        else
            record_validation "System Updates" "warn" "$updates_available updates available"
        fi
    fi
}

check_performance_requirements() {
    log_header "PERFORMANCE REQUIREMENTS CHECKS"
    
    # Check swap configuration
    log_info "Checking swap configuration..."
    local swap_total
    swap_total=$(free -m | awk '/^Swap:/ {print $2}')
    if (( swap_total > 0 )); then
        record_validation "Swap Space" "pass" "${swap_total}MB swap configured"
    else
        record_validation "Swap Space" "warn" "No swap space configured"
    fi
    
    # Check I/O performance (basic)
    log_info "Checking I/O scheduler..."
    local root_device
    root_device=$(df / | tail -1 | awk '{print $1}' | sed 's/[0-9]*$//')
    root_device=$(basename "$root_device")
    
    if [[ -f "/sys/block/$root_device/queue/scheduler" ]]; then
        local scheduler
        scheduler=$(cat "/sys/block/$root_device/queue/scheduler" | grep -o '\[.*\]' | tr -d '[]')
        record_validation "I/O Scheduler" "pass" "Using $scheduler scheduler"
    else
        record_validation "I/O Scheduler" "warn" "Cannot determine I/O scheduler"
    fi
    
    # Check system load
    log_info "Checking current system load..."
    local load_avg
    load_avg=$(uptime | awk '{print $(NF-2)}' | sed 's/,//')
    local load_num
    load_num=$(echo "$load_avg" | cut -d. -f1)
    
    if (( load_num < 2 )); then
        record_validation "System Load" "pass" "Load average: $load_avg"
    else
        record_validation "System Load" "warn" "High system load: $load_avg"
    fi
}

check_locale_configuration() {
    log_header "LOCALE CONFIGURATION CHECKS"
    
    # Check current locale
    log_info "Checking current locale configuration..."
    if locale | grep -q "LANG="; then
        local current_lang
        current_lang=$(locale | grep "LANG=" | cut -d= -f2)
        if [[ "$current_lang" == *"es_"* ]]; then
            record_validation "Current Locale" "pass" "Spanish locale detected: $current_lang"
        else
            record_validation "Current Locale" "warn" "Non-Spanish locale: $current_lang"
        fi
    else
        record_validation "Current Locale" "fail" "No locale configuration found"
    fi
    
    # Check available locales
    log_info "Checking available Spanish locales..."
    if locale -a | grep -q "es_MX"; then
        record_validation "Spanish Mexico Locale" "pass" "es_MX locale available"
    else
        record_validation "Spanish Mexico Locale" "warn" "es_MX locale not generated"
    fi
    
    # Check timezone
    log_info "Checking timezone configuration..."
    local current_tz
    current_tz=$(timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "unknown")
    if [[ "$current_tz" == *"Mexico_City"* ]]; then
        record_validation "Timezone" "pass" "Mexico City timezone configured"
    else
        record_validation "Timezone" "warn" "Timezone not set to Mexico City: $current_tz"
    fi
}

# ==============================================================================
# REPORT GENERATION
# ==============================================================================

generate_detailed_report() {
    log_header "GENERATING DETAILED REPORT"
    
    log_info "Creating detailed preflight report: $REPORT_FILE"
    
    cat > "$REPORT_FILE" << EOF
PARKING MANAGEMENT SYSTEM - PREFLIGHT CHECK REPORT
==================================================
Generated: $(date)
System: $(uname -a)
User: $(whoami)

SUMMARY
=======
Total Checks: $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS))
Passed: $VALIDATION_PASSED
Warnings: $VALIDATION_WARNINGS  
Errors: $VALIDATION_ERRORS

SYSTEM INFORMATION
==================
OS: $(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown")
Kernel: $(uname -r)
Architecture: $(uname -m)
Memory: $(free -h | awk '/^Mem:/ {print $2}') total, $(free -h | awk '/^Mem:/ {print $7}') available
Disk Space: $(df -h / | awk 'NR==2 {print $4}') available on root filesystem
CPU: $(nproc) cores
Uptime: $(uptime -p 2>/dev/null || uptime)

NETWORK INFORMATION
===================
Hostname: $(hostname)
IP Addresses: $(hostname -I 2>/dev/null || echo "Not available")
DNS Servers: $(grep nameserver /etc/resolv.conf 2>/dev/null | awk '{print $2}' | tr '\n' ' ' || echo "Not configured")

EOF
    
    if (( VALIDATION_ERRORS > 0 )); then
        cat >> "$REPORT_FILE" << EOF

CRITICAL ISSUES FOUND
====================
The following issues must be resolved before installation:

EOF
        for failed_check in "${VALIDATION_FAILED_CHECKS[@]}"; do
            echo "- $failed_check" >> "$REPORT_FILE"
        done
        
        cat >> "$REPORT_FILE" << EOF

RECOMMENDED ACTIONS
==================
1. Review the failed checks above
2. Resolve each critical issue
3. Re-run this preflight check
4. Proceed with installation only after all checks pass

EOF
    fi
    
    if (( VALIDATION_WARNINGS > 0 )); then
        cat >> "$REPORT_FILE" << EOF

WARNINGS FOUND
==============
The following items should be reviewed but may not prevent installation:

- Check the validation output above for specific warning details
- Consider addressing warnings for optimal system performance
- Some warnings may be acceptable depending on your environment

EOF
    fi
    
    cat >> "$REPORT_FILE" << EOF

NEXT STEPS
==========
EOF
    
    if (( VALIDATION_ERRORS == 0 )); then
        cat >> "$REPORT_FILE" << EOF
✅ PREFLIGHT CHECK PASSED

Your system meets the requirements for the Parking Management System.
You can proceed with the installation:

  sudo ./scripts/install-all.sh production

EOF
    else
        cat >> "$REPORT_FILE" << EOF
❌ PREFLIGHT CHECK FAILED

Please resolve the critical issues listed above before attempting installation.
Run this preflight check again after making the necessary corrections.

EOF
    fi
    
    log_success "Detailed report saved to: $REPORT_FILE"
}

# ==============================================================================
# MAIN PREFLIGHT CHECK PROCESS
# ==============================================================================

main() {
    log_header "$APP_NAME - PREFLIGHT CHECK"
    log_info "Validating system requirements before installation..."
    
    # Initialize validation counters
    reset_validation_counters
    
    # Run all validation checks
    run_comprehensive_validation
    
    # Run extended checks
    check_hardware_compatibility
    check_network_configuration
    check_security_configuration
    check_performance_requirements
    check_locale_configuration
    
    # Generate detailed report
    generate_detailed_report
    
    # Final summary
    log_header "PREFLIGHT CHECK SUMMARY"
    
    log_info "Total checks performed: $((VALIDATION_PASSED + VALIDATION_WARNINGS + VALIDATION_ERRORS))"
    log_success "Checks passed: $VALIDATION_PASSED"
    
    if (( VALIDATION_WARNINGS > 0 )); then
        log_warn "Warnings: $VALIDATION_WARNINGS"
    fi
    
    if (( VALIDATION_ERRORS > 0 )); then
        log_error "Critical errors: $VALIDATION_ERRORS"
        log_error "Failed checks: ${VALIDATION_FAILED_CHECKS[*]}"
        log_error ""
        log_error "❌ PREFLIGHT CHECK FAILED"
        log_error "Please resolve the critical issues before installation"
        log_info "Detailed report: $REPORT_FILE"
        exit 1
    else
        log_success ""
        log_success "✅ PREFLIGHT CHECK PASSED"
        log_success "System is ready for parking management installation"
        if (( VALIDATION_WARNINGS > 0 )); then
            log_warn "Note: $VALIDATION_WARNINGS warnings were found (see report for details)"
        fi
        log_info "Detailed report: $REPORT_FILE"
        log_info ""
        log_info "To proceed with installation:"
        log_info "  sudo ./scripts/install-all.sh production"
        exit 0
    fi
}

# ==============================================================================
# COMMAND LINE INTERFACE
# ==============================================================================

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        cat << EOF
Sistema de Estacionamiento - Verificación de Prerrequisitos

Uso: $0 [OPCIONES]

OPCIONES:
  --help, -h     Mostrar esta ayuda
  --version      Mostrar versión del script
  --report-only  Solo generar reporte sin output de consola

DESCRIPCIÓN:
Este script verifica que el sistema cumpla con todos los requisitos
necesarios para la instalación del sistema de gestión de estacionamiento.

VERIFICACIONES REALIZADAS:
- Requisitos del sistema operativo
- Recursos de hardware (memoria, disco, CPU)
- Conectividad de red e internet
- Configuración de paquetes y servicios
- Compatibilidad de hardware
- Configuración de seguridad
- Rendimiento del sistema
- Configuración de idioma y zona horaria

DURACIÓN ESTIMADA: 1-2 minutos

El script genera un reporte detallado con los resultados y recomendaciones.
EOF
        exit 0
        ;;
    "--version")
        echo "Sistema de Estacionamiento - Preflight Check v1.0.0"
        echo "Compatible con Ubuntu 20.04+ LTS"
        exit 0
        ;;
    "--report-only")
        # Run checks quietly and only generate report
        exec >/dev/null 2>&1
        main
        ;;
esac

# Run main preflight check
main "$@"