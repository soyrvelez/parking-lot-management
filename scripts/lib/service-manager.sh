#!/bin/bash

# Parking System - Service Manager Library
# Wrapper functions for safe and consistent systemd operations
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/../lib/service-manager.sh"

# Prevent multiple sourcing
if [[ "${PARKING_SERVICE_MANAGER_LOADED:-}" == "true" ]]; then
    return 0
fi

# Source dependencies
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/common.sh"
source "$LIB_DIR/logging.sh"

export PARKING_SERVICE_MANAGER_LOADED="true"

# ==============================================================================
# SERVICE MANAGER CONFIGURATION
# ==============================================================================

# Service operation timeouts
export SERVICE_START_TIMEOUT="${PARKING_SERVICE_START_TIMEOUT:-30}"
export SERVICE_STOP_TIMEOUT="${PARKING_SERVICE_STOP_TIMEOUT:-30}"
export SERVICE_RESTART_TIMEOUT="${PARKING_SERVICE_RESTART_TIMEOUT:-60}"

# Service status check intervals
export SERVICE_CHECK_INTERVAL="${PARKING_SERVICE_CHECK_INTERVAL:-2}"
export SERVICE_CHECK_RETRIES="${PARKING_SERVICE_CHECK_RETRIES:-10}"

# Service tracking
declare -a MANAGED_SERVICES=()
declare -a FAILED_SERVICES=()

# ==============================================================================
# SERVICE VALIDATION
# ==============================================================================

# Check if systemd is available
check_systemd_available() {
    if [[ ! -d /run/systemd/system ]]; then
        log_error "Systemd is not running on this system"
        return 1
    fi
    
    if ! command_exists systemctl; then
        log_error "systemctl command not found"
        return 1
    fi
    
    return 0
}

# Check if service unit exists
service_unit_exists() {
    local service="$1"
    systemctl list-unit-files --type=service --no-pager --no-legend | grep -q "^${service}\.service"
}

# Validate service name format
validate_service_name() {
    local service="$1"
    
    # Basic validation: no spaces, valid characters
    if [[ "$service" =~ [[:space:]] ]]; then
        log_error "Invalid service name (contains spaces): $service"
        return 1
    fi
    
    if [[ ! "$service" =~ ^[a-zA-Z0-9._-]+$ ]]; then
        log_error "Invalid service name (invalid characters): $service"
        return 1
    fi
    
    return 0
}

# ==============================================================================
# SERVICE STATUS OPERATIONS
# ==============================================================================

# Get service status
get_service_status() {
    local service="$1"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    if ! service_unit_exists "$service"; then
        echo "not-found"
        return 0
    fi
    
    local status
    status=$(systemctl is-active "$service" 2>/dev/null || echo "unknown")
    echo "$status"
}

# Check if service is running
is_service_running() {
    local service="$1"
    local status
    status=$(get_service_status "$service")
    [[ "$status" == "active" ]]
}

# Check if service is enabled
is_service_enabled() {
    local service="$1"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    systemctl is-enabled "$service" >/dev/null 2>&1
}

# Wait for service to reach desired state
wait_for_service_state() {
    local service="$1"
    local desired_state="$2"
    local timeout="${3:-$SERVICE_CHECK_RETRIES}"
    local interval="${4:-$SERVICE_CHECK_INTERVAL}"
    
    local attempts=0
    
    log_debug "Waiting for $service to be $desired_state..."
    
    while (( attempts < timeout )); do
        local current_state
        current_state=$(get_service_status "$service")
        
        if [[ "$current_state" == "$desired_state" ]]; then
            log_debug "$service reached desired state: $desired_state"
            return 0
        fi
        
        if [[ "$current_state" == "failed" ]] && [[ "$desired_state" != "failed" ]]; then
            log_error "$service failed to start"
            return 1
        fi
        
        sleep "$interval"
        (( attempts++ ))
    done
    
    log_error "Timeout waiting for $service to be $desired_state"
    return 1
}

# ==============================================================================
# SERVICE CONTROL OPERATIONS
# ==============================================================================

# Start a service
start_service() {
    local service="$1"
    local wait="${2:-true}"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    if ! check_systemd_available; then
        return 1
    fi
    
    if is_service_running "$service"; then
        log_debug "Service already running: $service"
        return 0
    fi
    
    log_info "Starting service: $service"
    
    if ! systemctl start "$service" 2>/dev/null; then
        log_error "Failed to start service: $service"
        FAILED_SERVICES+=("$service")
        return 1
    fi
    
    if [[ "$wait" == "true" ]]; then
        if wait_for_service_state "$service" "active" "$SERVICE_CHECK_RETRIES"; then
            log_success "Service started: $service"
            MANAGED_SERVICES+=("$service")
            return 0
        else
            log_error "Service failed to start within timeout: $service"
            FAILED_SERVICES+=("$service")
            return 1
        fi
    else
        log_success "Service start command issued: $service"
        MANAGED_SERVICES+=("$service")
        return 0
    fi
}

