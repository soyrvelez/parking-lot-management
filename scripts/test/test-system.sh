#!/bin/bash
set -euo pipefail

# Script: System Integration Test for Parking Management System
# Purpose: Test all system components in development/test mode
# Usage: sudo ./test-system.sh

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

log "=== PRUEBAS DE INTEGRACIÓN DEL SISTEMA ==="

# Test 1: Database Connection
log "Probando conexión a base de datos..."
if sqlite3 /opt/parking-system/prisma/dev.db "SELECT 1;" >/dev/null 2>&1; then
    test_result "Conexión a base de datos" "pass"
else
    test_result "Conexión a base de datos" "fail"
fi

# Test 2: API Health Check
log "Probando endpoint de salud del API..."
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    test_result "API Health Check" "pass"
else
    test_result "API Health Check" "fail"
fi

# Test 3: Create Test Ticket
log "Probando creación de ticket..."
TICKET_RESPONSE=$(curl -s -X POST http://localhost:5000/api/parking \
    -H "Content-Type: application/json" \
    -d '{"plateNumber":"TEST123","entryTime":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
)

if echo "$TICKET_RESPONSE" | grep -q "id"; then
    test_result "Creación de ticket" "pass"
    TICKET_ID=$(echo "$TICKET_RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
    info "Ticket creado con ID: $TICKET_ID"
else
    test_result "Creación de ticket" "fail"
fi

# Test 4: Barcode Generation
log "Probando generación de código de barras..."
if command -v node >/dev/null && node -e "require('jsbarcode')" 2>/dev/null; then
    test_result "Módulo JsBarcode disponible" "pass"
else
    test_result "Módulo JsBarcode disponible" "fail"
fi

# Test 5: Printer Communication
log "Probando comunicación con impresora..."
if lpstat -p EpsonTM-T20III >/dev/null 2>&1; then
    test_result "Impresora configurada en CUPS" "pass"
else
    test_result "Impresora configurada en CUPS" "fail"
fi

# Test 6: Scanner Input Simulation
log "Probando simulación de entrada de escáner..."
if [ -e /dev/input/barcode-scanner-event ] || [ -e /dev/thermal-printer ]; then
    test_result "Dispositivos de hardware detectados" "pass"
else
    test_result "Dispositivos de hardware detectados" "fail"
    warn "Hardware no conectado - pruebas en modo simulación"
fi

# Test 7: Frontend Accessibility
log "Probando accesibilidad del frontend..."
if curl -s http://localhost:3000 | grep -q "Sistema de Estacionamiento"; then
    test_result "Frontend accesible" "pass"
else
    test_result "Frontend accesible" "fail"
fi

# Test 8: WebSocket Connection
log "Probando conexión WebSocket..."
if timeout 5 node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => { console.log('connected'); process.exit(0); });
ws.on('error', () => { process.exit(1); });
" 2>/dev/null; then
    test_result "Conexión WebSocket" "pass"
else
    test_result "Conexión WebSocket" "fail"
fi

# Test 9: Spanish Locale
log "Probando configuración de idioma español..."
if locale | grep -q "LANG=es_MX.UTF-8"; then
    test_result "Locale español México" "pass"
else
    test_result "Locale español México" "fail"
fi

# Test 10: Memory Usage
log "Probando uso de memoria..."
MEMORY_USAGE=$(ps aux | grep -E "node|chromium" | awk '{sum+=$6} END {print sum/1024}')
if (( $(echo "$MEMORY_USAGE < 2000" | bc -l) )); then
    test_result "Uso de memoria (<2GB)" "pass"
    info "Uso actual: ${MEMORY_USAGE}MB"
else
    test_result "Uso de memoria (<2GB)" "fail"
    warn "Uso alto de memoria: ${MEMORY_USAGE}MB"
fi

# Test 11: Disk Space
log "Probando espacio en disco..."
DISK_USAGE=$(df /opt/parking-system | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $DISK_USAGE -lt 80 ]]; then
    test_result "Espacio en disco disponible" "pass"
    info "Uso de disco: ${DISK_USAGE}%"
