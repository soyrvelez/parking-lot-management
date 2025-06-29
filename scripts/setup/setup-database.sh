#!/bin/bash

# Parking System - Database Setup (Modernized)
# Purpose: Install and configure PostgreSQL 14 with parking database
# Usage: sudo ./setup-database.sh

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Get script directory and source shared libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
source "$SCRIPT_DIR/../lib/logging.sh"
source "$SCRIPT_DIR/../lib/validation.sh"
source "$SCRIPT_DIR/../lib/package-manager.sh"
source "$SCRIPT_DIR/../lib/service-manager.sh"

# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================

# Database credentials (will be saved securely)
DB_PASSWORD=""
BACKUP_USER_PASSWORD=""
CREDENTIALS_FILE="/opt/parking-db-credentials"

# PostgreSQL configuration
POSTGRES_VERSION="14"
POSTGRES_DATA_DIR="/var/lib/postgresql/$POSTGRES_VERSION/main"
POSTGRES_CONFIG_DIR="/etc/postgresql/$POSTGRES_VERSION/main"

# ==============================================================================
# CREDENTIAL MANAGEMENT
# ==============================================================================

generate_database_credentials() {
    log_header "GENERATING DATABASE CREDENTIALS"
    
    # Generate secure passwords
    log_info "Generating secure database passwords..."
    DB_PASSWORD="ParkingMexico$(generate_random_string 16)"
    BACKUP_USER_PASSWORD="BackupParking$(generate_random_string 16)"
    
    # Create credentials file
    log_info "Creating secure credentials file..."
    cat > "$CREDENTIALS_FILE" << EOF
# Parking System Database Credentials
# Generated: $(date)
# DO NOT SHARE OR COMMIT THIS FILE

export DB_NAME="$DB_NAME"
export DB_USER="$DB_USER"
export DB_PASSWORD="$DB_PASSWORD"
export DB_HOST="$DB_HOST"
export DB_PORT="$DB_PORT"
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

# Backup user credentials
export BACKUP_USER="parking_backup"
export BACKUP_PASSWORD="$BACKUP_USER_PASSWORD"
EOF
    
    # Secure the credentials file
    chmod 600 "$CREDENTIALS_FILE"
    chown root:root "$CREDENTIALS_FILE"
    
    log_success "Database credentials generated and secured"
}

# ==============================================================================
# POSTGRESQL INSTALLATION
# ==============================================================================

install_postgresql() {
    log_header "INSTALLING POSTGRESQL"
    
    # Check if PostgreSQL is already installed
    if package_installed postgresql; then
        local pg_version
        pg_version=$(pg_config --version 2>/dev/null | awk '{print $2}' | cut -d. -f1)
        
        if [[ "$pg_version" -ge 12 ]]; then
            log_success "PostgreSQL $pg_version already installed"
            return 0
        else
            log_warn "Outdated PostgreSQL $pg_version detected, upgrading..."
        fi
    fi
    
    # Update package lists
    if ! apt_update; then
        log_error "Failed to update package lists"
        return 1
    fi
    
    # Install PostgreSQL packages
    local postgres_packages=(
        "postgresql-$POSTGRES_VERSION"
        "postgresql-contrib-$POSTGRES_VERSION"
        "postgresql-client-$POSTGRES_VERSION"
        "postgresql-server-dev-$POSTGRES_VERSION"
    )
    
    log_info "Installing PostgreSQL packages..."
    if install_packages "${postgres_packages[@]}"; then
        log_success "PostgreSQL installed successfully"
        return 0
    else
        log_error "Failed to install PostgreSQL"
        return 1
    fi
}

# ==============================================================================
# POSTGRESQL CONFIGURATION
# ==============================================================================

configure_postgresql() {
    log_header "CONFIGURING POSTGRESQL"
    
    # Start PostgreSQL service
    log_info "Starting PostgreSQL service..."
    if ! start_service postgresql; then
        log_error "Failed to start PostgreSQL service"
        return 1
    fi
    
    # Enable PostgreSQL service
    if ! enable_service postgresql; then
        log_error "Failed to enable PostgreSQL service"
        return 1
    fi
    
    # Configure PostgreSQL for production
    log_info "Configuring PostgreSQL for production..."
    
    # Backup original configuration
    backup_file "$POSTGRES_CONFIG_DIR/postgresql.conf"
    backup_file "$POSTGRES_CONFIG_DIR/pg_hba.conf"
    
    # Configure postgresql.conf
    cat >> "$POSTGRES_CONFIG_DIR/postgresql.conf" << EOF

# Parking System Configuration
# Added: $(date)

# Connection and Authentication
listen_addresses = 'localhost'
port = $DB_PORT
max_connections = 100

# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Performance
checkpoint_timeout = 10min
random_page_cost = 1.1
effective_io_concurrency = 200

# Security
ssl = on
password_encryption = scram-sha-256
EOF
    
    # Configure pg_hba.conf for security
    cat > "$POSTGRES_CONFIG_DIR/pg_hba.conf" << EOF
# PostgreSQL Client Authentication Configuration
# Generated for Parking System: $(date)

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             postgres                                peer
local   all             all                                     peer

# IPv4 local connections:
host    $DB_NAME        $DB_USER        127.0.0.1/32           scram-sha-256
host    $DB_NAME        parking_backup  127.0.0.1/32           scram-sha-256
host    all             postgres        127.0.0.1/32           scram-sha-256

# IPv6 local connections:
host    all             all             ::1/128                 scram-sha-256

# Deny all other connections
host    all             all             0.0.0.0/0               reject
EOF
    
    # Restart PostgreSQL to apply configuration
    log_info "Restarting PostgreSQL to apply configuration..."
    if ! restart_service postgresql; then
        log_error "Failed to restart PostgreSQL service"
        return 1
    fi
    
    log_success "PostgreSQL configuration completed"
}

