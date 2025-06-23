#!/bin/bash
set -euo pipefail

# Script: Production Configuration for Parking Management System
# Purpose: Configure system for production environment with optimal settings
# Usage: sudo ./configure-production.sh

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

log "=== CONFIGURACIÓN PRODUCCIÓN SISTEMA DE ESTACIONAMIENTO ==="

# Configuration variables
APP_DIR="/opt/parking-system"
CONFIG_FILE="$APP_DIR/.env"
PRODUCTION_CONFIG="/opt/parking-production-config.json"

# Create production configuration file
log "Creando configuración de producción..."
cat > "$PRODUCTION_CONFIG" << 'EOF'
{
  "system": {
    "environment": "production",
    "debug": false,
    "timezone": "America/Mexico_City",
    "language": "es-MX",
    "charset": "UTF-8"
  },
  "database": {
    "pool_size": 20,
    "max_connections": 100,
    "query_timeout": 30000,
    "connection_timeout": 10000,
    "ssl": false,
    "backup_retention_days": 30
  },
  "web_server": {
    "port": 3000,
    "workers": 4,
    "max_requests_per_minute": 100,
    "session_timeout": 1800,
    "compression": true,
    "trust_proxy": true
  },
  "security": {
    "bcrypt_rounds": 12,
    "jwt_expiry": "1h",
    "rate_limiting": true,
    "helmet_config": true,
    "cors_strict": true,
    "csrf_protection": true
  },
  "hardware": {
    "printer": {
      "ip": "192.168.1.100",
      "port": 9100,
      "timeout": 5000,
      "retry_attempts": 3,
      "encoding": "latin1"
    },
    "scanner": {
      "enabled": true,
      "device": "/dev/input/barcode-scanner-event",
      "timeout": 1000,
      "code_type": "code39"
    }
  },
  "business": {
    "currency": "MXN",
    "currency_symbol": "$",
    "decimal_places": 2,
    "minimum_payment": 5.00,
    "maximum_bill": 500.00,
    "receipt_footer": "Gracias por su visita",
    "ticket_validity_hours": 24
  },
  "logging": {
    "level": "info",
    "max_file_size": "10MB",
    "max_files": 30,
    "audit_enabled": true,
    "performance_monitoring": true
  },
  "monitoring": {
    "health_check_interval": 60,
    "performance_metrics": true,
    "error_reporting": true,
    "uptime_monitoring": true
  },
  "backup": {
    "auto_backup": true,
    "backup_schedule": "0 2 * * *",
    "retention_policy": {
      "daily": 7,
      "weekly": 4,
      "monthly": 12
    }
  }
}
EOF

# Update application environment variables for production
log "Actualizando variables de entorno para producción..."

# Load database credentials
if [ -f "/opt/parking-db-credentials" ]; then
    source /opt/parking-db-credentials
else
    error "Credenciales de base de datos no encontradas"
    exit 1
fi

# Update .env file with production settings
cat > "$CONFIG_FILE" << EOF
# Parking System Production Configuration
# Generated: $(date)

# Environment
NODE_ENV=production
DEBUG=false
LOG_LEVEL=info

# Application
PORT=3000
APP_NAME=Sistema de Estacionamiento
APP_VERSION=1.0.0

# Database
DATABASE_URL=$DATABASE_URL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_POOL_SIZE=20
DB_MAX_CONNECTIONS=100

# Security
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 64)
BCRYPT_ROUNDS=12
CSRF_SECRET=$(openssl rand -base64 32)

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_FAILED_REQUESTS=true

# Localization
TZ=America/Mexico_City
LANG=es_MX.UTF-8
LC_ALL=es_MX.UTF-8
CURRENCY=MXN
CURRENCY_SYMBOL=$

# Hardware
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
PRINTER_TIMEOUT=5000
SCANNER_ENABLED=true
SCANNER_DEVICE=/dev/input/barcode-scanner-event

# Business Rules
MINIMUM_PAYMENT=5.00
MAXIMUM_BILL=500.00
TICKET_VALIDITY_HOURS=24
DEFAULT_PARKING_RATE=25.00
INCREMENT_RATE=5.00

# Logging
LOG_DIR=/var/log/parking-system
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=30
AUDIT_ENABLED=true

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
PERFORMANCE_MONITORING=true

# Backup
AUTO_BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30

# Features
ENABLE_PENSION_CUSTOMERS=true
ENABLE_LOST_TICKET_FEE=true
ENABLE_CASH_REGISTER=true
ENABLE_REPORTS=true
ENABLE_AUDIT_LOG=true

# Email (configure if needed)
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# ADMIN_EMAIL=admin@estacionamiento.local

# Redis (if using cache)
# REDIS_URL=redis://localhost:6379
# CACHE_TTL=300

# SSL/TLS (if using HTTPS)
# SSL_ENABLED=false
# SSL_CERT_PATH=
# SSL_KEY_PATH=

EOF

chmod 600 "$CONFIG_FILE"
chown parking:parking "$CONFIG_FILE"

# Configure nginx for production
log "Configurando Nginx para producción..."
cat > /etc/nginx/sites-available/parking-system << 'EOF'
# Nginx Production Configuration for Parking System

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=3r/m;

