#!/bin/bash

# Parking System - Package Manager Library
# Wrapper functions for safe and consistent APT operations
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/../lib/package-manager.sh"

# Prevent multiple sourcing
if [[ "${PARKING_PACKAGE_MANAGER_LOADED:-}" == "true" ]]; then
    return 0
fi

# Source dependencies
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/common.sh"
source "$LIB_DIR/logging.sh"

export PARKING_PACKAGE_MANAGER_LOADED="true"

# ==============================================================================
# PACKAGE MANAGER CONFIGURATION
# ==============================================================================

# APT configuration
export APT_RETRY_COUNT="${PARKING_APT_RETRY_COUNT:-3}"
export APT_RETRY_DELAY="${PARKING_APT_RETRY_DELAY:-5}"
export APT_TIMEOUT="${PARKING_APT_TIMEOUT:-300}"
export APT_FORCE_IPV4="${PARKING_APT_FORCE_IPV4:-true}"

# Package installation tracking
declare -a INSTALLED_PACKAGES=()
declare -a FAILED_PACKAGES=()

# ==============================================================================
# APT LOCK MANAGEMENT
# ==============================================================================

# Wait for APT locks to be released
wait_for_apt_locks() {
    local max_wait="${1:-300}"  # 5 minutes default
    local wait_time=0
    
    local lock_files=(
        "/var/lib/dpkg/lock"
        "/var/lib/dpkg/lock-frontend" 
        "/var/cache/apt/archives/lock"
    )
    
    log_debug "Waiting for APT locks to be released..."
    
    while (( wait_time < max_wait )); do
        local locked=false
        
        for lock_file in "${lock_files[@]}"; do
            if fuser "$lock_file" >/dev/null 2>&1; then
                locked=true
                break
            fi
        done
        
        if ! $locked; then
            log_debug "APT locks released after ${wait_time}s"
            return 0
        fi
        
        if (( wait_time % 30 == 0 )) && (( wait_time > 0 )); then
            log_info "Still waiting for APT locks... (${wait_time}s elapsed)"
        fi
        
        sleep 5
        (( wait_time += 5 ))
    done
    
    log_error "Timed out waiting for APT locks after ${max_wait}s"
    return 1
}

# Force release stuck APT locks (use with caution)
force_release_apt_locks() {
    log_warn "Forcibly releasing APT locks..."
    
    # Stop any running package managers
    pkill -f "apt|dpkg" || true
    
    # Remove lock files
    rm -f /var/lib/dpkg/lock*
    rm -f /var/cache/apt/archives/lock
    
    # Reconfigure dpkg
    dpkg --configure -a
    
    log_warn "APT locks forcibly released"
}

# ==============================================================================
# APT UPDATE OPERATIONS
# ==============================================================================

# Update package lists with retry logic
apt_update() {
    local retry_count=0
    local max_retries="${1:-$APT_RETRY_COUNT}"
    
    log_info "Updating package lists..."
    
    while (( retry_count < max_retries )); do
        if ! wait_for_apt_locks; then
            return 1
        fi
        
        log_command "apt-get update"
        
        local apt_args=("-y" "-q")
        
        if [[ "$APT_FORCE_IPV4" == "true" ]]; then
            apt_args+=("-o" "Acquire::ForceIPv4=true")
        fi
        
        if timeout "$APT_TIMEOUT" apt-get update "${apt_args[@]}" >/dev/null 2>&1; then
            log_success "Package lists updated successfully"
            return 0
        else
            (( retry_count++ ))
            log_warn "Package update failed (attempt $retry_count/$max_retries)"
            
            if (( retry_count < max_retries )); then
                log_info "Retrying in ${APT_RETRY_DELAY}s..."
                sleep "$APT_RETRY_DELAY"
            fi
        fi
    done
    
    log_error "Failed to update package lists after $max_retries attempts"
    return 1
}

# Upgrade system packages
apt_upgrade() {
    local upgrade_type="${1:-upgrade}"  # upgrade or dist-upgrade
    
    log_info "Upgrading system packages..."
    
    if ! wait_for_apt_locks; then
        return 1
    fi
    
    log_command "apt-get $upgrade_type"
    
    local apt_args=("-y" "-q")
    
    if [[ "$APT_FORCE_IPV4" == "true" ]]; then
        apt_args+=("-o" "Acquire::ForceIPv4=true")
    fi
    
    if timeout "$APT_TIMEOUT" apt-get "$upgrade_type" "${apt_args[@]}"; then
        log_success "System packages upgraded successfully"
        return 0
    else
        log_error "Failed to upgrade system packages"
        return 1
    fi
}

