#!/bin/bash

# Parking System - Common Utilities Library
# Shared constants, configurations, and core functions
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"

# Prevent multiple sourcing
if [[ "${PARKING_COMMON_LOADED:-}" == "true" ]]; then
    return 0
fi
export PARKING_COMMON_LOADED="true"

# ==============================================================================
# BASH CONFIGURATION
# ==============================================================================

# Standard bash safety configuration
set -euo pipefail

# Debian package manager configuration
export DEBIAN_FRONTEND=noninteractive

# ==============================================================================
# COLOR DEFINITIONS
# ==============================================================================

export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export WHITE='\033[1;37m'
export BOLD='\033[1m'
export NC='\033[0m' # No Color

# ==============================================================================
# SYSTEM CONSTANTS
# ==============================================================================

# System requirements
export MIN_MEMORY_GB=4
export RECOMMENDED_MEMORY_GB=8
export MIN_DISK_GB=10
export RECOMMENDED_DISK_GB=20
export MIN_UBUNTU_VERSION=20

# Application constants
export APP_NAME="Sistema de Gestión de Estacionamiento"
export APP_VERSION="1.0.0"
export APP_DIR="/opt/parking-system"
export SERVICE_USER="parking"
export WEB_PORT="3000"
export API_PORT="3001"

# Database constants
export DB_NAME="parking_lot"
export DB_USER="parking_user"
export DB_HOST="localhost"
export DB_PORT="5432"

# Localization
export SYSTEM_LANG="es_MX.UTF-8"
export SYSTEM_TZ="America/Mexico_City"

# Hardware constants
export PRINTER_IP="192.168.1.100"
export PRINTER_PORT="9100"
export PRINTER_NAME="EpsonTM-T20III"

# Directories
export LOG_DIR="/var/log/parking-system"
export BACKUP_DIR="/opt/parking-backups"
export CONFIG_DIR="/etc/parking-system"
export DATA_DIR="/var/lib/parking-system"

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

# Get script directory (works from any script location)
get_script_dir() {
    echo "$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
}

# Get project root directory
get_project_root() {
    local script_dir
    script_dir=$(get_script_dir)
    # Navigate up from scripts directory to project root
    echo "$(cd "$script_dir/.." && pwd)"
}

# Get library directory
get_lib_dir() {
    local script_dir
    script_dir=$(get_script_dir)
    echo "$script_dir/lib"
}

# Generate secure random string
generate_random_string() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Check if string is empty or only whitespace
is_empty() {
    local str="${1:-}"
    [[ -z "${str// }" ]]
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if service exists
service_exists() {
    systemctl list-unit-files --type=service | grep -q "^${1}\.service"
}

# Check if package is installed
package_installed() {
    dpkg -l "$1" >/dev/null 2>&1
}

# Get system IP address
get_system_ip() {
    hostname -I | awk '{print $1}'
}

# Get timestamp for logging
get_timestamp() {
    date +'%Y-%m-%d %H:%M:%S'
}

# Get current user safely
get_current_user() {
    if [[ -n "${SUDO_USER:-}" ]]; then
        echo "$SUDO_USER"
    else
        echo "$USER"
    fi
}

# Check if running as root
is_root() {
    [[ $EUID -eq 0 ]]
}

# Ensure directory exists with proper permissions
ensure_directory() {
    local dir="$1"
    local owner="${2:-root:root}"
    local perms="${3:-755}"
    
    mkdir -p "$dir"
    
    # Only change ownership if running as root
    if is_root; then
        chown "$owner" "$dir"
    fi
    
    chmod "$perms" "$dir" 2>/dev/null || true
}

# Backup file before modification
backup_file() {
    local file="$1"
    local backup_suffix="${2:-$(date +%Y%m%d_%H%M%S)}"
    
    if [[ -f "$file" ]]; then
        cp "$file" "${file}.backup.${backup_suffix}"
        echo "${file}.backup.${backup_suffix}"
    fi
}

# ==============================================================================
# FILE LOCK UTILITIES
# ==============================================================================

# Acquire file lock for safe concurrent operations
acquire_lock() {
    local lock_file="$1"
    local timeout="${2:-300}"  # 5 minutes default
    local wait_time=1
    local elapsed=0
    
    while (( elapsed < timeout )); do
        if (set -C; echo $$ > "$lock_file") 2>/dev/null; then
            return 0
        fi
        sleep $wait_time
        (( elapsed += wait_time ))
    done
    
    return 1
}

# Release file lock
release_lock() {
    local lock_file="$1"
    rm -f "$lock_file"
}

# ==============================================================================
# VALIDATION HELPERS
# ==============================================================================

# Validate IP address format
validate_ip() {
    local ip="$1"
    local regex='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
    
    if [[ $ip =~ $regex ]]; then
        IFS='.' read -ra ADDR <<< "$ip"
        for i in "${ADDR[@]}"; do
            if (( i > 255 )); then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

# Validate port number
validate_port() {
    local port="$1"
    [[ "$port" =~ ^[0-9]+$ ]] && (( port > 0 && port <= 65535 ))
}

# Validate email format (basic)
validate_email() {
    local email="$1"
    [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]
}

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Export all functions for use by other scripts
export -f get_script_dir get_project_root get_lib_dir
export -f generate_random_string is_empty command_exists service_exists package_installed
export -f get_system_ip get_timestamp get_current_user is_root
export -f ensure_directory backup_file
export -f acquire_lock release_lock
export -f validate_ip validate_port validate_email

# Set default umask for security
umask 022