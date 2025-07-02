#!/bin/bash

# Improved Ubuntu Deployment Script for Parking Management System
# This script orchestrates a safer deployment with better error handling

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warn() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/parking-ubuntu-deployment-$(date +%Y%m%d_%H%M%S).log"
CHECKPOINT_FILE="/opt/parking-deployment-checkpoint.txt"

# Check root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

# Redirect output to log file
exec > >(tee -a "$LOG_FILE")
exec 2>&1

log "=== INSTALACIÓN MEJORADA PARA UBUNTU - SISTEMA DE ESTACIONAMIENTO ==="
log "Script directory: $SCRIPT_DIR"
log "Log file: $LOG_FILE"

# Function to save checkpoint
save_checkpoint() {
    echo "$1" > "$CHECKPOINT_FILE"
    log "Checkpoint guardado: $1"
}

# Function to read checkpoint
read_checkpoint() {
    if [ -f "$CHECKPOINT_FILE" ]; then
        cat "$CHECKPOINT_FILE"
    else
        echo ""
    fi
}

# Function to run a phase with error handling
run_phase() {
    local phase_name="$1"
    local script_path="$2"
    local critical="${3:-true}"  # Default to critical
    
    log ""
    log "=== EJECUTANDO FASE: $phase_name ==="
    
    if [ -x "$script_path" ]; then
        if $script_path; then
            log "✓ Fase completada: $phase_name"
            save_checkpoint "$phase_name"
            return 0
        else
            error "✗ Fase falló: $phase_name"
            if [ "$critical" == "true" ]; then
                error "Esta es una fase crítica. Deteniendo instalación."
                show_recovery_options "$phase_name"
                exit 1
            else
                warn "Fase no crítica falló, continuando..."
                return 1
            fi
        fi
    else
        error "Script no encontrado o no ejecutable: $script_path"
        return 1
    fi
}

# Function to show recovery options
show_recovery_options() {
    local failed_phase="$1"
    
    echo ""
    echo "OPCIONES DE RECUPERACIÓN:"
    echo "========================"
    echo "1. Revisar el log: $LOG_FILE"
    echo "2. Ejecutar el troubleshooting guide: $SCRIPT_DIR/UBUNTU_DEPLOYMENT_GUIDE.md"
    echo "3. Continuar desde este punto: $0 --continue"
    echo "4. Reiniciar instalación: $0 --clean"
    echo ""
}

# Function to run preflight checks
run_preflight_checks() {
    log "Ejecutando verificaciones previas..."
    
    if [ -f "$SCRIPT_DIR/preflight-check-ubuntu.sh" ]; then
        if ! "$SCRIPT_DIR/preflight-check-ubuntu.sh"; then
            error "Las verificaciones previas encontraron problemas"
            error "Revise el reporte y corrija los problemas antes de continuar"
            exit 1
        fi
    else
        warn "Script de verificación previa no encontrado"
    fi
}

# Function to enable SSH for emergency access
enable_ssh_access() {
    log "Habilitando acceso SSH para emergencias..."
    
    # Install SSH if not present
    if ! dpkg -l openssh-server >/dev/null 2>&1; then
        apt-get update
        apt-get install -y openssh-server
    fi
    
    # Enable and start SSH
    systemctl enable ssh
    systemctl start ssh
    
    # Configure firewall
    if command -v ufw >/dev/null 2>&1; then
        ufw allow 22/tcp
    fi
    
    # Get IP address
    local ip_addr=$(hostname -I | awk '{print $1}')
    info "SSH habilitado en: $ip_addr:22"
    info "Use este acceso si el sistema se vuelve inaccesible"
}

