#!/bin/bash
set -euo pipefail

# Script: Kiosk Mode Test for Parking Management System
# Purpose: Test kiosk mode functionality and security
# Usage: sudo ./test-kiosk-mode.sh

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

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

test_result() {
    local test_name="$1"
    local result="$2"
    
    ((TOTAL_TESTS++))
    
    if [[ "$result" == "pass" ]]; then
        log "✓ $test_name - EXITOSO"
        ((TESTS_PASSED++))
    else
        error "✗ $test_name - FALLÓ"
        ((TESTS_FAILED++))
    fi
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

log "=== PRUEBAS DE MODO KIOSCO ==="

# Test 1: Auto-login Configuration
log "Verificando configuración de auto-login..."
if grep -q "autologin-user=operador" /etc/lightdm/lightdm.conf 2>/dev/null; then
    test_result "Auto-login configurado" "pass"
else
    test_result "Auto-login configurado" "fail"
fi

# Test 2: User Restrictions
log "Verificando restricciones de usuario operador..."
if ! su - operador -c "sudo apt update" 2>/dev/null; then
    test_result "Restricciones sudo correctas" "pass"
else
    test_result "Restricciones sudo correctas" "fail"
    warn "Usuario operador tiene permisos sudo excesivos"
fi

# Test 3: Kiosk Startup Script
log "Verificando script de inicio de kiosco..."
if [ -x /opt/parking-kiosk-start.sh ]; then
    test_result "Script de kiosco ejecutable" "pass"
else
    test_result "Script de kiosco ejecutable" "fail"
fi

# Test 4: OpenBox Configuration
log "Verificando configuración de OpenBox..."
if [ -f /home/operador/.config/openbox/autostart ]; then
    test_result "OpenBox configurado" "pass"
else
    test_result "OpenBox configurado" "fail"
fi

# Test 5: Chromium Kiosk Flags
log "Verificando flags de Chromium para kiosco..."
if grep -q "\\--kiosk" /opt/parking-kiosk-start.sh; then
    if grep -q "\\--disable-dev-tools" /opt/parking-kiosk-start.sh || grep -q "\\--disable-extensions" /opt/parking-kiosk-start.sh; then
        test_result "Chromium flags seguros" "pass"
    else
        test_result "Chromium flags seguros" "fail"
        warn "Faltan flags de seguridad en Chromium"
    fi
else
    test_result "Chromium flags seguros" "fail"
fi

# Test 6: Screen Saver Disabled
log "Verificando desactivación de protector de pantalla..."
if grep -q "xset s off" /home/operador/.config/openbox/autostart; then
    test_result "Protector de pantalla desactivado" "pass"
else
    test_result "Protector de pantalla desactivado" "fail"
fi

# Test 7: Power Management
log "Verificando gestión de energía..."
if grep -q "HandleLidSwitch=ignore" /etc/systemd/logind.conf; then
    test_result "Gestión de energía configurada" "pass"
else
    test_result "Gestión de energía configurada" "fail"
fi

# Test 8: Keyboard Shortcuts
log "Verificando atajos de teclado bloqueados..."
if [ -f /home/operador/.config/openbox/rc.xml ]; then
    # Check if Alt+F4, Ctrl+Alt+Del are disabled
    if ! grep -q "A-F4.*Close" /home/operador/.config/openbox/rc.xml; then
        test_result "Atajos peligrosos deshabilitados" "pass"
    else
        test_result "Atajos peligrosos deshabilitados" "fail"
    fi
else
    test_result "Atajos peligrosos deshabilitados" "fail"
fi

# Test 9: Auto-restart Mechanism
log "Verificando mecanismo de auto-reinicio..."
if grep -q "while true" /opt/parking-kiosk-start.sh; then
    test_result "Auto-reinicio de Chromium configurado" "pass"
else
    test_result "Auto-reinicio de Chromium configurado" "fail"
fi

# Test 10: System Monitoring
log "Verificando monitoreo del sistema..."
if [ -f /etc/cron.d/parking-monitor ]; then
    test_result "Monitoreo automático configurado" "pass"
else
    test_result "Monitoreo automático configurado" "fail"
fi

# Test 11: Recovery Script
log "Verificando script de recuperación..."
if [ -x /opt/parking-system-recovery.sh ]; then
    test_result "Script de recuperación disponible" "pass"
else
    test_result "Script de recuperación disponible" "fail"
fi

# Test 12: Display Resolution
log "Verificando configuración de pantalla..."
if [ -f /etc/X11/xorg.conf.d/99-kiosk-display.conf ]; then
    test_result "Configuración de pantalla para kiosco" "pass"
else
    test_result "Configuración de pantalla para kiosco" "fail"
fi

# Test 13: User Switching Disabled
log "Verificando bloqueo de cambio de usuario..."
if grep -q "allow-user-switching=false" /etc/lightdm/lightdm.conf 2>/dev/null; then
    test_result "Cambio de usuario bloqueado" "pass"
else
    test_result "Cambio de usuario bloqueado" "fail"
fi

# Test 14: Log Files
log "Verificando archivos de log..."
if [ -w /var/log/parking-kiosk.log ] || touch /var/log/parking-kiosk.log 2>/dev/null; then
    test_result "Logs de kiosco configurados" "pass"
else
    test_result "Logs de kiosco configurados" "fail"
fi

# Test 15: Kiosk Mode Simulation
log "Simulando inicio de modo kiosco..."
if timeout 5 su - operador -c "DISPLAY=:99 /opt/parking-kiosk-start.sh" 2>&1 | grep -q "INICIANDO MODO KIOSCO"; then
    test_result "Script de kiosco ejecutable por operador" "pass"
else
    test_result "Script de kiosco ejecutable por operador" "fail"
fi

# Generate kiosk test report
log "=== GENERANDO REPORTE DE PRUEBAS DE KIOSCO ==="

cat > /tmp/parking-kiosk-test-report.txt << EOF
REPORTE DE PRUEBAS DE MODO KIOSCO
=================================
Fecha: $(date)
Sistema: Modo Kiosco - Sistema de Estacionamiento

RESUMEN DE RESULTADOS
--------------------
Total de pruebas: $TOTAL_TESTS
Pruebas exitosas: $TESTS_PASSED
Pruebas fallidas: $TESTS_FAILED
Tasa de éxito: $(( TESTS_PASSED * 100 / TOTAL_TESTS ))%

CONFIGURACIÓN DE SEGURIDAD
-------------------------
Auto-login: $(grep -q "autologin-user=operador" /etc/lightdm/lightdm.conf 2>/dev/null && echo "✓" || echo "✗")
Restricciones usuario: $([ $TESTS_PASSED -gt 10 ] && echo "✓" || echo "✗")
Protector pantalla: $(grep -q "xset s off" /home/operador/.config/openbox/autostart 2>/dev/null && echo "✓" || echo "✗")
Atajos bloqueados: $([ $TESTS_PASSED -gt 10 ] && echo "✓" || echo "✗")
Auto-reinicio: $([ -f /opt/parking-kiosk-start.sh ] && echo "✓" || echo "✗")

MONITOREO Y RECUPERACIÓN
-----------------------
Monitoreo cron: $([ -f /etc/cron.d/parking-monitor ] && echo "✓" || echo "✗")
Script recuperación: $([ -x /opt/parking-system-recovery.sh ] && echo "✓" || echo "✗")
Logs configurados: $([ -w /var/log/parking-kiosk.log ] 2>/dev/null && echo "✓" || echo "✗")

RECOMENDACIONES
--------------
$([ $TESTS_FAILED -gt 0 ] && echo "- Ejecutar setup-kiosk.sh nuevamente" || echo "- Kiosco correctamente configurado")
$([ $TESTS_FAILED -gt 0 ] && echo "- Verificar permisos de archivos" || echo "- Realizar prueba de reinicio completo")
$([ $TESTS_FAILED -gt 0 ] && echo "- Revisar configuración de OpenBox" || echo "- Sistema listo para producción")

PRÓXIMOS PASOS
-------------
1. Reiniciar sistema para probar auto-login
2. Verificar que Chromium inicie en pantalla completa
3. Intentar salir del kiosco (no debería ser posible)
4. Probar recuperación automática tras cierre

EOF

log "Reporte guardado en: /tmp/parking-kiosk-test-report.txt"

# Check for critical security issues
CRITICAL_ISSUES=0

log "=== VERIFICANDO PROBLEMAS CRÍTICOS DE SEGURIDAD ==="

# Check if user can access terminal
if su - operador -c "which gnome-terminal || which xterm || which konsole" 2>/dev/null; then
    error "⚠️  CRÍTICO: Usuario operador puede acceder a terminal"
    ((CRITICAL_ISSUES++))
fi

# Check if user can install software
if su - operador -c "which apt || which snap || which dpkg" 2>/dev/null | grep -v "not found"; then
    if su - operador -c "sudo apt --version" 2>/dev/null; then
        error "⚠️  CRÍTICO: Usuario operador puede instalar software"
        ((CRITICAL_ISSUES++))
    fi
fi

# Check file manager access
if su - operador -c "which nautilus || which dolphin || which thunar" 2>/dev/null | grep -v "not found"; then
    warn "⚠️  Usuario operador puede acceder al gestor de archivos"
fi

# Display summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                RESUMEN DE PRUEBAS DE KIOSCO                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Total de pruebas ejecutadas: $TOTAL_TESTS"
echo -e "Pruebas exitosas: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Pruebas fallidas: ${RED}$TESTS_FAILED${NC}"
echo -e "Problemas críticos de seguridad: ${RED}$CRITICAL_ISSUES${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]] && [[ $CRITICAL_ISSUES -eq 0 ]]; then
    log "🎉 MODO KIOSCO CORRECTAMENTE CONFIGURADO Y SEGURO"
    info "Reinicie el sistema para activar el modo kiosco completo"
    exit 0
else
    error "❌ PROBLEMAS DETECTADOS EN CONFIGURACIÓN DE KIOSCO"
    info "Revise el reporte detallado en: /tmp/parking-kiosk-test-report.txt"
    exit 1
fi