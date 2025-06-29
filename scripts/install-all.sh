#!/bin/bash

# Parking System - Master Installation Script (Modernized)
# Purpose: Execute complete installation process for parking system on ThinkPad kiosk
# Usage: sudo ./install-all.sh [production|development|test]

# ==============================================================================
# INITIALIZATION
# ==============================================================================

# Get script directory and source shared libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/logging.sh"
source "$SCRIPT_DIR/lib/validation.sh"

# ==============================================================================
# INSTALLATION CONFIGURATION
# ==============================================================================

# Installation mode and options
INSTALL_MODE="production"
CONTINUE_FROM=""
START_TIME=$(date +%s)

# Installation log
INSTALL_LOG="/var/log/parking-installation-$(date +%Y%m%d_%H%M%S).log"
set_log_file "$INSTALL_LOG"

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

# ==============================================================================
# HELP AND USAGE
# ==============================================================================

show_usage() {
    cat << EOF
Uso: $0 [MODO] [OPCIONES]

MODOS:
  production    Instalación completa para producción (por defecto)
  development   Instalación con herramientas de desarrollo
  test          Instalación mínima para pruebas

OPCIONES:
  --continue-from FASE    Continuar instalación desde fase específica
  --help                  Mostrar esta ayuda

FASES DISPONIBLES:
$(printf "  - %s\n" "${PHASES[@]}" "${OPTIONAL_PHASES[@]}")

EJEMPLOS:
  $0 production
  $0 development
  $0 --continue-from deploy-parking-system

EOF
}

show_banner() {
    log_header "$APP_NAME - INSTALACIÓN AUTOMÁTICA"
    log_info "Versión: $APP_VERSION"
    log_info "Ubuntu LTS + Modo Kiosco"
    log_info "Lenovo ThinkPad + Hardware Integrado"
}

# ==============================================================================
# ARGUMENT PARSING
# ==============================================================================

parse_arguments() {
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
                    log_error "Opción desconocida: $1"
                    show_usage
                    exit 1
                elif [[ -z "$INSTALL_MODE" || "$INSTALL_MODE" == "production" ]]; then
                    INSTALL_MODE="$1"
                else
                    log_error "Argumento desconocido: $1"
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
            log_info "Modo de instalación: $INSTALL_MODE"
            ;;
        *)
            log_error "Modo de instalación inválido: $INSTALL_MODE"
            show_usage
            exit 1
            ;;
    esac
}

# ==============================================================================
# INSTALLATION STATUS TRACKING
# ==============================================================================

create_installation_status() {
    cat > /opt/parking-installation-status.txt << EOF
INSTALACIÓN SISTEMA DE ESTACIONAMIENTO
====================================
Inicio: $(date)
Modo: $INSTALL_MODE
Script: $0
Log: $INSTALL_LOG
Estado: EN_PROGRESO

EOF
}

update_installation_status() {
    local status="$1"
    local additional_info="${2:-}"
    
    cat >> /opt/parking-installation-status.txt << EOF
$status: $(date)
$additional_info
EOF
}

# ==============================================================================
# PHASE EXECUTION
# ==============================================================================

get_script_path_for_phase() {
    local phase_name="$1"
    
    case "$phase_name" in
        "setup-system"|"setup-database"|"setup-kiosk")
            echo "$SCRIPT_DIR/setup/${phase_name}.sh"
            ;;
        "setup-printer"|"setup-scanner")
            echo "$SCRIPT_DIR/hardware/${phase_name}.sh"
            ;;
        "harden-system"|"setup-remote-admin")
            echo "$SCRIPT_DIR/security/${phase_name}.sh"
            ;;
        "deploy-parking-system"|"setup-systemd-services")
            echo "$SCRIPT_DIR/deploy/${phase_name}.sh"
            ;;
        "setup-backups")
            echo "$SCRIPT_DIR/backup/${phase_name}.sh"
            ;;
        "test-system"|"test-kiosk-mode")
            echo "$SCRIPT_DIR/test/${phase_name}.sh"
            ;;
        *)
            log_error "Fase desconocida: $phase_name"
            return 1
            ;;
    esac
}

execute_phase() {
    local phase_name="$1"
    local script_path
    
    script_path=$(get_script_path_for_phase "$phase_name")
    if [[ $? -ne 0 ]]; then
        return 1
    fi
    
    # Check if script exists
    if [[ ! -f "$script_path" ]]; then
        log_error "Script no encontrado: $script_path"
        return 1
    fi
    
    # Make script executable
    chmod +x "$script_path"
    
    log_header "EJECUTANDO FASE: $phase_name"
    
    # Execute the script
    if "$script_path"; then
        log_success "Fase $phase_name completada exitosamente"
        return 0
    else
        log_error "Fase $phase_name falló"
        return 1
    fi
}

