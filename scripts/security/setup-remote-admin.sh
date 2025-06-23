#!/bin/bash
set -euo pipefail

# Script: Remote Administration Setup for Parking Management System
# Purpose: Configure secure SSH access for remote administration
# Usage: sudo ./setup-remote-admin.sh

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

log "=== CONFIGURACIÓN ADMINISTRACIÓN REMOTA ==="

# Create admin user for remote access
ADMIN_USER="admin"
ADMIN_PASSWORD="AdminParking$(openssl rand -base64 12 | tr -d '+=/' | head -c 12)"

log "Creando usuario administrador remoto..."

# Create admin user if it doesn't exist
if ! id "$ADMIN_USER" &>/dev/null; then
    useradd -m -s /bin/bash -G sudo "$ADMIN_USER"
    echo "$ADMIN_USER:$ADMIN_PASSWORD" | chpasswd
    log "✓ Usuario administrador '$ADMIN_USER' creado"
else
    log "Usuario administrador '$ADMIN_USER' ya existe"
fi

# Configure admin user restrictions
cat > /etc/security/limits.d/admin.conf << 'EOF'
# Límites para usuario administrador
admin soft nproc 1024
admin hard nproc 2048
admin soft nofile 8192
admin hard nofile 16384
admin soft priority 0
admin hard priority 0
EOF

# Create admin user SSH directory
mkdir -p /home/$ADMIN_USER/.ssh
chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh
chmod 700 /home/$ADMIN_USER/.ssh

# Generate SSH key pair for admin
log "Generando par de claves SSH para administrador..."
ssh-keygen -t rsa -b 4096 -f /home/$ADMIN_USER/.ssh/id_rsa -N "" -C "admin@parking-system-$(hostname)"
chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh/id_rsa*
chmod 600 /home/$ADMIN_USER/.ssh/id_rsa
chmod 644 /home/$ADMIN_USER/.ssh/id_rsa.pub

# Set up authorized_keys for admin
cp /home/$ADMIN_USER/.ssh/id_rsa.pub /home/$ADMIN_USER/.ssh/authorized_keys
chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh/authorized_keys
chmod 600 /home/$ADMIN_USER/.ssh/authorized_keys

log "✓ Claves SSH generadas para administrador"

# Configure SSH client for admin user
cat > /home/$ADMIN_USER/.ssh/config << 'EOF'
# SSH client configuration for parking system admin

Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    StrictHostKeyChecking ask
    UserKnownHostsFile ~/.ssh/known_hosts
    IdentitiesOnly yes
    PasswordAuthentication no
    PubkeyAuthentication yes
    HashKnownHosts yes
    VisualHostKey yes

# Parking system management
Host parking-backup
    Hostname backup.estacionamiento.local
    User admin
    Port 22
    IdentityFile ~/.ssh/id_rsa

Host parking-monitoring
    Hostname monitor.estacionamiento.local
    User admin
    Port 22
    IdentityFile ~/.ssh/id_rsa
EOF

chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh/config
chmod 600 /home/$ADMIN_USER/.ssh/config

# Configure sudo permissions for admin
log "Configurando permisos sudo para administrador..."
cat > /etc/sudoers.d/admin << 'EOF'
# Administrative permissions for parking system admin user

# Full system administration
admin ALL=(ALL:ALL) ALL

# Specific parking system commands (passwordless for automation)
admin ALL=(root) NOPASSWD: /bin/systemctl start parking-system
admin ALL=(root) NOPASSWD: /bin/systemctl stop parking-system
admin ALL=(root) NOPASSWD: /bin/systemctl restart parking-system
admin ALL=(root) NOPASSWD: /bin/systemctl status parking-system
admin ALL=(root) NOPASSWD: /bin/systemctl reload parking-system

# Database management
admin ALL=(root) NOPASSWD: /usr/bin/pg_dump
admin ALL=(root) NOPASSWD: /usr/bin/pg_restore
admin ALL=(root) NOPASSWD: /opt/parking-db-maintenance.sh
admin ALL=(root) NOPASSWD: /opt/test-db-connection.sh

