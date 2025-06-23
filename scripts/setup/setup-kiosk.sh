#!/bin/bash
set -euo pipefail

# Script: Kiosk Mode Setup for Parking Management System
# Purpose: Configure automatic login and Chromium kiosk mode for operator workstation
# Usage: sudo ./setup-kiosk.sh

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

log "=== CONFIGURACIÓN MODO KIOSCO - ESTACIONAMIENTO ==="

# Verify operator user exists
if ! id "operador" &>/dev/null; then
    error "Usuario operador no existe. Ejecute setup-system.sh primero"
    exit 1
fi

# Configure LightDM for autologin
log "Configurando login automático..."
cat > /etc/lightdm/lightdm.conf << 'EOF'
[Seat:*]
autologin-user=operador
autologin-user-timeout=0
user-session=openbox
autologin-session=openbox
greeter-session=unity-greeter
greeter-hide-users=true
greeter-show-manual-login=false
allow-guest=false
EOF

# Configure OpenBox window manager for kiosk
log "Configurando gestor de ventanas OpenBox..."
mkdir -p /home/operador/.config/openbox

cat > /home/operador/.config/openbox/autostart << 'EOF'
#!/bin/bash

# Ocultar cursor después de 3 segundos de inactividad
unclutter -idle 3 &

# Deshabilitar protector de pantalla y gestión de energía
xset s off
xset -dpms
xset s noblank

# Configurar resolución de pantalla
xrandr --output $(xrandr | grep " connected" | cut -d" " -f1 | head -1) --mode 1920x1080 --rate 60 || true

# Configurar variables de entorno para español México
export LANG=es_MX.UTF-8
export LC_ALL=es_MX.UTF-8
export TZ=America/Mexico_City

# Esperar que el sistema esté listo
sleep 5

# Ejecutar aplicación de estacionamiento en modo kiosco
/opt/parking-kiosk-start.sh &
EOF

chmod +x /home/operador/.config/openbox/autostart

# Create OpenBox menu configuration (minimal)
cat > /home/operador/.config/openbox/menu.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu xmlns="http://openbox.org/3.4/menu">
  <menu id="root-menu" label="Menú">
    <item label="Sistema de Estacionamiento">
      <action name="Execute">
        <command>/opt/parking-kiosk-start.sh</command>
      </action>
    </item>
    <separator />
    <item label="Reiniciar Sistema">
      <action name="Execute">
        <command>sudo systemctl reboot</command>
      </action>
    </item>
    <item label="Apagar Sistema">
      <action name="Execute">
        <command>sudo systemctl poweroff</command>
      </action>
    </item>
  </menu>
</openbox_menu>
EOF

