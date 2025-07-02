#!/bin/bash
set -euo pipefail

# Script: Master Installation Script for Parking Management System
# Purpose: Execute complete installation process for parking system on ThinkPad kiosk
# Usage: sudo ./install-all.sh [production|development|test]

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to sanitize log messages (remove sensitive data)
sanitize_log() {
    local message="$1"
    # Remove passwords, tokens, and credentials
    message=$(echo "$message" | sed -E 's/(password|passwd|secret|token|key|credential)[=:][ ]*[^ ]*/(password|passwd|secret|token|key|credential)=***HIDDEN***/gi')
    message=$(echo "$message" | sed -E 's/postgresql:\/\/[^:]*:[^@]*@/postgresql:\/\/***:***@/gi')
    message=$(echo "$message" | sed -E 's/(jwt_secret|database_url|api_key)[=:][ ]*[^ ]*/(jwt_secret|database_url|api_key)=***HIDDEN***/gi')
    echo "$message"
}

# Logging functions with sanitization
log() {
    local sanitized_msg=$(sanitize_log "$1")
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $sanitized_msg${NC}"
}

error() {
    local sanitized_msg=$(sanitize_log "$1")
    echo -e "${RED}[ERROR] $sanitized_msg${NC}" >&2
}

warn() {
    local sanitized_msg=$(sanitize_log "$1")
    echo -e "${YELLOW}[WARNING] $sanitized_msg${NC}"
}

info() {
    local sanitized_msg=$(sanitize_log "$1")
    echo -e "${BLUE}[INFO] $sanitized_msg${NC}"
}

# Usage function
show_usage() {
    echo "Uso: $0 [MODO] [OPCIONES]"
    echo ""
    echo "MODOS:"
    echo "  production    Instalación completa para producción (por defecto)"
    echo "  development   Instalación con herramientas de desarrollo"
    echo "  test          Instalación mínima para pruebas"
    echo ""
    echo "OPCIONES:"
    echo "  --continue-from FASE    Continuar instalación desde fase específica"
    echo "  --help                  Mostrar esta ayuda"
    echo ""
    echo "FASES DISPONIBLES:"
    local all_phases=("${PHASES[@]}" "${OPTIONAL_PHASES[@]}")
    for phase in "${all_phases[@]}"; do
        echo "  - $phase"
    done
    echo ""
    echo "EJEMPLOS:"
    echo "  $0 production"
    echo "  $0 development"
    echo "  $0 --continue-from deploy-parking-system"
    echo ""
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

# Parse command line arguments
INSTALL_MODE="production"
CONTINUE_FROM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --continue-from)
            CONTINUE_FROM="$2"
            shift 2
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        production|development|test)
            INSTALL_MODE="$1"
            shift
            ;;
        *)
            if [[ "$1" =~ ^-- ]]; then
                error "Opción desconocida: $1"
                show_usage
                exit 1
            elif [[ -z "$INSTALL_MODE" || "$INSTALL_MODE" == "production" ]]; then
                INSTALL_MODE="$1"
            else
                error "Argumento desconocido: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate installation mode
case "$INSTALL_MODE" in
    production|development|test)
        ;;
    *)
        error "Modo de instalación inválido: $INSTALL_MODE. Usar: production, development, o test"
        ;;
esac
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_LOG="/var/log/parking-installation-$(date +%Y%m%d_%H%M%S).log"
START_TIME=$(date +%s)

# Installation phases
PHASES=(
    "setup-system"
    "setup-database"
    "setup-kiosk"
    "setup-printer"
    "setup-scanner"
    "harden-system"
    "setup-remote-admin"
    "deploy-parking-system"
    "setup-systemd-services"
    "setup-backups"
)

# Optional/testing phases
OPTIONAL_PHASES=(
    "test-system"
    "test-kiosk-mode"
)

# Phase execution tracking
PHASES_TOTAL=0
PHASES_COMPLETED=0
PHASES_FAILED=0
FAILED_PHASES=()

# Function to safely write to log with file locking
write_to_log() {
    local message="$1"
    local lock_file="/tmp/parking-install.lock"
    
    # Wait for lock and write atomically
    (
        flock -x 200
        echo "$message" >> "$INSTALL_LOG"
    ) 200>"$lock_file"
}

