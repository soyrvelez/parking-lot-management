#!/bin/bash
set -euo pipefail

# Script: Database Setup for Parking Management System
# Purpose: Install and configure PostgreSQL 14 with parking database
# Usage: sudo ./setup-database.sh

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

log "=== CONFIGURACIÓN DE BASE DE DATOS - POSTGRESQL ==="

# Generate secure password for database
DB_PASSWORD="ParkingMexico$(openssl rand -base64 12 | tr -d '+=/' | head -c 16)"
BACKUP_USER_PASSWORD="BackupParking$(openssl rand -base64 12 | tr -d '+=/' | head -c 16)"

# Install PostgreSQL 14
log "Instalando PostgreSQL 14..."
apt update
apt install -y postgresql-14 postgresql-contrib-14 postgresql-client-14

# Start and enable PostgreSQL service
log "Iniciando servicios de PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to be ready
log "Esperando que PostgreSQL esté listo..."
until sudo -u postgres pg_isready; do
    sleep 2
done

# Configure PostgreSQL
log "Configurando PostgreSQL..."
sudo -u postgres psql << EOF
-- Create main database user
CREATE USER parking_user WITH PASSWORD '$DB_PASSWORD';

-- Create parking database
CREATE DATABASE parking_lot OWNER parking_user;

-- Grant privileges to parking_user
GRANT ALL PRIVILEGES ON DATABASE parking_lot TO parking_user;
ALTER USER parking_user CREATEDB;

-- Create backup user (limited privileges)
CREATE USER backup_user WITH PASSWORD '$BACKUP_USER_PASSWORD';
GRANT CONNECT ON DATABASE parking_lot TO backup_user;

-- Connect to parking_lot database to set up schema permissions
\c parking_lot;

-- Grant schema usage to parking_user
GRANT USAGE ON SCHEMA public TO parking_user;
GRANT CREATE ON SCHEMA public TO parking_user;

-- Grant backup privileges
GRANT USAGE ON SCHEMA public TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;

-- Create training database (copy of main database structure)
\c postgres;
CREATE DATABASE parking_training OWNER parking_user;
GRANT ALL PRIVILEGES ON DATABASE parking_training TO parking_user;

\q
EOF

# Configure PostgreSQL for performance and security
log "Optimizando configuración de PostgreSQL..."

# Get PostgreSQL version and config path
PG_VERSION="14"
PG_CONFIG_PATH="/etc/postgresql/$PG_VERSION/main"

# Backup original configuration
cp "$PG_CONFIG_PATH/postgresql.conf" "$PG_CONFIG_PATH/postgresql.conf.backup"
cp "$PG_CONFIG_PATH/pg_hba.conf" "$PG_CONFIG_PATH/pg_hba.conf.backup"

# Configure postgresql.conf for parking system
cat >> "$PG_CONFIG_PATH/postgresql.conf" << EOF

# Parking System Optimizations
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Logging configuration
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'mod'
log_min_duration_statement = 1000

# Security settings
ssl = on
password_encryption = scram-sha-256

# Backup and archiving
wal_level = replica
archive_mode = on
archive_command = 'cp %p /opt/parking-backups/wal/%f'
max_wal_senders = 3
EOF

# Configure pg_hba.conf for security
cat > "$PG_CONFIG_PATH/pg_hba.conf" << EOF
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                peer
local   all             parking_user                            md5
local   all             backup_user                             md5

# IPv4 local connections
host    parking_lot     parking_user    127.0.0.1/32           scram-sha-256
host    parking_training parking_user   127.0.0.1/32           scram-sha-256
host    parking_lot     backup_user     127.0.0.1/32           scram-sha-256

# IPv6 local connections  
host    parking_lot     parking_user    ::1/128                scram-sha-256
host    parking_training parking_user   ::1/128                scram-sha-256

# Deny all other connections
host    all             all             0.0.0.0/0              reject
host    all             all             ::/0                   reject
EOF

# Create WAL archive directory
log "Creando directorio para archivos WAL..."
mkdir -p /opt/parking-backups/wal
chown postgres:postgres /opt/parking-backups/wal
chmod 750 /opt/parking-backups/wal

# Create database backup directory
log "Creando directorio para respaldos de base de datos..."
mkdir -p /opt/parking-backups/database
chown postgres:postgres /opt/parking-backups/database
chmod 750 /opt/parking-backups/database