# Create OpenBox RC configuration
cat > /home/operador/.config/openbox/rc.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance>
    <strength>10</strength>
    <screen_edge_strength>20</screen_edge_strength>
  </resistance>
  
  <focus>
    <focusNew>yes</focusNew>
    <followMouse>no</followMouse>
    <focusLast>yes</focusLast>
    <underMouse>no</underMouse>
    <focusDelay>200</focusDelay>
    <raiseOnFocus>no</raiseOnFocus>
  </focus>
  
  <placement>
    <policy>Smart</policy>
    <center>yes</center>
    <monitor>Primary</monitor>
    <primaryMonitor>1</primaryMonitor>
  </placement>
  
  <theme>
    <name>Clearlooks</name>
    <titleLayout>NLIMC</titleLayout>
    <keepBorder>yes</keepBorder>
    <animateIconify>yes</animateIconify>
    <font place="ActiveWindow">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>bold</weight>
      <slant>normal</slant>
    </font>
    <font place="InactiveWindow">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>normal</weight>
      <slant>normal</slant>
    </font>
    <font place="MenuHeader">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>normal</weight>
      <slant>normal</slant>
    </font>
    <font place="MenuItem">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>normal</weight>
      <slant>normal</slant>
    </font>
    <font place="ActiveOnScreenDisplay">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>bold</weight>
      <slant>normal</slant>
    </font>
    <font place="InactiveOnScreenDisplay">
      <name>Ubuntu</name>
      <size>11</size>
      <weight>normal</weight>
      <slant>normal</slant>
    </font>
  </theme>
  
  <desktops>
    <number>1</number>
    <firstdesk>1</firstdesk>
    <names>
      <name>Estacionamiento</name>
    </names>
    <popupTime>875</popupTime>
  </desktops>
  
  <resize>
    <drawContents>yes</drawContents>
    <popupShow>Nonpixel</popupShow>
    <popupPosition>Center</popupPosition>
    <popupFixedPosition>
      <x>10</x>
      <y>10</y>
    </popupFixedPosition>
  </resize>
  
  <margins>
    <top>0</top>
    <bottom>0</bottom>
    <left>0</left>
    <right>0</right>
  </margins>
  
  <dock>
    <position>TopLeft</position>
    <floatingX>0</floatingX>
    <floatingY>0</floatingY>
    <noStrut>no</noStrut>
    <stacking>Above</stacking>
    <direction>Vertical</direction>
    <autoHide>no</autoHide>
    <hideDelay>300</hideDelay>
    <showDelay>300</showDelay>
    <moveButton>Middle</moveButton>
  </dock>
  
  <keyboard>
    <chainQuitKey>C-g</chainQuitKey>
    <!-- Deshabilitar la mayoría de atajos para mayor seguridad -->
    <keybind key="A-F4">
      <action name="ToggleMaximize"/>
    </keybind>
    <keybind key="C-A-r">
      <action name="Execute">
        <command>sudo systemctl reboot</command>
      </action>
    </keybind>
    <keybind key="C-A-s">
      <action name="Execute">
        <command>sudo systemctl poweroff</command>
      </action>
    </keybind>
  </keyboard>
  
  <mouse>
    <dragThreshold>1</dragThreshold>
    <doubleClickTime>500</doubleClickTime>
    <screenEdgeWarpTime>400</screenEdgeWarpTime>
    <screenEdgeWarpMouse>false</screenEdgeWarpMouse>
    
    <context name="Frame">
      <mousebind button="A-Left" action="Press">
        <action name="Focus"/>
        <action name="Raise"/>
      </mousebind>
      <mousebind button="A-Left" action="Click">
        <action name="Unshade"/>
      </mousebind>
      <mousebind button="A-Left" action="Drag">
        <action name="Move"/>
      </mousebind>
    </context>
    
    <context name="Titlebar">
      <mousebind button="Left" action="Drag">
        <action name="Move"/>
      </mousebind>
      <mousebind button="Left" action="DoubleClick">
        <action name="ToggleMaximize"/>
      </mousebind>
    </context>
    
    <context name="Root">
      <mousebind button="Middle" action="Press">
        <action name="ShowMenu">
          <menu>client-list-combined-menu</menu>
        </action>
      </mousebind>
      <mousebind button="Right" action="Press">
        <action name="ShowMenu">
          <menu>root-menu</menu>
        </action>
      </mousebind>
    </context>
  </mouse>
  
  <menu>
    <file>menu.xml</file>
    <hideDelay>200</hideDelay>
    <middle>no</middle>
    <submenuShowDelay>100</submenuShowDelay>
    <submenuHideDelay>400</submenuHideDelay>
    <showIcons>yes</showIcons>
    <manageDesktops>yes</manageDesktops>
  </menu>
  
  <applications>
    <!-- Configuraciones específicas para Chromium en modo kiosco -->
    <application class="Chromium-browser">
      <decor>no</decor>
      <maximized>yes</maximized>
      <fullscreen>yes</fullscreen>
      <layer>above</layer>
      <focus>yes</focus>
    </application>
  </applications>
</openbox_config>
EOF

# Create the kiosk startup script
log "Creando script de inicio del kiosco..."
cat > /opt/parking-kiosk-start.sh << 'EOF'
#!/bin/bash

# Script de inicio para modo kiosco del sistema de estacionamiento
# Ejecuta la aplicación web en Chromium con configuración segura

# Logging
exec > /var/log/parking-kiosk.log 2>&1

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "=== INICIANDO MODO KIOSCO ESTACIONAMIENTO ==="

