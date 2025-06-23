#!/bin/bash
set -euo pipefail

# Script: Backup System Setup for Parking Management System
# Purpose: Configure comprehensive backup system for database, configuration, and logs
# Usage: sudo ./setup-backups.sh

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

log "=== CONFIGURACIÓN SISTEMA DE RESPALDOS ==="

# Configuration
BACKUP_ROOT="/opt/parking-backups"
BACKUP_DB_DIR="$BACKUP_ROOT/database"
BACKUP_CONFIG_DIR="$BACKUP_ROOT/config"
BACKUP_LOGS_DIR="$BACKUP_ROOT/logs"
BACKUP_SYSTEM_DIR="$BACKUP_ROOT/system"
REMOTE_BACKUP_DIR="/mnt/backup-parking"

# Create backup directories
log "Creando directorios de respaldo..."
mkdir -p "$BACKUP_DB_DIR"
mkdir -p "$BACKUP_CONFIG_DIR"
mkdir -p "$BACKUP_LOGS_DIR" 
mkdir -p "$BACKUP_SYSTEM_DIR"
mkdir -p "$BACKUP_ROOT/daily"
mkdir -p "$BACKUP_ROOT/weekly"
mkdir -p "$BACKUP_ROOT/monthly"
mkdir -p "$BACKUP_ROOT/archive"

# Set permissions
chown -R postgres:postgres "$BACKUP_DB_DIR"
chmod -R 750 "$BACKUP_DB_DIR"
chown -R root:root "$BACKUP_CONFIG_DIR" "$BACKUP_LOGS_DIR" "$BACKUP_SYSTEM_DIR"
chmod -R 750 "$BACKUP_CONFIG_DIR" "$BACKUP_LOGS_DIR" "$BACKUP_SYSTEM_DIR"

log "✓ Directorios de respaldo creados"

# Load database credentials
if [ -f "/opt/parking-db-credentials" ]; then
    source /opt/parking-db-credentials
    log "✓ Credenciales de base de datos cargadas"
else
    error "Credenciales de base de datos no encontradas"
    exit 1
fi

# Create main backup script
log "Creando script principal de respaldos..."
cat > /opt/parking-backup.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Main backup script for parking management system
# Supports database, configuration, logs, and system backups

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] BACKUP: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] BACKUP ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] BACKUP WARNING: $1${NC}"
}

# Configuration
BACKUP_ROOT="/opt/parking-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_TYPE="${1:-daily}"
TARGET_DIR="${2:-$BACKUP_ROOT/$BACKUP_TYPE}"

# Load database credentials
source /opt/parking-db-credentials

backup_database() {
    local backup_file="$TARGET_DIR/parking_db_$TIMESTAMP.sql"
    local backup_file_gz="$backup_file.gz"
    
    log "Iniciando respaldo de base de datos..."
    
    # Create database backup
    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h localhost \
        -U $DB_USER \
        -d $DB_NAME \
        --verbose \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists > "$backup_file"
    
    if [ $? -eq 0 ]; then
        # Compress backup
        gzip "$backup_file"
        
        # Verify backup
        if [ -f "$backup_file_gz" ] && [ -s "$backup_file_gz" ]; then
            log "✓ Respaldo de base de datos completado: $(basename $backup_file_gz)"
            
            # Get backup size
            local size=$(du -h "$backup_file_gz" | cut -f1)
            log "Tamaño del respaldo: $size"
            
            # Test backup integrity
            if gunzip -t "$backup_file_gz"; then
                log "✓ Integridad del respaldo verificada"
            else
                error "✗ Error en integridad del respaldo"
                return 1
            fi
        else
            error "✗ Error creando respaldo de base de datos"
            return 1
        fi
    else
        error "✗ Error ejecutando pg_dump"
        return 1
    fi
}

