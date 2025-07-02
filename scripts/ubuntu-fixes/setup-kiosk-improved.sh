#!/bin/bash

# Improved Kiosk Mode Setup for Ubuntu
# Handles display manager conflicts, dynamic display detection, and better error recovery

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

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

# Create backup directory
BACKUP_DIR="/opt/parking-backups/kiosk-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

log "=== CONFIGURACIÓN MEJORADA DE MODO KIOSCO ==="
log "Directorio de respaldos: $BACKUP_DIR"

# Function to backup configuration files
backup_file() {
    local file="$1"
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/$(basename "$file").backup"
        log "Respaldo creado: $file"
    fi
}

# Function to handle display manager installation
setup_display_manager() {
    log "Configurando gestor de pantalla..."
    
    # Check current display manager
    local current_dm=""
    if systemctl is-active --quiet gdm3; then
        current_dm="gdm3"
    elif systemctl is-active --quiet gdm; then
        current_dm="gdm"
    elif systemctl is-active --quiet lightdm; then
        current_dm="lightdm"
    elif systemctl is-active --quiet sddm; then
        current_dm="sddm"
    fi
    
    if [ -n "$current_dm" ] && [ "$current_dm" != "lightdm" ]; then
        warn "Display manager actual: $current_dm"
        warn "Cambiando a LightDM..."
        
        # Install lightdm if not present
        if ! dpkg -l lightdm >/dev/null 2>&1; then
            log "Instalando LightDM..."
            DEBIAN_FRONTEND=noninteractive apt-get install -y lightdm lightdm-gtk-greeter
        fi
        
        # Stop current display manager
        systemctl stop "$current_dm" || true
        systemctl disable "$current_dm" || true
        
        # Configure lightdm as default
        echo "/usr/sbin/lightdm" > /etc/X11/default-display-manager
        DEBIAN_FRONTEND=noninteractive dpkg-reconfigure lightdm
        
        systemctl enable lightdm
    elif [ "$current_dm" == "lightdm" ]; then
        log "LightDM ya está configurado como display manager"
    else
        log "No hay display manager activo, instalando LightDM..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y lightdm lightdm-gtk-greeter
        echo "/usr/sbin/lightdm" > /etc/X11/default-display-manager
        systemctl enable lightdm
    fi
}

# Function to detect display resolution
detect_display_resolution() {
    log "Detectando resolución de pantalla..."
    
    local resolution="1024x768"  # Default fallback
    
    # Try multiple methods to detect resolution
    if command -v xrandr >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
        # Method 1: xrandr (if X is running)
        local xrandr_output=$(sudo -u operador DISPLAY=:0 xrandr 2>/dev/null | grep " connected" | head -1)
        if [ -n "$xrandr_output" ]; then
            resolution=$(echo "$xrandr_output" | grep -oP '\d+x\d+' | head -1)
            log "Resolución detectada (xrandr): $resolution"
        fi
    fi
    
    if [ "$resolution" == "1024x768" ]; then
        # Method 2: Check kernel video mode
        if [ -f /sys/class/graphics/fb0/virtual_size ]; then
            local fb_size=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null)
            if [ -n "$fb_size" ]; then
                resolution=$(echo "$fb_size" | tr ',' 'x')
                log "Resolución detectada (framebuffer): $resolution"
            fi
        fi
    fi
    
    if [ "$resolution" == "1024x768" ]; then
        # Method 3: Parse EDID data
        if command -v get-edid >/dev/null 2>&1; then
            local edid_info=$(get-edid 2>/dev/null | parse-edid 2>/dev/null | grep -i modeline | head -1)
            if [ -n "$edid_info" ]; then
                resolution=$(echo "$edid_info" | grep -oP '\d+x\d+' | head -1)
                log "Resolución detectada (EDID): $resolution"
            fi
        fi
    fi
    
    # Common ThinkPad resolutions as fallback options
    case "$resolution" in
        "1920x1080"|"1680x1050"|"1440x900"|"1366x768"|"1280x800"|"1024x768")
            log "Usando resolución: $resolution"
            ;;
        *)
            warn "Resolución inusual detectada: $resolution, usando 1366x768"
            resolution="1366x768"
            ;;
    esac
    
    echo "$resolution"
}

