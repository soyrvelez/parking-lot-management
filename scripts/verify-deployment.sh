#!/bin/bash

# =====================================================
# Script de Verificación Post-Despliegue
# Sistema de Gestión de Estacionamiento
# =====================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Función para imprimir encabezados
print_header() {
    echo -e "\n${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
}

# Función para verificar estado
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $2${NC}"
        ((TESTS_FAILED++))
    fi
}

# Función para advertencias
warn_status() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

# =====================================================
# INICIO DE VERIFICACIÓN
# =====================================================

echo "🚀 VERIFICACIÓN POST-DESPLIEGUE DEL SISTEMA DE ESTACIONAMIENTO"
echo "Fecha: $(date)"
echo "Usuario: $(whoami)"
echo ""

# =====================================================
# 1. VERIFICACIÓN DEL SISTEMA OPERATIVO
# =====================================================

print_header "1. VERIFICACIÓN DEL SISTEMA OPERATIVO"

# Verificar versión de Ubuntu
if lsb_release -d | grep -q "Ubuntu 22.04"; then
    check_status 0 "Ubuntu 22.04 LTS instalado"
else
    check_status 1 "Ubuntu 22.04 LTS NO encontrado"
fi

# Verificar actualizaciones
UPDATES=$(apt list --upgradable 2>/dev/null | grep -c "upgradable" || true)
if [ $UPDATES -eq 0 ]; then
    check_status 0 "Sistema actualizado"
else
    warn_status "Hay $UPDATES paquetes pendientes de actualización"
fi

# =====================================================
# 2. VERIFICACIÓN DE SERVICIOS
# =====================================================

print_header "2. VERIFICACIÓN DE SERVICIOS"

# PostgreSQL
systemctl is-active --quiet postgresql
check_status $? "PostgreSQL activo"

# Nginx
systemctl is-active --quiet nginx
check_status $? "Nginx activo"

# UFW Firewall
systemctl is-active --quiet ufw
check_status $? "Firewall UFW activo"

# =====================================================
# 3. VERIFICACIÓN DE LA APLICACIÓN
# =====================================================

print_header "3. VERIFICACIÓN DE LA APLICACIÓN"

# PM2
if pm2 status &>/dev/null; then
    check_status 0 "PM2 instalado y funcionando"
    
    # Verificar proceso backend
    if pm2 list | grep -q "parking-backend.*online"; then
        check_status 0 "Backend en ejecución"
    else
        check_status 1 "Backend NO está en ejecución"
    fi
    
    # Verificar proceso frontend
    if pm2 list | grep -q "parking-frontend.*online"; then
        check_status 0 "Frontend en ejecución"
    else
        check_status 1 "Frontend NO está en ejecución"
    fi
else
    check_status 1 "PM2 no encontrado"
fi

# =====================================================
# 4. VERIFICACIÓN DE CONECTIVIDAD
# =====================================================

print_header "4. VERIFICACIÓN DE CONECTIVIDAD"

# Verificar backend API
if curl -s http://localhost:4000/api/parking/status &>/dev/null; then
    check_status 0 "API Backend respondiendo"
else
    check_status 1 "API Backend NO responde"
fi

# Verificar frontend
if curl -s http://localhost:3001 | grep -q "Parking"; then
    check_status 0 "Frontend accesible"
else
    check_status 1 "Frontend NO accesible"
fi

# Verificar conectividad a Internet
if ping -c 1 8.8.8.8 &>/dev/null; then
    check_status 0 "Conexión a Internet activa"
else
    warn_status "Sin conexión a Internet"
fi

# =====================================================
# 5. VERIFICACIÓN DE HARDWARE
# =====================================================

print_header "5. VERIFICACIÓN DE HARDWARE"

# Verificar impresora (asumiendo IP 192.168.1.100)
if ping -c 1 192.168.1.100 &>/dev/null; then
    check_status 0 "Impresora accesible en red"
else
    check_status 1 "Impresora NO accesible"
fi

# Verificar puerto de impresora
if timeout 2 bash -c 'echo > /dev/tcp/192.168.1.100/9100' 2>/dev/null; then
    check_status 0 "Puerto de impresora (9100) abierto"
else
    check_status 1 "Puerto de impresora (9100) cerrado"
fi

# =====================================================
# 6. VERIFICACIÓN DE BASE DE DATOS
# =====================================================

print_header "6. VERIFICACIÓN DE BASE DE DATOS"

# Verificar conexión a PostgreSQL
if sudo -u postgres psql -c "SELECT 1;" &>/dev/null; then
    check_status 0 "PostgreSQL accesible"
else
    check_status 1 "PostgreSQL NO accesible"
fi

# Verificar base de datos
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw parking_lot_prod; then
    check_status 0 "Base de datos 'parking_lot_prod' existe"