# Configurar variables de entorno
export DISPLAY=:0
export LANG=es_MX.UTF-8
export LC_ALL=es_MX.UTF-8
export TZ=America/Mexico_City

# Verificar que el servicio esté corriendo
log "Verificando servicios del sistema..."
if ! systemctl is-active --quiet parking-system; then
    log "Iniciando servicio del sistema de estacionamiento..."
    sudo systemctl start parking-system
    sleep 10
fi

# Verificar conectividad de red
log "Verificando conectividad de red..."
ping_count=0
while ! ping -c 1 127.0.0.1 >/dev/null 2>&1; do
    ping_count=$((ping_count + 1))
    if [ $ping_count -gt 30 ]; then
        log "ERROR: No hay conectividad de red después de 30 intentos"
        break
    fi
    log "Esperando conectividad de red... intento $ping_count"
    sleep 2
done

# Verificar que la aplicación responda
log "Verificando que la aplicación responda..."
app_check_count=0
while ! curl -s http://localhost:3000/health >/dev/null 2>&1; do
    app_check_count=$((app_check_count + 1))
    if [ $app_check_count -gt 60 ]; then
        log "ERROR: Aplicación no responde después de 60 intentos"
        # Mostrar página de error
        chromium-browser \
            --kiosk \
            --no-sandbox \
            --disable-dev-shm-usage \
            --disable-gpu \
            --no-first-run \
            --disable-default-apps \
            --disable-infobars \
            --disable-extensions \
            --disable-plugins \
            --disable-background-timer-throttling \
            --disable-backgrounding-occluded-windows \
            --disable-renderer-backgrounding \
            --disable-features=TranslateUI \
            --lang=es-MX \
            "data:text/html,<html><head><title>Error Sistema</title><style>body{font-family:Arial;font-size:24px;text-align:center;margin-top:200px;background:#f44336;color:white;}h1{font-size:48px;}</style></head><body><h1>Error del Sistema</h1><p>El sistema de estacionamiento no está disponible.</p><p>Contacte al administrador del sistema.</p><p>Tiempo: $(date)</p></body></html>" &
        exit 1
    fi
    log "Esperando que la aplicación esté lista... intento $app_check_count"
    sleep 5
done

log "Aplicación lista, iniciando Chromium en modo kiosco..."

# Configuración de Chromium para kiosco seguro
CHROMIUM_FLAGS=(
    --kiosk
    --no-sandbox
    --disable-dev-shm-usage
    --disable-gpu
    --no-first-run
    --no-default-browser-check
    --disable-default-apps
    --disable-infobars
    --disable-extensions
    --disable-plugins
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disable-renderer-backgrounding
    --disable-features=TranslateUI
    --disable-web-security
    --disable-features=VizDisplayCompositor
    --disable-ipc-flooding-protection
    --lang=es-MX
    --force-device-scale-factor=1
    --window-size=1920,1080
    --start-fullscreen
    --app=http://localhost:3000/operator
)

# Reiniciar Chromium si se cierra inesperadamente
while true; do
    log "Iniciando Chromium con configuración de kiosco..."
    
    chromium-browser "${CHROMIUM_FLAGS[@]}" 2>&1 | while read line; do
        log "CHROMIUM: $line"
    done
    
    log "Chromium se cerró inesperadamente, reiniciando en 5 segundos..."
    sleep 5
done
EOF

chmod +x /opt/parking-kiosk-start.sh

# Configure operator user environment
log "Configurando entorno del usuario operador..."

# Set ownership of config files
chown -R operador:operador /home/operador/.config

# Create .bashrc for operator user
cat > /home/operador/.bashrc << 'EOF'
# Configuración de entorno para operador de estacionamiento

# Variables de idioma y región
export LANG=es_MX.UTF-8
export LC_ALL=es_MX.UTF-8
export TZ=America/Mexico_City

# Configuración de terminal
export PS1='\u@estacionamiento:\w\$ '
export EDITOR=nano

# Aliases útiles
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'

# Funciones de utilidad
logs() {
    tail -f /var/log/parking-kiosk.log
}

status() {
    systemctl status parking-system
}

restart() {
    sudo systemctl restart parking-system
    echo "Sistema reiniciado"
}

