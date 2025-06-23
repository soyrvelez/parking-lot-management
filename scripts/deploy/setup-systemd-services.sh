#!/bin/bash
set -euo pipefail

# Script: SystemD Services Setup for Parking Management System
# Purpose: Configure systemd services for automatic startup and management
# Usage: sudo ./setup-systemd-services.sh

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
    echo -e "${YELLOW}[ADVERTENCIA] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

log "=== CONFIGURACIÓN SERVICIOS SYSTEMD ==="

# Configuration
APP_DIR="/opt/parking-system"
SERVICE_USER="parking"
LOG_DIR="/var/log/parking-system"

# Verify prerequisites
log "Verificando prerrequisitos..."

if [ ! -d "$APP_DIR" ]; then
    error "Directorio de aplicación no encontrado: $APP_DIR"
    error "Ejecute deploy-parking-system.sh primero"
    exit 1
fi

if ! id "$SERVICE_USER" &>/dev/null; then
    error "Usuario de servicio no encontrado: $SERVICE_USER"
    error "Ejecute deploy-parking-system.sh primero"
    exit 1
fi

log "✓ Prerrequisitos verificados"

# Create main parking system service
log "Creando servicio principal parking-system..."
cat > /etc/systemd/system/parking-system.service << EOF
[Unit]
Description=Sistema de Gestión de Estacionamiento
Documentation=file://$APP_DIR/README.md
After=network.target postgresql.service
Wants=postgresql.service
Requires=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/start.sh
ExecReload=/bin/kill -HUP \$MAINPID
ExecStop=/bin/kill -TERM \$MAINPID

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$APP_DIR/.env

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Restart configuration
Restart=always
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=3

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$LOG_DIR /var/lib/parking-system $APP_DIR/uploads
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Logging
StandardOutput=append:$LOG_DIR/parking-system.log
StandardError=append:$LOG_DIR/parking-system-error.log
SyslogIdentifier=parking-system

# Process management
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
TimeoutStartSec=60

[Install]
WantedBy=multi-user.target
EOF

log "✓ Servicio parking-system creado"

# Create backup service
log "Creando servicio de respaldos..."
cat > /etc/systemd/system/parking-backup.service << 'EOF'
[Unit]
Description=Parking System Database Backup
After=postgresql.service parking-system.service
Requires=postgresql.service

[Service]
Type=oneshot
User=postgres
Group=postgres
ExecStart=/opt/parking-backup.sh daily
StandardOutput=append:/var/log/parking-system/backup.log
StandardError=append:/var/log/parking-system/backup-error.log
TimeoutStartSec=1800

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/parking-backups /var/log/parking-system
EOF

# Create backup timer
cat > /etc/systemd/system/parking-backup.timer << 'EOF'
[Unit]
Description=Run parking system backup daily
Requires=parking-backup.service

[Timer]
OnCalendar=daily
RandomizedDelaySec=30min
Persistent=true

[Install]
WantedBy=timers.target
EOF

log "✓ Servicio de respaldos creado"

# Create system monitoring service
log "Creando servicio de monitoreo..."
cat > /etc/systemd/system/parking-monitor.service << 'EOF'
[Unit]
Description=Parking System Monitor
After=parking-system.service
Wants=parking-system.service

[Service]
Type=simple
User=root
ExecStart=/opt/parking-system-monitor.sh
Restart=always
RestartSec=300
StandardOutput=append:/var/log/parking-system/monitor.log
StandardError=append:/var/log/parking-system/monitor-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ReadOnlyPaths=/opt/parking-system
ReadWritePaths=/var/log/parking-system

[Install]
WantedBy=multi-user.target
EOF

log "✓ Servicio de monitoreo creado"

# Create log cleanup service
log "Creando servicio de limpieza de logs..."
cat > /etc/systemd/system/parking-log-cleanup.service << 'EOF'
[Unit]
Description=Parking System Log Cleanup
After=parking-system.service