# Backup operations
admin ALL=(root) NOPASSWD: /opt/parking-backup.sh
admin ALL=(root) NOPASSWD: /opt/parking-restore.sh

# System monitoring
admin ALL=(root) NOPASSWD: /opt/security-monitor.sh
admin ALL=(root) NOPASSWD: /opt/system-health-check.sh

# Log viewing
admin ALL=(root) NOPASSWD: /usr/bin/tail /var/log/parking-system/*
admin ALL=(root) NOPASSWD: /usr/bin/tail /var/log/postgresql/*
admin ALL=(root) NOPASSWD: /usr/bin/tail /var/log/nginx/*

# System updates (security only)
admin ALL=(root) NOPASSWD: /usr/bin/apt update
admin ALL=(root) NOPASSWD: /usr/bin/apt list --upgradable
admin ALL=(root) NOPASSWD: /usr/bin/unattended-upgrade

# Network diagnostics
admin ALL=(root) NOPASSWD: /bin/ping
admin ALL=(root) NOPASSWD: /usr/bin/nmap
admin ALL=(root) NOPASSWD: /bin/netstat
admin ALL=(root) NOPASSWD: /usr/bin/ss

# Hardware testing
admin ALL=(root) NOPASSWD: /opt/test-thermal-printer.sh
admin ALL=(root) NOPASSWD: /opt/test-barcode-scanner.sh
admin ALL=(root) NOPASSWD: /opt/scanner-detect.sh
EOF

# Configure SSH server for admin access
log "Configurando servidor SSH para acceso administrativo..."

# Backup existing SSH config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)

# Update SSH configuration for admin access
cat >> /etc/ssh/sshd_config << 'EOF'

# Remote administration configuration for parking system
Match User admin
    PasswordAuthentication no
    PubkeyAuthentication yes
    AuthorizedKeysFile .ssh/authorized_keys
    AllowTcpForwarding yes
    AllowStreamLocalForwarding yes
    PermitTunnel no
    X11Forwarding no
    ClientAliveInterval 300
    ClientAliveCountMax 3
    MaxAuthTries 3
    MaxSessions 3

# Operator user restrictions (kiosk mode)
Match User operador
    PasswordAuthentication yes
    PubkeyAuthentication no
    AllowTcpForwarding no
    AllowStreamLocalForwarding no
    PermitTunnel no
    X11Forwarding no
    ForceCommand /opt/parking-kiosk-start.sh
EOF

# Restart SSH service
systemctl restart ssh
log "✓ Servidor SSH configurado y reiniciado"

# Configure fail2ban for admin protection
log "Configurando protección adicional para acceso administrativo..."
cat > /etc/fail2ban/jail.d/admin-protection.conf << 'EOF'
[sshd-admin]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
filter = sshd-admin
maxretry = 2
bantime = 7200
findtime = 300

[sudo-admin]
enabled = true
port = ssh
logpath = /var/log/auth.log
filter = sudo-admin
maxretry = 5
bantime = 3600
findtime = 600
EOF

# Create custom fail2ban filters
cat > /etc/fail2ban/filter.d/sshd-admin.conf << 'EOF'
[Definition]
failregex = ^.*Failed password for admin from <HOST>.*$
            ^.*Failed publickey for admin from <HOST>.*$
            ^.*Invalid user admin from <HOST>.*$

ignoreregex =
EOF

cat > /etc/fail2ban/filter.d/sudo-admin.conf << 'EOF'
[Definition]
failregex = ^.*sudo.*authentication failure.*user=admin.*rhost=<HOST>.*$
            ^.*sudo.*incorrect password attempt.*user=admin.*$

ignoreregex =
EOF

# Restart fail2ban
systemctl restart fail2ban
log "✓ Protección fail2ban configurada"

# Create remote administration tools
log "Creando herramientas de administración remota..."

# Create remote management script
cat > /opt/remote-admin-tools.sh << 'EOF'
#!/bin/bash

# Herramientas de administración remota para sistema de estacionamiento
# Funciones comunes para administradores remotos

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Función: Estado del sistema
system_status() {
    log "=== ESTADO DEL SISTEMA DE ESTACIONAMIENTO ==="
    
    echo "Fecha y hora: $(date)"
    echo "Uptime: $(uptime -p)"
    echo "Carga del sistema: $(uptime | awk -F'load average:' '{print $2}')"
    echo ""
    
    echo "=== SERVICIOS ==="
    echo "Parking System: $(systemctl is-active parking-system)"
    echo "PostgreSQL: $(systemctl is-active postgresql)"
    echo "SSH: $(systemctl is-active ssh)"
    echo "UFW Firewall: $(ufw status | head -1)"
    echo "Fail2Ban: $(systemctl is-active fail2ban)"
    echo ""
    
    echo "=== RECURSOS ==="
    echo "Memoria:"
    free -h
    echo ""
    echo "Disco:"
    df -h / /opt /var
    echo ""
    
    echo "=== RED ==="
    echo "Interfaz de red:"
    ip addr show | grep "inet " | grep -v "127.0.0.1"
    echo ""
    echo "Conectividad impresora:"
    if ping -c 1 192.168.1.100 >/dev/null 2>&1; then
        echo "✓ Impresora accesible (192.168.1.100)"
    else
        echo "✗ Impresora no accesible"
    fi
    echo ""
    
    echo "=== BASE DE DATOS ==="
    if sudo /opt/test-db-connection.sh >/dev/null 2>&1; then
        echo "✓ Base de datos conectada"
        # Get database size
        source /opt/parking-db-credentials
        DB_SIZE=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs)
        echo "Tamaño BD: $DB_SIZE"
    else
        echo "✗ Problemas con base de datos"
    fi
}

# Función: Logs del sistema
system_logs() {
    local lines=${1:-50}
    log "=== LOGS DEL SISTEMA (últimas $lines líneas) ==="
    
    echo "--- Parking System ---"
    sudo tail -n $lines /var/log/parking-system/*.log 2>/dev/null | tail -20
    echo ""
    
    echo "--- Sistema ---"
    sudo tail -n $lines /var/log/syslog | grep -E "(parking|error|fail)" | tail -10
    echo ""
    
    echo "--- Autenticación ---"
    sudo tail -n $lines /var/log/auth.log | grep -E "(ssh|sudo|fail)" | tail -10
    echo ""
    
    echo "--- Fail2Ban ---"
    sudo tail -n $lines /var/log/fail2ban.log | tail -10
}

# Función: Hardware status
hardware_status() {
    log "=== ESTADO DEL HARDWARE ==="
    
    echo "=== IMPRESORA TÉRMICA ==="
    if sudo /opt/test-thermal-printer.sh 2>/dev/null | grep -q "exitosa"; then
        echo "✓ Impresora funcionando correctamente"
    else
        echo "⚠ Verificar estado de impresora"
    fi
    
    echo ""
    echo "=== ESCÁNER CÓDIGO DE BARRAS ==="
    if sudo /opt/scanner-detect.sh 2>/dev/null | grep -q "detectado"; then
        echo "✓ Escáner detectado"
    else
        echo "⚠ Escáner no detectado"
    fi
    
    echo ""
    echo "=== TEMPERATURA CPU ==="
    if command -v sensors >/dev/null 2>&1; then
        sensors | grep -E "(Core|temp)" | head -4
    else
        echo "Sensores de temperatura no disponibles"
    fi
}

# Función: Backup rápido
quick_backup() {
    log "=== BACKUP RÁPIDO ==="
    
    BACKUP_DIR="/opt/parking-backups/quick-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Database backup
    echo "Respaldando base de datos..."
    if sudo /opt/parking-backup.sh database "$BACKUP_DIR"; then
        echo "✓ Base de datos respaldada"
    else
        echo "✗ Error respaldando base de datos"
    fi
    
    # Config backup
    echo "Respaldando configuración..."
    sudo cp -r /opt/parking-db-credentials "$BACKUP_DIR/" 2>/dev/null
    sudo cp -r /etc/ssh/sshd_config "$BACKUP_DIR/" 2>/dev/null
    sudo cp -r /etc/fail2ban "$BACKUP_DIR/" 2>/dev/null
    
    echo "✓ Backup completado en: $BACKUP_DIR"
    du -sh "$BACKUP_DIR"
}

# Función: Reinicio seguro
safe_restart() {
    log "=== REINICIO SEGURO DEL SISTEMA ==="
    
    warn "¿Está seguro que desea reiniciar el sistema? (y/N)"
    read -r confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        log "Deteniendo servicios de estacionamiento..."
        sudo systemctl stop parking-system
        
        log "Esperando 10 segundos..."
        sleep 10
        
        log "Reiniciando sistema..."
        sudo systemctl reboot
    else
        log "Reinicio cancelado"
    fi
}

# Función: Mostrar ayuda
show_help() {
    echo "=== HERRAMIENTAS DE ADMINISTRACIÓN REMOTA ==="
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  status      - Mostrar estado completo del sistema"
    echo "  logs [N]    - Mostrar logs del sistema (N líneas, default 50)"
    echo "  hardware    - Verificar estado del hardware"
    echo "  backup      - Crear backup rápido"
    echo "  restart     - Reinicio seguro del sistema"
    echo "  help        - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 status"
    echo "  $0 logs 100"
    echo "  $0 hardware"
    echo "  $0 backup"
}

# Main execution
case "${1:-help}" in
    "status")
        system_status
        ;;
    "logs")
        system_logs "${2:-50}"
        ;;
    "hardware")
        hardware_status
        ;;
    "backup")
        quick_backup
        ;;
    "restart")
        safe_restart
        ;;
    "help"|*)
        show_help
        ;;
esac
EOF

chmod +x /opt/remote-admin-tools.sh

# Create admin user profile
cat > /home/$ADMIN_USER/.bashrc << 'EOF'
# Configuración de perfil para administrador de estacionamiento

# Variables de entorno
export LANG=es_MX.UTF-8
export LC_ALL=es_MX.UTF-8
export TZ=America/Mexico_City
export EDITOR=nano
export PAGER=less

# Prompt personalizado
export PS1='\[\033[01;32m\]\u@parking-admin\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# History settings
export HISTSIZE=2000
export HISTFILESIZE=4000
export HISTCONTROL=ignoredups:erasedups
shopt -s histappend

# Aliases útiles
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'
alias status='sudo /opt/remote-admin-tools.sh status'
alias logs='sudo /opt/remote-admin-tools.sh logs'
alias hardware='sudo /opt/remote-admin-tools.sh hardware'
alias backup='sudo /opt/remote-admin-tools.sh backup'
alias parking-status='sudo systemctl status parking-system'
alias parking-restart='sudo systemctl restart parking-system'
alias parking-logs='sudo tail -f /var/log/parking-system/*.log'
alias db-status='sudo /opt/test-db-connection.sh'

# Funciones útiles
parking() {
    case "$1" in
        "start")
            sudo systemctl start parking-system
            ;;
        "stop")
            sudo systemctl stop parking-system
            ;;
        "restart")
            sudo systemctl restart parking-system
            ;;
        "status")
            sudo systemctl status parking-system
            ;;
        "logs")
            sudo journalctl -u parking-system -f
            ;;
        *)
            echo "Uso: parking {start|stop|restart|status|logs}"
            ;;
    esac
}

# Mostrar información del sistema al login
echo "=== ADMINISTRACIÓN REMOTA - SISTEMA DE ESTACIONAMIENTO ==="
echo "Usuario: $(whoami)"
echo "Servidor: $(hostname)"
echo "Fecha: $(date)"
echo "Uptime: $(uptime -p)"
echo ""
echo "Comandos disponibles:"
echo "  status          - Estado del sistema"
echo "  logs            - Ver logs"
echo "  hardware        - Estado hardware"
echo "  backup          - Backup rápido"
echo "  parking status  - Estado servicio"
echo "  parking restart - Reiniciar servicio"
echo ""
echo "Para ayuda completa: /opt/remote-admin-tools.sh help"
echo "=================================================="
EOF

chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.bashrc

# Create SSH key distribution script
log "Creando script de distribución de claves SSH..."
cat > /opt/distribute-ssh-keys.sh << 'EOF'
#!/bin/bash

# Script para distribuir claves SSH a administradores
# Facilita el acceso remoto seguro

echo "=== DISTRIBUCIÓN DE CLAVES SSH ==="
echo ""

if [ ! -f /home/admin/.ssh/id_rsa.pub ]; then
    echo "ERROR: Clave pública no encontrada"
    exit 1
fi

echo "Clave pública SSH del administrador:"
echo "=================================="
cat /home/admin/.ssh/id_rsa.pub
echo "=================================="
echo ""

echo "Para configurar acceso remoto:"
echo "1. Copie la clave pública mostrada arriba"
echo "2. En su máquina cliente, añada la clave a ~/.ssh/authorized_keys"
echo "3. Conéctese usando: ssh admin@$(hostname -I | awk '{print $1}')"
echo ""

echo "Información de conexión:"
echo "Usuario: admin"
echo "Host: $(hostname -I | awk '{print $1}')"
echo "Puerto: 22"
echo ""

# Generate connection instructions
echo "Instrucciones de conexión:"
echo "=========================="
echo "# Desde Linux/Mac:"
echo "ssh admin@$(hostname -I | awk '{print $1}')"
echo ""
echo "# Desde Windows (PuTTY):"
echo "Host: $(hostname -I | awk '{print $1}')"
echo "Port: 22"
echo "Username: admin"
echo "Auth: Use private key"
echo ""

# Save connection info to file
cat > /home/admin/connection-info.txt << EOL
Información de Conexión SSH - Sistema de Estacionamiento
======================================================

Usuario: admin
Host: $(hostname -I | awk '{print $1}')
Puerto: 22
Método: Clave SSH

Comando de conexión:
ssh admin@$(hostname -I | awk '{print $1}')

Clave pública:
$(cat /home/admin/.ssh/id_rsa.pub)

Generado: $(date)
EOL

chown admin:admin /home/admin/connection-info.txt
chmod 600 /home/admin/connection-info.txt

echo "Información guardada en: /home/admin/connection-info.txt"
EOF

chmod +x /opt/distribute-ssh-keys.sh

# Configure VPN client (optional setup)
log "Preparando configuración VPN (opcional)..."
mkdir -p /etc/openvpn/client
cat > /etc/openvpn/client/parking-admin.conf.template << 'EOF'
# Plantilla de configuración VPN para administración remota
# Copie este archivo y configure según su proveedor VPN

client
dev tun
proto udp
remote YOUR_VPN_SERVER 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
comp-lzo
verb 3

# Redirigir solo tráfico específico
route-nopull
route 192.168.0.0 255.255.0.0

# DNS
dhcp-option DNS 8.8.8.8
dhcp-option DNS 8.8.4.4

# Logging
log /var/log/openvpn-parking.log
status /var/log/openvpn-status.log
EOF

# Create admin monitoring dashboard
log "Creando dashboard de monitoreo para administrador..."
cat > /home/$ADMIN_USER/dashboard.sh << 'EOF'
#!/bin/bash

# Dashboard de monitoreo para administrador remoto
# Muestra información en tiempo real del sistema

while true; do
    clear
    echo "=== DASHBOARD SISTEMA ESTACIONAMIENTO ==="
    echo "Actualizado: $(date)"
    echo "========================================"
    echo ""
    
    # System status
    echo "SISTEMA:"
    echo "  Uptime: $(uptime -p)"
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}' | xargs)"
    echo "  Memory: $(free -h | awk 'NR==2{printf "%.0f%% used", $3*100/$2}')"
    echo "  Disk: $(df / | awk 'NR==2{printf "%s used", $5}')"
    echo ""
    
    # Services
    echo "SERVICIOS:"
    echo "  Parking: $(systemctl is-active parking-system)"
    echo "  Database: $(systemctl is-active postgresql)"
    echo "  SSH: $(systemctl is-active ssh)"
    echo "  Firewall: $(ufw status | head -1 | awk '{print $2}')"
    echo ""
    
    # Network
    echo "RED:"
    echo "  IP: $(hostname -I | awk '{print $1}')"
    if ping -c 1 192.168.1.100 >/dev/null 2>&1; then
        echo "  Printer: ✓ Connected"
    else
        echo "  Printer: ✗ Disconnected"
    fi
    echo ""
    
    # Recent activity
    echo "ACTIVIDAD RECIENTE:"
    sudo tail -5 /var/log/parking-system/*.log 2>/dev/null | tail -3 | sed 's/^/  /'
    echo ""
    
    echo "Presione Ctrl+C para salir, Enter para actualizar..."
    read -t 30 || true
done
EOF

chmod +x /home/$ADMIN_USER/dashboard.sh
chown $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/dashboard.sh

# Test remote admin configuration
log "Probando configuración de administración remota..."

# Test admin user
if id "$ADMIN_USER" >/dev/null 2>&1; then
    log "✓ Usuario administrador creado correctamente"
else
    error "✗ Error creando usuario administrador"
    exit 1
fi

# Test SSH key
if [ -f "/home/$ADMIN_USER/.ssh/id_rsa" ]; then
    log "✓ Claves SSH generadas correctamente"
else
    error "✗ Error generando claves SSH"
    exit 1
fi

# Test sudo permissions
if sudo -u $ADMIN_USER sudo -l | grep -q "parking-system"; then
    log "✓ Permisos sudo configurados correctamente"
else
    warn "⚠ Verificar permisos sudo"
fi

# Test SSH service
if systemctl is-active --quiet ssh; then
    log "✓ Servicio SSH activo"
else
    error "✗ Servicio SSH no activo"
    exit 1
fi

# Save admin credentials securely
log "Guardando credenciales de administrador..."
cat > /opt/parking-admin-credentials << EOF
# Credenciales de Administrador Remoto
# Creado: $(date)
ADMIN_USER=$ADMIN_USER
ADMIN_PASSWORD=$ADMIN_PASSWORD
SSH_KEY_PATH=/home/$ADMIN_USER/.ssh/id_rsa
PUBLIC_KEY_PATH=/home/$ADMIN_USER/.ssh/id_rsa.pub
CONNECTION_INFO=/home/$ADMIN_USER/connection-info.txt
EOF

chmod 600 /opt/parking-admin-credentials
chown root:root /opt/parking-admin-credentials

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Administración remota configurada: $(date)
Usuario administrador: $ADMIN_USER
SSH habilitado: Sí
Claves SSH: Generadas
Herramientas admin: /opt/remote-admin-tools.sh
Dashboard: /home/$ADMIN_USER/dashboard.sh
Credenciales: /opt/parking-admin-credentials
Distribución claves: /opt/distribute-ssh-keys.sh
EOF

# Run key distribution script
/opt/distribute-ssh-keys.sh

log "=== CONFIGURACIÓN ADMINISTRACIÓN REMOTA COMPLETADA ==="
log "Usuario administrador: $ADMIN_USER"
log "Contraseña temporal: $ADMIN_PASSWORD"
log "Claves SSH generadas en: /home/$ADMIN_USER/.ssh/"
log "Herramientas admin: /opt/remote-admin-tools.sh"
log "Dashboard: /home/$ADMIN_USER/dashboard.sh"
log ""
log "IMPORTANTE: Para acceso remoto seguro:"
log "1. Ejecute: /opt/distribute-ssh-keys.sh"
log "2. Configure su cliente SSH con la clave privada"
log "3. Conéctese usando: ssh $ADMIN_USER@$(hostname -I | awk '{print $1}')"
log "4. Cambie la contraseña temporal inmediatamente"
log ""
log "Próximo paso: Ejecutar deploy-parking-system.sh"

exit 0