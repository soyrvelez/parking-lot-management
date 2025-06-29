#!/bin/bash

# Parking System - System Validation Library
# Comprehensive system prerequisite and health checks
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/../lib/validation.sh"

# Prevent multiple sourcing
if [[ "${PARKING_VALIDATION_LOADED:-}" == "true" ]]; then
    return 0
fi

# Source dependencies
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/common.sh"
source "$LIB_DIR/logging.sh"

export PARKING_VALIDATION_LOADED="true"

# ==============================================================================
# VALIDATION RESULT TRACKING
# ==============================================================================

VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0
VALIDATION_PASSED=0
declare -a VALIDATION_FAILED_CHECKS=()

# Reset validation counters
reset_validation_counters() {
    VALIDATION_ERRORS=0
    VALIDATION_WARNINGS=0
    VALIDATION_PASSED=0
    VALIDATION_FAILED_CHECKS=()
}

# Record validation result
record_validation() {
    local check_name="$1"
    local result="$2"  # pass, warn, fail
    local message="$3"
    
    case "$result" in
        pass)
            log_success "$check_name: $message"
            ((VALIDATION_PASSED++))
            ;;
        warn)
            log_warn "$check_name: $message"
            ((VALIDATION_WARNINGS++))
            ;;
        fail)
            log_error "$check_name: $message"
            ((VALIDATION_ERRORS++))
            VALIDATION_FAILED_CHECKS+=("$check_name")
            ;;
    esac
}

# ==============================================================================
# ROOT PERMISSION CHECKS
# ==============================================================================

# Check if running as root
check_root_privileges() {
    if is_root; then
        record_validation "Root privileges" "pass" "Running as root user"
        return 0
    else
        record_validation "Root privileges" "fail" "Must run as root (use sudo)"
        return 1
    fi
}

# Check if sudo is available for non-root users
check_sudo_available() {
    if is_root; then
        record_validation "Sudo availability" "pass" "Already running as root"
        return 0
    fi
    
    if command_exists sudo; then
        if sudo -n true 2>/dev/null; then
            record_validation "Sudo availability" "pass" "Sudo access confirmed"
            return 0
        else
            record_validation "Sudo availability" "fail" "Sudo access required but not available"
            return 1
        fi
    else
        record_validation "Sudo availability" "fail" "Sudo command not found"
        return 1
    fi
}

# ==============================================================================
# OPERATING SYSTEM CHECKS
# ==============================================================================

# Check Ubuntu OS and version
check_ubuntu_os() {
    if [[ ! -f /etc/os-release ]]; then
        record_validation "Operating System" "fail" "Cannot determine OS - /etc/os-release not found"
        return 1
    fi
    
    source /etc/os-release
    
    if [[ "$ID" != "ubuntu" ]]; then
        record_validation "Operating System" "fail" "Ubuntu required, detected: $ID"
        return 1
    fi
    
    local version_major
    version_major=$(echo "$VERSION_ID" | cut -d. -f1)
    
    if (( version_major < MIN_UBUNTU_VERSION )); then
        record_validation "Ubuntu Version" "fail" "Ubuntu $MIN_UBUNTU_VERSION.04+ required, detected: $VERSION_ID"
        return 1
    elif (( version_major == MIN_UBUNTU_VERSION )); then
        record_validation "Ubuntu Version" "pass" "Ubuntu $VERSION_ID (minimum supported)"
        return 0
    else
        record_validation "Ubuntu Version" "pass" "Ubuntu $VERSION_ID (recommended)"
        return 0
    fi
}

# Check if system is using systemd
check_systemd() {
    if [[ -d /run/systemd/system ]]; then
        record_validation "Init System" "pass" "Systemd detected"
        return 0
    else
        record_validation "Init System" "fail" "Systemd required but not detected"
        return 1
    fi
}

# ==============================================================================
# HARDWARE RESOURCE CHECKS
# ==============================================================================