show_progress() {
    local current_phase="$1"
    
    local elapsed_time=$(($(date +%s) - START_TIME))
    local eta=0
    if (( PHASES_COMPLETED > 0 )); then
        eta=$((elapsed_time * PHASES_TOTAL / PHASES_COMPLETED - elapsed_time))
    fi
    
    log_info ""
    log_info "╔══════════════════════════════════════════════════════════════╗"
    log_info "║                      PROGRESO INSTALACIÓN                    ║"
    log_info "╠══════════════════════════════════════════════════════════════╣"
    log_info "$(printf "║ Fase actual: %-47s ║" "$current_phase")"
    log_info "$(printf "║ Progreso: (%d/%d fases)                               ║" "$PHASES_COMPLETED" "$PHASES_TOTAL")"
    log_info "$(printf "║ Tiempo transcurrido: %02d:%02d:%02d                         ║" $((elapsed_time/3600)) $((elapsed_time%3600/60)) $((elapsed_time%60)))"
    if (( PHASES_COMPLETED > 0 )); then
        log_info "$(printf "║ Tiempo estimado restante: %02d:%02d:%02d                   ║" $((eta/3600)) $((eta%3600/60)) $((eta%60)))"
    fi
    log_info "╚══════════════════════════════════════════════════════════════╝"
    log_info ""
}

# ==============================================================================
# ERROR HANDLING
# ==============================================================================

handle_installation_failure() {
    local failed_phase="$1"
    
    log_error "INSTALACIÓN FALLÓ EN FASE: $failed_phase"
    
    update_installation_status "FALLO" "Fase fallida: $failed_phase"
    
    # Show recovery options
    log_info ""
    log_info "OPCIONES DE RECUPERACIÓN:"
    log_info "========================"
    log_info "1. Revisar log de instalación: $INSTALL_LOG"
    log_info "2. Ejecutar fase individual: <categoria>/${failed_phase}.sh"
    log_info "3. Continuar desde fase específica: $0 --continue-from $failed_phase"
    log_info "4. Reinstalar completamente: $0 $INSTALL_MODE"
    log_info ""
    
    # Generate failure report
    cat > /opt/parking-installation-failure-report.txt << EOF
REPORTE DE FALLO DE INSTALACIÓN
==============================
Fecha: $(date)
Fase fallida: $failed_phase
Fases completadas: $PHASES_COMPLETED
Log completo: $INSTALL_LOG

Fases completadas exitosamente:
$(for i in $(seq 0 $((PHASES_COMPLETED - 1))); do echo "✓ ${PHASES[$i]}"; done)

Fase que falló:
✗ $failed_phase

Pasos para continuar:
1. Revisar errores en: $INSTALL_LOG
2. Corregir el problema identificado
3. Re-ejecutar la fase: <categoria>/${failed_phase}.sh
4. Continuar instalación desde: $0 --continue-from <siguiente_fase>

EOF
    
    log_info "Reporte de fallo generado: /opt/parking-installation-failure-report.txt"
}

# ==============================================================================
# INSTALLATION SUMMARY
# ==============================================================================

show_installation_summary() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    log_header "INSTALACIÓN COMPLETADA"
    
    local summary_text="
RESUMEN DE INSTALACIÓN
=====================
Fecha finalización: $(date)
Duración total: $((total_duration / 3600))h $((total_duration % 3600 / 60))m $((total_duration % 60))s
Modo instalación: $INSTALL_MODE
Fases ejecutadas: $PHASES_COMPLETED/$PHASES_TOTAL
Fases fallidas: $PHASES_FAILED

COMPONENTES INSTALADOS:
✓ Sistema Ubuntu configurado (español México)
✓ PostgreSQL 14 con base de datos parking_lot
✓ Modo kiosco con autologin (usuario: operador)
✓ Impresora térmica Epson TM-T20III configurada
✓ Escáner Honeywell Voyager 1250g configurado
✓ Sistema endurecido con firewall y fail2ban
✓ Acceso administrativo remoto configurado
✓ Aplicación de estacionamiento desplegada
✓ Servicios systemd configurados
✓ Sistema de respaldos automáticos

