#!/bin/bash

# Display Manager Conflict Resolution Script
# Safely transitions from any display manager to LightDM

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

# Check root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

log "=== RESOLVIENDO CONFLICTOS DE DISPLAY MANAGER ==="

# Detect current display manager
detect_current_dm() {
    local current_dm=""
    
    # Check systemd services
    for dm in gdm3 gdm lightdm sddm xdm; do
        if systemctl is-active --quiet "$dm" 2>/dev/null; then
            current_dm="$dm"
            break
        fi
    done
    
    # Check process if service not found
    if [ -z "$current_dm" ]; then
        if pgrep -x gdm3 >/dev/null; then
            current_dm="gdm3"
        elif pgrep -x gdm >/dev/null; then
            current_dm="gdm"
        elif pgrep -x lightdm >/dev/null; then
            current_dm="lightdm"
        elif pgrep -x sddm >/dev/null; then
            current_dm="sddm"
        fi
    fi
    
    # Check default display manager file
    if [ -z "$current_dm" ] && [ -f /etc/X11/default-display-manager ]; then
        local default_dm=$(cat /etc/X11/default-display-manager)
        case "$default_dm" in
            */gdm3) current_dm="gdm3" ;;
            */gdm) current_dm="gdm" ;;
            */lightdm) current_dm="lightdm" ;;
            */sddm) current_dm="sddm" ;;
        esac
    fi
    
    echo "$current_dm"
}

# Backup current configuration
backup_dm_config() {
    local backup_dir="/opt/parking-backups/dm-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    log "Creando respaldos en $backup_dir..."
    
    # Backup display manager configs
    for config in /etc/gdm3 /etc/gdm /etc/lightdm /etc/sddm.conf /etc/X11/default-display-manager; do
        if [ -e "$config" ]; then
            cp -r "$config" "$backup_dir/" 2>/dev/null || true
            log "Respaldado: $config"
        fi
    done
    
    echo "$backup_dir"
}

# Stop current display manager safely
stop_current_dm() {
    local dm="$1"
    
    if [ -n "$dm" ]; then
        log "Deteniendo $dm..."
        
        # Try graceful stop first
        systemctl stop "$dm" 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        pkill -9 "$dm" 2>/dev/null || true
        
        # Disable the service
        systemctl disable "$dm" 2>/dev/null || true
        
        log "$dm detenido y deshabilitado"
    fi
}

# Main process
main() {
    # Detect current state
    local current_dm=$(detect_current_dm)
    
    if [ -n "$current_dm" ]; then
        log "Display manager actual detectado: $current_dm"
    else
        log "No se detectó display manager activo"
    fi
    
    # Check if we're in GUI session
    if [ -n "$DISPLAY" ]; then
        warn "Está ejecutando desde una sesión gráfica"
        warn "El display manager se reiniciará y perderá la sesión actual"
        echo -n "¿Continuar? (s/N): "
        read -r response
        if [[ ! "$response" =~ ^[Ss]$ ]]; then
            log "Operación cancelada"
            exit 0
        fi
    fi
    
    # Create backups
    backup_dir=$(backup_dm_config)
    
    # Install LightDM if needed
    if ! dpkg -l lightdm >/dev/null 2>&1; then
        log "Instalando LightDM..."
        export DEBIAN_FRONTEND=noninteractive
        apt-get update
        apt-get install -y lightdm lightdm-gtk-greeter
    else
        log "LightDM ya está instalado"
    fi
    
    # Stop all display managers
    log "Deteniendo todos los display managers..."
    for dm in gdm3 gdm lightdm sddm xdm; do
        if systemctl is-active --quiet "$dm" 2>/dev/null; then
            stop_current_dm "$dm"
        fi
    done
    
    # Clear any residual processes
    pkill -9 X 2>/dev/null || true
    pkill -9 Xorg 2>/dev/null || true
    
    # Configure LightDM as default
    log "Configurando LightDM como display manager predeterminado..."
    echo "/usr/sbin/lightdm" > /etc/X11/default-display-manager
    
    # Reconfigure with debconf
    log "Reconfigurando sistema..."
    echo "lightdm shared/default-x-display-manager select lightdm" | debconf-set-selections
    DEBIAN_FRONTEND=noninteractive dpkg-reconfigure lightdm
    
    # Remove other display managers from startup
    log "Limpiando configuración de otros display managers..."
    for dm in gdm3 gdm sddm xdm; do
        systemctl mask "$dm" 2>/dev/null || true
        update-rc.d -f "$dm" remove 2>/dev/null || true
    done
    
    # Enable LightDM
    log "Habilitando LightDM..."
    systemctl unmask lightdm 2>/dev/null || true
    systemctl enable lightdm
    
    # Verify configuration
    log "Verificando configuración..."
    
    if [ -f /etc/X11/default-display-manager ]; then
        default_dm=$(cat /etc/X11/default-display-manager)
        if [[ "$default_dm" == *"lightdm"* ]]; then
            log "✓ LightDM configurado como predeterminado"
        else
            error "✗ LightDM no está configurado como predeterminado"
        fi
    fi
    
    # Test LightDM configuration
    if lightdm --test-mode --debug 2>&1 | grep -q "error"; then
        error "LightDM tiene errores de configuración"
        warn "Revise /var/log/lightdm/lightdm.log"
    else
        log "✓ Configuración de LightDM válida"
    fi
    
    # Create recovery script
    cat > /opt/restore-display-manager.sh << EOF
#!/bin/bash
# Script de recuperación de display manager
# Restaura la configuración desde: $backup_dir

echo "Restaurando configuración anterior..."
systemctl stop lightdm 2>/dev/null || true

if [ -f "$backup_dir/default-display-manager" ]; then
    cp "$backup_dir/default-display-manager" /etc/X11/default-display-manager
fi

# Restaurar configuraciones
for config in gdm3 gdm lightdm; do
    if [ -d "$backup_dir/\$config" ]; then
        cp -r "$backup_dir/\$config" /etc/
    fi
done

echo "Configuración restaurada. Reinicie el sistema."
EOF
    chmod +x /opt/restore-display-manager.sh
    
    log "=== CONVERSIÓN A LIGHTDM COMPLETADA ==="
    log ""
    log "Respaldos guardados en: $backup_dir"
    log "Script de recuperación: /opt/restore-display-manager.sh"
    log ""
    
    # Offer to start LightDM now
    if [ -z "$DISPLAY" ]; then
        echo -n "¿Iniciar LightDM ahora? (s/N): "
        read -r response
        if [[ "$response" =~ ^[Ss]$ ]]; then
            log "Iniciando LightDM..."
            systemctl start lightdm
        else
            log "Para iniciar LightDM manualmente: sudo systemctl start lightdm"
        fi
    else
        warn "IMPORTANTE: Debe reiniciar el sistema o ejecutar:"
        warn "sudo systemctl restart lightdm"
        warn "Esto cerrará su sesión actual"
    fi
}

# Run main process
main

exit 0