# Initialize logging with safe concurrent access
mkdir -p "$(dirname "$INSTALL_LOG")"
touch "$INSTALL_LOG"

# Redirect stdout and stderr to both console and log file with locking
exec > >(while IFS= read -r line; do 
    echo "$line"
    write_to_log "$line"
done) 2>&1

log "=== INSTALACIÓN COMPLETA SISTEMA DE ESTACIONAMIENTO ==="
log "Modo de instalación: $INSTALL_MODE"
log "Directorio scripts: $SCRIPT_DIR"
log "Log de instalación: $INSTALL_LOG"

# Create installation status file
cat > /opt/parking-installation-status.txt << EOF
INSTALACIÓN SISTEMA DE ESTACIONAMIENTO
====================================
Inicio: $(date)
Modo: $INSTALL_MODE
Script: $0
Log: $INSTALL_LOG
Estado: EN_PROGRESO

EOF

# Function to display banner
show_banner() {
    echo ""
    echo "################################################################"
    echo "#                                                              #"
    echo "#          SISTEMA DE GESTIÓN DE ESTACIONAMIENTO              #"
    echo "#                                                              #"
    echo "#                 INSTALACIÓN AUTOMÁTICA                      #"
    echo "#                                                              #"
    echo "#             Ubuntu LTS + Modo Kiosco                        #"
    echo "#          Lenovo ThinkPad + Hardware Integrado               #"
    echo "#                                                              #"
    echo "################################################################"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    log "=== VERIFICANDO PRERREQUISITOS ==="
    
    # Check OS
    if ! lsb_release -d | grep -q "Ubuntu"; then
        error "Este script está diseñado para Ubuntu LTS"
        exit 1
    fi
    
    # Check OS version
    local ubuntu_version=$(lsb_release -r | awk '{print $2}' | cut -d. -f1)
    if [ "$ubuntu_version" -lt 20 ]; then
        error "Ubuntu 20.04 LTS o superior requerido"
        exit 1
    fi
    
    # Check internet connectivity
    if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        error "Conexión a internet requerida para la instalación"
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    local available_gb=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
    if [ "$available_gb" -lt 10 ]; then
        error "Espacio insuficiente en disco. Mínimo 10GB requerido, disponible: ${available_gb}GB"
        exit 1
    fi
    
    # Check memory (minimum 4GB for production)
    local memory_gb=$(free -g | awk 'NR==2{print $2}')
    local memory_mb=$(free -m | awk 'NR==2{print $2}')
    
    if [ "$INSTALL_MODE" = "production" ]; then
        if [ "$memory_gb" -lt 4 ]; then
            error "Memoria insuficiente para modo producción. Mínimo 4GB requerido, detectada: ${memory_mb}MB"
            exit 1
        elif [ "$memory_gb" -lt 8 ]; then
            warn "Memoria RAM recomendada para producción: 8GB. Detectada: ${memory_gb}GB"
            echo "¿Continuar con ${memory_gb}GB de RAM? (y/N)"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                error "Instalación cancelada por el usuario"
                exit 1
            fi
        fi
    else
        if [ "$memory_gb" -lt 2 ]; then
            warn "Memoria RAM baja para modo ${INSTALL_MODE}. Detectada: ${memory_mb}MB"
        fi
    fi
    
    # Check comprehensive script directory structure
    local required_dirs=("setup" "hardware" "security" "deploy" "backup" "test")
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$SCRIPT_DIR/$dir" ]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [ ${#missing_dirs[@]} -gt 0 ]; then
        error "Estructura de directorios de scripts incompleta. Faltantes: ${missing_dirs[*]}"
        exit 1
    fi
    
    # Check for required core scripts
    local required_scripts=(
        "setup/setup-system.sh"
        "setup/setup-database.sh"
        "setup/setup-kiosk.sh"
        "hardware/setup-printer.sh"
        "hardware/setup-scanner.sh"
        "security/harden-system.sh"
        "deploy/deploy-parking-system.sh"
        "deploy/setup-systemd-services.sh"
    )
    
    local missing_scripts=()
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$SCRIPT_DIR/$script" ]; then
            missing_scripts+=("$script")
        elif [ ! -x "$SCRIPT_DIR/$script" ]; then
            warn "Script sin permisos de ejecución: $script"
            chmod +x "$SCRIPT_DIR/$script"
        fi
    done
    
    if [ ${#missing_scripts[@]} -gt 0 ]; then
        error "Scripts críticos faltantes: ${missing_scripts[*]}"
        exit 1
    fi
    
    log "✓ Prerrequisitos verificados"
}

# Function to execute installation phase
execute_phase() {
    local phase_name="$1"
    local script_path=""
    
    # Determine script path based on phase
    case "$phase_name" in
        "setup-system"|"setup-database"|"setup-kiosk")
            script_path="$SCRIPT_DIR/setup/${phase_name}.sh"
            ;;
        "setup-printer"|"setup-scanner")
            script_path="$SCRIPT_DIR/hardware/${phase_name}.sh"
            ;;
        "harden-system"|"setup-remote-admin")
            script_path="$SCRIPT_DIR/security/${phase_name}.sh"
            ;;
        "deploy-parking-system"|"setup-systemd-services")
            script_path="$SCRIPT_DIR/deploy/${phase_name}.sh"
            ;;
        "setup-backups")
            script_path="$SCRIPT_DIR/backup/${phase_name}.sh"
            ;;
        "test-system"|"test-kiosk-mode")
            script_path="$SCRIPT_DIR/test/${phase_name}.sh"
            ;;
        *)
            error "Fase desconocida: $phase_name"
            return 1
            ;;
    esac
    
    # Check if script exists
    if [ ! -f "$script_path" ]; then
        error "Script no encontrado: $script_path"
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_path"
    
    log "=== EJECUTANDO FASE: $phase_name ==="
    
    # Execute the script
    if "$script_path"; then
        log "✓ Fase $phase_name completada exitosamente"
        return 0
    else
        error "✗ Fase $phase_name falló"
        return 1
    fi
}