# Upstream backend
upstream parking_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Main server block
server {
    listen 80;
    server_name localhost $(hostname) $(hostname -I | awk '{print $1}');
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Hide server information
    server_tokens off;
    
    # Client settings
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    
    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;
    
    # Static files with caching
    location /static/ {
        alias /opt/parking-system/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        
        # Security for static files
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health check (no rate limiting)
    location /health {
        proxy_pass http://parking_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
        
        # Quick timeout for health checks
        proxy_connect_timeout 3s;
        proxy_send_timeout 3s;
        proxy_read_timeout 3s;
    }
    
    # API endpoints with rate limiting
    location /api/ {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        
        proxy_pass http://parking_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
    
    # Login endpoint with stricter rate limiting
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        limit_req_status 429;
        
        proxy_pass http://parking_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Admin interface (additional security)
    location /admin {
        # Optional: restrict to local network
        # allow 192.168.0.0/16;
        # allow 10.0.0.0/8;
        # deny all;
        
        proxy_pass http://parking_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Main application
    location / {
        proxy_pass http://parking_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Caching for dynamic content
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Block sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(sql|log|env)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
    }
    
    location = /404.html {
        root /usr/share/nginx/html;
    }
}

# Optional SSL/HTTPS configuration (commented out)
# server {
#     listen 443 ssl http2;
#     server_name localhost $(hostname);
#     
#     ssl_certificate /path/to/certificate.pem;
#     ssl_certificate_key /path/to/private.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
#     ssl_prefer_server_ciphers off;
#     ssl_session_cache shared:SSL:10m;
#     
#     # Include main configuration
#     include /etc/nginx/sites-available/parking-system-common.conf;
# }
EOF

# Test nginx configuration
nginx -t && systemctl reload nginx

# Configure PostgreSQL for production
log "Optimizando PostgreSQL para producción..."
cat >> /etc/postgresql/14/main/postgresql.conf << 'EOF'

# Production optimizations for parking system
shared_buffers = 512MB
effective_cache_size = 2GB
work_mem = 8MB
maintenance_work_mem = 128MB
max_connections = 100
checkpoint_segments = 32
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100

# Logging for production
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
EOF

systemctl restart postgresql

# Configure system limits for production
log "Configurando límites del sistema..."
cat > /etc/security/limits.d/parking-production.conf << 'EOF'
# Production limits for parking system

# PostgreSQL user
postgres soft nofile 65536
postgres hard nofile 65536

# Parking application user
parking soft nofile 65536
parking hard nofile 65536
parking soft nproc 4096
parking hard nproc 4096

# Nginx user
www-data soft nofile 65536
www-data hard nofile 65536
EOF

# Configure kernel parameters for production
log "Configurando parámetros del kernel..."
cat >> /etc/sysctl.d/99-parking-production.conf << 'EOF'

# Production optimizations for parking system

# Network performance
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_max_syn_backlog = 8192

# File system
fs.file-max = 2097152
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# PostgreSQL optimizations
kernel.shmmax = 1073741824
kernel.shmall = 262144
EOF

sysctl --system

# Configure log rotation for production
log "Configurando rotación de logs..."
cat > /etc/logrotate.d/parking-production << 'EOF'
/var/log/parking-system/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 parking parking
    sharedscripts
    postrotate
        systemctl reload parking-system || true
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi \
    endscript
    postrotate
        systemctl reload nginx || true
    endscript
}
EOF

# Configure monitoring for production
log "Configurando monitoreo de producción..."
cat > /opt/production-monitor.sh << 'EOF'
#!/bin/bash

# Production monitoring script for parking system
# Enhanced monitoring for production environment

ALERT_EMAIL="admin@estacionamiento.local"
LOG_FILE="/var/log/parking-system/production-monitor.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

alert() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ALERT: $1" | tee -a $LOG_FILE
    logger -p local0.err "PARKING-PRODUCTION-ALERT: $1"
    # Send email if configured
    # echo "$1" | mail -s "Parking System Alert" $ALERT_EMAIL
}

# Check application performance
check_application_performance() {
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/health)
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
        alert "Application response time high: ${response_time}s"
    fi
    
    local memory_usage=$(ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | grep parking | head -1 | awk '{print $4}')
    if (( $(echo "$memory_usage > 70.0" | bc -l) )); then
        alert "Application memory usage high: ${memory_usage}%"
    fi
}

# Check database performance
check_database_performance() {
    source /opt/parking-db-credentials
    
    local connections=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
    if [ "$connections" -gt 80 ]; then
        alert "Database connections high: $connections"
    fi
    
    local slow_queries=$(PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30 seconds';" 2>/dev/null | xargs)
    if [ "$slow_queries" -gt 5 ]; then
        alert "Slow database queries detected: $slow_queries"
    fi
}

# Check disk space
check_disk_space() {
    local disk_usage=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        alert "Disk space critical: ${disk_usage}%"
    fi
    
    local log_disk_usage=$(df /var/log | awk 'NR==2{print $5}' | sed 's/%//')
    if [ "$log_disk_usage" -gt 80 ]; then
        alert "Log disk space high: ${log_disk_usage}%"
    fi
}

# Check system resources
check_system_resources() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    if (( $(echo "$load_avg > 4.0" | bc -l) )); then
        alert "System load high: $load_avg"
    fi
    
    local memory_percent=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$memory_percent" -gt 90 ]; then
        alert "System memory critical: ${memory_percent}%"
    fi
}

