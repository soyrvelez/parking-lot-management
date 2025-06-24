#!/bin/bash
set -euo pipefail

# Script: Pre-flight Check for Parking Management System Installation
# Purpose: Verify all requirements before starting installation
# Usage: ./preflight-check.sh

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Check results
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# System requirements
MIN_MEMORY_GB=4
RECOMMENDED_MEMORY_GB=8
MIN_DISK_GB=10
RECOMMENDED_DISK_GB=20
MIN_UBUNTU_VERSION=20

# Logging functions
log() {
    echo -e "${GREEN}[✓] $1${NC}"
    ((CHECKS_PASSED++))
}

error() {
    echo -e "${RED}[✗] $1${NC}" >&2
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}[⚠] $1${NC}"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}[ℹ] $1${NC}"
}

header() {
    echo ""
    echo -e "${BOLD}${BLUE}=== $1 ===${NC}"
    echo ""
}

# Show banner
show_banner() {
    echo -e "${BOLD}${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║         SISTEMA DE ESTACIONAMIENTO - VERIFICACIÓN            ║"
    echo "║                    Pre-instalación                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Este script verificará que su sistema cumple con todos los"
    echo "requisitos antes de iniciar la instalación."
    echo ""
}

# Check if running as regular user (not root)
check_user_permissions() {
    header "Verificando Permisos de Usuario"
    
    if [[ $EUID -eq 0 ]]; then
        error "Este script NO debe ejecutarse como root (sin sudo)"
        info "Ejecute como usuario normal: ./preflight-check.sh"
        return 1
    else
        log "Ejecutando como usuario normal: $(whoami)"
    fi
    
    # Check sudo access
    if sudo -n true 2>/dev/null; then
        log "Acceso sudo disponible sin contraseña"
    elif sudo -v 2>/dev/null; then
        log "Acceso sudo disponible (se requiere contraseña)"
    else
        error "Sin acceso sudo - requerido para la instalación"
        return 1
    fi
}

# Check operating system
check_operating_system() {
    header "Verificando Sistema Operativo"
    
    # Check if Ubuntu
    if ! command -v lsb_release &> /dev/null; then
        error "lsb_release no encontrado - ¿Es este Ubuntu?"
        return 1
    fi
    
    local os_name=$(lsb_release -is)
    local os_version=$(lsb_release -rs)
    local os_codename=$(lsb_release -cs)
    
    if [[ "$os_name" != "Ubuntu" ]]; then
        error "Sistema operativo: $os_name (se requiere Ubuntu)"
        return 1
    else
        log "Sistema operativo: $os_name $os_version ($os_codename)"
    fi
    
    # Check Ubuntu version
    local major_version=$(echo "$os_version" | cut -d. -f1)
    if [[ $major_version -lt $MIN_UBUNTU_VERSION ]]; then
        error "Ubuntu $os_version detectado - se requiere $MIN_UBUNTU_VERSION.04 o superior"
        return 1
    else
        log "Versión de Ubuntu compatible: $os_version"
    fi
    
    # Check if LTS version
    if [[ "$os_codename" == "focal" ]] || [[ "$os_codename" == "jammy" ]]; then
        log "Versión LTS detectada (recomendado)"
    else
        warn "Versión no-LTS detectada - se recomienda usar Ubuntu LTS"
    fi
}

