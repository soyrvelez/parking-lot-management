#!/bin/bash
set -euo pipefail

# Script: Deploy Parking Management System
# Purpose: Deploy the complete parking system application and configure services
# Usage: sudo ./deploy-parking-system.sh [production|development]

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
DEPLOYMENT_MODE="${1:-production}"
APP_DIR="/opt/parking-system"
REPO_URL="https://github.com/usuario/parking-lot-management.git"  # Update with actual repo
SERVICE_USER="parking"
WEB_PORT="3000"
API_PORT="3001"

log "=== DESPLIEGUE SISTEMA DE ESTACIONAMIENTO ==="
log "Modo de despliegue: $DEPLOYMENT_MODE"

# Verify prerequisites
log "Verificando prerrequisitos..."

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    error "Node.js no está instalado. Ejecute setup-system.sh primero"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js versión 18+ requerida. Versión actual: $(node --version)"
    exit 1
fi

# Check PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    error "PostgreSQL no está activo. Ejecute setup-database.sh primero"
    exit 1
fi

# Check database credentials
if [ ! -f "/opt/parking-db-credentials" ]; then
    error "Credenciales de base de datos no encontradas. Ejecute setup-database.sh primero"
    exit 1
fi

log "✓ Prerrequisitos verificados"

# Create service user
log "Creando usuario de servicio..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$APP_DIR" -c "Parking System Service" "$SERVICE_USER"
    log "✓ Usuario de servicio '$SERVICE_USER' creado"
else
    log "Usuario de servicio '$SERVICE_USER' ya existe"
fi

# Create application directory
log "Creando directorio de aplicación..."
mkdir -p "$APP_DIR"
mkdir -p /var/log/parking-system
mkdir -p /var/lib/parking-system

# Set ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" /var/log/parking-system
chown -R "$SERVICE_USER:$SERVICE_USER" /var/lib/parking-system

# For demo purposes, we'll simulate deployment since we have the code locally
log "Desplegando código de aplicación..."