# Function to show installation progress
show_progress() {
    local current_phase="$1"
    local total_phases="$2"
    local completed_phases="$3"
    
    local percentage=0
    if [ "$total_phases" -gt 0 ]; then
        percentage=$((completed_phases * 100 / total_phases))
    fi
    local elapsed_time=$(($(date +%s) - START_TIME))
    local eta=0
    if [ "$completed_phases" -gt 0 ]; then
        eta=$((elapsed_time * total_phases / completed_phases - elapsed_time))
    fi
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                      PROGRESO INSTALACIÓN                    ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    printf "║ Fase actual: %-47s ║\n" "$current_phase"
    printf "║ Progreso: %3d%% (%d/%d fases)                            ║\n" "$percentage" "$completed_phases" "$total_phases"
    printf "║ Tiempo transcurrido: %02d:%02d:%02d                         ║\n" $((elapsed_time/3600)) $((elapsed_time%3600/60)) $((elapsed_time%60))
    if [ "$completed_phases" -gt 0 ]; then
        printf "║ Tiempo estimado restante: %02d:%02d:%02d                   ║\n" $((eta/3600)) $((eta%3600/60)) $((eta%60))
    fi
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# Function to handle installation failure
handle_failure() {
    local failed_phase="$1"
    
    error "INSTALACIÓN FALLÓ EN FASE: $failed_phase"
    
    # Update installation status
    cat >> /opt/parking-installation-status.txt << EOF
FALLO: $(date)
Fase fallida: $failed_phase
Fases completadas: $PHASES_COMPLETED/$PHASES_TOTAL
EOF
    
    # Show recovery options
    echo ""
    echo "OPCIONES DE RECUPERACIÓN:"
    echo "========================"
    echo "1. Revisar log de instalación: $INSTALL_LOG"
    echo "2. Ejecutar fase individual: $SCRIPT_DIR/<categoria>/${failed_phase}.sh"
    echo "3. Continuar desde fase específica: $0 --continue-from $failed_phase"
    echo "4. Reinstalar completamente: $0 $INSTALL_MODE"
    echo ""
    
    # Generate failure report
    cat > /opt/parking-installation-failure-report.txt << EOF
REPORTE DE FALLO DE INSTALACIÓN
==============================
Fecha: $(date)
Fase fallida: $failed_phase
Fases completadas: $PHASES_COMPLETED
Fases fallidas: ${#FAILED_PHASES[@]}
Log completo: $INSTALL_LOG

Fases completadas exitosamente:
$(for i in $(seq 0 $((PHASES_COMPLETED - 1))); do echo "✓ ${PHASES[$i]}"; done)

Fase que falló:
✗ $failed_phase

Pasos para continuar:
1. Revisar errores en: $INSTALL_LOG
2. Corregir el problema identificado
3. Re-ejecutar la fase: $SCRIPT_DIR/<categoria>/${failed_phase}.sh
4. Continuar instalación desde: $0 --continue-from <siguiente_fase>

EOF
    
    log "Reporte de fallo generado: /opt/parking-installation-failure-report.txt"
}

# Function to show final installation summary
show_installation_summary() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    INSTALACIÓN COMPLETADA                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    
    {
        echo "RESUMEN DE INSTALACIÓN"
        echo "====================="
        echo "Fecha finalización: $(date)"
        echo "Duración total: $((total_duration / 3600))h $((total_duration % 3600 / 60))m $((total_duration % 60))s"
        echo "Modo instalación: $INSTALL_MODE"
        echo "Fases ejecutadas: $PHASES_COMPLETED/$PHASES_TOTAL"
        echo "Fases fallidas: $PHASES_FAILED"
        echo ""
        echo "COMPONENTES INSTALADOS:"
        echo "✓ Sistema Ubuntu configurado (español México)"
        echo "✓ PostgreSQL 14 con base de datos parking_lot"
        echo "✓ Modo kiosco con autologin (usuario: operador)"
        echo "✓ Impresora térmica Epson TM-T20III configurada"
        echo "✓ Escáner Honeywell Voyager 1250g configurado"
        echo "✓ Sistema endurecido con firewall y fail2ban"
        echo "✓ Acceso administrativo remoto configurado"
        echo "✓ Aplicación de estacionamiento desplegada"
        echo "✓ Servicios systemd configurados"
        echo "✓ Sistema de respaldos automáticos"
        echo ""
        echo "CREDENCIALES IMPORTANTES:"
        echo "Usuario operador: operador"
        echo "Usuario admin: admin"
        echo "Credenciales BD: /opt/parking-db-credentials"
        echo "Credenciales admin: /opt/parking-admin-credentials"
        echo ""
        echo "PRÓXIMOS PASOS:"
        echo "1. Reiniciar el sistema: sudo reboot"
        echo "2. Verificar modo kiosco automático"
        echo "3. Probar impresora: /opt/test-thermal-printer.sh"
        echo "4. Probar escáner: /opt/test-barcode-scanner.sh"
        echo "5. Acceder via web: http://$(hostname -I | awk '{print $1}')"
        echo "6. Configurar acceso remoto SSH"
        echo ""
        echo "DOCUMENTACIÓN:"
        echo "- Guía completa: INSTALLATION_GUIDE.md"
        echo "- Status sistema: /opt/parking-setup-status.txt"
        echo "- Log instalación: $INSTALL_LOG"
        echo "- Scripts gestión: /opt/parking-*.sh"
        echo ""
        echo "SOPORTE:"
        echo "- Monitoreo: /opt/remote-admin-tools.sh status"
        echo "- Servicios: /opt/parking-services.sh status"
        echo "- Respaldos: /opt/backup-manager.sh status"
        echo "- Pruebas: /opt/test-system.sh"
        
    } | tee -a "$INSTALL_LOG"
    
    # Update final installation status
    cat >> /opt/parking-installation-status.txt << EOF
COMPLETADO: $(date)
Duración: $((total_duration / 60)) minutos
Estado: EXITOSO
Fases: $PHASES_COMPLETED/$PHASES_TOTAL completadas
EOF
    
    log "=== INSTALACIÓN COMPLETA FINALIZADA EXITOSAMENTE ==="
}

# Main installation process
main() {
    show_banner
    check_prerequisites
    
    # Count total phases
    PHASES_TOTAL=${#PHASES[@]}
    
    # Add test phases if in development mode
    if [ "$INSTALL_MODE" = "development" ] || [ "$INSTALL_MODE" = "test" ]; then
        PHASES+=("${OPTIONAL_PHASES[@]}")
        PHASES_TOTAL=${#PHASES[@]}
    fi
    
    log "Iniciando instalación de $PHASES_TOTAL fases en modo $INSTALL_MODE..."
    
    # Determine starting phase
    local start_index=0
    if [[ -n "$CONTINUE_FROM" ]]; then
        log "Continuando instalación desde fase: $CONTINUE_FROM"
        for i in "${!PHASES[@]}"; do
            if [[ "${PHASES[$i]}" == "$CONTINUE_FROM" ]]; then
                start_index=$i
                PHASES_COMPLETED=$i
                log "Saltando fases completadas (0-$((i-1)))"
                break
            fi
        done
        
        if [[ "$start_index" -eq 0 && "$CONTINUE_FROM" != "${PHASES[0]}" ]]; then
            error "Fase '$CONTINUE_FROM' no encontrada. Fases disponibles: ${PHASES[*]}"
        fi
    fi
    
    # Execute each phase from starting index
    for ((i=start_index; i<${#PHASES[@]}; i++)); do
        phase="${PHASES[$i]}"
        show_progress "$phase" "$PHASES_TOTAL" "$PHASES_COMPLETED"
        
        if execute_phase "$phase"; then
            ((PHASES_COMPLETED++))
            log "Fase $phase completada ($PHASES_COMPLETED/$PHASES_TOTAL)"
        else
            ((PHASES_FAILED++))
            FAILED_PHASES+=("$phase")
            handle_failure "$phase"
            exit 1
        fi
        
        # Small delay between phases
        sleep 2
    done
    
    # Show final summary
    show_installation_summary
    
    # Final recommendations
    echo ""
    warn "IMPORTANTE: Reinicie el sistema para activar el modo kiosco completo"
    info "Comando: sudo reboot"
    echo ""
    
    exit 0
}

# Function to show help
show_help() {
    echo "Instalación Completa - Sistema de Estacionamiento"
    echo "================================================="
    echo ""
    echo "Usage: $0 [modo] [opciones]"
    echo ""
    echo "Modos de instalación:"
    echo "  production   - Instalación completa para producción (default)"
    echo "  development  - Instalación con herramientas de desarrollo"
    echo "  test         - Instalación con pruebas adicionales"
    echo ""
    echo "Opciones:"
    echo "  --help, -h   - Mostrar esta ayuda"
    echo "  --version    - Mostrar versión del instalador"
    echo "  --status     - Mostrar estado de instalación actual"
    echo ""
    echo "Descripción:"
    echo "Este script ejecuta la instalación completa del Sistema de Gestión"
    echo "de Estacionamiento en una Lenovo ThinkPad con Ubuntu LTS."
    echo ""
    echo "Componentes instalados:"
    echo "- Sistema base Ubuntu con idioma español México"
    echo "- PostgreSQL 14 con base de datos configurada"
    echo "- Modo kiosco automático con OpenBox y Chromium"
    echo "- Integración hardware: impresora térmica y escáner"
    echo "- Seguridad: firewall, fail2ban, SSH hardening"
    echo "- Aplicación web de estacionamiento"
    echo "- Servicios systemd y monitoreo automático"
    echo "- Sistema de respaldos automáticos"
    echo ""
    echo "Duración estimada: 45-90 minutos"
    echo "Requisitos: Ubuntu 20.04+, 8GB RAM, 20GB disco, Internet"
    echo ""
    echo "Ejemplos:"
    echo "  $0 production"
    echo "  $0 development"
    echo "  $0 --status"
}

# Function to show installation status
show_status() {
    echo "Estado de Instalación del Sistema de Estacionamiento"
    echo "===================================================="
    
    if [ -f "/opt/parking-installation-status.txt" ]; then
        cat /opt/parking-installation-status.txt
    else
        echo "No se encontró información de instalación previa."
    fi
    
    echo ""
    
    if [ -f "/opt/parking-setup-status.txt" ]; then
        echo "Estado de Componentes:"
        echo "====================="
        cat /opt/parking-setup-status.txt
    fi
}

# Parse command line arguments
case "${1:-production}" in
    "production"|"development"|"test")
        main
        ;;
    "--help"|"-h")
        show_help
        ;;
    "--version")
        echo "Instalador Sistema de Estacionamiento v1.0.0"
        echo "Compatible con Ubuntu 20.04+ LTS"
        ;;
    "--status")
        show_status
        ;;
    *)
        error "Opción inválida: $1"
        show_help
        exit 1
        ;;
esac