# Check hardware requirements
check_hardware_requirements() {
    header "Verificando Requisitos de Hardware"
    
    # Check CPU architecture
    local arch=$(uname -m)
    if [[ "$arch" == "x86_64" ]] || [[ "$arch" == "amd64" ]]; then
        log "Arquitectura CPU: $arch (64-bit)"
    else
        error "Arquitectura CPU: $arch - se requiere x86_64/amd64"
        return 1
    fi
    
    # Check memory
    local total_mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local total_mem_gb=$((total_mem_kb / 1024 / 1024))
    
    if [[ $total_mem_gb -lt $MIN_MEMORY_GB ]]; then
        error "Memoria RAM: ${total_mem_gb}GB - mínimo ${MIN_MEMORY_GB}GB requerido"
    elif [[ $total_mem_gb -lt $RECOMMENDED_MEMORY_GB ]]; then
        warn "Memoria RAM: ${total_mem_gb}GB - se recomiendan ${RECOMMENDED_MEMORY_GB}GB"
    else
        log "Memoria RAM: ${total_mem_gb}GB"
    fi
    
    # Check disk space
    local available_gb=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
    
    if [[ $available_gb -lt $MIN_DISK_GB ]]; then
        error "Espacio en disco: ${available_gb}GB disponible - mínimo ${MIN_DISK_GB}GB requerido"
    elif [[ $available_gb -lt $RECOMMENDED_DISK_GB ]]; then
        warn "Espacio en disco: ${available_gb}GB disponible - se recomiendan ${RECOMMENDED_DISK_GB}GB"
    else
        log "Espacio en disco: ${available_gb}GB disponible"
    fi
    
    # Check for ThinkPad (optional but recommended)
    if sudo dmidecode -s system-manufacturer 2>/dev/null | grep -qi "lenovo"; then
        if sudo dmidecode -s system-version 2>/dev/null | grep -qi "thinkpad"; then
            log "Hardware ThinkPad detectado (recomendado)"
        else
            info "Hardware Lenovo detectado"
        fi
    else
        info "Hardware: $(sudo dmidecode -s system-manufacturer 2>/dev/null || echo "Desconocido")"
    fi
}

# Check network connectivity
check_network_connectivity() {
    header "Verificando Conectividad de Red"
    
    # Check internet connection
    if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
        log "Conexión a Internet disponible"
    else
        error "Sin conexión a Internet - requerida para descargar paquetes"
        return 1
    fi
    
    # Check DNS resolution
    if ping -c 1 -W 2 google.com >/dev/null 2>&1; then
        log "Resolución DNS funcionando"
    else
        warn "Problemas con resolución DNS"
    fi
    
    # Check package repositories
    if sudo apt update --dry-run >/dev/null 2>&1; then
        log "Repositorios de paquetes accesibles"
    else
        error "No se pueden acceder repositorios de paquetes"
        return 1
    fi
}

# Check required packages
check_required_packages() {
    header "Verificando Paquetes Básicos"
    
    local required_packages=(
        "git"
        "curl"
        "wget"
        "build-essential"
    )
    
    local missing_packages=()
    
    for package in "${required_packages[@]}"; do
        if dpkg -l | grep -q "^ii.*$package"; then
            log "Paquete instalado: $package"
        else
            missing_packages+=("$package")
            warn "Paquete faltante: $package"
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        info "Para instalar paquetes faltantes:"
        info "sudo apt update && sudo apt install -y ${missing_packages[*]}"
    fi
}

# Check USB devices
check_usb_devices() {
    header "Verificando Dispositivos USB"
    
    # Check for USB ports
    local usb_count=$(lsusb | wc -l)
    if [[ $usb_count -gt 1 ]]; then
        log "Puertos USB disponibles: $((usb_count - 1)) dispositivos detectados"
    else
        warn "No se detectaron dispositivos USB"
    fi
    
    # Check for printer (Epson)
    if lsusb | grep -qi "epson"; then
        log "Impresora Epson detectada via USB"
        lsusb | grep -i "epson"
    else
        info "Impresora Epson no detectada (se puede conectar después)"
    fi
    
    # Check for scanner (Honeywell)
    if lsusb | grep -qi "honeywell\|0c2e:0b61"; then
        log "Escáner Honeywell detectado via USB"
        lsusb | grep -i "honeywell\|0c2e:0b61"
    else
        info "Escáner Honeywell no detectado (se puede conectar después)"
    fi
}

