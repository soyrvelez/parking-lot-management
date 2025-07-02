#!/bin/bash

# Enhanced Preflight Check for Ubuntu Deployment
# This script validates the system before attempting installation
# and provides detailed diagnostics for troubleshooting

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Initialize report
REPORT_FILE="/tmp/ubuntu-deployment-report-$(date +%Y%m%d_%H%M%S).txt"
ISSUES_FOUND=0

report() {
    echo "$1" | tee -a "$REPORT_FILE"
}

check_issue() {
    local test_name="$1"
    local test_result="$2"
    local fix_suggestion="$3"
    
    if [ "$test_result" != "0" ]; then
        ((ISSUES_FOUND++))
        report "❌ ISSUE: $test_name"
        report "   FIX: $fix_suggestion"
        report ""
        return 1
    else
        report "✅ PASS: $test_name"
        return 0
    fi
}

log "=== UBUNTU DEPLOYMENT PREFLIGHT CHECK ==="
report "Ubuntu Deployment Preflight Check Report"
report "========================================"
report "Date: $(date)"
report "Hostname: $(hostname)"
report ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

# 1. Check Ubuntu Version
report "1. UBUNTU VERSION CHECK"
report "-----------------------"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    report "OS: $NAME $VERSION"
    
    if [[ "$ID" != "ubuntu" ]]; then
        check_issue "Ubuntu OS required" "1" "Install Ubuntu 20.04 LTS or newer"
    else
        ubuntu_version=$(echo "$VERSION_ID" | cut -d. -f1)
        if [ "$ubuntu_version" -lt 20 ]; then
            check_issue "Ubuntu version >= 20.04" "1" "Upgrade to Ubuntu 20.04 LTS or newer"
        else
            check_issue "Ubuntu version >= 20.04" "0" ""
        fi
    fi
else
    check_issue "OS detection" "1" "Cannot detect OS version"
fi
report ""

# 2. Check Display Manager
report "2. DISPLAY MANAGER CHECK"
report "------------------------"
current_dm=""
if systemctl is-active --quiet gdm3; then
    current_dm="gdm3"
elif systemctl is-active --quiet gdm; then
    current_dm="gdm"
elif systemctl is-active --quiet lightdm; then
    current_dm="lightdm"
elif systemctl is-active --quiet sddm; then
    current_dm="sddm"
fi

if [ -n "$current_dm" ]; then
    report "Current display manager: $current_dm"
    if [ "$current_dm" != "lightdm" ]; then
        check_issue "Display manager conflict" "1" "Run: sudo dpkg-reconfigure lightdm (after installing lightdm)"
    else
        check_issue "LightDM already active" "0" ""
    fi
else
    report "No display manager currently active"
    check_issue "Display manager" "0" ""
fi
report ""

# 3. Check Network Configuration
report "3. NETWORK CONFIGURATION"
report "------------------------"
# Check if NetworkManager is running
if systemctl is-active --quiet NetworkManager; then
    report "NetworkManager: Active"
    check_issue "NetworkManager active" "0" ""
else
    check_issue "NetworkManager not active" "1" "Run: sudo systemctl enable --now NetworkManager"
fi

# Check network connectivity
if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    check_issue "Internet connectivity" "0" ""
else
    check_issue "Internet connectivity" "1" "Check network configuration and firewall settings"
fi
report ""

# 4. Check Package Manager State
report "4. PACKAGE MANAGER STATE"
report "------------------------"
# Check for dpkg locks
if fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
    check_issue "dpkg lock-frontend" "1" "Wait for other package operations to complete or run: sudo killall apt apt-get"
else
    check_issue "dpkg lock-frontend free" "0" ""
fi

if fuser /var/lib/apt/lists/lock >/dev/null 2>&1; then
    check_issue "apt lists lock" "1" "Wait for other package operations to complete"
else
    check_issue "apt lists lock free" "0" ""
fi

# Check for broken packages
if dpkg --audit 2>&1 | grep -q "^[a-zA-Z]"; then
    check_issue "Broken packages" "1" "Run: sudo dpkg --configure -a && sudo apt-get install -f"
else
    check_issue "No broken packages" "0" ""
fi
report ""

# 5. Check Display Configuration
report "5. DISPLAY CONFIGURATION"
report "------------------------"
# Check if running in GUI mode
if [ -n "$DISPLAY" ]; then
    report "Display variable: $DISPLAY"
    check_issue "GUI environment detected" "0" ""