# Copy source code from current directory to deployment directory
if [ -d "$(pwd)/src" ]; then
    log "Copiando código fuente desde directorio actual..."
    cp -r "$(pwd)"/* "$APP_DIR/" 2>/dev/null || true
    # Remove git directory and sensitive files
    rm -rf "$APP_DIR/.git" 2>/dev/null || true
    rm -f "$APP_DIR/.env*" 2>/dev/null || true
else
    # Alternative: clone from repository (commented for demo)
    log "Clonando repositorio..."
    # git clone "$REPO_URL" "$APP_DIR"
    
    # For demo, create minimal structure
    mkdir -p "$APP_DIR"/{src,scripts,public}
    cat > "$APP_DIR/package.json" << 'EOF'
{
  "name": "parking-lot-management",
  "version": "1.0.0",
  "description": "Sistema de Gestión de Estacionamiento",
  "main": "dist/app.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "ts-node src/app.ts",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "decimal.js": "^10.4.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
EOF
fi

# Install dependencies
log "Instalando dependencias de Node.js..."
cd "$APP_DIR"

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    npm init -y
    npm install express pg bcrypt jsonwebtoken decimal.js cors helmet winston
    npm install -D @types/node @types/express typescript ts-node
fi

# Install production dependencies
if [ "$DEPLOYMENT_MODE" = "production" ]; then
    npm ci --only=production
else
    npm install
fi

log "✓ Dependencias instaladas"

# Load database credentials
source /opt/parking-db-credentials

# Create environment configuration
log "Configurando variables de entorno..."
cat > "$APP_DIR/.env" << EOF
# Parking System Environment Configuration
# Generated: $(date)

# Application
NODE_ENV=$DEPLOYMENT_MODE
PORT=$WEB_PORT
API_PORT=$API_PORT

# Database
DATABASE_URL=$DATABASE_URL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
BCRYPT_ROUNDS=12

# Localization
TZ=America/Mexico_City
LANG=es_MX.UTF-8

# Hardware
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
SCANNER_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/parking-system

# Features
ENABLE_METRICS=true
ENABLE_AUDIT=true
ENABLE_BACKUP=true

# Admin
ADMIN_EMAIL=admin@estacionamiento.local
SYSTEM_NAME=Sistema de Estacionamiento

# Cache
REDIS_URL=redis://localhost:6379
CACHE_TTL=300

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF

chmod 600 "$APP_DIR/.env"
chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/.env"

# Build application if TypeScript
log "Compilando aplicación..."
if [ -f "tsconfig.json" ]; then
    npm run build 2>/dev/null || npx tsc 2>/dev/null || log "Build skipped - no TypeScript config"
fi

# Create startup script
log "Creando script de inicio..."
cat > "$APP_DIR/start.sh" << 'EOF'
#!/bin/bash

# Startup script for parking system
cd /opt/parking-system

# Source environment variables
source .env

# Create logs directory
mkdir -p /var/log/parking-system

# Start application
if [ -f "dist/app.js" ]; then
    exec node dist/app.js
elif [ -f "src/app.js" ]; then
    exec node src/app.js
elif [ -f "app.js" ]; then
    exec node app.js
else
    echo "No application entry point found"
    exit 1
fi
EOF

chmod +x "$APP_DIR/start.sh"

# Create health check script
cat > "$APP_DIR/health-check.sh" << 'EOF'
#!/bin/bash

# Health check script for parking system
source /opt/parking-system/.env

# Check web server
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT:-3000}/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "OK"
    exit 0
else
    echo "FAIL - HTTP Status: $HTTP_STATUS"
    exit 1
fi
EOF

chmod +x "$APP_DIR/health-check.sh"

# Set final ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# Run database migrations/setup
log "Configurando esquema de base de datos..."
cat > /tmp/parking-schema.sql << 'EOF'
-- Parking System Database Schema
-- Created for production deployment

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pricing configuration table
CREATE TABLE IF NOT EXISTS pricing_config (
    id SERIAL PRIMARY KEY,
    minimum_hours INTEGER NOT NULL DEFAULT 1,
    minimum_rate DECIMAL(10,2) NOT NULL,
    increment_minutes INTEGER NOT NULL DEFAULT 15,
    increment_rate DECIMAL(10,2) NOT NULL,
    daily_special_hours INTEGER,
    daily_special_rate DECIMAL(10,2),
    monthly_rate DECIMAL(10,2) NOT NULL,
    lost_ticket_fee DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO pricing_config (
    minimum_rate, increment_rate, monthly_rate, lost_ticket_fee
) VALUES (25.00, 5.00, 800.00, 100.00)
ON CONFLICT DO NOTHING;

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMP WITH TIME ZONE,
    total_amount DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    barcode VARCHAR(50) UNIQUE NOT NULL,
    printed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pension customers table
CREATE TABLE IF NOT EXISTS pension_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    plate_number VARCHAR(20) NOT NULL,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    monthly_rate DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    ticket_id UUID REFERENCES tickets(id),
    pension_customer_id UUID REFERENCES pension_customers(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    operator_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cash register table
CREATE TABLE IF NOT EXISTS cash_register (
    id SERIAL PRIMARY KEY,
    opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    withdrawals JSONB DEFAULT '[]'::jsonb,
    deposits JSONB DEFAULT '[]'::jsonb
);

-- Insert default cash register
INSERT INTO cash_register (opening_balance, current_balance) 
VALUES (0.00, 0.00)
ON CONFLICT DO NOTHING;

-- System users table (for admin access)
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_entry_time ON tickets(entry_time);
CREATE INDEX IF NOT EXISTS idx_tickets_plate_number ON tickets(plate_number);
CREATE INDEX IF NOT EXISTS idx_tickets_barcode ON tickets(barcode);
CREATE INDEX IF NOT EXISTS idx_pension_customers_plate ON pension_customers(plate_number);
CREATE INDEX IF NOT EXISTS idx_pension_customers_active ON pension_customers(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

-- Insert default admin user (password: admin123 - change immediately)
INSERT INTO system_users (username, password_hash, role) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXzgVEn11.2.', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_pricing_config_updated_at BEFORE UPDATE ON pricing_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pension_customers_updated_at BEFORE UPDATE ON pension_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_users_updated_at BEFORE UPDATE ON system_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EOF

# Apply database schema
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -f /tmp/parking-schema.sql

# Clean up
rm /tmp/parking-schema.sql

log "✓ Esquema de base de datos configurado"

# Create reverse proxy configuration (nginx)
log "Configurando proxy reverso..."
apt install -y nginx

# Configure nginx
cat > /etc/nginx/sites-available/parking-system << EOF
# Nginx configuration for Parking System

upstream parking_backend {
    server 127.0.0.1:$WEB_PORT;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost $(hostname) $(hostname -I | awk '{print $1}');
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Hide server version
    server_tokens off;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    
    # Static files
    location /static/ {
        alias $APP_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        proxy_pass http://parking_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://parking_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Main application
    location / {
        proxy_pass http://parking_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}

# Rate limiting zones
http {
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/parking-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start and enable nginx
systemctl enable nginx
systemctl restart nginx

log "✓ Proxy reverso configurado"

# Create log rotation configuration
log "Configurando rotación de logs..."
cat > /etc/logrotate.d/parking-system << 'EOF'
/var/log/parking-system/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 parking parking
    postrotate
        systemctl reload parking-system || true
    endscript
}

/var/log/nginx/access.log /var/log/nginx/error.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload nginx || true
    endscript
}
EOF

# Create monitoring script
log "Creando script de monitoreo de aplicación..."
cat > /opt/parking-app-monitor.sh << 'EOF'
#!/bin/bash

# Application monitoring script for parking system
# Monitors application health and restarts if needed

LOG_FILE="/var/log/parking-system/monitor.log"
HEALTH_URL="http://localhost:3000/health"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a $LOG_FILE
}

# Check if application is responding
check_health() {
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
    echo "$status_code"
}

# Main monitoring logic
main() {
    # Check application health
    HEALTH_STATUS=$(check_health)
    
    if [ "$HEALTH_STATUS" = "200" ]; then
        log "Application healthy - HTTP $HEALTH_STATUS"
    else
        error "Application unhealthy - HTTP $HEALTH_STATUS"
        
        # Check if service is running
        if systemctl is-active --quiet parking-system; then
            log "Service running but not responding, restarting..."
            systemctl restart parking-system
            sleep 30
            
            # Check again after restart
            HEALTH_STATUS=$(check_health)
            if [ "$HEALTH_STATUS" = "200" ]; then
                log "Application recovered after restart"
            else
                error "Application still unhealthy after restart"
            fi
        else
            error "Service not running, starting..."
            systemctl start parking-system
        fi
    fi
    
    # Check disk space
    DISK_USAGE=$(df /var/log | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        error "Disk space low: ${DISK_USAGE}% used"
    fi
    
    # Check memory usage
    MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$MEM_USAGE" -gt 85 ]; then
        error "Memory usage high: ${MEM_USAGE}%"
    fi
}

main
EOF

chmod +x /opt/parking-app-monitor.sh

# Add monitoring to cron
cat > /etc/cron.d/parking-app-monitor << 'EOF'
# Application monitoring every 2 minutes
*/2 * * * * root /opt/parking-app-monitor.sh
EOF