# Install required packages with error handling
log "Instalando paquetes requeridos..."
packages_to_install=(
    "openbox"
    "lightdm"
    "lightdm-gtk-greeter"
    "chromium-browser"
    "unclutter"
    "xdotool"
    "wmctrl"
    "x11-xserver-utils"
    "xinit"
    "xserver-xorg"
    "pulseaudio"
    "read-edid"
    "i2c-tools"
)

for package in "${packages_to_install[@]}"; do
    if ! dpkg -l "$package" >/dev/null 2>&1; then
        log "Instalando $package..."
        if ! DEBIAN_FRONTEND=noninteractive apt-get install -y "$package"; then
            warn "No se pudo instalar $package, continuando..."
        fi
    else
        log "$package ya está instalado"
    fi
done

# Verify operator user exists
if ! id "operador" &>/dev/null; then
    error "Usuario operador no existe. Ejecute setup-system.sh primero"
    exit 1
fi

# Setup display manager
setup_display_manager

# Backup existing LightDM configuration
backup_file "/etc/lightdm/lightdm.conf"
backup_file "/etc/lightdm/lightdm-gtk-greeter.conf"

# Configure LightDM with better error handling
log "Configurando LightDM para autologin..."
mkdir -p /etc/lightdm/lightdm.conf.d

# Main LightDM configuration
cat > /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf << 'EOF'
[Seat:*]
autologin-user=operador
autologin-user-timeout=0
user-session=openbox
allow-user-switching=false
allow-guest=false
greeter-allow-guest=false
greeter-show-manual-login=false
greeter-hide-users=true
EOF

# Greeter configuration
cat > /etc/lightdm/lightdm-gtk-greeter.conf << 'EOF'
[greeter]
background = #000000
theme-name = Adwaita-dark
icon-theme-name = Adwaita
font-name = Ubuntu 11
hide-user-image = true
indicators = ~language;~session;~power
EOF

# Configure OpenBox
log "Configurando OpenBox..."
mkdir -p /home/operador/.config/openbox

# Get display resolution
DISPLAY_RESOLUTION=$(detect_display_resolution)

# Create autostart with dynamic resolution
cat > /home/operador/.config/openbox/autostart << EOF
#!/bin/bash

# Logging
exec > /var/log/parking-kiosk-startup.log 2>&1
echo "[$(date)] Starting kiosk mode..."

# Wait for X to be ready
sleep 3

# Hide cursor after 3 seconds
unclutter -idle 3 &

# Disable screen saver and power management
xset s off
xset -dpms
xset s noblank

# Set display resolution dynamically
if command -v xrandr >/dev/null 2>&1; then
    # Get primary display
    PRIMARY_DISPLAY=\$(xrandr | grep " connected" | head -1 | cut -d' ' -f1)
    if [ -n "\$PRIMARY_DISPLAY" ]; then
        echo "Setting display \$PRIMARY_DISPLAY to $DISPLAY_RESOLUTION"
        xrandr --output "\$PRIMARY_DISPLAY" --mode $DISPLAY_RESOLUTION 2>/dev/null || \
        xrandr --output "\$PRIMARY_DISPLAY" --auto 2>/dev/null || true
    fi
fi

# Configure environment
export LANG=es_MX.UTF-8
export LC_ALL=es_MX.UTF-8
export TZ=America/Mexico_City

# Start parking kiosk
/opt/parking-kiosk-launcher.sh &
EOF

chmod +x /home/operador/.config/openbox/autostart

# Create improved kiosk launcher with better error handling
cat > /opt/parking-kiosk-launcher.sh << 'EOF'
#!/bin/bash