else
    test_result "Espacio en disco disponible" "fail"
    warn "Disco casi lleno: ${DISK_USAGE}%"
fi

# Test 12: Service Auto-restart
log "Probando auto-reinicio del servicio..."
systemctl stop parking-system
sleep 5
if systemctl is-active --quiet parking-system; then
    test_result "Auto-reinicio del servicio" "pass"
else
    systemctl start parking-system
    test_result "Auto-reinicio del servicio" "fail"
fi

# Test 13: Log Rotation
log "Probando rotación de logs..."
if [ -f /etc/logrotate.d/parking-system ]; then
    if logrotate -d /etc/logrotate.d/parking-system 2>&1 | grep -q "error"; then
        test_result "Configuración de logrotate" "fail"
    else
        test_result "Configuración de logrotate" "pass"
    fi
else
    test_result "Configuración de logrotate" "fail"
fi

# Test 14: Firewall Rules
log "Probando reglas de firewall..."
if ufw status | grep -q "3000.*ALLOW"; then
    test_result "Puerto 3000 abierto en firewall" "pass"
else
    test_result "Puerto 3000 abierto en firewall" "fail"
fi

# Test 15: SSL/TLS Configuration (if applicable)
log "Probando configuración SSL/TLS..."
if [ -f /etc/nginx/sites-enabled/parking-system-ssl ]; then
    if nginx -t 2>&1 | grep -q "successful"; then
        test_result "Configuración SSL válida" "pass"
    else
        test_result "Configuración SSL válida" "fail"
    fi
else
    info "SSL no configurado (opcional para desarrollo)"
    test_result "SSL no requerido en desarrollo" "pass"
fi

# Generate test report
log "=== GENERANDO REPORTE DE PRUEBAS ==="

cat > /tmp/parking-system-test-report.txt << EOF
REPORTE DE PRUEBAS DE INTEGRACIÓN
=================================
Fecha: $(date)
Sistema: Sistema de Gestión de Estacionamiento
Modo: Desarrollo/Pruebas

RESUMEN DE RESULTADOS
--------------------
Total de pruebas: $TOTAL_TESTS
Pruebas exitosas: $TESTS_PASSED
Pruebas fallidas: $TESTS_FAILED
Tasa de éxito: $(( TESTS_PASSED * 100 / TOTAL_TESTS ))%

DETALLES DE PRUEBAS
------------------
1. Base de datos: $([ $TESTS_FAILED -eq 0 ] && echo "✓" || echo "✗")
2. API REST: $([ $TESTS_FAILED -eq 0 ] && echo "✓" || echo "✗")
3. Hardware: $([ -e /dev/input/barcode-scanner-event ] && echo "✓" || echo "Simulado")
4. Frontend: $([ $TESTS_FAILED -eq 0 ] && echo "✓" || echo "✗")
5. Localización: $(locale | grep -q "es_MX" && echo "✓" || echo "✗")
6. Rendimiento: $([ $TESTS_FAILED -eq 0 ] && echo "✓" || echo "✗")

RECOMENDACIONES
--------------
$([ $TESTS_FAILED -gt 0 ] && echo "- Revisar logs en /var/log/parking-system/" || echo "- Sistema listo para uso")
$([ $TESTS_FAILED -gt 0 ] && echo "- Ejecutar ./scripts/validate-installation.sh" || echo "- Proceder con pruebas manuales")

EOF

log "Reporte guardado en: /tmp/parking-system-test-report.txt"

# Display summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  RESUMEN DE PRUEBAS                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Total de pruebas ejecutadas: $TOTAL_TESTS"
echo -e "Pruebas exitosas: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Pruebas fallidas: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    log "🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE"
    exit 0
else
    error "❌ ALGUNAS PRUEBAS FALLARON"
    info "Revise el reporte detallado en: /tmp/parking-system-test-report.txt"
    exit 1
fi