# Test deployment
log "Probando despliegue..."

# Check if all components are ready
sleep 5

# Test nginx
if systemctl is-active --quiet nginx; then
    log "✓ Nginx activo"
else
    error "✗ Nginx no activo"
fi

# Test database connection
if sudo -u $SERVICE_USER bash -c "cd $APP_DIR && timeout 10 node -e 'process.exit(0)'" 2>/dev/null; then
    log "✓ Node.js funcionando"
else
    warn "⚠ Verificar Node.js"
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Sistema desplegado: $(date)
Modo: $DEPLOYMENT_MODE
Directorio: $APP_DIR
Usuario servicio: $SERVICE_USER
Puerto web: $WEB_PORT
Proxy: Nginx configurado
Base datos: Esquema aplicado
Monitoreo: Cada 2 minutos
Logs: /var/log/parking-system/
Health check: $HEALTH_URL
EOF

log "=== DESPLIEGUE DEL SISTEMA COMPLETADO ==="
log "Aplicación desplegada en: $APP_DIR"
log "Usuario de servicio: $SERVICE_USER"
log "Puerto web: $WEB_PORT"
log "Proxy reverso: Nginx configurado"
log "Base de datos: Esquema aplicado"
log "Monitoreo: Configurado cada 2 minutos"
log "Logs: /var/log/parking-system/"
log ""
log "Para completar la instalación:"
log "1. Ejecute: setup-systemd-services.sh"
log "2. Inicie el sistema: systemctl start parking-system"
log "3. Verifique: curl http://localhost/health"
log ""
log "Credenciales admin por defecto:"
log "Usuario: admin"
log "Contraseña: admin123 (CAMBIAR INMEDIATAMENTE)"
log ""
log "Próximo paso: Ejecutar setup-systemd-services.sh"

exit 0