else
    warn "No display variable set - might be in text mode"
fi

# Check for X11
if command -v xrandr >/dev/null 2>&1; then
    report "X11 utilities installed"
    # Try to get display info
    if xrandr 2>/dev/null | grep -q " connected"; then
        display_info=$(xrandr 2>/dev/null | grep " connected" | head -1)
        report "Primary display: $display_info"
        check_issue "Display detection" "0" ""
    else
        check_issue "Display detection" "1" "Check display drivers and X11 configuration"
    fi
else
    check_issue "X11 utilities" "1" "Install x11-xserver-utils package"
fi
report ""

# 6. Check Hardware Compatibility
report "6. HARDWARE COMPATIBILITY"
report "-------------------------"
# Check CPU architecture
arch=$(uname -m)
report "Architecture: $arch"
if [[ "$arch" == "x86_64" || "$arch" == "amd64" ]]; then
    check_issue "CPU architecture" "0" ""
else
    check_issue "CPU architecture" "1" "x86_64/amd64 architecture required"
fi

# Check memory
total_mem_mb=$(free -m | awk 'NR==2{print $2}')
report "Total memory: ${total_mem_mb}MB"
if [ "$total_mem_mb" -lt 2048 ]; then
    check_issue "Memory >= 2GB" "1" "System has less than 2GB RAM, 4GB+ recommended"
elif [ "$total_mem_mb" -lt 4096 ]; then
    warn "System has less than 4GB RAM, performance may be limited"
    check_issue "Memory >= 2GB" "0" ""
else
    check_issue "Memory >= 4GB" "0" ""
fi

# Check disk space
available_gb=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
report "Available disk space: ${available_gb}GB"
if [ "$available_gb" -lt 10 ]; then
    check_issue "Disk space >= 10GB" "1" "Free up disk space, at least 10GB required"
else
    check_issue "Disk space >= 10GB" "0" ""
fi
report ""

# 7. Check Existing Services
report "7. SERVICE CONFLICTS"
report "--------------------"
# Check for services that might conflict
conflicting_services=("mysql" "mariadb" "apache2" "nginx")
conflicts_found=0

for service in "${conflicting_services[@]}"; do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        warn "Potentially conflicting service found: $service"
        ((conflicts_found++))
    fi
done

if [ "$conflicts_found" -eq 0 ]; then
    check_issue "No service conflicts" "0" ""
else
    check_issue "Service conflicts" "1" "Review and stop conflicting services if needed"
fi
report ""

# 8. Check User Configuration
report "8. USER CONFIGURATION"
report "---------------------"
# Check if operador user exists
if id "operador" &>/dev/null; then
    report "User 'operador' exists"
    # Check if user is in required groups
    groups_output=$(groups operador 2>/dev/null || echo "")
    report "User groups: $groups_output"
    check_issue "Operador user exists" "0" ""
else
    report "User 'operador' does not exist (will be created)"
    check_issue "Operador user" "0" ""
fi
report ""

# 9. Check SELinux/AppArmor
report "9. SECURITY MODULES"
report "-------------------"
if command -v getenforce >/dev/null 2>&1; then
    selinux_status=$(getenforce)
    report "SELinux status: $selinux_status"
    if [ "$selinux_status" == "Enforcing" ]; then
        check_issue "SELinux" "1" "SELinux may interfere, consider setting to Permissive for installation"
    else
        check_issue "SELinux" "0" ""
    fi
else
    report "SELinux not installed"
fi

if systemctl is-active --quiet apparmor; then
    report "AppArmor: Active"
    warn "AppArmor is active, may need profile adjustments for kiosk mode"
fi
report ""

# 10. Generate Summary
report "SUMMARY"
report "======="
report "Total issues found: $ISSUES_FOUND"
report ""

if [ "$ISSUES_FOUND" -eq 0 ]; then
    log "✅ System is ready for deployment!"
    report "✅ System is ready for deployment!"
else
    error "❌ Found $ISSUES_FOUND issues that need to be resolved"
    report "❌ Found $ISSUES_FOUND issues that need to be resolved before deployment"
    report ""
    report "Please review the issues above and apply the suggested fixes."
    report "After fixing, run this preflight check again."
fi

report ""
report "Full report saved to: $REPORT_FILE"

log "Report saved to: $REPORT_FILE"

# Exit with appropriate code
exit $ISSUES_FOUND