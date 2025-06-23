#!/bin/bash
set -euo pipefail

# Script: Daily Maintenance for Parking Management System
# Purpose: Perform daily maintenance tasks including cleanup, optimization, and health checks
# Usage: sudo ./daily-maintenance.sh

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

# Configuration
MAINTENANCE_LOG="/var/log/parking-system/maintenance.log"
TEMP_DIR="/tmp/parking-maintenance-$(date +%Y%m%d)"
REPORT_FILE="/var/log/parking-system/maintenance-report-$(date +%Y%m%d).txt"

# Initialize logging
exec > >(tee -a "$MAINTENANCE_LOG") 2>&1

log "=== MANTENIMIENTO DIARIO SISTEMA DE ESTACIONAMIENTO ==="

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Load database credentials
if [ -f "/opt/parking-db-credentials" ]; then
    source /opt/parking-db-credentials
else
    error "Credenciales de base de datos no encontradas"
    exit 1
fi

# Initialize maintenance report
cat > "$REPORT_FILE" << EOF
REPORTE DE MANTENIMIENTO DIARIO
==============================
Fecha: $(date)
Sistema: $(hostname)
IP: $(hostname -I | awk '{print $1}')

EOF

# Function: Database maintenance
database_maintenance() {
    log "Iniciando mantenimiento de base de datos..."
    
    {
        echo "MANTENIMIENTO BASE DE DATOS"
        echo "=========================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Database statistics before maintenance
    local tables_before=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    local db_size_before=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs)
    
    {
        echo "Estado inicial:"
        echo "  Tablas: $tables_before"
        echo "  Tamaño BD: $db_size_before"
        echo ""
    } >> "$REPORT_FILE"
    
    # Vacuum and analyze all tables
    log "Ejecutando VACUUM ANALYZE..."
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;" >> "$TEMP_DIR/vacuum.log" 2>&1
    
    if [ $? -eq 0 ]; then
        log "✓ VACUUM ANALYZE completado"
        echo "✓ VACUUM ANALYZE: Exitoso" >> "$REPORT_FILE"
    else
        error "✗ Error en VACUUM ANALYZE"
        echo "✗ VACUUM ANALYZE: Error" >> "$REPORT_FILE"
    fi
    
    # Update table statistics
    log "Actualizando estadísticas de tablas..."
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "ANALYZE;" >> "$TEMP_DIR/analyze.log" 2>&1
    
    # Reindex critical tables
    log "Reindexando tablas críticas..."
    local critical_tables=("tickets" "transactions" "pension_customers")
    
    for table in "${critical_tables[@]}"; do
        PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "REINDEX TABLE $table;" >> "$TEMP_DIR/reindex.log" 2>&1
        if [ $? -eq 0 ]; then
            log "✓ Tabla $table reindexada"
        else
            warn "⚠ Error reindexando tabla $table"
        fi
    done
    
    # Database statistics after maintenance
    local db_size_after=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs)
    
    {
        echo "Estado final:"
        echo "  Tamaño BD: $db_size_after"
        echo ""
    } >> "$REPORT_FILE"
    
    log "✓ Mantenimiento de base de datos completado"
}

