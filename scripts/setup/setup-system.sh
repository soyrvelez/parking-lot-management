#!/bin/bash

# Parking System - System Setup (Modernized)
# Purpose: Initialize Ubuntu system with required packages and Spanish locale
# Usage: sudo ./setup-system.sh

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Get script directory and source shared libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
source "$SCRIPT_DIR/../lib/logging.sh"
source "$SCRIPT_DIR/../lib/validation.sh"
source "$SCRIPT_DIR/../lib/package-manager.sh"

# ==============================================================================
# SYSTEM SETUP CONFIGURATION
# ==============================================================================

# Backup directory for pre-installation state
BACKUP_DIR="/opt/parking-backups/pre-install"

# ==============================================================================
# BACKUP FUNCTIONS
# ==============================================================================

create_system_backup() {
    log_header "CREATING SYSTEM CONFIGURATION BACKUP"
    
    log_info "Creating backup directory..."
    ensure_directory "$BACKUP_DIR" "root:root" "755"
    
    # Backup critical system configuration files
    local config_files=(
        "/etc/locale.gen"
        "/etc/timezone"
        "/etc/environment"
        "/etc/default/locale"
        "/etc/apt/sources.list"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            local backup_file="$BACKUP_DIR/$(basename "$config_file")"
            cp "$config_file" "$backup_file" 2>/dev/null || true
            log_info "Backed up: $config_file"
        fi
    done
    
    # Backup package list
    dpkg --get-selections > "$BACKUP_DIR/installed-packages.list" 2>/dev/null || true
    
    log_success "System configuration backup completed"
}

# ==============================================================================
# LOCALE CONFIGURATION
# ==============================================================================

configure_spanish_locale() {
    log_header "CONFIGURING SPANISH (MEXICO) LOCALE"
    
    # Generate Spanish Mexico locale
    log_info "Generating Spanish Mexico locale..."
    
    # Ensure locale is uncommented in locale.gen
    if [[ -f /etc/locale.gen ]]; then
        sed -i 's/# es_MX.UTF-8 UTF-8/es_MX.UTF-8 UTF-8/' /etc/locale.gen
        sed -i 's/# es_ES.UTF-8 UTF-8/es_ES.UTF-8 UTF-8/' /etc/locale.gen
    fi
    
    # Generate locales
    locale-gen es_MX.UTF-8
    locale-gen es_ES.UTF-8
    
    # Update system locale
    log_info "Setting system locale to Spanish Mexico..."
    update-locale LANG=es_MX.UTF-8 LC_ALL=es_MX.UTF-8
    
    # Configure environment variables
    log_info "Configuring locale environment variables..."
    cat > /etc/environment << EOF
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
LANG="$SYSTEM_LANG"
LANGUAGE="es_MX:es"
LC_ALL="$SYSTEM_LANG"
LC_NUMERIC="$SYSTEM_LANG"
LC_TIME="$SYSTEM_LANG"
LC_MONETARY="$SYSTEM_LANG"
LC_PAPER="$SYSTEM_LANG"
LC_IDENTIFICATION="$SYSTEM_LANG"
LC_NAME="$SYSTEM_LANG"
LC_ADDRESS="$SYSTEM_LANG"
LC_TELEPHONE="$SYSTEM_LANG"
LC_MEASUREMENT="$SYSTEM_LANG"
TZ="$SYSTEM_TZ"
EOF
    
    log_success "Spanish locale configuration completed"
}

configure_timezone() {
    log_header "CONFIGURING TIMEZONE"
    
    log_info "Setting timezone to Mexico City..."
    timedatectl set-timezone "$SYSTEM_TZ"
    timedatectl set-ntp true
    
    # Verify timezone setting
    local current_tz
    current_tz=$(timedatectl show --property=Timezone --value)
    
    if [[ "$current_tz" == "$SYSTEM_TZ" ]]; then
        log_success "Timezone set to: $current_tz"
    else
        log_error "Failed to set timezone. Current: $current_tz, Expected: $SYSTEM_TZ"
        return 1
    fi
}

# ==============================================================================
# PACKAGE INSTALLATION
# ==============================================================================

install_system_packages() {
    log_header "INSTALLING SYSTEM PACKAGES"
    
    # Update package lists first
    if ! apt_update; then
        log_error "Failed to update package lists"
        return 1
    fi
    
    # Upgrade existing packages
    log_info "Upgrading existing packages..."
    if ! apt_upgrade; then
        log_error "Failed to upgrade packages"
        return 1
    fi
    
    # Install essential packages
    log_info "Installing essential system packages..."
    if ! install_essential_packages; then
        log_error "Failed to install essential packages"
        return 1
    fi
    
    # Install localization packages
    log_info "Installing Spanish localization packages..."
    if ! install_localization_packages; then
        log_error "Failed to install localization packages"
        return 1
    fi
    
    # Install security packages
    log_info "Installing security packages..."
    if ! install_security_packages; then
        log_error "Failed to install security packages"
        return 1
    fi
    
    log_success "All system packages installed successfully"
}

# ==============================================================================
# NODE.JS INSTALLATION
# ==============================================================================

install_nodejs() {
    log_header "INSTALLING NODE.JS"
    
    # Check if Node.js is already installed with correct version
    if command_exists node; then
        local node_version
        node_version=$(node --version | sed 's/v//')
        local major_version
        major_version=$(echo "$node_version" | cut -d. -f1)
        
        if (( major_version >= 18 )); then
            log_success "Node.js $node_version already installed"
            return 0
        else
            log_warn "Outdated Node.js $node_version detected, upgrading..."
        fi
    fi
    
    # Add NodeSource repository
    log_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    
    # Install Node.js
    log_info "Installing Node.js LTS..."
    if install_package nodejs; then
        # Verify installation
        local installed_version
        installed_version=$(node --version)
        log_success "Node.js installed: $installed_version"
        
        # Install common global packages
        log_info "Installing global npm packages..."
        npm install -g npm@latest
        npm install -g pm2 typescript ts-node
        
        return 0
    else
        log_error "Failed to install Node.js"
        return 1
    fi
}

# ==============================================================================
# SYSTEM CONFIGURATION
# ==============================================================================

configure_system_settings() {
    log_header "CONFIGURING SYSTEM SETTINGS"
    
    # Configure automatic updates
    log_info "Configuring automatic security updates..."
    if [[ -f /etc/apt/apt.conf.d/50unattended-upgrades ]]; then
        # Enable automatic security updates
        sed -i 's|//\s*"${distro_id}:${distro_codename}-security";|        "${distro_id}:${distro_codename}-security";|' \
            /etc/apt/apt.conf.d/50unattended-upgrades
            
        # Enable automatic removal of unused dependencies
        echo 'Unattended-Upgrade::Remove-Unused-Dependencies "true";' >> /etc/apt/apt.conf.d/50unattended-upgrades
        echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
    fi
    
    # Configure systemd journal
    log_info "Configuring system logging..."
    mkdir -p /etc/systemd/journald.conf.d
    cat > /etc/systemd/journald.conf.d/parking-system.conf << EOF
[Journal]
Storage=persistent
Compress=yes
MaxRetentionSec=30day
MaxFileSec=1week
EOF
    
    # Configure kernel parameters for production
    log_info "Configuring kernel parameters..."
    cat > /etc/sysctl.d/99-parking-system.conf << EOF
# Parking System - Kernel Parameters
# Network performance optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# Security settings
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
EOF
    
    # Apply sysctl settings
    sysctl --system >/dev/null 2>&1 || true
    
    log_success "System settings configured"
}

# ==============================================================================
# SYSTEM VALIDATION
# ==============================================================================

validate_system_setup() {
    log_header "VALIDATING SYSTEM SETUP"
    
    local validation_failed=false
    
    # Check locale
    log_info "Validating locale configuration..."
    if locale | grep -q "LANG=$SYSTEM_LANG"; then
        log_success "Locale configuration validated"
    else
        log_error "Locale configuration failed"
        validation_failed=true
    fi
    
    # Check timezone
    log_info "Validating timezone configuration..."
    local current_tz
    current_tz=$(timedatectl show --property=Timezone --value)
    if [[ "$current_tz" == "$SYSTEM_TZ" ]]; then
        log_success "Timezone configuration validated"
    else
        log_error "Timezone configuration failed"
        validation_failed=true
    fi
    
    # Check Node.js
    log_info "Validating Node.js installation..."
    if command_exists node && command_exists npm; then
        local node_version npm_version
        node_version=$(node --version)
        npm_version=$(npm --version)
        log_success "Node.js validated: $node_version, npm: $npm_version"
    else
        log_error "Node.js installation failed"
        validation_failed=true
    fi
    
    # Check essential packages
    log_info "Validating essential packages..."
    local essential_packages=("curl" "wget" "git" "vim")
    for package in "${essential_packages[@]}"; do
        if command_exists "$package"; then
            log_success "Package validated: $package"
        else
            log_error "Package missing: $package"
            validation_failed=true
        fi
    done
    
    if $validation_failed; then
        log_error "System setup validation failed"
        return 1
    else
        log_success "System setup validation completed successfully"
        return 0
    fi
}

# ==============================================================================
# STATUS REPORTING
# ==============================================================================

update_setup_status() {
    log_info "Updating system setup status..."
    
    cat >> /opt/parking-setup-status.txt << EOF
Sistema configurado: $(date)
Idioma: $SYSTEM_LANG
Zona horaria: $SYSTEM_TZ
Node.js: $(node --version 2>/dev/null || echo "No instalado")
Paquetes esenciales: Instalados
Configuración de seguridad: Aplicada
Actualizaciones automáticas: Habilitadas
EOF
}

# ==============================================================================
# MAIN SYSTEM SETUP PROCESS
# ==============================================================================

main() {
    log_header "SISTEMA DE ESTACIONAMIENTO - CONFIGURACIÓN DEL SISTEMA"
    
    # Check prerequisites
    if ! check_root_privileges; then
        exit 1
    fi
    
    # Run basic system validation
    log_info "Validating system prerequisites..."
    if ! run_basic_validation; then
        log_error "Basic system validation failed"
        exit 1
    fi
    
    # Create system backup
    create_system_backup
    
    # Configure locale and timezone
    configure_spanish_locale
    configure_timezone
    
    # Install packages
    install_system_packages
    
    # Install Node.js
    install_nodejs
    
    # Configure system settings
    configure_system_settings
    
    # Validate setup
    if ! validate_system_setup; then
        log_error "System setup validation failed"
        exit 1
    fi
    
    # Update status
    update_setup_status
    
    # Show package installation summary
    show_package_summary
    
    log_header "CONFIGURACIÓN DEL SISTEMA COMPLETADA EXITOSAMENTE"
    
    log_info "CONFIGURACIÓN APLICADA:"
    log_info "- Idioma del sistema: Español (México)"
    log_info "- Zona horaria: Ciudad de México"
    log_info "- Node.js: $(node --version)"
    log_info "- Paquetes esenciales: Instalados"
    log_info "- Configuración de seguridad: Aplicada"
    log_info ""
    log_warn "NOTA: Es recomendable reiniciar el sistema para aplicar todos los cambios"
    log_info "Comando: sudo reboot"
    log_info ""
    log_info "Siguiente paso: Ejecutar setup-database.sh"
    
    exit 0
}

# ==============================================================================
# COMMAND LINE INTERFACE
# ==============================================================================

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        cat << EOF
Sistema de Estacionamiento - Configuración del Sistema

Uso: sudo $0 [OPCIONES]

OPCIONES:
  --help, -h    Mostrar esta ayuda
  --version     Mostrar versión del script

DESCRIPCIÓN:
Este script configura el sistema Ubuntu con los requisitos básicos
para el sistema de gestión de estacionamiento:

- Configuración de idioma español (México)
- Configuración de zona horaria (Ciudad de México)
- Instalación de paquetes esenciales
- Instalación de Node.js LTS
- Configuración de seguridad básica
- Configuración de actualizaciones automáticas

REQUISITOS:
- Ubuntu 20.04 LTS o superior
- Permisos de administrador (sudo)
- Conexión a internet

DURACIÓN ESTIMADA: 10-15 minutos
EOF
        exit 0
        ;;
    "--version")
        echo "Sistema de Estacionamiento - Setup del Sistema v1.0.0"
        echo "Compatible con Ubuntu 20.04+ LTS"
        exit 0
        ;;
esac

# Run main setup process
main "$@"