# Enhanced kiosk launcher with retry logic and error handling
LOG_FILE="/var/log/parking-kiosk.log"
MAX_RETRIES=10
RETRY_DELAY=5

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

show_error_page() {
    local error_msg="$1"
    chromium-browser \
        --kiosk \
        --no-sandbox \
        --disable-dev-shm-usage \
        --disable-gpu \
        --no-first-run \
        --disable-features=TranslateUI \
        --lang=es-MX \
        "data:text/html,<html><head><meta charset='UTF-8'><title>Error</title><style>body{font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f44336;color:white;}div{text-align:center;}h1{font-size:3em;margin-bottom:0.5em;}p{font-size:1.5em;margin:0.5em;}</style></head><body><div><h1>Sistema No Disponible</h1><p>$error_msg</p><p>Por favor contacte al administrador</p></div></body></html>" &
}

log "=== Iniciando sistema de estacionamiento ==="

# Wait for network
retry=0
while [ $retry -lt $MAX_RETRIES ]; do
    if ping -c 1 127.0.0.1 >/dev/null 2>&1; then
        log "Red disponible"
        break
    fi
    retry=$((retry + 1))
    log "Esperando red... intento $retry/$MAX_RETRIES"
    sleep $RETRY_DELAY
done

if [ $retry -eq $MAX_RETRIES ]; then
    log "ERROR: Red no disponible después de $MAX_RETRIES intentos"
    show_error_page "Error de red"
    exit 1
fi

# Wait for parking system service
retry=0
while [ $retry -lt $MAX_RETRIES ]; do
    if systemctl is-active --quiet parking-system; then
        log "Servicio parking-system activo"
        break
    fi
    retry=$((retry + 1))
    log "Iniciando servicio... intento $retry/$MAX_RETRIES"
    systemctl start parking-system || true
    sleep $RETRY_DELAY
done

# Wait for application to respond
retry=0
while [ $retry -lt $((MAX_RETRIES * 2)) ]; do
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log "Aplicación respondiendo correctamente"
        break
    fi
    retry=$((retry + 1))
    log "Esperando aplicación... intento $retry/$((MAX_RETRIES * 2))"
    sleep $RETRY_DELAY
done

if ! curl -s http://localhost:3000/health >/dev/null 2>&1; then
    log "ERROR: Aplicación no responde"
    show_error_page "Servicio no disponible"
    exit 1
fi

log "Iniciando Chromium en modo kiosk"

# Chromium flags optimized for kiosk
CHROMIUM_FLAGS=(
    --kiosk
    --no-sandbox
    --disable-dev-shm-usage
    --disable-gpu-sandbox
    --no-first-run
    --no-default-browser-check
    --disable-default-apps
    --disable-infobars
    --disable-extensions
    --disable-plugins-discovery
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disable-renderer-backgrounding
    --disable-features=TranslateUI
    --disable-ipc-flooding-protection
    --disable-hang-monitor
    --disable-prompt-on-repost
    --disable-sync
    --disable-web-resources
    --disable-client-side-phishing-detection
    --disable-component-update
    --disable-default-apps
    --disable-domain-reliability
    --disable-background-networking
    --disable-breakpad
    --lang=es-MX
    --window-position=0,0
    --start-fullscreen
    --app=http://localhost:3000/operator
)

# Keep restarting Chromium if it crashes
while true; do
    log "Ejecutando Chromium..."
    chromium-browser "${CHROMIUM_FLAGS[@]}" 2>&1 | while read line; do
        log "CHROMIUM: $line"
    done
    
    log "Chromium terminó, reiniciando en $RETRY_DELAY segundos..."
    sleep $RETRY_DELAY
done
EOF

chmod +x /opt/parking-kiosk-launcher.sh

