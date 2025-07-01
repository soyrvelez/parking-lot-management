#!/bin/bash

# Ubuntu 24.04.2 Compatibility Check Script
# Purpose: Verify Ubuntu 24.04 specific compatibility and prepare system for installation
# Usage: sudo ./ubuntu-24-compatibility-check.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Este script debe ejecutarse como root (sudo)${NC}" >&2
   exit 1
fi

# Logging functions
log_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((CHECKS_PASSED++))
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    ((CHECKS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

log_header() {
    echo ""
    echo -e "${YELLOW}============================================${NC}"
    echo -e "${YELLOW} $1${NC}"
    echo -e "${YELLOW}============================================${NC}"
}

# =============================================================================
# UBUNTU VERSION VERIFICATION
# =============================================================================

check_ubuntu_version() {
    log_header "VERIFICACIÓN DE VERSIÓN UBUNTU"
    
    if ! command -v lsb_release >/dev/null 2>&1; then
        log_error "lsb_release no encontrado. Instalando..."
        apt update
        apt install -y lsb-release
    fi
    
    local ubuntu_version=$(lsb_release -rs)
    local ubuntu_codename=$(lsb_release -cs)
    
    if [[ "$ubuntu_version" == "24.04" ]]; then
        log_success "Ubuntu 24.04 LTS detectado (codename: $ubuntu_codename)"
    elif [[ "$ubuntu_version" =~ ^24\.04 ]]; then
        log_success "Ubuntu 24.04.x LTS detectado (versión: $ubuntu_version)"
    else
        log_error "Versión Ubuntu no compatible: $ubuntu_version"
        log_info "Este script está optimizado para Ubuntu 24.04 LTS"
        return 1
    fi
}

# =============================================================================
# POSTGRESQL VERSION CHECK
# =============================================================================

check_postgresql_compatibility() {
    log_header "VERIFICACIÓN POSTGRESQL"
    
    # Check what PostgreSQL versions are available
    local available_versions=$(apt search postgresql-[0-9] 2>/dev/null | grep -o "postgresql-[0-9][0-9]*" | sort -V | tail -3)
    
    log_info "Versiones PostgreSQL disponibles:"
    for version in $available_versions; do
        echo "  - $version"
    done
    
    # Check if PostgreSQL 16 is available (Ubuntu 24.04 default)
    if apt search postgresql-16 2>/dev/null | grep -q "postgresql-16"; then
        log_success "PostgreSQL 16 disponible (recomendado para Ubuntu 24.04)"
    else
        log_warning "PostgreSQL 16 no encontrado en repositorios"
    fi
    
    # Check if PostgreSQL 14 is available (our scripts' default)
    if apt search postgresql-14 2>/dev/null | grep -q "postgresql-14"; then
        log_success "PostgreSQL 14 disponible (compatibilidad con scripts)"
    else
        log_warning "PostgreSQL 14 no disponible en repositorios base"
        log_info "Se puede instalar desde repositorio oficial PostgreSQL"
    fi
    
    # Check if any PostgreSQL is already installed
    if dpkg -l | grep -q postgresql; then
        local installed_version=$(dpkg -l | grep postgresql | grep -o "postgresql-[0-9][0-9]*" | head -1 || echo "desconocida")
        log_info "PostgreSQL ya instalado: $installed_version"
    fi
}

# =============================================================================
# DISPLAY MANAGER CHECK
# =============================================================================

check_display_manager() {
    log_header "VERIFICACIÓN GESTOR DE PANTALLA"
    
    # Check current display manager
    local current_dm=""
    
    if systemctl is-active --quiet gdm3; then
        current_dm="gdm3"
        log_warning "GDM3 actualmente activo (Ubuntu 24.04 default)"
        log_info "Se cambiará a LightDM durante la instalación"
    elif systemctl is-active --quiet lightdm; then
        current_dm="lightdm" 
        log_success "LightDM ya activo"
    else
        log_info "Ningún gestor de pantalla activo"
    fi
    
    # Check if LightDM is available
    if apt search lightdm 2>/dev/null | grep -q "lightdm.*display manager"; then
        log_success "LightDM disponible para instalación"
    else
        log_error "LightDM no encontrado en repositorios"
    fi
    
    # Check if this is a desktop installation
    if dpkg -l | grep -q ubuntu-desktop; then
        log_info "Instalación Ubuntu Desktop detectada"
        log_info "Requiere cambio de GDM3 a LightDM para modo kiosko"
    fi
}

# =============================================================================
# NODE.JS COMPATIBILITY CHECK  
# =============================================================================

check_nodejs_compatibility() {
    log_header "VERIFICACIÓN NODE.JS"
    
    # Check Node.js availability in repositories
    local nodejs_version=$(apt show nodejs 2>/dev/null | grep "Version:" | cut -d' ' -f2 | cut -d'.' -f1 || echo "no-disponible")
    
    if [[ "$nodejs_version" == "no-disponible" ]]; then
        log_error "Node.js no encontrado en repositorios"
    elif [[ "$nodejs_version" -ge 18 ]]; then
        log_success "Node.js $nodejs_version disponible (compatible con requisitos >= 18)"
    else
        log_warning "Node.js $nodejs_version disponible (se requiere >= 18)"
        log_info "Se instalará desde NodeSource repository"
    fi
    
    # Check if Node.js is already installed
    if command -v node >/dev/null 2>&1; then
        local current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$current_version" -ge 18 ]]; then
            log_success "Node.js $current_version ya instalado y compatible"
        else
            log_warning "Node.js $current_version instalado pero obsoleto"
        fi
    fi
}

# =============================================================================
# PACKAGE AVAILABILITY CHECK
# =============================================================================

check_essential_packages() {
    log_header "VERIFICACIÓN PAQUETES ESENCIALES"
    
    local essential_packages=(
        "curl"
        "wget" 
        "git"
        "openssh-server"
        "ufw"
        "screen"
        "build-essential"
        "python3"
        "python3-pip"
        "openbox"
        "chromium-browser"
        "unclutter"
    )
    
    for package in "${essential_packages[@]}"; do
        if apt search "^${package}$" 2>/dev/null | grep -q "^${package}/"; then
            log_success "$package disponible"
        else
            log_warning "$package no encontrado con nombre exacto"
        fi
    done
}

# =============================================================================
# SYSTEM RESOURCES CHECK
# =============================================================================

check_system_resources() {
    log_header "VERIFICACIÓN RECURSOS DEL SISTEMA"
    
    # Memory check
    local total_mem=$(free -g | awk 'NR==2{print $2}')
    if [[ $total_mem -ge 4 ]]; then
        log_success "Memoria RAM: ${total_mem}GB (suficiente)"
    else
        log_warning "Memoria RAM: ${total_mem}GB (recomendado: 4GB+)"
    fi
    
    # Disk space check
    local free_space=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [[ $free_space -ge 20 ]]; then
        log_success "Espacio libre: ${free_space}GB (suficiente)"
    else
        log_warning "Espacio libre: ${free_space}GB (recomendado: 20GB+)"
    fi
    
    # CPU architecture
    local arch=$(uname -m)
    if [[ "$arch" == "x86_64" ]]; then
        log_success "Arquitectura: $arch (compatible)"
    else
        log_warning "Arquitectura: $arch (no probada)"
    fi
}

# =============================================================================
# UBUNTU 24.04 SPECIFIC ADJUSTMENTS
# =============================================================================

prepare_ubuntu_24_environment() {
    log_header "PREPARACIÓN AMBIENTE UBUNTU 24.04"
    
    # Update package lists
    log_info "Actualizando listas de paquetes..."
    apt update
    
    # Install essential compatibility packages
    log_info "Instalando paquetes de compatibilidad..."
    apt install -y software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    # Prepare for PostgreSQL repository if needed
    if ! apt search postgresql-14 2>/dev/null | grep -q "postgresql-14"; then
        log_info "Preparando repositorio PostgreSQL oficial..."
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - 2>/dev/null || true
        echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
        log_success "Repositorio PostgreSQL oficial agregado"
    fi
    
    log_success "Ambiente Ubuntu 24.04 preparado"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    echo -e "${BLUE}🚀 VERIFICACIÓN COMPATIBILIDAD UBUNTU 24.04.2${NC}"
    echo -e "${BLUE}Sistema de Gestión de Estacionamiento${NC}"
    echo ""
    
    # Run all checks
    check_ubuntu_version
    check_postgresql_compatibility
    check_display_manager  
    check_nodejs_compatibility
    check_essential_packages
    check_system_resources
    
    # Prepare environment
    prepare_ubuntu_24_environment
    
    # Summary
    log_header "RESUMEN DE VERIFICACIÓN"
    echo ""
    echo -e "Verificaciones exitosas: ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Verificaciones fallidas: ${RED}$CHECKS_FAILED${NC}"
    echo -e "Advertencias: ${YELLOW}$WARNINGS${NC}"
    echo ""
    
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}✅ SISTEMA COMPATIBLE CON UBUNTU 24.04${NC}"
        echo ""
        echo -e "${BLUE}Próximos pasos:${NC}"
        echo "1. Ejecutar: sudo ./scripts/preflight-check.sh"
        echo "2. Continuar con: sudo ./scripts/install-all.sh production"
        echo ""
        exit 0
    else
        echo -e "${RED}❌ PROBLEMAS DE COMPATIBILIDAD ENCONTRADOS${NC}"
        echo ""
        echo -e "${YELLOW}Por favor resuelva los problemas antes de continuar:${NC}"
        echo "- Revisar mensajes de error arriba"
        echo "- Consultar UBUNTU_24_DEPLOYMENT_GUIDE.md"
        echo "- Contactar soporte técnico si es necesario"
        echo ""
        exit 1
    fi
}

# Execute main function
main "$@"