# Mostrar información del sistema al login
echo "=== SISTEMA DE ESTACIONAMIENTO ==="
echo "Usuario: $(whoami)"
echo "Fecha: $(date)"
echo "Estado del sistema: $(systemctl is-active parking-system)"
echo "==============================="
EOF

chown operador:operador /home/operador/.bashrc

# Configure sudo permissions for operator (limited)
log "Configurando permisos sudo limitados para operador..."
cat > /etc/sudoers.d/operador << 'EOF'
# Permisos limitados para usuario operador
operador ALL=(root) NOPASSWD: /bin/systemctl start parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl stop parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl restart parking-system
operador ALL=(root) NOPASSWD: /bin/systemctl status parking-system
operador ALL=(root) NOPASSWD: /sbin/reboot
operador ALL=(root) NOPASSWD: /sbin/poweroff
operador ALL=(root) NOPASSWD: /sbin/shutdown
EOF

# Configure system to prevent user switching
log "Configurando restricciones de usuario..."

# Disable user switching in LightDM
cat >> /etc/lightdm/lightdm.conf << 'EOF'

[SeatDefaults]
allow-user-switching=false
allow-guest=false
greeter-show-remote-login=false
EOF

# Configure logind to handle power management
log "Configurando gestión de energía..."
cat > /etc/systemd/logind.conf << 'EOF'
[Login]
NAutoVTs=1
ReserveVT=1
KillUserProcesses=yes
KillOnlyUsers=
KillExcludeUsers=root
InhibitDelayMaxSec=5
HandlePowerKey=poweroff
HandleSuspendKey=ignore
HandleHibernateKey=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
PowerKeyIgnoreInhibited=no
SuspendKeyIgnoreInhibited=yes
HibernateKeyIgnoreInhibited=yes
LidSwitchIgnoreInhibited=yes
HoldoffTimeoutSec=30s
IdleAction=ignore
IdleActionSec=30min
RuntimeDirectorySize=10%
RemoveIPC=yes
InhibitorsMax=8192
SessionsMax=8192
EOF

# Create system monitoring script
log "Creando script de monitoreo del sistema..."
cat > /opt/parking-system-monitor.sh << 'EOF'
#!/bin/bash

# Script de monitoreo para sistema de estacionamiento
# Verifica que todos los servicios estén funcionando correctamente

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/parking-monitor.log
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a /var/log/parking-monitor.log
}

# Verificar servicio principal
if ! systemctl is-active --quiet parking-system; then
    error "Servicio parking-system no está activo"
    systemctl start parking-system
    sleep 10
fi

# Verificar aplicación web
if ! curl -s http://localhost:3000/health >/dev/null 2>&1; then
    error "Aplicación web no responde"
    systemctl restart parking-system
fi

# Verificar espacio en disco (alertar si menos de 2GB)
DISK_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$DISK_SPACE" -lt 2097152 ]; then  # 2GB in KB
    error "Espacio en disco bajo: $(df -h / | awk 'NR==2 {print $5}') usado"
fi

# Verificar memoria RAM disponible
FREE_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7*100/$2}')
if [ "$FREE_MEM" -lt 20 ]; then
    error "Memoria RAM baja: ${FREE_MEM}% disponible"
fi

# Verificar conectividad de impresora
if ! ping -c 1 192.168.1.100 >/dev/null 2>&1; then
    error "Impresora no responde en 192.168.1.100"
fi

log "Monitoreo completado - Sistema OK"
EOF

chmod +x /opt/parking-system-monitor.sh

# Configure monitoring cron job
log "Configurando monitoreo automático..."
cat > /etc/cron.d/parking-monitor << 'EOF'
# Monitoreo cada 5 minutos del sistema de estacionamiento
*/5 * * * * root /opt/parking-system-monitor.sh
EOF

# Configure log rotation for kiosk logs
cat > /etc/logrotate.d/parking-kiosk << 'EOF'
/var/log/parking-kiosk.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 operador operador
}