backup_configuration() {
    local config_backup="$TARGET_DIR/config_$TIMESTAMP.tar.gz"
    
    log "Iniciando respaldo de configuración..."
    
    # List of configuration files and directories
    local config_items=(
        "/opt/parking-system/.env"
        "/opt/parking-db-credentials"
        "/etc/nginx/sites-available/parking-system"
        "/etc/systemd/system/parking-*.service"
        "/etc/systemd/system/parking-*.timer"
        "/etc/fail2ban/jail.d/admin-protection.conf"
        "/etc/ssh/sshd_config"
        "/etc/ufw"
        "/opt/parking-system/package.json"
    )
    
    # Create temporary file list
    local file_list="/tmp/parking_config_files_$TIMESTAMP.txt"
    > "$file_list"
    
    for item in "${config_items[@]}"; do
        if [ -e "$item" ]; then
            echo "$item" >> "$file_list"
        fi
    done
    
    # Create archive
    if [ -s "$file_list" ]; then
        tar -czf "$config_backup" -T "$file_list" 2>/dev/null
        
        if [ $? -eq 0 ] && [ -f "$config_backup" ]; then
            log "✓ Respaldo de configuración completado: $(basename $config_backup)"
            local size=$(du -h "$config_backup" | cut -f1)
            log "Tamaño del respaldo: $size"
        else
            error "✗ Error creando respaldo de configuración"
            rm -f "$file_list"
            return 1
        fi
    else
        warn "⚠ No se encontraron archivos de configuración para respaldar"
    fi
    
    rm -f "$file_list"
}

backup_logs() {
    local logs_backup="$TARGET_DIR/logs_$TIMESTAMP.tar.gz"
    
    log "Iniciando respaldo de logs..."
    
    # Backup logs from last 7 days for daily backup, all for others
    local find_opts=""
    if [ "$BACKUP_TYPE" = "daily" ]; then
        find_opts="-mtime -7"
    fi
    
    # Create logs archive
    find /var/log/parking-system -name "*.log" $find_opts -print0 | \
        tar -czf "$logs_backup" --null -T - 2>/dev/null
    
    if [ $? -eq 0 ] && [ -f "$logs_backup" ]; then
        log "✓ Respaldo de logs completado: $(basename $logs_backup)"
        local size=$(du -h "$logs_backup" | cut -f1)
        log "Tamaño del respaldo: $size"
    else
        warn "⚠ No se encontraron logs para respaldar o error en creación"
    fi
}