# ==============================================================================
# DATABASE SETUP
# ==============================================================================

create_database_and_users() {
    log_header "CREATING DATABASE AND USERS"
    
    # Create application database user
    log_info "Creating application database user..."
    sudo -u postgres psql << EOF
-- Create application user
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Create backup user
CREATE USER parking_backup WITH ENCRYPTED PASSWORD '$BACKUP_USER_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
GRANT CONNECT ON DATABASE $DB_NAME TO parking_backup;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR USER $DB_USER IN SCHEMA public GRANT SELECT ON TABLES TO parking_backup;

\q
EOF
    
    if [[ $? -eq 0 ]]; then
        log_success "Database and users created successfully"
    else
        log_error "Failed to create database and users"
        return 1
    fi
}

create_database_schema() {
    log_header "CREATING DATABASE SCHEMA"
    
    # Create the database schema
    log_info "Creating parking system database schema..."
    
    # Connect as application user and create schema
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_pricing_config_updated_at ON pricing_config;
CREATE TRIGGER update_pricing_config_updated_at BEFORE UPDATE ON pricing_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pension_customers_updated_at ON pension_customers;
CREATE TRIGGER update_pension_customers_updated_at BEFORE UPDATE ON pension_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_users_updated_at ON system_users;
CREATE TRIGGER update_system_users_updated_at BEFORE UPDATE ON system_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change immediately)
INSERT INTO system_users (username, password_hash, role) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXzgVEn11.2.', 'admin')
ON CONFLICT (username) DO NOTHING;
EOF
    
    if [[ $? -eq 0 ]]; then
        log_success "Database schema created successfully"
    else
        log_error "Failed to create database schema"
        return 1
    fi
}

# ==============================================================================
# BACKUP CONFIGURATION
# ==============================================================================

configure_database_backup() {
    log_header "CONFIGURING DATABASE BACKUP"
    
    # Create backup directory
    local backup_dir="/opt/parking-backups/database"
    ensure_directory "$backup_dir" "postgres:postgres" "755"
    
    # Create backup script
    log_info "Creating database backup script..."
    cat > /opt/parking-db-backup.sh << EOF
#!/bin/bash

# Parking System Database Backup Script
# Generated: $(date)

# Load database credentials
source "$CREDENTIALS_FILE"

# Backup configuration
BACKUP_DIR="$backup_dir"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\$BACKUP_DIR/parking_backup_\$TIMESTAMP.sql"
RETENTION_DAYS=30

# Create backup
echo "Creating database backup: \$BACKUP_FILE"
PGPASSWORD="\$DB_PASSWORD" pg_dump -h localhost -U "\$DB_USER" -d "\$DB_NAME" > "\$BACKUP_FILE"

if [[ \$? -eq 0 ]]; then
    echo "Backup completed successfully"
    
    # Compress backup
    gzip "\$BACKUP_FILE"
    echo "Backup compressed: \$BACKUP_FILE.gz"
    
    # Remove old backups
    find "\$BACKUP_DIR" -name "parking_backup_*.sql.gz" -mtime +\$RETENTION_DAYS -delete
    echo "Old backups cleaned up"
else
    echo "Backup failed"
    exit 1
fi
EOF
    
    chmod +x /opt/parking-db-backup.sh
    
    # Create daily backup cron job
    log_info "Setting up daily backup cron job..."
    cat > /etc/cron.d/parking-db-backup << EOF
# Parking System Database Backup
# Runs daily at 2:30 AM
30 2 * * * postgres /opt/parking-db-backup.sh >> /var/log/parking-db-backup.log 2>&1
EOF
    
    log_success "Database backup configuration completed"
}

# ==============================================================================
# DATABASE VALIDATION
# ==============================================================================