else
    check_status 1 "Base de datos 'parking_lot_prod' NO existe"
fi

# Verificar configuración de precios
if [ -f /home/parking/parking-system/.env ]; then
    DB_URL=$(grep DATABASE_URL /home/parking/parking-system/.env | cut -d '=' -f2)
    if [ ! -z "$DB_URL" ]; then
        # Intentar verificar datos iniciales
        RESULT=$(cd /home/parking/parking-system && npx prisma db seed 2>&1 || true)
        if echo "$RESULT" | grep -q "already exists"; then
            check_status 0 "Datos iniciales cargados"
        else
            warn_status "Estado de datos iniciales desconocido"
        fi
    fi
fi

# =====================================================
# 7. VERIFICACIÓN DE SEGURIDAD
# =====================================================

print_header "7. VERIFICACIÓN DE SEGURIDAD"

# Verificar UFW
if ufw status | grep -q "Status: active"; then
    check_status 0 "Firewall activo"
else
    check_status 1 "Firewall NO activo"
fi

# Verificar SSH
if systemctl is-active --quiet ssh; then
    warn_status "SSH está activo (considerar deshabilitar para producción)"
else
    check_status 0 "SSH deshabilitado"
fi

# Verificar modo kiosko
if [ -f /home/parking/.config/openbox/autostart ]; then
    check_status 0 "Configuración de modo kiosko presente"
else
    check_status 1 "Configuración de modo kiosko NO encontrada"
fi

# =====================================================
# 8. VERIFICACIÓN DE RESPALDOS
# =====================================================

print_header "8. VERIFICACIÓN DE RESPALDOS"

# Verificar script de respaldo
if [ -f /home/parking/backup/backup.sh ]; then
    check_status 0 "Script de respaldo presente"
else
    check_status 1 "Script de respaldo NO encontrado"
fi

# Verificar cron de respaldo
if crontab -l 2>/dev/null | grep -q backup; then
    check_status 0 "Tarea cron de respaldo configurada"
else
    warn_status "Tarea cron de respaldo NO configurada"
fi

# =====================================================
# 9. PRUEBAS FUNCIONALES BÁSICAS
# =====================================================

print_header "9. PRUEBAS FUNCIONALES"

# Verificar endpoint de precios
PRICING_RESPONSE=$(curl -s http://localhost:4000/api/parking/pricing 2>/dev/null || echo "{}")
if echo "$PRICING_RESPONSE" | grep -q "monthlyRate"; then
    check_status 0 "API de precios respondiendo correctamente"
    MONTHLY_RATE=$(echo "$PRICING_RESPONSE" | grep -o '"monthlyRate":"[0-9]*"' | grep -o '[0-9]*')
    if [ "$MONTHLY_RATE" == "800" ]; then
        check_status 0 "Tarifa mensual configurada correctamente (\$800 MXN)"
    else
        warn_status "Tarifa mensual: \$$MONTHLY_RATE MXN (esperado: \$800)"
    fi
else
    check_status 1 "API de precios NO responde correctamente"
fi

# =====================================================
# 10. ESPACIO EN DISCO
# =====================================================

print_header "10. VERIFICACIÓN DE RECURSOS"

# Espacio en disco
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    check_status 0 "Espacio en disco adecuado (${DISK_USAGE}% usado)"
else
    warn_status "Espacio en disco bajo (${DISK_USAGE}% usado)"
fi

# Memoria disponible
MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
if [ $MEM_AVAILABLE -gt 1000 ]; then
    check_status 0 "Memoria disponible adecuada (${MEM_AVAILABLE}MB)"
else
    warn_status "Memoria disponible baja (${MEM_AVAILABLE}MB)"
fi

# =====================================================
# RESUMEN FINAL
# =====================================================

print_header "RESUMEN DE VERIFICACIÓN"

echo ""
echo "Pruebas exitosas: ${GREEN}$TESTS_PASSED${NC}"
echo "Pruebas fallidas: ${RED}$TESTS_FAILED${NC}"
echo "Advertencias: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ¡SISTEMA LISTO PARA PRODUCCIÓN!${NC}"
    echo ""
    echo "Próximos pasos recomendados:"
    echo "1. Realizar prueba completa de entrada/salida de vehículo"
    echo "2. Registrar un cliente de pensión de prueba"
    echo "3. Verificar impresión de boletos y recibos"
    echo "4. Capacitar al operador con casos reales"
    exit 0
else
    echo -e "${RED}✗ SISTEMA REQUIERE ATENCIÓN${NC}"
    echo ""
    echo "Por favor revise los errores anteriores y:"
    echo "1. Consulte TROUBLESHOOTING_GUIDE.md para soluciones"
    echo "2. Verifique los logs con: pm2 logs"
    echo "3. Contacte soporte técnico si persisten los problemas"
    exit 1
fi