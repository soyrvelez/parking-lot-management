#!/bin/bash

# Parking System - Centralized Logging Library
# Comprehensive logging functions with security and performance features
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/../lib/logging.sh"

# Prevent multiple sourcing
if [[ "${PARKING_LOGGING_LOADED:-}" == "true" ]]; then
    return 0
fi

# Source common utilities
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/common.sh"

export PARKING_LOGGING_LOADED="true"

# ==============================================================================
# LOGGING CONFIGURATION
# ==============================================================================

# Log levels (numeric for easy comparison)
declare -r LOG_LEVEL_ERROR=1
declare -r LOG_LEVEL_WARN=2
declare -r LOG_LEVEL_INFO=3
declare -r LOG_LEVEL_DEBUG=4

# Default log level (can be overridden with PARKING_LOG_LEVEL env var)
CURRENT_LOG_LEVEL="${PARKING_LOG_LEVEL:-$LOG_LEVEL_INFO}"

# Log file configuration
DEFAULT_LOG_FILE="${PARKING_LOG_FILE:-/tmp/parking-install.log}"
LOG_MAX_SIZE="${PARKING_LOG_MAX_SIZE:-10485760}"  # 10MB default
LOG_BACKUP_COUNT="${PARKING_LOG_BACKUP_COUNT:-5}"

# Security: Sensitive data patterns to sanitize
declare -a SENSITIVE_PATTERNS=(
    's/(password|passwd|secret|token|key|credential)[=:][ ]*[^ ]*/(password|passwd|secret|token|key|credential)=***HIDDEN***/gi'
    's/postgresql:\/\/[^:]*:[^@]*@/postgresql:\/\/***:***@/gi'
    's/(jwt_secret|database_url|api_key|db_password)[=:][ ]*[^ ]*/(jwt_secret|database_url|api_key|db_password)=***HIDDEN***/gi'
    's/([0-9]{1,3}\.){3}[0-9]{1,3}/***IP_HIDDEN***/g'
)

# ==============================================================================
# LOG SANITIZATION
# ==============================================================================

# Sanitize log messages to remove sensitive information
sanitize_log_message() {
    local message="$1"
    
    # Apply each sanitization pattern
    for pattern in "${SENSITIVE_PATTERNS[@]}"; do
        message=$(echo "$message" | sed -E "$pattern")
    done
    
    echo "$message"
}

# ==============================================================================
# LOG ROTATION
# ==============================================================================

# Rotate log file if it exceeds maximum size
rotate_log_file() {
    local log_file="$1"
    
    if [[ ! -f "$log_file" ]]; then
        return 0
    fi
    
    local file_size
    file_size=$(stat -c%s "$log_file" 2>/dev/null || echo "0")
    
    if (( file_size > LOG_MAX_SIZE )); then
        # Rotate existing backups
        for (( i = LOG_BACKUP_COUNT; i > 1; i-- )); do
            local old_backup="${log_file}.$(( i - 1 ))"
            local new_backup="${log_file}.${i}"
            if [[ -f "$old_backup" ]]; then
                mv "$old_backup" "$new_backup"
            fi
        done
        
        # Move current log to .1
        mv "$log_file" "${log_file}.1"
        
        # Create new empty log file
        touch "$log_file"
        chmod 640 "$log_file"
    fi
}

# ==============================================================================
# CORE LOGGING FUNCTIONS
# ==============================================================================

# Internal logging function with file locking
_log_internal() {
    local level="$1"
    local level_name="$2" 
    local level_color="$3"
    local message="$4"
    local log_file="${5:-$DEFAULT_LOG_FILE}"
    
    # Check if we should log this level
    if (( level > CURRENT_LOG_LEVEL )); then
        return 0
    fi
    
    # Sanitize the message
    local sanitized_message
    sanitized_message=$(sanitize_log_message "$message")
    
    # Format the log entry
    local timestamp
    timestamp=$(get_timestamp)
    local formatted_message="[${timestamp}] [${level_name}] ${sanitized_message}"
    
    # Console output with colors
    echo -e "${level_color}${formatted_message}${NC}"
    
    # File output (if log file is specified)
    if [[ -n "$log_file" && "$log_file" != "/dev/null" ]]; then
        # Ensure log directory exists
        local log_dir
        log_dir=$(dirname "$log_file")
        ensure_directory "$log_dir" "root:root" "755"
        
        # Rotate if needed
        rotate_log_file "$log_file"
        
        # Write to file with locking
        local lock_file="${log_file}.lock"
        if acquire_lock "$lock_file" 30; then
            echo "$formatted_message" >> "$log_file"
            release_lock "$lock_file"
        else
            # Fallback: write without lock if we can't acquire it
            echo "$formatted_message" >> "$log_file"
        fi
    fi
}

# ==============================================================================
# PUBLIC LOGGING FUNCTIONS
# ==============================================================================

# Error logging - always shown, written to stderr
log_error() {
    _log_internal "$LOG_LEVEL_ERROR" "ERROR" "$RED" "$1" "${2:-$DEFAULT_LOG_FILE}" >&2
}
alias error='log_error'