# Stop a service
stop_service() {
    local service="$1"
    local wait="${2:-true}"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    if ! check_systemd_available; then
        return 1
    fi
    
    if ! is_service_running "$service"; then
        log_debug "Service already stopped: $service"
        return 0
    fi
    
    log_info "Stopping service: $service"
    
    if ! systemctl stop "$service" 2>/dev/null; then
        log_error "Failed to stop service: $service"
        return 1
    fi
    
    if [[ "$wait" == "true" ]]; then
        if wait_for_service_state "$service" "inactive" "$SERVICE_CHECK_RETRIES"; then
            log_success "Service stopped: $service"
            return 0
        else
            log_error "Service failed to stop within timeout: $service"
            return 1
        fi
    else
        log_success "Service stop command issued: $service"
        return 0
    fi
}

# Restart a service
restart_service() {
    local service="$1"
    local wait="${2:-true}"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    log_info "Restarting service: $service"
    
    if ! systemctl restart "$service" 2>/dev/null; then
        log_error "Failed to restart service: $service"
        FAILED_SERVICES+=("$service")
        return 1
    fi
    
    if [[ "$wait" == "true" ]]; then
        if wait_for_service_state "$service" "active" "$SERVICE_CHECK_RETRIES"; then
            log_success "Service restarted: $service"
            return 0
        else
            log_error "Service failed to restart within timeout: $service"
            FAILED_SERVICES+=("$service")
            return 1
        fi
    else
        log_success "Service restart command issued: $service"
        return 0
    fi
}

# Reload service configuration
reload_service() {
    local service="$1"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    log_info "Reloading service configuration: $service"
    
    if systemctl reload "$service" 2>/dev/null; then
        log_success "Service configuration reloaded: $service"
        return 0
    else
        log_error "Failed to reload service configuration: $service"
        return 1
    fi
}

# ==============================================================================
# SERVICE ENABLE/DISABLE OPERATIONS
# ==============================================================================

# Enable a service
enable_service() {
    local service="$1"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    if is_service_enabled "$service"; then
        log_debug "Service already enabled: $service"
        return 0
    fi
    
    log_info "Enabling service: $service"
    
    if systemctl enable "$service" >/dev/null 2>&1; then
        log_success "Service enabled: $service"
        return 0
    else
        log_error "Failed to enable service: $service"
        return 1
    fi
}

# Disable a service
disable_service() {
    local service="$1"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    if ! is_service_enabled "$service"; then
        log_debug "Service already disabled: $service"
        return 0
    fi
    
    log_info "Disabling service: $service"
    
    if systemctl disable "$service" >/dev/null 2>&1; then
        log_success "Service disabled: $service"
        return 0
    else
        log_error "Failed to disable service: $service"
        return 1
    fi
}

# ==============================================================================
# SERVICE UNIT FILE MANAGEMENT
# ==============================================================================

# Create systemd service unit file
create_service_unit() {
    local service_name="$1"
    local service_description="$2"
    local exec_start="$3"
    local user="${4:-root}"
    local working_directory="${5:-/}"
    local environment_file="${6:-}"
    
    local unit_file="/etc/systemd/system/${service_name}.service"
    
    log_info "Creating service unit: $service_name"
    
    cat > "$unit_file" << EOF
[Unit]
Description=$service_description
After=network.target
Wants=network.target

[Service]
Type=simple
User=$user
WorkingDirectory=$working_directory
ExecStart=$exec_start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$service_name

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$working_directory

EOF

    # Add environment file if specified
    if [[ -n "$environment_file" ]] && [[ -f "$environment_file" ]]; then
        echo "EnvironmentFile=$environment_file" >> "$unit_file"
    fi
    
    cat >> "$unit_file" << EOF

[Install]
WantedBy=multi-user.target
EOF
    
    # Set proper permissions
    chmod 644 "$unit_file"
    
    # Reload systemd to recognize new unit
    systemctl daemon-reload
    
    log_success "Service unit created: $service_name"
    return 0
}

# Remove service unit file
remove_service_unit() {
    local service="$1"
    local unit_file="/etc/systemd/system/${service}.service"
    
    if [[ ! -f "$unit_file" ]]; then
        log_debug "Service unit file does not exist: $service"
        return 0
    fi
    
    log_info "Removing service unit: $service"
    
    # Stop and disable service first
    stop_service "$service" false
    disable_service "$service"
    
    # Remove unit file
    rm -f "$unit_file"
    
    # Reload systemd
    systemctl daemon-reload
    
    log_success "Service unit removed: $service"
    return 0
}