# Create minimal OpenBox menu
cat > /home/operador/.config/openbox/menu.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu xmlns="http://openbox.org/3.4/menu">
  <menu id="root-menu" label="Sistema">
    <item label="Reiniciar Sistema">
      <action name="Execute">
        <command>sudo systemctl reboot</command>
      </action>
    </item>
  </menu>
</openbox_menu>
EOF

# Create OpenBox RC configuration with minimal decorations
cat > /home/operador/.config/openbox/rc.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <applications>
    <application class="*">
      <decor>no</decor>
      <maximized>yes</maximized>
      <fullscreen>yes</fullscreen>
    </application>
  </applications>
  <keyboard>
    <keybind key="C-A-Delete">
      <action name="Execute">
        <command>sudo systemctl reboot</command>
      </action>
    </keybind>
  </keyboard>
  <mouse>
    <context name="Root">
      <mousebind button="Right" action="Press">
        <action name="ShowMenu">
          <menu>root-menu</menu>
        </action>
      </mousebind>
    </context>
  </mouse>
</openbox_config>
EOF

# Set correct permissions
chown -R operador:operador /home/operador/.config
chmod -R 755 /home/operador/.config

# Configure sudo permissions for operador
log "Configurando permisos sudo para operador..."
cat > /etc/sudoers.d/operador-kiosk << 'EOF'
# Limited sudo permissions for kiosk operator
operador ALL=(root) NOPASSWD: /bin/systemctl start parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl stop parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl restart parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl status parking-system
operador ALL=(root) NOPASSWD: /sbin/reboot
operador ALL=(root) NOPASSWD: /sbin/poweroff
EOF

chmod 440 /etc/sudoers.d/operador-kiosk

# Configure systemd-logind for kiosk
log "Configurando systemd-logind..."
backup_file "/etc/systemd/logind.conf"

cat > /etc/systemd/logind.conf.d/kiosk.conf << 'EOF'
[Login]
NAutoVTs=1
ReserveVT=1
HandlePowerKey=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
IdleAction=ignore
EOF

# Create recovery script
cat > /opt/parking-kiosk-recovery.sh << 'EOF'
#!/bin/bash

echo "[$(date)] Ejecutando recuperación de kiosk..." >> /var/log/parking-recovery.log

# Kill any existing chromium processes
pkill -f chromium-browser || true

# Restart display manager
systemctl restart lightdm

echo "[$(date)] Recuperación completada" >> /var/log/parking-recovery.log
EOF

chmod +x /opt/parking-kiosk-recovery.sh

# Create systemd service for kiosk monitoring
cat > /etc/systemd/system/parking-kiosk-monitor.service << 'EOF'
[Unit]
Description=Parking Kiosk Monitor
After=lightdm.service

[Service]
Type=simple
ExecStart=/bin/bash -c 'while true; do if ! pgrep -f chromium-browser > /dev/null; then /opt/parking-kiosk-recovery.sh; fi; sleep 30; done'
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable parking-kiosk-monitor.service

# Final verification
log "Verificando configuración..."

if [ -f /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf ]; then
    log "✓ Configuración LightDM creada"
else
    error "✗ Fallo al crear configuración LightDM"
fi

if [ -f /home/operador/.config/openbox/autostart ]; then
    log "✓ Configuración OpenBox creada"
else
    error "✗ Fallo al crear configuración OpenBox"
fi

# Update status
cat >> /opt/parking-setup-status.txt << EOF
Modo kiosco configurado: $(date)
Display Manager: LightDM
Window Manager: OpenBox
Resolución detectada: $DISPLAY_RESOLUTION
Directorio respaldos: $BACKUP_DIR
EOF

log "=== CONFIGURACIÓN DE KIOSCO COMPLETADA ==="
log "Respaldos guardados en: $BACKUP_DIR"
log "Para revertir cambios, restaure los archivos desde el directorio de respaldos"
log ""
log "IMPORTANTE: Reinicie el sistema para aplicar los cambios"
log "Comando: sudo reboot"

exit 0