backup_system_info() {
    local system_backup="$TARGET_DIR/system_info_$TIMESTAMP.tar.gz"
    local temp_dir="/tmp/parking_system_info_$TIMESTAMP"
    
    log "Iniciando respaldo de información del sistema..."
    
    mkdir -p "$temp_dir"
    
    # Collect system information
    {
        echo "=== PARKING SYSTEM BACKUP REPORT ==="
        echo "Generated: $(date)"
        echo "Hostname: $(hostname)"
        echo "IP Address: $(hostname -I)"
        echo "OS: $(lsb_release -d | cut -f2)"
        echo "Kernel: $(uname -r)"
        echo "Uptime: $(uptime)"
        echo ""
        
        echo "=== DISK USAGE ==="
        df -h
        echo ""
        
        echo "=== MEMORY USAGE ==="
        free -h
        echo ""
        
        echo "=== SERVICES STATUS ==="
        systemctl status parking-system --no-pager || true
        systemctl status postgresql --no-pager || true
        systemctl status nginx --no-pager || true
        echo ""
        
        echo "=== NETWORK STATUS ==="
        ip addr show
        echo ""
        
        echo "=== PARKING SYSTEM STATUS ==="
        if [ -f "/opt/parking-setup-status.txt" ]; then
            cat /opt/parking-setup-status.txt
        fi
        echo ""
        
        echo "=== DATABASE STATUS ==="
        sudo -u postgres psql -d $DB_NAME -c "SELECT COUNT(*) as total_tickets FROM tickets;" 2>/dev/null || echo "Database query failed"
        echo ""
        
    } > "$temp_dir/system_info.txt"
    
    # Copy important status files
    cp /opt/parking-setup-status.txt "$temp_dir/" 2>/dev/null || true
    cp /var/log/parking-system/*.log "$temp_dir/" 2>/dev/null || true
    
    # Create archive
    tar -czf "$system_backup" -C "/tmp" "parking_system_info_$TIMESTAMP" 2>/dev/null
    
    if [ $? -eq 0 ] && [ -f "$system_backup" ]; then
        log "✓ Respaldo de información del sistema completado: $(basename $system_backup)"
        local size=$(du -h "$system_backup" | cut -f1)
        log "Tamaño del respaldo: $size"
    else
        error "✗ Error creando respaldo de información del sistema"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
}

cleanup_old_backups() {
    log "Limpiando respaldos antiguos..."
    
    case "$BACKUP_TYPE" in
        "daily")
            # Keep last 7 daily backups
            find "$BACKUP_ROOT/daily" -name "*.gz" -mtime +7 -delete
            find "$BACKUP_ROOT/daily" -name "*.sql" -mtime +7 -delete
            log "✓ Respaldos diarios antiguos eliminados (>7 días)"
            ;;
        "weekly")
            # Keep last 4 weekly backups
            find "$BACKUP_ROOT/weekly" -name "*.gz" -mtime +28 -delete
            find "$BACKUP_ROOT/weekly" -name "*.sql" -mtime +28 -delete
            log "✓ Respaldos semanales antiguos eliminados (>28 días)"
            ;;
        "monthly")
            # Keep last 12 monthly backups
            find "$BACKUP_ROOT/monthly" -name "*.gz" -mtime +365 -delete
            find "$BACKUP_ROOT/monthly" -name "*.sql" -mtime +365 -delete
            log "✓ Respaldos mensuales antiguos eliminados (>365 días)"
            ;;
    esac
}

verify_backup_space() {
    local available_space=$(df "$BACKUP_ROOT" | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        error "Espacio insuficiente para respaldos: $(df -h "$BACKUP_ROOT" | awk 'NR==2 {print $4}') disponible"
        return 1
    fi
    
    log "✓ Espacio suficiente para respaldos: $(df -h "$BACKUP_ROOT" | awk 'NR==2 {print $4}') disponible"
}

# Main execution
main() {
    log "=== INICIANDO RESPALDO $BACKUP_TYPE ==="
    
    # Create target directory
    mkdir -p "$TARGET_DIR"
    
    # Verify backup space
    verify_backup_space || exit 1
    
    # Initialize counters
    local success_count=0
    local total_operations=4
    
    # Perform backups
    if backup_database; then
        ((success_count++))
    fi
    
    if backup_configuration; then
        ((success_count++))
    fi
    
    if backup_logs; then
        ((success_count++))
    fi
    
    if backup_system_info; then
        ((success_count++))
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Report results
    log "=== RESPALDO $BACKUP_TYPE COMPLETADO ==="
    log "Operaciones exitosas: $success_count/$total_operations"
    log "Directorio de respaldo: $TARGET_DIR"
    
    # Calculate total backup size
    if [ -d "$TARGET_DIR" ]; then
        local total_size=$(du -sh "$TARGET_DIR" | cut -f1)
        log "Tamaño total del respaldo: $total_size"
    fi
    
    # Write backup log entry
    echo "$(date): $BACKUP_TYPE backup completed - $success_count/$total_operations operations successful" >> /var/log/parking-system/backup-history.log
    
    if [ "$success_count" -eq "$total_operations" ]; then
        log "✓ Respaldo completado exitosamente"
        exit 0
    else
        error "✗ Respaldo completado con errores"
        exit 1
    fi
}

# Help function
show_help() {
    echo "Parking System Backup Script"
    echo "Usage: $0 [type] [target_directory]"
    echo ""
    echo "Types:"
    echo "  daily    - Daily backup (default)"
    echo "  weekly   - Weekly backup"
    echo "  monthly  - Monthly backup"
    echo "  full     - Full backup"
    echo ""
    echo "Examples:"
    echo "  $0 daily"
    echo "  $0 weekly /external/backup"
    echo "  $0 full /mnt/backup"
}

# Execute based on parameters
case "${1:-daily}" in
    "daily"|"weekly"|"monthly"|"full")
        main
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        error "Tipo de respaldo inválido: $1"
        show_help
        exit 1
        ;;
esac
EOF

chmod +x /opt/parking-backup.sh

log "✓ Script principal de respaldos creado"

# Create restore script
log "Creando script de restauración..."
cat > /opt/parking-restore.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Restore script for parking management system
# Supports database and configuration restoration

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] RESTORE: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] RESTORE ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] RESTORE WARNING: $1${NC}"
}

BACKUP_ROOT="/opt/parking-backups"
BACKUP_FILE="$1"

# Load database credentials
source /opt/parking-db-credentials

restore_database() {
    local backup_file="$1"
    
    log "Iniciando restauración de base de datos..."
    
    # Verify backup file exists
    if [ ! -f "$backup_file" ]; then
        error "Archivo de respaldo no encontrado: $backup_file"
        return 1
    fi
    
    # Check if file is compressed
    local restore_cmd=""
    if [[ "$backup_file" == *.gz ]]; then
        restore_cmd="gunzip -c '$backup_file'"
    else
        restore_cmd="cat '$backup_file'"
    fi
    
    warn "⚠ ADVERTENCIA: Esta operación eliminará todos los datos actuales"
    warn "¿Está seguro que desea continuar? (escriba 'CONFIRMAR' para continuar)"
    read -r confirmation
    
    if [ "$confirmation" != "CONFIRMAR" ]; then
        log "Restauración cancelada por el usuario"
        return 1
    fi
    
    # Stop parking system service
    log "Deteniendo servicio de estacionamiento..."
    systemctl stop parking-system || true
    
    # Create backup of current database
    local current_backup="/tmp/current_db_backup_$(date +%Y%m%d_%H%M%S).sql"
    log "Creando respaldo de seguridad de la base actual..."
    PGPASSWORD=$DB_PASSWORD pg_dump \
        -h localhost \
        -U $DB_USER \
        -d $DB_NAME > "$current_backup"
    
    # Restore database
    log "Restaurando base de datos desde: $(basename $backup_file)"
    eval "$restore_cmd" | PGPASSWORD=$DB_PASSWORD psql \
        -h localhost \
        -U $DB_USER \
        -d $DB_NAME \
        -v ON_ERROR_STOP=1
    
    if [ $? -eq 0 ]; then
        log "✓ Base de datos restaurada exitosamente"
        log "Respaldo de seguridad guardado en: $current_backup"
        
        # Restart parking system
        log "Reiniciando servicio de estacionamiento..."
        systemctl start parking-system
        
        # Wait for service to be ready
        sleep 10
        
        # Test database connection
        if /opt/test-db-connection.sh; then
            log "✓ Conexión a base de datos verificada"
        else
            error "✗ Error verificando conexión a base de datos"
        fi
    else
        error "✗ Error restaurando base de datos"
        log "Restaurando base de datos desde respaldo de seguridad..."
        PGPASSWORD=$DB_PASSWORD psql \
            -h localhost \
            -U $DB_USER \
            -d $DB_NAME < "$current_backup"
        systemctl start parking-system
        return 1
    fi
}

list_backups() {
    log "=== RESPALDOS DISPONIBLES ==="
    echo ""
    
    for backup_type in daily weekly monthly; do
        local backup_dir="$BACKUP_ROOT/$backup_type"
        if [ -d "$backup_dir" ] && [ "$(ls -A $backup_dir)" ]; then
            echo "RESPALDOS $backup_type:"
            ls -lah "$backup_dir"/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ", " $6 " " $7 ")"}'
            echo ""
        fi
    done
    
    echo "Para restaurar, use: $0 <archivo_respaldo>"
}

show_help() {
    echo "Parking System Restore Script"
    echo "Usage: $0 [backup_file|list]"
    echo ""
    echo "Commands:"
    echo "  list            - List available backups"
    echo "  <backup_file>   - Restore from specific backup file"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 /opt/parking-backups/daily/parking_db_20240315_120000.sql.gz"
}

# Main execution
case "${1:-help}" in
    "list")
        list_backups
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        if [ -n "${1:-}" ]; then
            restore_database "$1"
        else
            show_help
        fi
        ;;
esac
EOF

chmod +x /opt/parking-restore.sh

log "✓ Script de restauración creado"

# Create backup monitoring script
log "Creando script de monitoreo de respaldos..."
cat > /opt/backup-monitor.sh << 'EOF'
#!/bin/bash

# Backup monitoring script for parking system
# Monitors backup health and sends alerts

LOG_FILE="/var/log/parking-system/backup-monitor.log"
BACKUP_ROOT="/opt/parking-backups"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a $LOG_FILE
    logger -p local0.err "PARKING-BACKUP: $1"
}

warn() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" | tee -a $LOG_FILE
    logger -p local0.warn "PARKING-BACKUP: $1"
}

check_backup_age() {
    local backup_type="$1"
    local max_age_hours="$2"
    local backup_dir="$BACKUP_ROOT/$backup_type"
    
    if [ ! -d "$backup_dir" ]; then
        error "Directorio de respaldo no encontrado: $backup_dir"
        return 1
    fi
    
    # Find most recent backup
    local latest_backup=$(find "$backup_dir" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -z "$latest_backup" ]; then
        error "No se encontraron respaldos $backup_type"
        return 1
    fi
    
    # Check age
    local backup_age=$(find "$latest_backup" -mmin +$((max_age_hours * 60)) | wc -l)
    
    if [ "$backup_age" -gt 0 ]; then
        error "Respaldo $backup_type demasiado antiguo: $(basename $latest_backup)"
        return 1
    else
        log "✓ Respaldo $backup_type reciente: $(basename $latest_backup)"
        return 0
    fi
}

check_backup_size() {
    local backup_type="$1"
    local min_size_mb="$2"
    local backup_dir="$BACKUP_ROOT/$backup_type"
    
    # Find most recent backup
    local latest_backup=$(find "$backup_dir" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -n "$latest_backup" ]; then
        local backup_size_mb=$(du -m "$latest_backup" | cut -f1)
        
        if [ "$backup_size_mb" -lt "$min_size_mb" ]; then
            warn "Respaldo $backup_type muy pequeño: ${backup_size_mb}MB (mínimo: ${min_size_mb}MB)"
            return 1
        else
            log "✓ Tamaño de respaldo $backup_type OK: ${backup_size_mb}MB"
            return 0
        fi
    fi
    
    return 1
}

check_disk_space() {
    local available_gb=$(df "$BACKUP_ROOT" | awk 'NR==2 {print int($4/1024/1024)}')
    local min_space_gb=5
    
    if [ "$available_gb" -lt "$min_space_gb" ]; then
        error "Espacio en disco bajo para respaldos: ${available_gb}GB disponible"
        return 1
    else
        log "✓ Espacio en disco OK: ${available_gb}GB disponible"
        return 0
    fi
}

# Main monitoring checks
log "=== MONITOREO DE RESPALDOS ==="

issues_found=0

# Check daily backup (should be less than 25 hours old)
if ! check_backup_age "daily" 25; then
    ((issues_found++))
fi

# Check weekly backup (should be less than 8 days old)
if ! check_backup_age "weekly" 192; then
    ((issues_found++))
fi

# Check backup sizes (minimum 1MB for database backups)
if ! check_backup_size "daily" 1; then
    ((issues_found++))
fi

# Check disk space
if ! check_disk_space; then
    ((issues_found++))
fi

# Report summary
if [ "$issues_found" -eq 0 ]; then
    log "✓ Todos los respaldos están saludables"
else
    error "$issues_found problemas encontrados en el sistema de respaldos"
fi

log "=== MONITOREO COMPLETADO ==="
EOF

chmod +x /opt/backup-monitor.sh

log "✓ Script de monitoreo de respaldos creado"

# Configure backup cron jobs
log "Configurando trabajos cron para respaldos..."

# Daily backup at 2:00 AM
cat > /etc/cron.d/parking-backup-daily << 'EOF'
# Daily backup for parking system at 2:00 AM
0 2 * * * postgres /opt/parking-backup.sh daily >> /var/log/parking-system/backup-daily.log 2>&1
EOF

# Weekly backup on Sundays at 3:00 AM
cat > /etc/cron.d/parking-backup-weekly << 'EOF'
# Weekly backup for parking system on Sundays at 3:00 AM
0 3 * * 0 postgres /opt/parking-backup.sh weekly >> /var/log/parking-system/backup-weekly.log 2>&1
EOF

# Monthly backup on the 1st at 4:00 AM
cat > /etc/cron.d/parking-backup-monthly << 'EOF'
# Monthly backup for parking system on 1st of month at 4:00 AM
0 4 1 * * postgres /opt/parking-backup.sh monthly >> /var/log/parking-system/backup-monthly.log 2>&1
EOF

# Backup monitoring every 6 hours
cat > /etc/cron.d/parking-backup-monitor << 'EOF'
# Monitor backup health every 6 hours
0 */6 * * * root /opt/backup-monitor.sh
EOF

log "✓ Trabajos cron configurados"

# Create backup management script
log "Creando script de gestión de respaldos..."
cat > /opt/backup-manager.sh << 'EOF'
#!/bin/bash

# Backup management script for parking system
# Provides easy backup management functionality

show_status() {
    echo "=== ESTADO DEL SISTEMA DE RESPALDOS ==="
    echo ""
    
    # Disk usage
    echo "ESPACIO EN DISCO:"
    df -h /opt/parking-backups
    echo ""
    
    # Recent backups
    echo "RESPALDOS RECIENTES:"
    for type in daily weekly monthly; do
        local dir="/opt/parking-backups/$type"
        if [ -d "$dir" ]; then
            local latest=$(find "$dir" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
            if [ -n "$latest" ]; then
                local size=$(du -h "$latest" | cut -f1)
                local date=$(stat -c %y "$latest" | cut -d' ' -f1)
                echo "  $type: $(basename $latest) ($size, $date)"
            else
                echo "  $type: No backups found"
            fi
        fi
    done
    echo ""
    
    # Cron jobs status
    echo "TRABAJOS PROGRAMADOS:"
    echo "  Daily: $(crontab -l -u postgres 2>/dev/null | grep parking-backup | grep daily || echo 'Not configured')"
    echo "  Weekly: $(crontab -l -u postgres 2>/dev/null | grep parking-backup | grep weekly || echo 'Not configured')"
    echo "  Monthly: $(crontab -l -u postgres 2>/dev/null | grep parking-backup | grep monthly || echo 'Not configured')"
}

create_backup() {
    local type="${1:-daily}"
    echo "Creando respaldo $type..."
    /opt/parking-backup.sh "$type"
}

list_backups() {
    /opt/parking-restore.sh list
}

restore_backup() {
    local backup_file="$1"
    if [ -z "$backup_file" ]; then
        echo "ERROR: Especifique el archivo de respaldo"
        list_backups
        return 1
    fi
    
    /opt/parking-restore.sh "$backup_file"
}

cleanup_old() {
    echo "Limpiando respaldos antiguos..."
    
    # Daily backups older than 7 days
    find /opt/parking-backups/daily -name "*.gz" -mtime +7 -delete
    echo "✓ Respaldos diarios > 7 días eliminados"
    
    # Weekly backups older than 28 days  
    find /opt/parking-backups/weekly -name "*.gz" -mtime +28 -delete
    echo "✓ Respaldos semanales > 28 días eliminados"
    
    # Monthly backups older than 365 days
    find /opt/parking-backups/monthly -name "*.gz" -mtime +365 -delete
    echo "✓ Respaldos mensuales > 365 días eliminados"
}

show_help() {
    echo "Parking System Backup Manager"
    echo "Usage: $0 {status|backup|list|restore|cleanup|help}"
    echo ""
    echo "Commands:"
    echo "  status              - Show backup system status"
    echo "  backup [type]       - Create backup (daily/weekly/monthly)"
    echo "  list                - List available backups"
    echo "  restore <file>      - Restore from backup file"
    echo "  cleanup             - Clean old backups"
    echo "  help                - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 backup daily"
    echo "  $0 restore /opt/parking-backups/daily/backup.sql.gz"
}

case "${1:-status}" in
    "status")
        show_status
        ;;
    "backup")
        create_backup "${2:-daily}"
        ;;
    "list")
        list_backups
        ;;
    "restore")
        restore_backup "$2"
        ;;
    "cleanup")
        cleanup_old
        ;;
    "help"|*)
        show_help
        ;;