# Check available memory
check_memory() {
    local memory_mb
    memory_mb=$(free -m | awk 'NR==2{print $2}')
    local memory_gb=$((memory_mb / 1024))
    
    if (( memory_gb < MIN_MEMORY_GB )); then
        record_validation "Memory" "fail" "Insufficient memory: ${memory_gb}GB (minimum: ${MIN_MEMORY_GB}GB)"
        return 1
    elif (( memory_gb < RECOMMENDED_MEMORY_GB )); then
        record_validation "Memory" "warn" "Low memory: ${memory_gb}GB (recommended: ${RECOMMENDED_MEMORY_GB}GB)"
        return 0
    else
        record_validation "Memory" "pass" "Sufficient memory: ${memory_gb}GB"
        return 0
    fi
}

# Check available disk space
check_disk_space() {
    local available_gb
    available_gb=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
    
    if (( available_gb < MIN_DISK_GB )); then
        record_validation "Disk Space" "fail" "Insufficient disk space: ${available_gb}GB (minimum: ${MIN_DISK_GB}GB)"
        return 1
    elif (( available_gb < RECOMMENDED_DISK_GB )); then
        record_validation "Disk Space" "warn" "Low disk space: ${available_gb}GB (recommended: ${RECOMMENDED_DISK_GB}GB)"
        return 0
    else
        record_validation "Disk Space" "pass" "Sufficient disk space: ${available_gb}GB"
        return 0
    fi
}

# Check CPU architecture
check_cpu_architecture() {
    local arch
    arch=$(uname -m)
    
    case "$arch" in
        x86_64|amd64)
            record_validation "CPU Architecture" "pass" "64-bit x86 architecture: $arch"
            return 0
            ;;
        aarch64|arm64)
            record_validation "CPU Architecture" "warn" "ARM 64-bit architecture: $arch (some packages may not be available)"
            return 0
            ;;
        *)
            record_validation "CPU Architecture" "fail" "Unsupported architecture: $arch"
            return 1
            ;;
    esac
}

# ==============================================================================
# NETWORK CONNECTIVITY CHECKS
# ==============================================================================

# Check internet connectivity
check_internet_connectivity() {
    local test_hosts=("8.8.8.8" "1.1.1.1" "208.67.222.222")
    local success=false
    
    for host in "${test_hosts[@]}"; do
        if ping -c 1 -W 3 "$host" >/dev/null 2>&1; then
            success=true
            break
        fi
    done
    
    if $success; then
        record_validation "Internet Connectivity" "pass" "Internet connection verified"
        return 0
    else
        record_validation "Internet Connectivity" "fail" "No internet connection available"
        return 1
    fi
}

# Check DNS resolution
check_dns_resolution() {
    local test_domains=("google.com" "ubuntu.com" "github.com")
    local success=false
    
    for domain in "${test_domains[@]}"; do
        if nslookup "$domain" >/dev/null 2>&1; then
            success=true
            break
        fi
    done
    
    if $success; then
        record_validation "DNS Resolution" "pass" "DNS resolution working"
        return 0
    else
        record_validation "DNS Resolution" "fail" "DNS resolution not working"
        return 1
    fi
}

# ==============================================================================
# PACKAGE MANAGEMENT CHECKS
# ==============================================================================

# Check APT package manager
check_apt_functionality() {
    if ! command_exists apt; then
        record_validation "APT Package Manager" "fail" "APT not found"
        return 1
    fi
    
    # Test APT update (dry run)
    if apt-get update --dry-run >/dev/null 2>&1; then
        record_validation "APT Package Manager" "pass" "APT functioning correctly"
        return 0
    else
        record_validation "APT Package Manager" "fail" "APT update failed"
        return 1
    fi
}

# Check for package locks
check_package_locks() {
    local lock_files=(
        "/var/lib/dpkg/lock"
        "/var/lib/dpkg/lock-frontend"
        "/var/cache/apt/archives/lock"
    )
    
    local locked=false
    for lock_file in "${lock_files[@]}"; do
        if fuser "$lock_file" >/dev/null 2>&1; then
            locked=true
            break
        fi
    done
    
    if $locked; then
        record_validation "Package Locks" "fail" "Package manager is locked (another process may be running)"
        return 1
    else
        record_validation "Package Locks" "pass" "No package manager locks detected"
        return 0
    fi
}