[Service]
Type=oneshot
User=root
ExecStart=/bin/bash -c 'find /var/log/parking-system -name "*.log" -mtime +30 -delete && find /var/log/parking-system -name "*.log.gz" -mtime +90 -delete'
StandardOutput=append:/var/log/parking-system/cleanup.log
StandardError=append:/var/log/parking-system/cleanup-error.log
EOF

# Create log cleanup timer
cat > /etc/systemd/system/parking-log-cleanup.timer << 'EOF'
[Unit]
Description=Run parking log cleanup weekly
Requires=parking-log-cleanup.service

[Timer]
OnCalendar=weekly
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

log "✓ Servicio de limpieza de logs creado"

# Create health check service
log "Creando servicio de verificación de salud..."
cat > /etc/systemd/system/parking-health-check.service << 'EOF'
[Unit]
Description=Parking System Health Check
After=parking-system.service
Wants=parking-system.service

[Service]
Type=oneshot
User=parking
ExecStart=/opt/parking-system/health-check.sh
StandardOutput=append:/var/log/parking-system/health.log
StandardError=append:/var/log/parking-system/health-error.log
TimeoutStartSec=30

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/opt/parking-system
ReadWritePaths=/var/log/parking-system
EOF

# Create health check timer
cat > /etc/systemd/system/parking-health-check.timer << 'EOF'
[Unit]
Description=Run parking health check every 5 minutes
Requires=parking-health-check.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

log "✓ Servicio de verificación de salud creado"

# Create system update service
log "Creando servicio de actualizaciones de seguridad..."
cat > /etc/systemd/system/parking-security-updates.service << 'EOF'
[Unit]
Description=Parking System Security Updates
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/unattended-upgrade
StandardOutput=append:/var/log/parking-system/updates.log
StandardError=append:/var/log/parking-system/updates-error.log
TimeoutStartSec=3600

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
EOF

# Create update timer
cat > /etc/systemd/system/parking-security-updates.timer << 'EOF'
[Unit]
Description=Run security updates weekly
Requires=parking-security-updates.service

[Timer]
OnCalendar=Sun 03:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

log "✓ Servicio de actualizaciones creado"

# Create watchdog service for critical monitoring
log "Creando servicio watchdog..."
cat > /etc/systemd/system/parking-watchdog.service << 'EOF'
[Unit]
Description=Parking System Watchdog
After=parking-system.service
Wants=parking-system.service

[Service]
Type=simple
User=root
ExecStart=/opt/parking-watchdog.sh
Restart=always
RestartSec=60
StandardOutput=append:/var/log/parking-system/watchdog.log
StandardError=append:/var/log/parking-system/watchdog-error.log

# Watchdog configuration
WatchdogSec=120
NotifyAccess=main

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ReadOnlyPaths=/opt/parking-system
ReadWritePaths=/var/log/parking-system

[Install]
WantedBy=multi-user.target
EOF

# Create watchdog script
cat > /opt/parking-watchdog.sh << 'EOF'
#!/bin/bash

# Watchdog script for parking system
# Monitors critical system components and services

HEALTH_URL="http://localhost:3000/health"
PRINTER_IP="192.168.1.100"
DB_CHECK_SCRIPT="/opt/test-db-connection.sh"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WATCHDOG: $1"
    systemd-notify --status="$1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WATCHDOG ERROR: $1" >&2
    systemd-notify --status="ERROR: $1"
}

# Send keepalive signal
notify_healthy() {
    systemd-notify WATCHDOG=1
}

