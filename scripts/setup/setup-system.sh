#!/bin/bash
set -euo pipefail

# Script: System Setup for Parking Management System
# Purpose: Initialize Ubuntu system with required packages and Spanish locale
# Usage: sudo ./setup-system.sh

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

log "=== CONFIGURACIÓN DEL SISTEMA - ESTACIONAMIENTO ==="

# Backup current configuration
log "Creando respaldo de configuración actual..."
mkdir -p /opt/parking-backups/pre-install
cp -r /etc/locale.gen /opt/parking-backups/pre-install/ 2>/dev/null || true
cp -r /etc/timezone /opt/parking-backups/pre-install/ 2>/dev/null || true

# Update system packages
log "Actualizando paquetes del sistema..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt upgrade -y

# Install essential packages
log "Instalando paquetes esenciales..."
apt install -y \
    curl wget git vim htop net-tools \
    build-essential software-properties-common \
    openssh-server ufw fail2ban \
    unattended-upgrades apt-listchanges \
    locales locales-all \
    tzdata

# Configure Spanish Mexico locale
log "Configurando idioma español (México)..."
locale-gen es_MX.UTF-8
update-locale LANG=es_MX.UTF-8 LC_ALL=es_MX.UTF-8

# Set Mexico City timezone
log "Configurando zona horaria Ciudad de México..."
timedatectl set-timezone America/Mexico_City
timedatectl set-ntp true

# Configure Spanish language packages
log "Instalando paquetes de idioma español..."
apt install -y \
    language-pack-es \
    language-pack-es-base \
    language-pack-gnome-es \
    language-pack-gnome-es-base \
    firefox-locale-es \
    thunderbird-locale-es \
    libreoffice-l10n-es \
    hunspell-es

# Set up environment variables for Spanish
log "Configurando variables de entorno en español..."
cat > /etc/environment << 'EOF'
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
LANG="es_MX.UTF-8"
LANGUAGE="es_MX:es"
LC_ALL="es_MX.UTF-8"
LC_NUMERIC="es_MX.UTF-8"
LC_TIME="es_MX.UTF-8"
LC_MONETARY="es_MX.UTF-8"
LC_PAPER="es_MX.UTF-8"
LC_IDENTIFICATION="es_MX.UTF-8"
LC_NAME="es_MX.UTF-8"
LC_ADDRESS="es_MX.UTF-8"
LC_TELEPHONE="es_MX.UTF-8"
LC_MEASUREMENT="es_MX.UTF-8"
TZ="America/Mexico_City"
EOF

# Install Node.js 20 LTS
log "Instalando Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "Node.js instalado: $NODE_VERSION"
log "NPM instalado: $NPM_VERSION"

# Install build tools
log "Instalando herramientas de compilación..."
apt install -y gcc g++ make python3-pip

# Install Chromium for kiosk mode
log "Instalando Chromium para modo kiosco..."
apt install -y chromium-browser

# Install X11 and display management packages
log "Instalando paquetes de sistema gráfico..."
apt install -y \
    xorg openbox lightdm \
    unclutter xdotool wmctrl \
    x11-xserver-utils \
    pulseaudio pavucontrol \
    plymouth-theme-ubuntu-logo

# Create operator user if it doesn't exist
if ! id "operador" &>/dev/null; then
    log "Creando usuario operador..."
    useradd -m -s /bin/bash operador
    echo "operador:OperadorParking2024!" | chpasswd
    
    # Configure operator user restrictions
    mkdir -p /etc/security/limits.d/
    cat > /etc/security/limits.d/operador.conf << 'EOF'
# Limitar recursos para usuario operador
operador soft nproc 256
operador hard nproc 512
operador soft nofile 4096
operador hard nofile 8192
operador soft priority 19
operador hard priority 19
operador soft cpu 1440
operador hard cpu 1440
EOF

    # Remove administrative capabilities
    deluser operador sudo 2>/dev/null || true
    gpasswd -d operador adm 2>/dev/null || true
    
    log "Usuario operador creado con restricciones"
else
    log "Usuario operador ya existe"
fi

# Configure automatic updates
log "Configurando actualizaciones automáticas..."
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Configure unattended upgrades for security updates only
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# Disable unnecessary services for security
log "Deshabilitando servicios innecesarios..."
SERVICES_TO_DISABLE=(
    "bluetooth"
    "cups-browsed"
    "ModemManager"
    "whoopsie"
    "apport"
    "kerneloops"
    "speech-dispatcher"
    "brltty"
    "colord"
    "switcheroo-control"
)

for service in "${SERVICES_TO_DISABLE[@]}"; do
    systemctl stop $service 2>/dev/null || true
    systemctl disable $service 2>/dev/null || true
    systemctl mask $service 2>/dev/null || true
    log "Servicio $service deshabilitado"
done

# Clean up packages
log "Limpiando paquetes innecesarios..."
apt autoremove --purge -y
apt autoclean

# Verify system configuration
log "Verificando configuración del sistema..."

# Check locale
CURRENT_LOCALE=$(locale | grep LANG= | cut -d= -f2 | tr -d '"')
if [[ "$CURRENT_LOCALE" == "es_MX.UTF-8" ]]; then
    log "✓ Idioma configurado correctamente: $CURRENT_LOCALE"
else
    warn "⚠ Idioma no configurado correctamente: $CURRENT_LOCALE"
fi

# Check timezone
CURRENT_TZ=$(timedatectl show -p Timezone --value)
if [[ "$CURRENT_TZ" == "America/Mexico_City" ]]; then
    log "✓ Zona horaria configurada correctamente: $CURRENT_TZ"
else
    warn "⚠ Zona horaria no configurada correctamente: $CURRENT_TZ"
fi

# Check Node.js
if command -v node &> /dev/null; then
    log "✓ Node.js disponible: $(node --version)"
else
    error "✗ Node.js no está disponible"
    exit 1
fi

# Check operator user
if id "operador" &>/dev/null; then
    log "✓ Usuario operador creado correctamente"
else
    error "✗ Usuario operador no existe"
    exit 1
fi

# Create installation status file
cat > /opt/parking-setup-status.txt << EOF
Sistema base configurado: $(date)
Idioma: es_MX.UTF-8
Zona horaria: America/Mexico_City
Node.js: $(node --version)
Usuario operador: Creado
Servicios deshabilitados: ${#SERVICES_TO_DISABLE[@]}
EOF

log "=== CONFIGURACIÓN DEL SISTEMA COMPLETADA ==="
log "Estado guardado en: /opt/parking-setup-status.txt"
log ""
log "Próximo paso: Ejecutar setup-database.sh"
log "Reinicio recomendado para aplicar todos los cambios"

exit 0