# Check hardware connectivity
check_hardware() {
    if ! ping -c 1 192.168.1.100 >/dev/null 2>&1; then
        alert "Thermal printer not responding"
    fi
    
    if ! lsusb | grep -q "0c2e:0b61"; then
        alert "Barcode scanner not detected"
    fi
}

# Main monitoring loop
main() {
    log "Production monitoring check started"
    
    check_application_performance
    check_database_performance
    check_disk_space
    check_system_resources
    check_hardware
    
    log "Production monitoring check completed"
}

main
EOF

chmod +x /opt/production-monitor.sh

# Add production monitoring to cron
cat > /etc/cron.d/parking-production-monitor << 'EOF'
# Production monitoring every 5 minutes
*/5 * * * * root /opt/production-monitor.sh
EOF

# Configure backup for production
log "Configurando respaldos para producción..."
cat > /etc/cron.d/parking-production-backup << 'EOF'
# Production backup schedule
0 1 * * * postgres /opt/parking-backup.sh daily >> /var/log/parking-system/backup-daily.log 2>&1
0 2 * * 0 postgres /opt/parking-backup.sh weekly >> /var/log/parking-system/backup-weekly.log 2>&1
0 3 1 * * postgres /opt/parking-backup.sh monthly >> /var/log/parking-system/backup-monthly.log 2>&1
EOF

# Create production maintenance script
log "Creando script de mantenimiento de producción..."
cat > /opt/production-maintenance.sh << 'EOF'
#!/bin/bash

# Production maintenance script
# Comprehensive maintenance for production environment

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] MAINTENANCE: $1"
}

# Daily maintenance tasks
daily_maintenance() {
    log "Starting daily maintenance"
    
    # Database maintenance
    /opt/parking-db-maintenance.sh
    
    # Log cleanup
    find /var/log/parking-system -name "*.log" -mtime +30 -delete
    
    # Clear application cache
    sudo -u parking rm -rf /opt/parking-system/tmp/* 2>/dev/null || true
    
    # Update system statistics
    updatedb
    
    log "Daily maintenance completed"
}

# Weekly maintenance tasks
weekly_maintenance() {
    log "Starting weekly maintenance"
    
    # Security updates
    unattended-upgrade
    
    # Database optimization
    source /opt/parking-db-credentials
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;"
    
    # System cleanup
    apt-get autoremove -y
    apt-get autoclean
    
    log "Weekly maintenance completed"
}

# Execute based on parameter
case "${1:-daily}" in
    "daily")
        daily_maintenance
        ;;
    "weekly")
        weekly_maintenance
        ;;
    *)
        echo "Usage: $0 {daily|weekly}"
        exit 1
        ;;
esac
EOF

chmod +x /opt/production-maintenance.sh

# Add maintenance to cron
cat > /etc/cron.d/parking-production-maintenance << 'EOF'
# Production maintenance schedule
0 4 * * * root /opt/production-maintenance.sh daily >> /var/log/parking-system/maintenance.log 2>&1
0 5 * * 0 root /opt/production-maintenance.sh weekly >> /var/log/parking-system/maintenance.log 2>&1
EOF

# Final production checks
log "Ejecutando verificaciones finales de producción..."

# Restart services with new configuration
systemctl restart parking-system
systemctl restart nginx
sleep 10

# Test application
if curl -s http://localhost/health | grep -q "OK"; then
    log "✓ Aplicación respondiendo correctamente"
else
    error "✗ Aplicación no responde después de configuración"
fi

# Test database
if /opt/test-db-connection.sh >/dev/null 2>&1; then
    log "✓ Base de datos funcionando correctamente"
else
    error "✗ Error en conexión de base de datos"
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Configuración producción aplicada: $(date)
Nginx: Optimizado para producción
PostgreSQL: Optimizado para producción
Límites sistema: Configurados
Monitoreo: Cada 5 minutos
Mantenimiento: Diario/semanal automatizado
Respaldos: Horario de producción
EOF

log "=== CONFIGURACIÓN DE PRODUCCIÓN COMPLETADA ==="
log "Sistema optimizado para ambiente de producción"
log "Configuración guardada en: $PRODUCTION_CONFIG"
log "Monitoreo de producción: /opt/production-monitor.sh"
log "Mantenimiento: /opt/production-maintenance.sh"
log ""
log "IMPORTANTE: Sistema configurado para máximo rendimiento y confiabilidad"
log "- Nginx optimizado con compresión y cache"
log "- PostgreSQL optimizado para carga de trabajo"
log "- Monitoreo automático cada 5 minutos"
log "- Mantenimiento automático diario y semanal"
log "- Respaldos en horario de producción"
log ""
log "El sistema está listo para operación 24/7 en producción"

exit 0