# ==============================================================================
# EXISTING INSTALLATION CHECKS
# ==============================================================================

# Check for existing PostgreSQL installation
check_existing_postgresql() {
    if package_installed postgresql || package_installed postgresql-14; then
        if service_exists postgresql; then
            if systemctl is-active --quiet postgresql; then
                record_validation "Existing PostgreSQL" "warn" "PostgreSQL already installed and running"
            else
                record_validation "Existing PostgreSQL" "warn" "PostgreSQL installed but not running"
            fi
        else
            record_validation "Existing PostgreSQL" "warn" "PostgreSQL package installed but service not configured"
        fi
        return 0
    else
        record_validation "Existing PostgreSQL" "pass" "No existing PostgreSQL installation"
        return 0
    fi
}

# Check for existing Node.js installation
check_existing_nodejs() {
    if command_exists node; then
        local node_version
        node_version=$(node --version 2>/dev/null | sed 's/v//')
        local major_version
        major_version=$(echo "$node_version" | cut -d. -f1)
        
        if (( major_version >= 18 )); then
            record_validation "Existing Node.js" "pass" "Compatible Node.js $node_version already installed"
        else
            record_validation "Existing Node.js" "warn" "Outdated Node.js $node_version detected (will be upgraded)"
        fi
        return 0
    else
        record_validation "Existing Node.js" "pass" "No existing Node.js installation"
        return 0
    fi
}

# Check for existing parking system installation
check_existing_parking_system() {
    if [[ -d "$APP_DIR" ]]; then
        record_validation "Existing Installation" "warn" "Previous installation found at $APP_DIR"
        return 0
    fi
    
    if service_exists parking-system; then
        record_validation "Existing Installation" "warn" "Parking system service already exists"
        return 0
    fi
    
    record_validation "Existing Installation" "pass" "No previous installation detected"
    return 0
}

# ==============================================================================
# HARDWARE-SPECIFIC CHECKS
# ==============================================================================

# Check for USB devices (printers/scanners)
check_usb_devices() {
    if ! command_exists lsusb; then
        record_validation "USB Detection" "warn" "lsusb not available, cannot check USB devices"
        return 0
    fi
    
    local usb_devices
    usb_devices=$(lsusb | wc -l)
    
    if (( usb_devices > 0 )); then
        record_validation "USB Devices" "pass" "$usb_devices USB devices detected"
        return 0
    else
        record_validation "USB Devices" "warn" "No USB devices detected"
        return 0
    fi
}