# Save database credentials securely
log "Guardando credenciales de base de datos..."
cat > /opt/parking-db-credentials << EOF
# Parking System Database Credentials
# Created: $(date)
DB_USER=parking_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=parking_lot
DB_TRAINING=parking_training
BACKUP_USER=backup_user
BACKUP_PASSWORD=$BACKUP_USER_PASSWORD
DATABASE_URL=postgresql://parking_user:$DB_PASSWORD@localhost:5432/parking_lot
TRAINING_DATABASE_URL=postgresql://parking_user:$DB_PASSWORD@localhost:5432/parking_training
EOF

chmod 600 /opt/parking-db-credentials
chown root:root /opt/parking-db-credentials

# Create simple password file for backup scripts
echo "$DB_PASSWORD" > /opt/parking-db-password
chmod 600 /opt/parking-db-password
chown root:root /opt/parking-db-password

# Restart PostgreSQL to apply changes
log "Reiniciando PostgreSQL para aplicar cambios..."
systemctl restart postgresql

# Wait for PostgreSQL to be ready again
until sudo -u postgres pg_isready; do
    sleep 2
done

# Create database connection test script
cat > /opt/test-db-connection.sh << 'EOF'
#!/bin/bash
source /opt/parking-db-credentials

echo "Probando conexión a base de datos..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" 

if [ $? -eq 0 ]; then
    echo "✓ Conexión a base de datos exitosa"
else
    echo "✗ Error de conexión a base de datos"
    exit 1
fi
EOF

chmod +x /opt/test-db-connection.sh

# Test database connection
log "Probando conexión a base de datos..."
if /opt/test-db-connection.sh; then
    log "✓ Base de datos configurada correctamente"
else
    error "✗ Error en configuración de base de datos"
    exit 1
fi

# Create database maintenance script
cat > /opt/parking-db-maintenance.sh << 'EOF'
#!/bin/bash
# Database maintenance script for parking system

source /opt/parking-db-credentials

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Iniciando mantenimiento de base de datos..."

# Vacuum and analyze
log "Ejecutando VACUUM ANALYZE..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;"

# Update statistics
log "Actualizando estadísticas..."
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "ANALYZE;"

# Clean old logs
log "Limpiando logs antiguos..."
find /var/log/postgresql -name "*.log" -mtime +30 -delete

log "Mantenimiento completado"
EOF

chmod +x /opt/parking-db-maintenance.sh

# Set up daily maintenance cron job
log "Configurando mantenimiento automático..."
cat > /etc/cron.d/parking-db-maintenance << 'EOF'
# Daily PostgreSQL maintenance for parking system
0 2 * * * postgres /opt/parking-db-maintenance.sh >> /var/log/parking-db-maintenance.log 2>&1
EOF

# Configure PostgreSQL log rotation
cat > /etc/logrotate.d/postgresql-parking << 'EOF'
/var/log/postgresql/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 postgres postgres
    postrotate
        systemctl reload postgresql || true
    endscript
}
EOF

# Verify installation
log "Verificando instalación de PostgreSQL..."

# Check service status
if systemctl is-active --quiet postgresql; then
    log "✓ Servicio PostgreSQL activo"
else
    error "✗ Servicio PostgreSQL no está activo"
    exit 1
fi

# Check database exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw parking_lot; then
    log "✓ Base de datos parking_lot creada"
else
    error "✗ Base de datos parking_lot no existe"
    exit 1
fi

# Check user exists
if sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='parking_user'" | grep -q 1; then
    log "✓ Usuario parking_user creado"
else
    error "✗ Usuario parking_user no existe"
    exit 1
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Base de datos configurada: $(date)
PostgreSQL: $(sudo -u postgres psql --version | head -1)
Base de datos: parking_lot, parking_training
Usuario principal: parking_user
Usuario respaldo: backup_user
Credenciales: /opt/parking-db-credentials
EOF

log "=== CONFIGURACIÓN DE BASE DE DATOS COMPLETADA ==="
log "Credenciales guardadas en: /opt/parking-db-credentials"
log "Script de prueba: /opt/test-db-connection.sh"
log "Mantenimiento automático configurado"
log ""
log "Próximo paso: Ejecutar deploy-parking-system.sh"

exit 0