# Warning logging
log_warn() {
    _log_internal "$LOG_LEVEL_WARN" "WARN" "$YELLOW" "$1" "${2:-$DEFAULT_LOG_FILE}"
}
alias warn='log_warn'

# Info logging - main logging level
log_info() {
    _log_internal "$LOG_LEVEL_INFO" "INFO" "$GREEN" "$1" "${2:-$DEFAULT_LOG_FILE}"
}
alias log='log_info'
alias info='log_info'

# Debug logging - only shown in debug mode
log_debug() {
    _log_internal "$LOG_LEVEL_DEBUG" "DEBUG" "$BLUE" "$1" "${2:-$DEFAULT_LOG_FILE}"
}
alias debug='log_debug'

# ==============================================================================
# SPECIALIZED LOGGING FUNCTIONS
# ==============================================================================

# Success logging with checkmark
log_success() {
    log_info "✓ $1" "${2:-$DEFAULT_LOG_FILE}"
}

# Failure logging with X mark
log_failure() {
    log_error "✗ $1" "${2:-$DEFAULT_LOG_FILE}"
}

# Warning logging with warning mark
log_warning() {
    log_warn "⚠ $1" "${2:-$DEFAULT_LOG_FILE}"
}

# Progress logging
log_progress() {
    local current="$1"
    local total="$2"
    local task="$3"
    local percentage=$((current * 100 / total))
    log_info "[$current/$total] ($percentage%) $task"
}

# Section header logging
log_header() {
    local header="$1"
    local border=$(printf '=%.0s' {1..60})
    log_info ""
    log_info "$border"
    log_info "$header"
    log_info "$border"
}

# Command execution logging
log_command() {
    local command="$1"
    local hide_command="${2:-false}"
    
    if [[ "$hide_command" == "true" ]]; then
        log_debug "Executing command: [HIDDEN]"
    else
        log_debug "Executing command: $command"
    fi
}

# ==============================================================================
# LOG LEVEL MANAGEMENT
# ==============================================================================

# Set log level by name
set_log_level() {
    local level_name="$1"
    
    case "${level_name,,}" in
        error|err)
            CURRENT_LOG_LEVEL=$LOG_LEVEL_ERROR
            ;;
        warn|warning)
            CURRENT_LOG_LEVEL=$LOG_LEVEL_WARN
            ;;
        info|information)
            CURRENT_LOG_LEVEL=$LOG_LEVEL_INFO
            ;;
        debug|dbg)
            CURRENT_LOG_LEVEL=$LOG_LEVEL_DEBUG
            ;;
        *)
            log_error "Invalid log level: $level_name. Valid levels: error, warn, info, debug"
            return 1
            ;;
    esac
    
    log_debug "Log level set to: $level_name ($CURRENT_LOG_LEVEL)"
}

# Get current log level name
get_log_level() {
    case $CURRENT_LOG_LEVEL in
        $LOG_LEVEL_ERROR) echo "error" ;;
        $LOG_LEVEL_WARN) echo "warn" ;;
        $LOG_LEVEL_INFO) echo "info" ;;
        $LOG_LEVEL_DEBUG) echo "debug" ;;
        *) echo "unknown" ;;
    esac
}

# ==============================================================================
# LOG FILE MANAGEMENT
# ==============================================================================

# Set default log file
set_log_file() {
    local log_file="$1"
    
    # Validate log file path
    local log_dir
    log_dir=$(dirname "$log_file")
    
    if [[ ! -d "$log_dir" ]]; then
        if ! mkdir -p "$log_dir" 2>/dev/null; then
            log_error "Cannot create log directory: $log_dir"
            return 1
        fi
    fi
    
    # Test write access
    if ! touch "$log_file" 2>/dev/null; then
        log_error "Cannot write to log file: $log_file"
        return 1
    fi
    
    DEFAULT_LOG_FILE="$log_file"
    log_debug "Default log file set to: $log_file"
}

# Get current log file
get_log_file() {
    echo "$DEFAULT_LOG_FILE"
}

# Clear log file
clear_log() {
    local log_file="${1:-$DEFAULT_LOG_FILE}"
    
    if [[ -f "$log_file" ]]; then
        > "$log_file"
        log_info "Log file cleared: $log_file"
    fi
}

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Initialize logging from environment variables
initialize_logging() {
    # Set log level from environment
    if [[ -n "${PARKING_LOG_LEVEL:-}" ]]; then
        set_log_level "$PARKING_LOG_LEVEL" || true
    fi
    
    # Set log file from environment
    if [[ -n "${PARKING_LOG_FILE:-}" ]]; then
        set_log_file "$PARKING_LOG_FILE" || true
    fi
    
    # Enable debug mode if requested
    if [[ "${PARKING_DEBUG:-false}" == "true" ]]; then
        set_log_level "debug"
    fi
}

# ==============================================================================
# EXPORT FUNCTIONS
# ==============================================================================

# Export all public functions
export -f log_error log_warn log_info log_debug
export -f log_success log_failure log_warning log_progress log_header log_command
export -f set_log_level get_log_level
export -f set_log_file get_log_file clear_log
export -f sanitize_log_message

# Initialize logging system
initialize_logging