# Main monitoring loop
while true; do
    ISSUES_FOUND=0
    
    # Check web application
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" --max-time 10 || echo "000")
    if [ "$HTTP_STATUS" != "200" ]; then
        error "Web application not responding (HTTP: $HTTP_STATUS)"
        ISSUES_FOUND=1
    fi
    
    # Check database
    if ! $DB_CHECK_SCRIPT >/dev/null 2>&1; then
        error "Database connection failed"
        ISSUES_FOUND=1
    fi
    
    # Check printer connectivity
    if ! ping -c 1 -W 3 "$PRINTER_IP" >/dev/null 2>&1; then
        error "Printer not reachable at $PRINTER_IP"
        ISSUES_FOUND=1
    fi
    
    # Check disk space
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        error "Critical disk space: ${DISK_USAGE}% used"
        ISSUES_FOUND=1
    fi
    
    # Check memory
    MEM_AVAILABLE=$(free -m | awk 'NR==2{print $7}')
    if [ "$MEM_AVAILABLE" -lt 100 ]; then
        error "Low memory: ${MEM_AVAILABLE}MB available"
        ISSUES_FOUND=1
    fi
    
    # Report status
    if [ "$ISSUES_FOUND" -eq 0 ]; then
        log "All systems operational"
        notify_healthy
    else
        error "$ISSUES_FOUND critical issues detected"
    fi
    
    # Wait 30 seconds before next check
    sleep 30
done
EOF

chmod +x /opt/parking-watchdog.sh

log "✓ Servicio watchdog creado"

# Reload systemd daemon
log "Recargando daemon systemd..."
systemctl daemon-reload

# Enable services
log "Habilitando servicios..."
systemctl enable parking-system.service
systemctl enable parking-backup.timer
systemctl enable parking-monitor.service
systemctl enable parking-log-cleanup.timer
systemctl enable parking-health-check.timer
systemctl enable parking-security-updates.timer
systemctl enable parking-watchdog.service

log "✓ Servicios habilitados"

# Start timers
log "Iniciando timers..."
systemctl start parking-backup.timer
systemctl start parking-log-cleanup.timer
systemctl start parking-health-check.timer
systemctl start parking-security-updates.timer

log "✓ Timers iniciados"

# Create service management script
log "Creando script de gestión de servicios..."
cat > /opt/parking-services.sh << 'EOF'
#!/bin/bash

# Service management script for parking system
# Provides easy management of all parking-related services

SERVICES=(
    "parking-system"
    "parking-monitor"
    "parking-watchdog"
)

TIMERS=(
    "parking-backup"
    "parking-log-cleanup"
    "parking-health-check"
    "parking-security-updates"
)

show_status() {
    echo "=== PARKING SYSTEM SERVICES STATUS ==="
    echo ""
    
    echo "MAIN SERVICES:"
    for service in "${SERVICES[@]}"; do
        status=$(systemctl is-active "$service")
        enabled=$(systemctl is-enabled "$service")
        printf "  %-20s: %s (%s)\n" "$service" "$status" "$enabled"
    done
    
    echo ""
    echo "TIMERS:"
    for timer in "${TIMERS[@]}"; do
        status=$(systemctl is-active "${timer}.timer")
        enabled=$(systemctl is-enabled "${timer}.timer")
        next_run=$(systemctl list-timers "${timer}.timer" --no-pager | awk 'NR==2 {print $1, $2}')
        printf "  %-20s: %s (%s) - Next: %s\n" "${timer}.timer" "$status" "$enabled" "$next_run"
    done
}

start_all() {
    echo "Starting all parking system services..."
    
    for service in "${SERVICES[@]}"; do
        echo "Starting $service..."
        systemctl start "$service"
    done
    
    for timer in "${TIMERS[@]}"; do
        echo "Starting ${timer}.timer..."
        systemctl start "${timer}.timer"
    done
    
    echo "All services started."
}

stop_all() {
    echo "Stopping all parking system services..."
    
    for service in "${SERVICES[@]}"; do
        echo "Stopping $service..."
        systemctl stop "$service"
    done
    
    for timer in "${TIMERS[@]}"; do
        echo "Stopping ${timer}.timer..."
        systemctl stop "${timer}.timer"
    done
    
    echo "All services stopped."
}

