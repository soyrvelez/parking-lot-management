#!/bin/bash
set -euo pipefail

# Script: System Security Hardening for Parking Management System
# Purpose: Harden Ubuntu system for kiosk mode with security best practices
# Usage: sudo ./harden-system.sh

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

log "=== ENDURECIMIENTO DE SEGURIDAD DEL SISTEMA ==="

# Create security backup directory
log "Creando respaldo de configuración de seguridad..."
mkdir -p /opt/parking-backups/security-config
cp /etc/ssh/sshd_config /opt/parking-backups/security-config/ 2>/dev/null || true
cp /etc/sudoers /opt/parking-backups/security-config/ 2>/dev/null || true
cp -r /etc/ufw /opt/parking-backups/security-config/ 2>/dev/null || true

# 1. FIREWALL CONFIGURATION (UFW)
log "Configurando firewall UFW..."

# Reset UFW to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow specific services for parking system
log "Configurando reglas de firewall..."

# SSH (restricted to local network)
ufw allow from 192.168.0.0/16 to any port 22
ufw allow from 10.0.0.0/8 to any port 22
ufw allow from 172.16.0.0/12 to any port 22

# Web interface (local only)
ufw allow from 127.0.0.1 to any port 3000
ufw allow from 192.168.0.0/16 to any port 3000

# Printer communication
ufw allow out 9100
ufw allow from 192.168.1.100

# DNS
ufw allow out 53

# NTP
ufw allow out 123

# HTTP/HTTPS for updates only
ufw allow out 80
ufw allow out 443

# Enable UFW
ufw --force enable

log "✓ Firewall configurado y habilitado"

# 2. SSH HARDENING
log "Endureciendo configuración SSH..."

# Create hardened SSH config
cat > /etc/ssh/sshd_config << 'EOF'
# SSH Configuration for Parking System Security
# Hardened configuration for kiosk environment

# Protocol and encryption
Protocol 2
Port 22

# Authentication
PermitRootLogin no
PasswordAuthentication yes
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes

# Connection settings
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 60
MaxAuthTries 3
MaxSessions 3
MaxStartups 10:30:60

# User restrictions
AllowUsers operador admin
DenyUsers root
AllowGroups sudo admin

# Network settings
AddressFamily inet
ListenAddress 0.0.0.0
TCPKeepAlive yes

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Security features
StrictModes yes
IgnoreRhosts yes
HostbasedAuthentication no
PermitUserEnvironment no
X11Forwarding no
X11DisplayOffset 10
PrintMotd no
PrintLastLog yes
UsePrivilegeSeparation sandbox

# File transfer restrictions
AllowTcpForwarding no
AllowStreamLocalForwarding no
GatewayPorts no
PermitTunnel no

# Kerberos and GSSAPI (disabled)
KerberosAuthentication no
GSSAPIAuthentication no

# Banner and SFTP
Banner /etc/ssh/ssh_banner
Subsystem sftp /usr/lib/openssh/sftp-server -l INFO

# Compression
Compression no

# Additional security
DebianBanner no
VersionAddendum none
EOF

# Create SSH banner
cat > /etc/ssh/ssh_banner << 'EOF'
*******************************************************************
               SISTEMA DE ESTACIONAMIENTO
               ACCESO AUTORIZADO ÚNICAMENTE

Este sistema está monitoreado. Todo acceso es registrado.
El uso no autorizado está prohibido y será procesado 
conforme a la ley.

*******************************************************************
EOF

# Restart SSH service
systemctl restart ssh
log "✓ SSH endurecido y reiniciado"

# 3. FAIL2BAN CONFIGURATION
log "Configurando Fail2Ban..."

# Install fail2ban if not already installed
apt install -y fail2ban

# Create fail2ban configuration for parking system
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Ban hosts for 1 hour (3600 seconds)
bantime = 3600
findtime = 600
maxretry = 3
backend = auto
usedns = warn
logencoding = auto
enabled = false
mode = normal
filter = %(__name__)s[mode=%(mode)s]

# Email notification (configure if needed)
# destemail = admin@estacionamiento.com
# sendername = Fail2Ban-Estacionamiento
# mta = sendmail

# Default action
action = %(action_)s

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 3600

[sshd-ddos]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 6
bantime = 600