# ==============================================================================
# SERVICE MONITORING
# ==============================================================================

# Get service logs
get_service_logs() {
    local service="$1"
    local lines="${2:-50}"
    local follow="${3:-false}"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    local journalctl_args=("-u" "$service" "-n" "$lines" "--no-pager")
    
    if [[ "$follow" == "true" ]]; then
        journalctl_args+=("-f")
    fi
    
    journalctl "${journalctl_args[@]}"
}

# Check service health
check_service_health() {
    local service="$1"
    local health_check_command="${2:-}"
    
    if ! validate_service_name "$service"; then
        return 1
    fi
    
    # Basic systemd status check
    if ! is_service_running "$service"; then
        log_error "Service not running: $service"
        return 1
    fi
    
    # Custom health check if provided
    if [[ -n "$health_check_command" ]]; then
        log_debug "Running health check for $service: $health_check_command"
        if eval "$health_check_command" >/dev/null 2>&1; then
            log_success "Service health check passed: $service"
            return 0
        else
            log_error "Service health check failed: $service"
            return 1
        fi
    fi
    
    log_success "Service running normally: $service"
    return 0
}

# Monitor multiple services
monitor_services() {
    local services=("$@")
    local all_healthy=true
    
    log_info "Monitoring ${#services[@]} services..."
    
    for service in "${services[@]}"; do
        if check_service_health "$service"; then
            log_success "✓ $service"
        else
            log_error "✗ $service"
            all_healthy=false
        fi
    done
    
    return $([[ "$all_healthy" == "true" ]] && echo 0 || echo 1)
}

# ==============================================================================
# BULK OPERATIONS
# ==============================================================================

# Start multiple services
start_services() {
    local services=("$@")
    local failed_count=0
    
    log_info "Starting ${#services[@]} services..."
    
    for service in "${services[@]}"; do
        if start_service "$service"; then
            log_success "Started: $service"
        else
            log_error "Failed to start: $service"
            (( failed_count++ ))
        fi
    done
    
    if (( failed_count > 0 )); then
        log_error "$failed_count services failed to start"
        return 1
    else
        log_success "All services started successfully"
        return 0
    fi
}

# Stop multiple services
stop_services() {
    local services=("$@")
    local failed_count=0
    
    log_info "Stopping ${#services[@]} services..."
    
    for service in "${services[@]}"; do
        if stop_service "$service"; then
            log_success "Stopped: $service"
        else
            log_error "Failed to stop: $service"
            (( failed_count++ ))
        fi
    done
    
    if (( failed_count > 0 )); then
        log_error "$failed_count services failed to stop"
        return 1
    else
        log_success "All services stopped successfully"
        return 0
    fi
}

# Enable multiple services
enable_services() {
    local services=("$@")
    local failed_count=0
    
    log_info "Enabling ${#services[@]} services..."
    
    for service in "${services[@]}"; do
        if enable_service "$service"; then
            log_success "Enabled: $service"
        else
            log_error "Failed to enable: $service"
            (( failed_count++ ))
        fi
    done
    
    if (( failed_count > 0 )); then
        log_error "$failed_count services failed to enable"
        return 1
    else
        log_success "All services enabled successfully"
        return 0
    fi
}

# ==============================================================================
# SERVICE SUMMARY
# ==============================================================================

# Show service management summary
show_service_summary() {
    log_header "SERVICE MANAGEMENT SUMMARY"
    
    if (( ${#MANAGED_SERVICES[@]} > 0 )); then
        log_success "Successfully managed services (${#MANAGED_SERVICES[@]}):"
        for service in "${MANAGED_SERVICES[@]}"; do
            local status
            status=$(get_service_status "$service")
            log_info "  $service: $status"
        done
    fi
    
    if (( ${#FAILED_SERVICES[@]} > 0 )); then
        log_error "Failed services (${#FAILED_SERVICES[@]}):"
        for service in "${FAILED_SERVICES[@]}"; do
            log_error "  ✗ $service"
        done
        return 1
    fi
    
    return 0
}

# ==============================================================================
# EXPORT FUNCTIONS
# ==============================================================================

export -f check_systemd_available service_unit_exists validate_service_name
export -f get_service_status is_service_running is_service_enabled wait_for_service_state
export -f start_service stop_service restart_service reload_service
export -f enable_service disable_service
export -f create_service_unit remove_service_unit
export -f get_service_logs check_service_health monitor_services
export -f start_services stop_services enable_services
export -f show_service_summary