restart_main() {
    echo "Restarting main parking system service..."
    systemctl restart parking-system
    sleep 5
    systemctl status parking-system --no-pager
}

show_logs() {
    local service="${1:-parking-system}"
    echo "Showing logs for $service..."
    journalctl -u "$service" -f --no-pager
}

show_help() {
    echo "Parking System Service Management"
    echo "Usage: $0 {status|start|stop|restart|logs [service]|help}"
    echo ""
    echo "Commands:"
    echo "  status    - Show status of all services"
    echo "  start     - Start all services"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart main parking service"
    echo "  logs      - Show logs (optionally specify service)"
    echo "  help      - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 restart"
    echo "  $0 logs parking-system"
}

case "${1:-status}" in
    "status")
        show_status
        ;;
    "start")
        start_all
        ;;
    "stop")
        stop_all
        ;;
    "restart")
        restart_main
        ;;
    "logs")
        show_logs "${2:-parking-system}"
        ;;
    "help"|*)
        show_help
        ;;
esac
EOF

chmod +x /opt/parking-services.sh

# Create service override directory for customization
log "Creando directorios de configuración personalizada..."
mkdir -p /etc/systemd/system/parking-system.service.d
mkdir -p /etc/systemd/system/parking-monitor.service.d

# Create example override file
cat > /etc/systemd/system/parking-system.service.d/custom.conf.example << 'EOF'
# Example override configuration for parking-system service
# Rename to custom.conf to apply changes

[Service]
# Increase restart delay for problematic environments
# RestartSec=30

# Additional environment variables
# Environment=DEBUG_LEVEL=verbose

# Memory limits (uncomment if needed)
# MemoryLimit=1G
# MemoryAccounting=true

# CPU limits (uncomment if needed)
# CPUQuota=80%
# CPUAccounting=true
EOF

# Test services configuration
log "Probando configuración de servicios..."

# Validate service files
for service in parking-system parking-backup parking-monitor parking-log-cleanup parking-health-check parking-security-updates parking-watchdog; do
    if systemd-analyze verify "/etc/systemd/system/${service}.service" 2>/dev/null; then
        log "✓ Servicio ${service}.service válido"
    else
        warn "⚠ Verificar configuración de ${service}.service"
    fi
done

# Validate timer files
for timer in parking-backup parking-log-cleanup parking-health-check parking-security-updates; do
    if systemd-analyze verify "/etc/systemd/system/${timer}.timer" 2>/dev/null; then
        log "✓ Timer ${timer}.timer válido"
    else
        warn "⚠ Verificar configuración de ${timer}.timer"
    fi
done

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Servicios systemd configurados: $(date)
Servicio principal: parking-system.service
Servicios auxiliares: 6 servicios
Timers configurados: 4 timers
Gestión servicios: /opt/parking-services.sh
Watchdog: Configurado
Respaldos automáticos: Diarios
Monitoreo salud: Cada 5 minutos
Actualizaciones seguridad: Semanales
EOF

log "=== CONFIGURACIÓN SERVICIOS SYSTEMD COMPLETADA ==="
log "Servicios principales configurados:"
log "  - parking-system.service (aplicación principal)"
log "  - parking-monitor.service (monitoreo del sistema)"
log "  - parking-watchdog.service (watchdog crítico)"
log ""
log "Timers configurados:"
log "  - parking-backup.timer (respaldos diarios)"
log "  - parking-health-check.timer (verificación cada 5 min)"
log "  - parking-log-cleanup.timer (limpieza semanal)"
log "  - parking-security-updates.timer (actualizaciones semanales)"
log ""
log "Gestión de servicios: /opt/parking-services.sh"
log ""
log "Para iniciar el sistema completo:"
log "1. systemctl start parking-system"
log "2. /opt/parking-services.sh status"
log "3. Verificar: curl http://localhost/health"
log ""
log "Próximo paso: Ejecutar setup-backups.sh"

exit 0