validate_database_setup() {
    log_header "VALIDATING DATABASE SETUP"
    
    local validation_failed=false
    
    # Check PostgreSQL service
    log_info "Validating PostgreSQL service..."
    if is_service_running postgresql; then
        log_success "PostgreSQL service is running"
    else
        log_error "PostgreSQL service is not running"
        validation_failed=true
    fi
    
    # Check database connectivity
    log_info "Validating database connectivity..."
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database connectivity validated"
    else
        log_error "Database connectivity failed"
        validation_failed=true
    fi
    
    # Check database schema
    log_info "Validating database schema..."
    local table_count
    table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
    
    if [[ "$table_count" -ge 5 ]]; then
        log_success "Database schema validated ($table_count tables)"
    else
        log_error "Database schema incomplete ($table_count tables)"
        validation_failed=true
    fi
    
    # Check backup script
    log_info "Validating backup configuration..."
    if [[ -x /opt/parking-db-backup.sh ]]; then
        log_success "Backup script configured"
    else
        log_error "Backup script not found or not executable"
        validation_failed=true
    fi
    
    if $validation_failed; then
        log_error "Database setup validation failed"
        return 1
    else
        log_success "Database setup validation completed successfully"
        return 0
    fi
}

# ==============================================================================
# STATUS REPORTING
# ==============================================================================

update_database_status() {
    log_info "Updating database setup status..."
    
    local pg_version
    pg_version=$(pg_config --version 2>/dev/null | awk '{print $2}')
    
    cat >> /opt/parking-setup-status.txt << EOF
Base de datos configurada: $(date)
PostgreSQL: $pg_version
Base de datos: $DB_NAME
Usuario: $DB_USER
Host: $DB_HOST:$DB_PORT
Respaldos: Configurados (diario 2:30 AM)
Credenciales: $CREDENTIALS_FILE
EOF
}

# ==============================================================================
# MAIN DATABASE SETUP PROCESS
# ==============================================================================

main() {
    log_header "SISTEMA DE ESTACIONAMIENTO - CONFIGURACIÓN DE BASE DE DATOS"
    
    # Check prerequisites
    if ! check_root_privileges; then
        exit 1
    fi
    
    # Run database-specific validation
    log_info "Validating prerequisites..."
    check_ubuntu_os
    check_memory
    check_disk_space
    check_internet_connectivity
    
    # Generate database credentials
    generate_database_credentials
    
    # Install PostgreSQL
    install_postgresql
    
    # Configure PostgreSQL
    configure_postgresql
    
    # Create database and users
    create_database_and_users
    
    # Create database schema
    create_database_schema
    
    # Configure backup
    configure_database_backup
    
    # Validate setup
    if ! validate_database_setup; then
        log_error "Database setup validation failed"
        exit 1
    fi
    
    # Update status
    update_database_status
    
    log_header "CONFIGURACIÓN DE BASE DE DATOS COMPLETADA EXITOSAMENTE"
    
    log_info "CONFIGURACIÓN DE BASE DE DATOS:"
    log_info "- PostgreSQL: $(pg_config --version 2>/dev/null | awk '{print $2}')"
    log_info "- Base de datos: $DB_NAME"
    log_info "- Usuario: $DB_USER"
    log_info "- Host: $DB_HOST:$DB_PORT"
    log_info "- Credenciales: $CREDENTIALS_FILE"
    log_info "- Respaldos: Configurados (diario 2:30 AM)"
    log_info ""
    log_warn "IMPORTANTE: Credenciales guardadas en $CREDENTIALS_FILE"
    log_warn "CAMBIAR contraseña admin por defecto: admin123"
    log_info ""
    log_info "Siguiente paso: Ejecutar setup-kiosk.sh"
    
    exit 0
}

# ==============================================================================
# COMMAND LINE INTERFACE
# ==============================================================================

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        cat << EOF
Sistema de Estacionamiento - Configuración de Base de Datos

Uso: sudo $0 [OPCIONES]

OPCIONES:
  --help, -h    Mostrar esta ayuda
  --version     Mostrar versión del script

DESCRIPCIÓN:
Este script instala y configura PostgreSQL para el sistema de
gestión de estacionamiento:

- Instalación de PostgreSQL 14
- Creación de base de datos y usuarios
- Configuración de seguridad
- Creación del esquema de base de datos
- Configuración de respaldos automáticos
- Generación de credenciales seguras

REQUISITOS:
- Ubuntu 20.04 LTS o superior  
- Permisos de administrador (sudo)
- Conexión a internet
- Al menos 2GB de espacio libre

DURACIÓN ESTIMADA: 5-10 minutos
EOF
        exit 0
        ;;
    "--version")
        echo "Sistema de Estacionamiento - Setup de Base de Datos v1.0.0"
        echo "PostgreSQL 14 compatible"
        exit 0
        ;;
esac

# Run main setup process
main "$@"