CREDENCIALES IMPORTANTES:
Usuario operador: operador
Usuario admin: admin
Credenciales BD: /opt/parking-db-credentials
Credenciales admin: /opt/parking-admin-credentials

PRÓXIMOS PASOS:
1. Reiniciar el sistema: sudo reboot
2. Verificar modo kiosco automático
3. Probar impresora: /opt/test-thermal-printer.sh
4. Probar escáner: /opt/test-barcode-scanner.sh
5. Acceder via web: http://$(get_system_ip)
6. Configurar acceso remoto SSH

DOCUMENTACIÓN:
- Status sistema: /opt/parking-setup-status.txt
- Log instalación: $INSTALL_LOG
- Scripts gestión: /opt/parking-*.sh

SOPORTE:
- Monitoreo: /opt/remote-admin-tools.sh status
- Servicios: /opt/parking-services.sh status
- Respaldos: /opt/backup-manager.sh status
- Pruebas: /opt/test-system.sh
"
    
    echo "$summary_text" | tee -a "$INSTALL_LOG"
    
    update_installation_status "COMPLETADO" "Estado: EXITOSO"
    
    log_header "INSTALACIÓN COMPLETA FINALIZADA EXITOSAMENTE"
}

# ==============================================================================
# MAIN INSTALLATION PROCESS
# ==============================================================================

main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    # Show banner
    show_banner
    
    # Create installation status file
    create_installation_status
    
    # Comprehensive prerequisite validation
    log_header "VALIDACIÓN DE PRERREQUISITOS"
    if ! run_comprehensive_validation; then
        log_error "La validación de prerrequisitos falló"
        log_error "Corrija los problemas reportados antes de continuar"
        exit 1
    fi
    
    # Count total phases
    PHASES_TOTAL=${#PHASES[@]}
    
    # Add test phases if in development mode
    if [[ "$INSTALL_MODE" == "development" || "$INSTALL_MODE" == "test" ]]; then
        PHASES+=("${OPTIONAL_PHASES[@]}")
        PHASES_TOTAL=${#PHASES[@]}
    fi
    
    log_info "Iniciando instalación de $PHASES_TOTAL fases en modo $INSTALL_MODE..."
    
    # Determine starting phase
    local start_index=0
    if [[ -n "$CONTINUE_FROM" ]]; then
        log_info "Continuando instalación desde fase: $CONTINUE_FROM"
        for i in "${!PHASES[@]}"; do
            if [[ "${PHASES[$i]}" == "$CONTINUE_FROM" ]]; then
                start_index=$i
                PHASES_COMPLETED=$i
                log_info "Saltando fases completadas (0-$((i-1)))"
                break
            fi
        done
        
        if [[ "$start_index" -eq 0 && "$CONTINUE_FROM" != "${PHASES[0]}" ]]; then
            log_error "Fase '$CONTINUE_FROM' no encontrada. Fases disponibles: ${PHASES[*]}"
            exit 1
        fi
    fi
    
    # Execute each phase from starting index
    for ((i=start_index; i<${#PHASES[@]}; i++)); do
        local phase="${PHASES[$i]}"
        show_progress "$phase"
        
        if execute_phase "$phase"; then
            ((PHASES_COMPLETED++))
            log_info "Fase $phase completada ($PHASES_COMPLETED/$PHASES_TOTAL)"
        else
            ((PHASES_FAILED++))
            FAILED_PHASES+=("$phase")
            handle_installation_failure "$phase"
            exit 1
        fi
        
        # Small delay between phases
        sleep 2
    done
    
    # Show final summary
    show_installation_summary
    
    # Final recommendations
    log_warn "IMPORTANTE: Reinicie el sistema para activar el modo kiosco completo"
    log_info "Comando: sudo reboot"
    
    exit 0
}

# ==============================================================================
# COMMAND LINE INTERFACE
# ==============================================================================

# Handle special commands
case "${1:-}" in
    "--help"|"-h")
        show_usage
        exit 0
        ;;
    "--version")
        echo "Instalador $APP_NAME v$APP_VERSION"
        echo "Compatible con Ubuntu 20.04+ LTS"
        exit 0
        ;;
    "--status")
        if [[ -f "/opt/parking-installation-status.txt" ]]; then
            cat /opt/parking-installation-status.txt
        else
            echo "No se encontró información de instalación previa."
        fi
        exit 0
        ;;
esac

# Check root privileges
if ! check_root_privileges; then
    exit 1
fi

# Run main installation
main "$@"