esac
EOF

chmod +x /opt/backup-manager.sh

log "✓ Script de gestión de respaldos creado"

# Test backup system
log "Probando sistema de respaldos..."

# Create initial backup to test
if /opt/parking-backup.sh daily /tmp/test-backup-$(date +%Y%m%d); then
    log "✓ Prueba de respaldo exitosa"
    rm -rf /tmp/test-backup-*
else
    warn "⚠ Verificar configuración de respaldos"
fi

# Test backup space
if df "$BACKUP_ROOT" | awk 'NR==2 {exit ($4 < 1048576) ? 1 : 0}'; then
    log "✓ Espacio suficiente para respaldos"
else
    warn "⚠ Espacio en disco bajo para respaldos"
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Sistema de respaldos configurado: $(date)
Directorio respaldos: $BACKUP_ROOT
Respaldo diario: 2:00 AM
Respaldo semanal: Domingos 3:00 AM
Respaldo mensual: Día 1 4:00 AM
Monitoreo: Cada 6 horas
Script gestión: /opt/backup-manager.sh
Script restauración: /opt/parking-restore.sh
Retención diaria: 7 días
Retención semanal: 28 días
Retención mensual: 365 días
EOF

log "=== CONFIGURACIÓN SISTEMA DE RESPALDOS COMPLETADA ==="
log "Directorio de respaldos: $BACKUP_ROOT"
log "Script principal: /opt/parking-backup.sh"
log "Script de restauración: /opt/parking-restore.sh"
log "Gestión de respaldos: /opt/backup-manager.sh"
log ""
log "Programación de respaldos:"
log "  - Diario: 2:00 AM (retención 7 días)"
log "  - Semanal: Domingos 3:00 AM (retención 28 días)"
log "  - Mensual: Día 1 4:00 AM (retención 365 días)"
log "  - Monitoreo: Cada 6 horas"
log ""
log "Para gestionar respaldos:"
log "  /opt/backup-manager.sh status"
log "  /opt/backup-manager.sh backup daily"
log "  /opt/backup-manager.sh list"
log ""
log "Próximo paso: Ejecutar daily-maintenance.sh"

exit 0