# ==============================================================================
# PACKAGE INSTALLATION
# ==============================================================================

# Install a single package with error handling
install_package() {
    local package="$1"
    local retry_count=0
    local max_retries="${2:-$APT_RETRY_COUNT}"
    
    # Check if already installed
    if package_installed "$package"; then
        log_debug "Package already installed: $package"
        return 0
    fi
    
    log_info "Installing package: $package"
    
    while (( retry_count < max_retries )); do
        if ! wait_for_apt_locks; then
            return 1
        fi
        
        log_command "apt-get install $package"
        
        local apt_args=("-y" "-q" "install" "$package")
        
        if [[ "$APT_FORCE_IPV4" == "true" ]]; then
            apt_args=("-y" "-q" "-o" "Acquire::ForceIPv4=true" "install" "$package")
        fi
        
        if timeout "$APT_TIMEOUT" apt-get "${apt_args[@]}" >/dev/null 2>&1; then
            log_success "Package installed: $package"
            INSTALLED_PACKAGES+=("$package")
            return 0
        else
            (( retry_count++ ))
            log_warn "Package installation failed: $package (attempt $retry_count/$max_retries)"
            
            if (( retry_count < max_retries )); then
                log_info "Retrying in ${APT_RETRY_DELAY}s..."
                sleep "$APT_RETRY_DELAY"
            fi
        fi
    done
    
    log_error "Failed to install package: $package"
    FAILED_PACKAGES+=("$package")
    return 1
}