/var/log/parking-monitor.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Configure display settings for optimal kiosk experience
log "Configurando ajustes de pantalla para kiosco..."
cat > /etc/X11/xorg.conf.d/99-kiosk-display.conf << 'EOF'
Section "ServerLayout"
    Identifier "Kiosk Layout"
    Screen 0 "Kiosk Screen" 0 0
    InputDevice "Kiosk Keyboard" "CoreKeyboard"
    InputDevice "Kiosk Mouse" "CorePointer"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection

Section "Monitor"
    Identifier "Kiosk Monitor"
    Option "DPMS" "false"
EndSection

Section "Screen"
    Identifier "Kiosk Screen"
    Monitor "Kiosk Monitor"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Modes "1920x1080" "1680x1050" "1440x900" "1024x768"
    EndSubSection
EndSection

Section "InputDevice"
    Identifier "Kiosk Keyboard"
    Driver "kbd"
    Option "XkbLayout" "latam"
    Option "XkbVariant" "deadtilde"
EndSection

Section "InputDevice"
    Identifier "Kiosk Mouse"
    Driver "mouse"
    Option "Protocol" "auto"
    Option "Device" "/dev/input/mice"
EndSection
EOF

# Create system recovery script
log "Creando script de recuperación del sistema..."
cat > /opt/parking-system-recovery.sh << 'EOF'
#!/bin/bash

# Script de recuperación para sistema de estacionamiento
# Se ejecuta cuando el sistema no responde correctamente

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] RECUPERACIÓN: $1" | tee -a /var/log/parking-recovery.log
}

log "=== INICIANDO PROCEDIMIENTO DE RECUPERACIÓN ==="

# Matar procesos Chromium existentes
log "Cerrando navegadores existentes..."
pkill -f chromium-browser || true
sleep 3

# Reiniciar servicio de aplicación
log "Reiniciando servicio de aplicación..."
systemctl restart parking-system
sleep 15

# Verificar que la aplicación responda
log "Verificando respuesta de aplicación..."
retries=0
while [ $retries -lt 10 ]; do
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log "Aplicación respondiendo correctamente"
        break
    fi
    retries=$((retries + 1))
    log "Reintento $retries/10..."
    sleep 5
done

# Reiniciar modo kiosco
log "Reiniciando modo kiosco..."
sudo -u operador DISPLAY=:0 /opt/parking-kiosk-start.sh &

log "=== RECUPERACIÓN COMPLETADA ==="
EOF

chmod +x /opt/parking-system-recovery.sh

# Verify kiosk configuration
log "Verificando configuración del modo kiosco..."

# Check autologin configuration
if grep -q "autologin-user=operador" /etc/lightdm/lightdm.conf; then
    log "✓ Login automático configurado correctamente"
else
    error "✗ Login automático no configurado"
    exit 1
fi

# Check OpenBox configuration
if [ -f /home/operador/.config/openbox/autostart ]; then
    log "✓ OpenBox configurado correctamente"
else
    error "✗ OpenBox no configurado"
    exit 1
fi

# Check kiosk startup script
if [ -x /opt/parking-kiosk-start.sh ]; then
    log "✓ Script de inicio del kiosco creado"
else
    error "✗ Script de inicio del kiosco no existe"
    exit 1
fi

# Test display manager configuration
if systemctl is-enabled --quiet lightdm; then
    log "✓ LightDM habilitado correctamente"
else
    warn "⚠ LightDM no está habilitado, habilitando..."
    systemctl enable lightdm
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Modo kiosco configurado: $(date)
Login automático: operador
Gestor de ventanas: OpenBox
Display manager: LightDM
Script inicio: /opt/parking-kiosk-start.sh
Monitoreo: Cada 5 minutos
Logs: /var/log/parking-kiosk.log
EOF

log "=== CONFIGURACIÓN MODO KIOSCO COMPLETADA ==="
log "Login automático configurado para usuario 'operador'"
log "Aplicación se iniciará automáticamente en modo kiosco"
log "Logs del kiosco: /var/log/parking-kiosk.log"
log "Script de recuperación: /opt/parking-system-recovery.sh"
log ""
log "Próximo paso: Ejecutar setup-printer.sh"
log "IMPORTANTE: Reiniciar sistema para aplicar configuración de kiosco"

exit 0