# Web application protection
[parking-web]
enabled = true
port = 3000
logpath = /var/log/parking-system/*.log
maxretry = 5
bantime = 1800
findtime = 300
filter = parking-web

[recidive]
enabled = true
logpath = /var/log/fail2ban.log
action = %(action_mwl)s
bantime = 86400
findtime = 86400
maxretry = 3
EOF

# Create custom filter for parking web app
cat > /etc/fail2ban/filter.d/parking-web.conf << 'EOF'
[Definition]
failregex = ^.*\[ERROR\].*Failed login attempt from <HOST>.*$
            ^.*\[WARN\].*Suspicious activity from <HOST>.*$
            ^.*\[ERROR\].*Rate limit exceeded from <HOST>.*$

ignoreregex =
EOF

# Start and enable fail2ban
systemctl enable fail2ban
systemctl restart fail2ban
log "✓ Fail2Ban configurado y habilitado"

# 4. KERNEL HARDENING
log "Endureciendo configuración del kernel..."

# Create sysctl security configuration
cat > /etc/sysctl.d/99-parking-security.conf << 'EOF'
# Kernel hardening for parking system

# Network security
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# ICMP
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# TCP/IP stack hardening
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Memory protection
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.yama.ptrace_scope = 1

# Core dumps
fs.suid_dumpable = 0
kernel.core_pattern = |/bin/false

# Address space layout randomization
kernel.randomize_va_space = 2

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# IPv6 privacy extensions
net.ipv6.conf.all.use_tempaddr = 2
net.ipv6.conf.default.use_tempaddr = 2

# Disable IPv6 if not needed
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
EOF

# Apply sysctl settings
sysctl --system
log "✓ Configuración del kernel endurecida"

# 5. FILE SYSTEM PERMISSIONS
log "Configurando permisos del sistema de archivos..."

# Secure sensitive files
chmod 600 /etc/ssh/ssh_host_*_key
chmod 644 /etc/ssh/ssh_host_*_key.pub
chmod 644 /etc/ssh/sshd_config
chmod 600 /etc/sudoers
chmod 440 /etc/sudoers.d/*

# Secure log files
chown root:adm /var/log
chmod 750 /var/log
find /var/log -type f -exec chmod 640 {} \;

# Secure parking system files
if [ -d /opt/parking-system ]; then
    chown -R root:root /opt/parking-system
    chmod -R 755 /opt/parking-system
fi

# Secure configuration files
chmod 600 /opt/parking-db-credentials 2>/dev/null || true
chown root:root /opt/parking-db-credentials 2>/dev/null || true

# Secure home directories
chmod 750 /home/operador
chown operador:operador /home/operador

log "✓ Permisos del sistema de archivos configurados"

# 6. USER ACCOUNT SECURITY
log "Configurando seguridad de cuentas de usuario..."

# Set password policies
cat > /etc/security/pwquality.conf << 'EOF'
# Password quality requirements for parking system

# Minimum password length
minlen = 12

# Require mixed case
ucredit = -1
lcredit = -1

# Require digits
dcredit = -1

# Require special characters
ocredit = -1

# Maximum consecutive characters
maxrepeat = 2

# Minimum character classes
minclass = 3

# Check dictionary words
dictcheck = 1

# Password history
enforce_for_root = 1
EOF

# Configure login.defs
sed -i 's/^PASS_MAX_DAYS.*/PASS_MAX_DAYS 90/' /etc/login.defs
sed -i 's/^PASS_MIN_DAYS.*/PASS_MIN_DAYS 1/' /etc/login.defs
sed -i 's/^PASS_WARN_AGE.*/PASS_WARN_AGE 7/' /etc/login.defs

# Lock unused system accounts
UNUSED_ACCOUNTS=("games" "news" "uucp" "proxy" "www-data" "backup" "list" "irc" "gnats" "nobody")
for account in "${UNUSED_ACCOUNTS[@]}"; do
    if id "$account" >/dev/null 2>&1; then
        usermod -L "$account"
        usermod -s /usr/sbin/nologin "$account"
    fi
done

log "✓ Seguridad de cuentas configurada"

# 7. AUDIT LOGGING
log "Configurando auditoría del sistema..."

# Install auditd
apt install -y auditd audispd-plugins

# Configure audit rules
cat > /etc/audit/rules.d/parking-audit.rules << 'EOF'
# Audit rules for parking system security

# Delete existing rules
-D

# Buffer settings
-b 8192

# Failure mode (0=silent 1=printk 2=panic)
-f 1

# Monitor file access
-w /opt/parking-system -p wa -k parking-system-access
-w /opt/parking-db-credentials -p wa -k database-credentials
-w /etc/ssh/sshd_config -p wa -k ssh-config
-w /etc/sudoers -p wa -k sudo-config
-w /etc/passwd -p wa -k user-accounts
-w /etc/group -p wa -k group-accounts
-w /etc/shadow -p wa -k password-changes

# Monitor network configuration
-w /etc/hosts -p wa -k network-config
-w /etc/resolv.conf -p wa -k dns-config