# Install multiple packages with progress tracking
install_packages() {
    local packages=("$@")
    local total_packages=${#packages[@]}
    local current_package=0
    local failed_count=0
    
    log_info "Installing $total_packages packages..."
    
    for package in "${packages[@]}"; do
        (( current_package++ ))
        log_progress "$current_package" "$total_packages" "Installing $package"
        
        if ! install_package "$package"; then
            (( failed_count++ ))
        fi
    done
    
    if (( failed_count > 0 )); then
        log_error "$failed_count packages failed to install"
        return 1
    else
        log_success "All $total_packages packages installed successfully"
        return 0
    fi
}

# Install packages from categories
install_package_group() {
    local group_name="$1"
    shift
    local packages=("$@")
    
    log_info "Installing $group_name packages..."
    
    if install_packages "${packages[@]}"; then
        log_success "$group_name packages installed successfully"
        return 0
    else
        log_error "Some $group_name packages failed to install"
        return 1
    fi
}

# ==============================================================================
# PACKAGE REMOVAL
# ==============================================================================

# Remove a package
remove_package() {
    local package="$1"
    local purge="${2:-false}"
    
    if ! package_installed "$package"; then
        log_debug "Package not installed: $package"
        return 0
    fi
    
    log_info "Removing package: $package"
    
    if ! wait_for_apt_locks; then
        return 1
    fi
    
    local action="remove"
    if [[ "$purge" == "true" ]]; then
        action="purge"
    fi
    
    log_command "apt-get $action $package"
    
    if apt-get -y -q "$action" "$package" >/dev/null 2>&1; then
        log_success "Package removed: $package"
        return 0
    else
        log_error "Failed to remove package: $package"
        return 1
    fi
}

# ==============================================================================
# PACKAGE INFORMATION
# ==============================================================================

# Get package version
get_package_version() {
    local package="$1"
    
    if package_installed "$package"; then
        dpkg -l "$package" | awk 'NR==2 {print $3}'
    else
        echo ""
    fi
}

# Check if package is available in repositories
package_available() {
    local package="$1"
    apt-cache show "$package" >/dev/null 2>&1
}

# Get package description
get_package_description() {
    local package="$1"
    apt-cache show "$package" 2>/dev/null | grep -m1 "^Description:" | cut -d: -f2- | sed 's/^ *//'
}

# List installed packages matching pattern
list_installed_packages() {
    local pattern="${1:-.*}"
    dpkg -l | awk '/^ii/ {print $2}' | grep -E "$pattern"
}

# ==============================================================================
# REPOSITORY MANAGEMENT
# ==============================================================================

# Add APT repository
add_repository() {
    local repo="$1"
    local keyring="${2:-}"
    
    log_info "Adding repository: $repo"
    
    if [[ -n "$keyring" ]]; then
        log_info "Adding keyring: $keyring"
        if ! wget -qO- "$keyring" | apt-key add - >/dev/null 2>&1; then
            log_error "Failed to add keyring"
            return 1
        fi
    fi
    
    if add-apt-repository -y "$repo" >/dev/null 2>&1; then
        log_success "Repository added: $repo"
        return 0
    else
        log_error "Failed to add repository: $repo"
        return 1
    fi
}

# ==============================================================================
# SYSTEM CLEANUP
# ==============================================================================

# Clean package cache
cleanup_apt_cache() {
    log_info "Cleaning APT cache..."
    
    if ! wait_for_apt_locks; then
        return 1
    fi
    
    apt-get clean >/dev/null 2>&1
    apt-get autoremove -y >/dev/null 2>&1
    apt-get autoclean >/dev/null 2>&1
    
    log_success "APT cache cleaned"
}

# Fix broken packages
fix_broken_packages() {
    log_info "Fixing broken packages..."
    
    if ! wait_for_apt_locks; then
        return 1
    fi
    
    if apt-get -f install -y >/dev/null 2>&1; then
        log_success "Broken packages fixed"
        return 0
    else
        log_error "Failed to fix broken packages"
        return 1
    fi
}

# ==============================================================================
# PACKAGE GROUPS/CATEGORIES
# ==============================================================================

# Essential system packages
install_essential_packages() {
    local packages=(
        curl wget git vim nano
        htop net-tools dnsutils
        build-essential software-properties-common
        ca-certificates gnupg lsb-release
        unzip zip tar gzip
    )
    
    install_package_group "Essential" "${packages[@]}"
}

# Security packages
install_security_packages() {
    local packages=(
        openssh-server
        ufw fail2ban
        unattended-upgrades apt-listchanges
        rkhunter chkrootkit
    )
    
    install_package_group "Security" "${packages[@]}"
}

# Development packages
install_development_packages() {
    local packages=(
        nodejs npm
        postgresql postgresql-client postgresql-contrib
        redis-server
        nginx
    )
    
    install_package_group "Development" "${packages[@]}"
}

# Localization packages
install_localization_packages() {
    local packages=(
        locales locales-all tzdata
        language-pack-es language-pack-es-base
        language-pack-gnome-es language-pack-gnome-es-base
        firefox-locale-es thunderbird-locale-es
        libreoffice-l10n-es hunspell-es
    )
    
    install_package_group "Localization" "${packages[@]}"
}

# Hardware packages
install_hardware_packages() {
    local packages=(
        cups cups-client cups-bsd cups-filters
        system-config-printer printer-driver-escpr
        usb-creator-common usb-creator-gtk
        usbutils pciutils
    )
    
    install_package_group "Hardware" "${packages[@]}"
}

# Desktop/kiosk packages
install_desktop_packages() {
    local packages=(
        xorg lightdm openbox
        chromium-browser firefox
        unclutter xdotool
        autocutsel
    )
    
    install_package_group "Desktop/Kiosk" "${packages[@]}"
}

# ==============================================================================
# INSTALLATION SUMMARY
# ==============================================================================

# Show installation summary
show_package_summary() {
    log_header "PACKAGE INSTALLATION SUMMARY"
    
    if (( ${#INSTALLED_PACKAGES[@]} > 0 )); then
        log_success "Successfully installed packages (${#INSTALLED_PACKAGES[@]}):"
        for package in "${INSTALLED_PACKAGES[@]}"; do
            log_info "  ✓ $package"
        done
    fi
    
    if (( ${#FAILED_PACKAGES[@]} > 0 )); then
        log_error "Failed to install packages (${#FAILED_PACKAGES[@]}):"
        for package in "${FAILED_PACKAGES[@]}"; do
            log_error "  ✗ $package"
        done
        return 1
    fi
    
    return 0
}

# ==============================================================================
# EXPORT FUNCTIONS
# ==============================================================================

export -f wait_for_apt_locks force_release_apt_locks
export -f apt_update apt_upgrade
export -f install_package install_packages install_package_group
export -f remove_package
export -f get_package_version package_available get_package_description list_installed_packages
export -f add_repository
export -f cleanup_apt_cache fix_broken_packages
export -f install_essential_packages install_security_packages install_development_packages
export -f install_localization_packages install_hardware_packages install_desktop_packages
export -f show_package_summary