# Check display configuration
check_display_configuration() {
    header "Verificando Configuración de Pantalla"
    
    # Check if X11 is available
    if [[ -n "${DISPLAY:-}" ]]; then
        log "Servidor X11 disponible: $DISPLAY"
        
        # Check screen resolution
        if command -v xrandr &> /dev/null; then
            local resolution=$(xrandr | grep '*' | awk '{print $1}' | head -1)
            if [[ -n "$resolution" ]]; then
                log "Resolución de pantalla: $resolution"
                
                # Check if resolution is at least 1024x768
                local width=$(echo "$resolution" | cut -d'x' -f1)
                local height=$(echo "$resolution" | cut -d'x' -f2)
                
                if [[ $width -lt 1024 ]] || [[ $height -lt 768 ]]; then
                    warn "Resolución baja detectada - se recomienda 1920x1080"
                fi
            fi
        fi
    else
        warn "Servidor X11 no disponible - ejecutando en modo consola"
    fi
}

# Check locale configuration
check_locale_configuration() {
    header "Verificando Configuración Regional"
    
    # Check if Spanish locale is available
    if locale -a | grep -q "es_MX"; then
        log "Locale español México (es_MX) disponible"
    else
        warn "Locale es_MX no disponible - se instalará durante setup"
    fi
    
    # Check timezone
    local current_tz=$(timedatectl show | grep Timezone | cut -d'=' -f2)
    if [[ "$current_tz" == "America/Mexico_City" ]]; then
        log "Zona horaria correcta: America/Mexico_City"
    else
        warn "Zona horaria actual: $current_tz (se cambiará a America/Mexico_City)"
    fi
}

# Check script files
check_installation_scripts() {
    header "Verificando Scripts de Instalación"
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local required_scripts=(
        "install-all.sh"
        "validate-installation.sh"
        "setup/setup-system.sh"
        "setup/setup-database.sh"
        "setup/setup-kiosk.sh"
        "hardware/setup-printer.sh"
        "hardware/setup-scanner.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ -f "$script_dir/$script" ]]; then
            log "Script encontrado: $script"
        else
            error "Script faltante: $script"
        fi
    done
    
    # Check if scripts are executable
    if [[ -x "$script_dir/install-all.sh" ]]; then
        log "Script principal es ejecutable"
    else
        warn "Script principal no es ejecutable - se corregirá automáticamente"
    fi
}

# Generate recommendations
generate_recommendations() {
    header "Recomendaciones"
    
    if [[ $CHECKS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}✅ SISTEMA LISTO PARA INSTALACIÓN${NC}"
        echo ""
        echo "Su sistema cumple con todos los requisitos. Puede proceder con:"
        echo -e "${BOLD}sudo ./scripts/install-all.sh${NC}"
    else
        echo -e "${RED}${BOLD}❌ SISTEMA NO ESTÁ LISTO${NC}"
        echo ""
        echo "Por favor corrija los siguientes problemas antes de instalar:"
        echo "(Vea los mensajes de error arriba para detalles)"
    fi
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}${BOLD}⚠️  ADVERTENCIAS${NC}"
        echo "Hay $WARNINGS advertencias que deberían considerarse."
        echo "La instalación puede continuar pero podría no ser óptima."
    fi
    
    echo ""
    echo "Tiempo estimado de instalación: 45-90 minutos"
    echo "Asegúrese de tener una conexión estable a Internet durante la instalación."
}

# Main execution
main() {
    show_banner
    
    # Run all checks
    check_user_permissions
    check_operating_system
    check_hardware_requirements
    check_network_connectivity
    check_required_packages
    check_usb_devices
    check_display_configuration
    check_locale_configuration
    check_installation_scripts
    
    # Summary
    echo ""
    echo -e "${BOLD}${BLUE}=== RESUMEN ===${NC}"
    echo -e "Verificaciones exitosas: ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Verificaciones fallidas: ${RED}$CHECKS_FAILED${NC}"
    echo -e "Advertencias: ${YELLOW}$WARNINGS${NC}"
    
    generate_recommendations
    
    # Exit with appropriate code
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Run main function
main "$@"