# Monitor critical directories
-w /etc -p wa -k system-config
-w /usr/bin -p wa -k binary-access
-w /usr/sbin -p wa -k system-binary-access

# System calls
-a always,exit -F arch=b64 -S adjtimex -S settimeofday -k time-change
-a always,exit -F arch=b32 -S adjtimex -S settimeofday -S stime -k time-change
-a always,exit -F arch=b64 -S clock_settime -k time-change
-a always,exit -F arch=b32 -S clock_settime -k time-change
-w /etc/localtime -p wa -k time-change

# User/group modifications
-w /etc/group -p wa -k identity
-w /etc/passwd -p wa -k identity
-w /etc/gshadow -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/security/opasswd -p wa -k identity

# Login/logout events
-w /var/log/lastlog -p wa -k logins
-w /var/run/faillock -p wa -k logins

# Process execution
-a always,exit -F arch=b64 -S execve -k exec
-a always,exit -F arch=b32 -S execve -k exec

# Network connections
-a always,exit -F arch=b64 -S connect -k network-connect
-a always,exit -F arch=b32 -S connect -k network-connect

# Make configuration immutable
-e 2
EOF

# Start and enable auditd
systemctl enable auditd
systemctl restart auditd
log "✓ Auditoría del sistema configurada"

# 8. DISABLE UNNECESSARY SERVICES
log "Deshabilitando servicios innecesarios..."

SERVICES_TO_DISABLE=(
    "bluetooth"
    "cups-browsed"
    "avahi-daemon"
    "snapd"
    "ModemManager"
    "whoopsie"
    "apport"
    "kerneloops"
    "speech-dispatcher"
    "brltty"
    "colord"
    "switcheroo-control"
    "geoclue"
    "accounts-daemon"
)

for service in "${SERVICES_TO_DISABLE[@]}"; do
    if systemctl is-enabled "$service" >/dev/null 2>&1; then
        systemctl stop "$service" 2>/dev/null || true
        systemctl disable "$service" 2>/dev/null || true
        systemctl mask "$service" 2>/dev/null || true
        log "Servicio $service deshabilitado"
    fi
done

log "✓ Servicios innecesarios deshabilitados"

# 9. SECURE TEMPORARY DIRECTORIES
log "Configurando directorios temporales seguros..."

# Secure /tmp
cat >> /etc/fstab << 'EOF'
# Secure temporary directories for parking system
tmpfs /tmp tmpfs defaults,rw,nosuid,nodev,noexec,relatime,size=2G 0 0
tmpfs /var/tmp tmpfs defaults,rw,nosuid,nodev,noexec,relatime,size=1G 0 0
tmpfs /dev/shm tmpfs defaults,rw,nosuid,nodev,noexec,relatime,size=1G 0 0
EOF

log "✓ Directorios temporales configurados"

# 10. INTRUSION DETECTION
log "Configurando detección de intrusiones..."

# Install and configure rkhunter
apt install -y rkhunter

# Configure rkhunter
cat > /etc/rkhunter.conf << 'EOF'
# RKHunter configuration for parking system

# Logging
LOGFILE=/var/log/rkhunter.log
APPEND_LOG=1
COPY_LOG_ON_ERROR=1

# Update options
UPDATE_MIRRORS=1
MIRRORS_MODE=0
WEB_CMD=""

# Scanning options
PKGMGR=DPKG
PHALANX2_DIRTEST=0
ALLOW_SSH_ROOT_USER=no
ALLOW_SSH_PROT_V1=0

# Mail configuration
MAIL-ON-WARNING=root
MAIL_CMD=mail

# White list
RTKT_FILE_WHITELIST=""
HASH_FUNC=SHA256
HASH_FLD_IDX=3

# Check options
SCRIPTWHITELIST=/usr/bin/groups
SCRIPTWHITELIST=/usr/bin/ldd
SCRIPTWHITELIST=/usr/bin/which
SCRIPTWHITELIST=/usr/sbin/adduser

# System specific
DISABLE_TESTS="suspscan hidden_procs deleted_files packet_cap_apps apps"
EOF

# Initialize rkhunter database
rkhunter --update
rkhunter --propupd

# Configure daily rkhunter scan
cat > /etc/cron.daily/rkhunter << 'EOF'
#!/bin/bash
# Daily rkhunter scan for parking system

/usr/bin/rkhunter --cronjob --update --quiet
EOF

chmod +x /etc/cron.daily/rkhunter

log "✓ Detección de intrusiones configurada"

# 11. SYSTEM MONITORING
log "Configurando monitoreo del sistema..."