# Function to create system restore point
create_restore_point() {
    log "Creando punto de restauración..."
    
    local backup_dir="/opt/parking-backups/system-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup critical configurations
    local configs=(
        "/etc/lightdm"
        "/etc/X11"
        "/etc/systemd/system/parking-*.service"
        "/home/operador/.config"
        "/opt/parking-system"
    )
    
    for config in "${configs[@]}"; do
        if [ -e "$config" ]; then
            cp -r "$config" "$backup_dir/" 2>/dev/null || true
        fi
    done
    
    # Create restore script
    cat > "$backup_dir/restore.sh" << EOF
#!/bin/bash
echo "Restaurando configuración desde $backup_dir..."
cp -r $backup_dir/* / 2>/dev/null || true
echo "Restauración completada. Reinicie el sistema."
EOF
    chmod +x "$backup_dir/restore.sh"
    
    log "Punto de restauración creado: $backup_dir"
}

# Main deployment function
deploy_system() {
    local start_phase="${1:-}"
    local checkpoint=$(read_checkpoint)
    
    # Phase definitions
    declare -a phases=(
        "preflight:$SCRIPT_DIR/preflight-check-ubuntu.sh:true"
        "ssh_setup:enable_ssh_access:true"
        "restore_point:create_restore_point:false"
        "system_setup:$PARENT_DIR/setup/setup-system.sh:true"
        "database_setup:$PARENT_DIR/setup/setup-database.sh:true"
        "display_manager_fix:$SCRIPT_DIR/fix-display-manager.sh:true"
        "kiosk_setup:$SCRIPT_DIR/setup-kiosk-improved.sh:true"
        "printer_setup:$PARENT_DIR/hardware/setup-printer.sh:false"
        "scanner_setup:$PARENT_DIR/hardware/setup-scanner.sh:false"
        "security_setup:$PARENT_DIR/security/harden-system.sh:false"
        "deploy_app:$PARENT_DIR/deploy/deploy-parking-system.sh:true"
        "systemd_setup:$PARENT_DIR/deploy/setup-systemd-services.sh:true"
        "backup_setup:$PARENT_DIR/backup/setup-backups.sh:false"
    )
    
    # Determine starting point
    local start_index=0
    if [ -n "$start_phase" ]; then
        checkpoint="$start_phase"
    fi
    
    if [ -n "$checkpoint" ]; then
        log "Continuando desde checkpoint: $checkpoint"
        for i in "${!phases[@]}"; do
            IFS=':' read -r phase_name script_path critical <<< "${phases[$i]}"
            if [ "$phase_name" == "$checkpoint" ]; then
                start_index=$((i + 1))
                break
            fi
        done
    fi
    
    # Execute phases
    for ((i=start_index; i<${#phases[@]}; i++)); do
        IFS=':' read -r phase_name script_path critical <<< "${phases[$i]}"
        
        # Handle special function phases
        case "$script_path" in
            enable_ssh_access)
                enable_ssh_access
                save_checkpoint "$phase_name"
                ;;
            create_restore_point)
                create_restore_point
                save_checkpoint "$phase_name"
                ;;
            *)
                run_phase "$phase_name" "$script_path" "$critical"
                ;;
        esac
    done
}

# Function to clean previous installation
clean_installation() {
    log "Limpiando instalación previa..."
    
    # Stop services
    systemctl stop parking-system 2>/dev/null || true
    systemctl stop lightdm 2>/dev/null || true
    
    # Remove checkpoint
    rm -f "$CHECKPOINT_FILE"
    
    # Remove kiosk configurations
    rm -f /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
    rm -rf /home/operador/.config/openbox
    
    log "Limpieza completada"
}

# Parse command line arguments
case "${1:-}" in
    "--continue")
        log "Continuando instalación desde último checkpoint..."
        deploy_system
        ;;
    "--clean")
        clean_installation
        deploy_system
        ;;
    "--preflight-only")
        run_preflight_checks
        ;;
    "--help")
        echo "Uso: $0 [OPCIÓN]"
        echo ""
        echo "Opciones:"
        echo "  --continue       Continuar desde último checkpoint"
        echo "  --clean          Limpiar e iniciar instalación nueva"
        echo "  --preflight-only Solo ejecutar verificaciones previas"
        echo "  --help           Mostrar esta ayuda"
        echo ""
        echo "Sin opciones: Iniciar instalación normal"
        ;;
    *)
        # Check if we should continue from checkpoint
        if [ -f "$CHECKPOINT_FILE" ]; then
            checkpoint=$(read_checkpoint)
            warn "Se detectó instalación previa en: $checkpoint"
            echo -n "¿Continuar desde este punto? (s/N): "
            read -r response
            if [[ "$response" =~ ^[Ss]$ ]]; then
                deploy_system
            else
                echo -n "¿Limpiar y comenzar de nuevo? (s/N): "
                read -r response
                if [[ "$response" =~ ^[Ss]$ ]]; then
                    clean_installation
                    deploy_system
                else
                    log "Instalación cancelada"
                    exit 0
                fi
            fi
        else
            deploy_system
        fi
        ;;
esac

# Final summary
if [ $? -eq 0 ]; then
    log ""
    log "=== INSTALACIÓN COMPLETADA EXITOSAMENTE ==="
    log ""
    log "PRÓXIMOS PASOS:"
    log "1. Revise el log de instalación: $LOG_FILE"
    log "2. Verifique los servicios: systemctl status parking-system"
    log "3. Pruebe el acceso web: http://$(hostname -I | awk '{print $1}'):3000"
    log "4. Reinicie el sistema: sudo reboot"
    log ""
    log "IMPORTANTE: El sistema se iniciará en modo kiosk después del reinicio"
    log "Acceso SSH disponible en: $(hostname -I | awk '{print $1}'):22"
    log ""
    log "Para soporte, consulte: $SCRIPT_DIR/UBUNTU_DEPLOYMENT_GUIDE.md"
else
    error ""
    error "=== INSTALACIÓN FALLÓ ==="
    show_recovery_options
fi

exit $?