# Function: Log cleanup
log_cleanup() {
    log "Iniciando limpieza de logs..."
    
    {
        echo "LIMPIEZA DE LOGS"
        echo "==============="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Calculate log sizes before cleanup
    local total_logs_before=$(du -sh /var/log/parking-system 2>/dev/null | cut -f1 || echo "0")
    local system_logs_before=$(du -sh /var/log/*.log 2>/dev/null | awk '{sum+=$1} END {print sum"K"}' || echo "0")
    
    {
        echo "Tamaño inicial:"
        echo "  Logs parking: $total_logs_before"
        echo "  Logs sistema: $system_logs_before"
        echo ""
    } >> "$REPORT_FILE"
    
    # Clean parking system logs older than 30 days
    local deleted_parking=0
    while IFS= read -r -d '' file; do
        rm "$file"
        ((deleted_parking++))
    done < <(find /var/log/parking-system -name "*.log" -mtime +30 -print0 2>/dev/null)
    
    # Compress logs older than 7 days
    local compressed=0
    while IFS= read -r -d '' file; do
        gzip "$file"
        ((compressed++))
    done < <(find /var/log/parking-system -name "*.log" -mtime +7 -print0 2>/dev/null)
    
    # Clean system logs (rotate large files)
    local rotated=0
    for logfile in /var/log/syslog /var/log/auth.log /var/log/kern.log; do
        if [ -f "$logfile" ] && [ $(stat -c%s "$logfile") -gt 104857600 ]; then # 100MB
            logrotate -f /etc/logrotate.d/rsyslog
            ((rotated++))
        fi
    done
    
    # Calculate log sizes after cleanup
    local total_logs_after=$(du -sh /var/log/parking-system 2>/dev/null | cut -f1 || echo "0")
    
    {
        echo "Limpieza realizada:"
        echo "  Logs eliminados: $deleted_parking archivos"
        echo "  Logs comprimidos: $compressed archivos"
        echo "  Logs rotados: $rotated archivos"
        echo ""
        echo "Tamaño final:"
        echo "  Logs parking: $total_logs_after"
        echo ""
    } >> "$REPORT_FILE"
    
    log "✓ Limpieza de logs completada"
}

# Function: Temporary files cleanup
temp_cleanup() {
    log "Iniciando limpieza de archivos temporales..."
    
    {
        echo "LIMPIEZA ARCHIVOS TEMPORALES"
        echo "==========================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Clean /tmp files older than 7 days
    local temp_deleted=0
    while IFS= read -r -d '' file; do
        rm -rf "$file"
        ((temp_deleted++))
    done < <(find /tmp -name "parking-*" -mtime +7 -print0 2>/dev/null)
    
    # Clean application temp files
    local app_temp_deleted=0
    if [ -d "/opt/parking-system/temp" ]; then
        while IFS= read -r -d '' file; do
            rm -rf "$file"
            ((app_temp_deleted++))
        done < <(find /opt/parking-system/temp -type f -mtime +1 -print0 2>/dev/null)
    fi
    
    # Clean npm cache if exists
    if [ -d "/home/parking/.npm" ]; then
        sudo -u parking npm cache clean --force >> "$TEMP_DIR/npm-clean.log" 2>&1
    fi
    
    {
        echo "Archivos temporales eliminados:"
        echo "  /tmp: $temp_deleted archivos"
        echo "  App temp: $app_temp_deleted archivos"
        echo "  NPM cache: Limpiado"
        echo ""
    } >> "$REPORT_FILE"
    
    log "✓ Limpieza de archivos temporales completada"
}

# Function: System optimization
system_optimization() {
    log "Iniciando optimización del sistema..."
    
    {
        echo "OPTIMIZACIÓN DEL SISTEMA"
        echo "======================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Clear system caches
    log "Limpiando cachés del sistema..."
    echo 3 > /proc/sys/vm/drop_caches
    
    # Update locate database
    log "Actualizando base de datos locate..."
    updatedb >> "$TEMP_DIR/updatedb.log" 2>&1
    
    # Clean package cache
    log "Limpiando caché de paquetes..."
    apt-get autoremove -y >> "$TEMP_DIR/apt-autoremove.log" 2>&1
    apt-get autoclean >> "$TEMP_DIR/apt-autoclean.log" 2>&1
    
    # Optimize systemd journal
    log "Optimizando journal de systemd..."
    journalctl --vacuum-time=30d >> "$TEMP_DIR/journal-vacuum.log" 2>&1
    
    {
        echo "Optimización realizada:"
        echo "✓ Cachés del sistema limpiados"
        echo "✓ Base datos locate actualizada"
        echo "✓ Caché paquetes limpiado"
        echo "✓ Journal systemd optimizado"
        echo ""
    } >> "$REPORT_FILE"
    
    log "✓ Optimización del sistema completada"
}

# Function: Security checks
security_checks() {
    log "Iniciando verificaciones de seguridad..."
    
    {
        echo "VERIFICACIONES DE SEGURIDAD"
        echo "=========================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    local security_issues=0
    
    # Check firewall status
    if ufw status | grep -q "Status: active"; then
        echo "✓ Firewall: Activo" >> "$REPORT_FILE"
    else
        echo "✗ Firewall: Inactivo" >> "$REPORT_FILE"
        ((security_issues++))
    fi
    
    # Check SSH configuration
    if sshd -t 2>/dev/null; then
        echo "✓ SSH: Configuración válida" >> "$REPORT_FILE"
    else
        echo "✗ SSH: Error en configuración" >> "$REPORT_FILE"
        ((security_issues++))
    fi
    
    # Check fail2ban
    if systemctl is-active --quiet fail2ban; then
        echo "✓ Fail2Ban: Activo" >> "$REPORT_FILE"
    else
        echo "✗ Fail2Ban: Inactivo" >> "$REPORT_FILE"
        ((security_issues++))
    fi
    
    # Check file permissions on critical files
    local perm_issues=0
    local critical_files=(
        "/opt/parking-db-credentials:600"
        "/etc/ssh/sshd_config:644"
        "/opt/parking-system/.env:600"
    )
    
    for item in "${critical_files[@]}"; do
        IFS=':' read -r file expected_perm <<< "$item"
        if [ -f "$file" ]; then
            local actual_perm=$(stat -c %a "$file")
            if [ "$actual_perm" != "$expected_perm" ]; then
                echo "⚠ Permisos incorrectos: $file ($actual_perm, esperado: $expected_perm)" >> "$REPORT_FILE"
                ((perm_issues++))
            fi
        fi
    done
    
    if [ "$perm_issues" -eq 0 ]; then
        echo "✓ Permisos de archivos: Correctos" >> "$REPORT_FILE"
    else
        echo "⚠ Permisos de archivos: $perm_issues problemas" >> "$REPORT_FILE"
        ((security_issues++))
    fi
    
    # Check for suspicious processes
    local suspicious_procs=$(ps aux | grep -E "(nc|netcat|telnet|nmap)" | grep -v grep | wc -l)
    if [ "$suspicious_procs" -eq 0 ]; then
        echo "✓ Procesos: Sin actividad sospechosa" >> "$REPORT_FILE"
    else
        echo "⚠ Procesos: $suspicious_procs procesos sospechosos detectados" >> "$REPORT_FILE"
        ((security_issues++))
    fi
    
    {
        echo ""
        echo "Resumen seguridad: $security_issues problemas encontrados"
        echo ""
    } >> "$REPORT_FILE"
    
    if [ "$security_issues" -eq 0 ]; then
        log "✓ Verificaciones de seguridad completadas sin problemas"
    else
        warn "⚠ $security_issues problemas de seguridad encontrados"
    fi
}

# Function: Hardware checks
hardware_checks() {
    log "Iniciando verificaciones de hardware..."
    
    {
        echo "VERIFICACIONES DE HARDWARE"
        echo "========================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Check printer connectivity
    if ping -c 3 192.168.1.100 >/dev/null 2>&1; then
        echo "✓ Impresora: Conectada (192.168.1.100)" >> "$REPORT_FILE"
    else
        echo "✗ Impresora: No responde" >> "$REPORT_FILE"
    fi
    
    # Check scanner
    if lsusb | grep -q "0c2e:0b61"; then
        echo "✓ Escáner: Detectado" >> "$REPORT_FILE"
    else
        echo "⚠ Escáner: No detectado" >> "$REPORT_FILE"
    fi
    
    # Check disk health
    local disk_errors=$(dmesg | grep -i "error\|fail" | grep -i "disk\|ata\|scsi" | wc -l)
    if [ "$disk_errors" -eq 0 ]; then
        echo "✓ Disco: Sin errores" >> "$REPORT_FILE"
    else
        echo "⚠ Disco: $disk_errors errores en dmesg" >> "$REPORT_FILE"
    fi
    
    # Check temperature (if available)
    if command -v sensors >/dev/null 2>&1; then
        local max_temp=$(sensors | grep -E "Core|temp" | grep -o "[0-9]*\.[0-9]*°C" | grep -o "[0-9]*\.[0-9]*" | sort -n | tail -1)
        if [ -n "$max_temp" ] && (( $(echo "$max_temp > 80" | bc -l) )); then
            echo "⚠ Temperatura: ${max_temp}°C (alta)" >> "$REPORT_FILE"
        else
            echo "✓ Temperatura: ${max_temp:-N/A}°C" >> "$REPORT_FILE"
        fi
    else
        echo "ℹ Temperatura: Sensores no disponibles" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    
    log "✓ Verificaciones de hardware completadas"
}

# Function: Service health checks
service_health_checks() {
    log "Iniciando verificaciones de servicios..."
    
    {
        echo "VERIFICACIONES DE SERVICIOS"
        echo "=========================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # Critical services to check
    local services=(
        "parking-system"
        "postgresql"
        "nginx"
        "ssh"
        "ufw"
        "fail2ban"
    )
    
    local service_issues=0
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service"; then
            local status="Activo"
            local uptime=$(systemctl show "$service" --property=ActiveEnterTimestamp --value)
            echo "✓ $service: $status" >> "$REPORT_FILE"
        else
            echo "✗ $service: Inactivo" >> "$REPORT_FILE"
            ((service_issues++))
        fi
    done
    
    # Check parking system health endpoint
    local health_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" --max-time 10 || echo "000")
    if [ "$health_status" = "200" ]; then
        echo "✓ Parking API: Respondiendo ($health_status)" >> "$REPORT_FILE"
    else
        echo "✗ Parking API: No responde ($health_status)" >> "$REPORT_FILE"
        ((service_issues++))
    fi
    
    {
        echo ""
        echo "Resumen servicios: $service_issues problemas encontrados"
        echo ""
    } >> "$REPORT_FILE"
    
    if [ "$service_issues" -eq 0 ]; then
        log "✓ Todos los servicios funcionando correctamente"
    else
        warn "⚠ $service_issues problemas de servicios encontrados"
    fi
}

# Function: System resource monitoring
resource_monitoring() {
    log "Iniciando monitoreo de recursos..."
    
    {
        echo "MONITOREO DE RECURSOS"
        echo "===================="
        echo "Fecha: $(date)"
        echo ""
    } >> "$REPORT_FILE"
    
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    echo "CPU: ${cpu_usage}% utilización" >> "$REPORT_FILE"
    
    # Memory usage
    local mem_info=$(free -h | awk 'NR==2{printf "Total: %s, Usado: %s, Libre: %s, Porcentaje: %.0f%%", $2, $3, $4, $3*100/$2}')
    echo "Memoria: $mem_info" >> "$REPORT_FILE"
    
    # Disk usage
    echo "Almacenamiento:" >> "$REPORT_FILE"
    df -h | grep -E "^/dev" | awk '{printf "  %s: %s usado de %s (%s)\n", $6, $3, $2, $5}' >> "$REPORT_FILE"
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo "Carga promedio:$load_avg" >> "$REPORT_FILE"
    
    # Network connections
    local connections=$(ss -tuln | wc -l)
    echo "Conexiones de red: $connections" >> "$REPORT_FILE"
    
    # Check for resource alerts
    local alerts=0
    
    # High CPU alert
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo "⚠ ALERTA: CPU usage alto (${cpu_usage}%)" >> "$REPORT_FILE"
        ((alerts++))
    fi
    
    # High memory alert
    local mem_percent=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$mem_percent" -gt 85 ]; then
        echo "⚠ ALERTA: Memoria alta (${mem_percent}%)" >> "$REPORT_FILE"
        ((alerts++))
    fi
    
    # High disk usage alert
    local disk_percent=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$disk_percent" -gt 85 ]; then
        echo "⚠ ALERTA: Disco lleno (${disk_percent}%)" >> "$REPORT_FILE"
        ((alerts++))
    fi
    
    {
        echo ""
        echo "Alertas de recursos: $alerts"
        echo ""
    } >> "$REPORT_FILE"
    
    log "✓ Monitoreo de recursos completado"
}

# Function: Generate maintenance summary
generate_summary() {
    log "Generando resumen de mantenimiento..."
    
    {
        echo "RESUMEN DE MANTENIMIENTO"
        echo "======================="
        echo "Fecha: $(date)"
        echo "Duración: $((SECONDS / 60)) minutos"
        echo ""
        echo "Tareas completadas:"
        echo "✓ Mantenimiento de base de datos"
        echo "✓ Limpieza de logs"
        echo "✓ Limpieza de archivos temporales"
        echo "✓ Optimización del sistema"
        echo "✓ Verificaciones de seguridad"
        echo "✓ Verificaciones de hardware"
        echo "✓ Verificaciones de servicios"
        echo "✓ Monitoreo de recursos"
        echo ""
        echo "Reporte completo disponible en: $REPORT_FILE"
        echo ""
    } >> "$REPORT_FILE"
    
    # Send summary to syslog
    logger -p local0.info "PARKING-MAINTENANCE: Daily maintenance completed in $((SECONDS / 60)) minutes"
    
    log "✓ Resumen de mantenimiento generado"
}

# Main execution
main() {
    local start_time=$SECONDS
    
    log "Iniciando mantenimiento diario..."
    
    # Execute maintenance tasks
    database_maintenance
    log_cleanup
    temp_cleanup
    system_optimization
    security_checks
    hardware_checks
    service_health_checks
    resource_monitoring
    generate_summary
    
    # Cleanup temporary directory
    rm -rf "$TEMP_DIR"
    
    local duration=$((SECONDS - start_time))
    log "=== MANTENIMIENTO DIARIO COMPLETADO EN $((duration / 60)) MINUTOS ==="
    
    # Final status
    echo "Mantenimiento completado exitosamente en $((duration / 60)) minutos" >> "$REPORT_FILE"
    
    # Compress older reports
    find /var/log/parking-system -name "maintenance-report-*.txt" -mtime +7 -exec gzip {} \;
    
    exit 0
}

# Execute maintenance
main