# Check display manager for kiosk mode
check_display_manager() {
    local display_managers=("lightdm" "gdm3" "sddm")
    local detected=()
    
    for dm in "${display_managers[@]}"; do
        if package_installed "$dm"; then
            detected+=("$dm")
        fi
    done
    
    if (( ${#detected[@]} == 0 )); then
        record_validation "Display Manager" "warn" "No display manager detected (required for kiosk mode)"
        return 0
    elif (( ${#detected[@]} == 1 )); then
        record_validation "Display Manager" "pass" "Display manager detected: ${detected[0]}"
        return 0
    else
        record_validation "Display Manager" "warn" "Multiple display managers detected: ${detected[*]} (may cause conflicts)"
        return 0
    fi
}

# ==============================================================================
# SCRIPT STRUCTURE CHECKS
# ==============================================================================

# Check script directory structure
check_script_structure() {
    local script_root
    script_root=$(get_script_dir)
    local required_dirs=("setup" "hardware" "deploy" "security" "backup")
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$script_root/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if (( ${#missing_dirs[@]} > 0 )); then
        record_validation "Script Structure" "fail" "Missing directories: ${missing_dirs[*]}"
        return 1
    else
        record_validation "Script Structure" "pass" "All required script directories present"
        return 0
    fi
}

# Check for required core scripts
check_required_scripts() {
    local script_root
    script_root=$(get_script_dir)
    local required_scripts=(
        "setup/setup-system.sh"
        "setup/setup-database.sh"
        "setup/setup-kiosk.sh"
        "hardware/setup-printer.sh"
        "hardware/setup-scanner.sh"
        "deploy/deploy-parking-system.sh"
    )
    
    local missing_scripts=()
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script_root/$script" ]]; then
            missing_scripts+=("$script")
        fi
    done
    
    if (( ${#missing_scripts[@]} > 0 )); then
        record_validation "Required Scripts" "fail" "Missing scripts: ${missing_scripts[*]}"
        return 1
    else
        record_validation "Required Scripts" "pass" "All required scripts present"
        return 0
    fi
}

# ==============================================================================
# COMPREHENSIVE VALIDATION FUNCTIONS
# ==============================================================================

# Run all basic system checks
run_basic_validation() {
    log_header "BASIC SYSTEM VALIDATION"
    
    reset_validation_counters
    
    check_root_privileges
    check_ubuntu_os
    check_systemd
    check_memory
    check_disk_space
    check_cpu_architecture
    
    return $VALIDATION_ERRORS
}

# Run network-related checks
run_network_validation() {
    log_header "NETWORK VALIDATION"
    
    check_internet_connectivity
    check_dns_resolution
    
    return $VALIDATION_ERRORS
}

# Run package management checks
run_package_validation() {
    log_header "PACKAGE MANAGEMENT VALIDATION"
    
    check_apt_functionality
    check_package_locks
    
    return $VALIDATION_ERRORS
}

# Run existing installation checks
run_installation_validation() {
    log_header "EXISTING INSTALLATION VALIDATION"
    
    check_existing_postgresql
    check_existing_nodejs
    check_existing_parking_system
    
    return $VALIDATION_ERRORS
}

# Run hardware-specific checks
run_hardware_validation() {
    log_header "HARDWARE VALIDATION"
    
    check_usb_devices
    check_display_manager
    
    return $VALIDATION_ERRORS
}

# Run script structure checks
run_script_validation() {
    log_header "SCRIPT STRUCTURE VALIDATION"
    
    check_script_structure
    check_required_scripts
    
    return $VALIDATION_ERRORS
}

# Run comprehensive validation (all checks)
run_comprehensive_validation() {
    log_header "COMPREHENSIVE SYSTEM VALIDATION"
    log_info "Validating system for parking management installation..."
    
    reset_validation_counters
    
    # Run all validation categories
    run_basic_validation
    run_network_validation  
    run_package_validation
    run_installation_validation
    run_hardware_validation
    run_script_validation
    
    # Summary
    log_header "VALIDATION SUMMARY"
    log_info "Checks passed: $VALIDATION_PASSED"
    
    if (( VALIDATION_WARNINGS > 0 )); then
        log_warn "Warnings: $VALIDATION_WARNINGS"
    fi
    
    if (( VALIDATION_ERRORS > 0 )); then
        log_error "Errors: $VALIDATION_ERRORS"
        log_error "Failed checks: ${VALIDATION_FAILED_CHECKS[*]}"
        return 1
    else
        log_success "All validation checks passed!"
        return 0
    fi
}

# ==============================================================================
# EXPORT FUNCTIONS
# ==============================================================================

export -f reset_validation_counters record_validation
export -f check_root_privileges check_sudo_available
export -f check_ubuntu_os check_systemd
export -f check_memory check_disk_space check_cpu_architecture
export -f check_internet_connectivity check_dns_resolution
export -f check_apt_functionality check_package_locks
export -f check_existing_postgresql check_existing_nodejs check_existing_parking_system
export -f check_usb_devices check_display_manager
export -f check_script_structure check_required_scripts
export -f run_basic_validation run_network_validation run_package_validation
export -f run_installation_validation run_hardware_validation run_script_validation
export -f run_comprehensive_validation