# Create system monitoring script
cat > /opt/security-monitor.sh << 'EOF'
#!/bin/bash

# Sistema de monitoreo de seguridad para estacionamiento
# Verifica estado de seguridad cada hora

LOG_FILE="/var/log/security-monitor.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

alert() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ALERTA: $1" >> $LOG_FILE
    # Send alert to system admin (configure notification method)
    logger -p auth.warn "PARKING-SECURITY: $1"
}

log "=== VERIFICACIÓN DE SEGURIDAD ==="

# Check firewall status
if ! ufw status | grep -q "Status: active"; then
    alert "Firewall UFW no está activo"
fi

# Check SSH service
if ! systemctl is-active --quiet ssh; then
    alert "Servicio SSH no está activo"
fi

# Check fail2ban
if ! systemctl is-active --quiet fail2ban; then
    alert "Fail2Ban no está activo"
fi

# Check audit daemon
if ! systemctl is-active --quiet auditd; then
    alert "Auditd no está activo"
fi

# Check for failed login attempts
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log | grep "$(date '+%b %d')" | wc -l)
if [ "$FAILED_LOGINS" -gt 10 ]; then
    alert "Múltiples intentos de login fallidos: $FAILED_LOGINS"
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    alert "Espacio en disco bajo: ${DISK_USAGE}% usado"
fi

# Check system load
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
if (( $(echo "$LOAD_AVG > 5.0" | bc -l) )); then
    alert "Carga del sistema alta: $LOAD_AVG"
fi

# Check for suspicious processes
SUSPICIOUS_PROCS=$(ps aux | grep -E "(nc|netcat|telnet)" | grep -v grep | wc -l)
if [ "$SUSPICIOUS_PROCS" -gt 0 ]; then
    alert "Procesos sospechosos detectados"
fi

log "Verificación de seguridad completada"
EOF

chmod +x /opt/security-monitor.sh

# Add security monitoring to cron
cat > /etc/cron.hourly/security-monitor << 'EOF'
#!/bin/bash
/opt/security-monitor.sh
EOF

chmod +x /etc/cron.hourly/security-monitor

log "✓ Monitoreo de seguridad configurado"

# 12. LOG ROTATION AND RETENTION
log "Configurando rotación y retención de logs..."

# Configure logrotate for security logs
cat > /etc/logrotate.d/parking-security << 'EOF'
/var/log/security-monitor.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}

/var/log/auth.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload rsyslog || true
    endscript
}

/var/log/fail2ban.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload fail2ban || true
    endscript
}

/var/log/rkhunter.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
}
EOF

log "✓ Rotación de logs configurada"

# 13. VERIFICATION AND TESTING
log "Verificando configuración de seguridad..."

# Test firewall
if ufw status | grep -q "Status: active"; then
    log "✓ Firewall UFW activo"
else
    error "✗ Firewall UFW no activo"
fi

# Test SSH
if systemctl is-active --quiet ssh; then
    log "✓ SSH activo"
else
    error "✗ SSH no activo"
fi

# Test fail2ban
if systemctl is-active --quiet fail2ban; then
    log "✓ Fail2Ban activo"
else
    error "✗ Fail2Ban no activo"
fi

# Test auditd
if systemctl is-active --quiet auditd; then
    log "✓ Auditd activo"
else
    error "✗ Auditd no activo"
fi

# Check file permissions
if [ "$(stat -c %a /etc/ssh/sshd_config)" = "644" ]; then
    log "✓ Permisos SSH correctos"
else
    warn "⚠ Verificar permisos SSH"
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Sistema endurecido: $(date)
Firewall: UFW configurado
SSH: Endurecido
Fail2Ban: Configurado
Auditoría: Auditd activo
Detección intrusiones: RKHunter
Monitoreo: Cada hora
Logs seguridad: /var/log/security-monitor.log
Servicios deshabilitados: ${#SERVICES_TO_DISABLE[@]}
EOF

log "=== ENDURECIMIENTO DE SEGURIDAD COMPLETADO ==="
log "Firewall UFW configurado y activo"
log "SSH endurecido con configuración segura"
log "Fail2Ban configurado para protección automática"
log "Auditoría del sistema habilitada"
log "Detección de intrusiones RKHunter configurada"
log "Monitoreo de seguridad cada hora"
log ""
log "IMPORTANTE: Revise los siguientes archivos de configuración:"
log "- Firewall: ufw status"
log "- SSH: /etc/ssh/sshd_config"
log "- Fail2Ban: /etc/fail2ban/jail.local"
log "- Logs seguridad: /var/log/security-monitor.log"
log ""
log "Próximo paso: Ejecutar setup-remote-admin.sh"

exit 0