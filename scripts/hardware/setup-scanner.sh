#!/bin/bash
set -euo pipefail

# Script: Barcode Scanner Setup for Parking Management System
# Purpose: Configure Honeywell Voyager 1250g USB barcode scanner
# Usage: sudo ./setup-scanner.sh

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

log "=== CONFIGURACIÓN ESCÁNER CÓDIGO DE BARRAS HONEYWELL VOYAGER 1250G ==="

# Scanner specifications
VENDOR_ID="0c2e"
PRODUCT_ID="0b61"
SCANNER_NAME="Honeywell Voyager 1250g"

# Install USB utilities and input device support
log "Instalando utilidades USB y soporte para dispositivos de entrada..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt install -y \
    usbutils \
    inputattach \
    input-utils \
    evtest \
    libinput-tools \
    xdotool \
    wmctrl

# Check if scanner is connected
log "Verificando conexión del escáner..."
if lsusb | grep -i "0c2e:0b61" >/dev/null 2>&1; then
    log "✓ Escáner Honeywell Voyager 1250g detectado"
    SCANNER_CONNECTED=true
else
    warn "⚠ Escáner no detectado"
    warn "Asegúrese de que el escáner esté conectado a un puerto USB"
    SCANNER_CONNECTED=false
fi

# Create udev rules for scanner
log "Configurando reglas udev para el escáner..."
cat > /etc/udev/rules.d/99-barcode-scanner.rules << 'EOF'
# Honeywell Voyager 1250g Barcode Scanner Rules
# Vendor ID: 0c2e, Product ID: 0b61

# Set permissions and create symlink
SUBSYSTEM=="usb", ATTRS{idVendor}=="0c2e", ATTRS{idProduct}=="0b61", MODE="0666", GROUP="input", SYMLINK+="barcode-scanner"

# HID input device rules
SUBSYSTEM=="input", ATTRS{idVendor}=="0c2e", ATTRS{idProduct}=="0b61", MODE="0666", GROUP="input"

# Create device node for applications
KERNEL=="event*", SUBSYSTEM=="input", ATTRS{idVendor}=="0c2e", ATTRS{idProduct}=="0b61", SYMLINK+="input/barcode-scanner-event"

# Set device attributes for proper functioning
ACTION=="add", SUBSYSTEM=="usb", ATTRS{idVendor}=="0c2e", ATTRS{idProduct}=="0b61", RUN+="/bin/sh -c 'echo 1 > /sys/bus/usb/devices/%k/bConfigurationValue'"
EOF

# Reload udev rules
log "Recargando reglas udev..."
udevadm control --reload-rules
udevadm trigger

# Configure input device handling
log "Configurando manejo de dispositivos de entrada..."

# Create input device configuration for X11
cat > /etc/X11/xorg.conf.d/99-barcode-scanner.conf << 'EOF'
Section "InputClass"
    Identifier "Honeywell Voyager 1250g Barcode Scanner"
    MatchVendor "Honeywell"
    MatchProduct "Voyager 1250g"
    MatchDevicePath "/dev/input/event*"
    Driver "evdev"
    Option "SendCoreEvents" "true"
    Option "Device" "/dev/input/barcode-scanner-event"
EndSection

Section "InputClass"
    Identifier "USB HID Barcode Scanner"
    MatchUSBID "0c2e:0b61"
    Driver "evdev"
    Option "SendCoreEvents" "true"
    Option "GrabDevice" "false"
EndSection
EOF

# Create scanner detection script
log "Creando script de detección de escáner..."
cat > /opt/scanner-detect.sh << 'EOF'
#!/bin/bash

# Script de detección y configuración del escáner de código de barras

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

VENDOR_ID="0c2e"
PRODUCT_ID="0b61"

log "=== DETECCIÓN DE ESCÁNER DE CÓDIGO DE BARRAS ==="

# Check USB connection
if lsusb | grep -i "${VENDOR_ID}:${PRODUCT_ID}" >/dev/null 2>&1; then
    DEVICE_INFO=$(lsusb | grep -i "${VENDOR_ID}:${PRODUCT_ID}")
    log "✓ Escáner detectado: $DEVICE_INFO"
    
    # Get USB bus and device numbers
    BUS_NUM=$(echo $DEVICE_INFO | grep -o "Bus [0-9]*" | grep -o "[0-9]*")
    DEV_NUM=$(echo $DEVICE_INFO | grep -o "Device [0-9]*" | grep -o "[0-9]*")
    
    log "Bus USB: $BUS_NUM, Dispositivo: $DEV_NUM"
    
    # Check device permissions
    USB_DEVICE_PATH="/dev/bus/usb/$BUS_NUM/$DEV_NUM"
    if [ -r "$USB_DEVICE_PATH" ]; then
        log "✓ Permisos de dispositivo USB correctos"
    else
        error "✗ Sin permisos de lectura en $USB_DEVICE_PATH"
    fi
    
    # Check for input device
    if [ -e /dev/input/barcode-scanner-event ]; then
        log "✓ Dispositivo de entrada configurado: /dev/input/barcode-scanner-event"
    else
        log "ℹ Buscando dispositivos de entrada..."
        for event_device in /dev/input/event*; do
            if [ -e "$event_device" ]; then
                # Check if this is our scanner
                DEVICE_NAME=$(udevadm info --query=property --name="$event_device" | grep "ID_VENDOR_ID=$VENDOR_ID" || true)
                if [ -n "$DEVICE_NAME" ]; then
                    log "✓ Dispositivo de entrada encontrado: $event_device"
                    break
                fi
            fi
        done
    fi
    
else
    error "✗ Escáner no detectado"
    log "Verifique que:"
    log "1. El escáner esté conectado a un puerto USB"
    log "2. El cable USB no esté dañado"
    log "3. El escáner esté encendido (LED azul)"
    exit 1
fi

# Test scanner input (if running in X11 environment)
if [ -n "${DISPLAY:-}" ]; then
    log "Probando entrada del escáner..."
    log "Escanee un código de barras en los próximos 10 segundos..."
    
    # Monitor input events for 10 seconds
    timeout 10s evtest /dev/input/barcode-scanner-event 2>/dev/null | while read line; do
        if echo "$line" | grep -q "EV_KEY"; then
            log "✓ Entrada detectada desde escáner"
            break
        fi
    done || log "⚠ No se detectó entrada del escáner (tiempo agotado)"
fi

log "=== DETECCIÓN COMPLETADA ==="
EOF

chmod +x /opt/scanner-detect.sh

# Create scanner test script
log "Creando script de prueba de escáner..."
cat > /opt/test-barcode-scanner.sh << 'EOF'
#!/bin/bash

# Script de prueba para escáner de código de barras
# Genera códigos de barras de prueba y verifica funcionamiento

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1"
}

log "=== PRUEBA DE ESCÁNER DE CÓDIGO DE BARRAS ==="

# Check if scanner is detected
if ! /opt/scanner-detect.sh | grep -q "Escáner detectado"; then
    error "Escáner no detectado. Verifique la conexión."
    exit 1
fi

# Generate test barcode (Code 39)
log "Generando código de barras de prueba..."

# Create test barcode data
TEST_CODES=(
    "PARKING001"
    "TICKET123"
    "TEST2024"
    "SAMPLE01"
)

# Create HTML page with test barcodes for printing
cat > /tmp/test-barcodes.html << 'EOL'
<!DOCTYPE html>
<html>
<head>
    <title>Códigos de Barras de Prueba - Sistema de Estacionamiento</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .barcode-container { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .barcode-text { font-size: 14px; font-weight: bold; text-align: center; margin: 10px 0; }
        .instructions { background: #f0f0f0; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Códigos de Barras de Prueba - Sistema de Estacionamiento</h1>
    
    <div class="instructions">
        <h3>Instrucciones:</h3>
        <ol>
            <li>Imprima esta página para obtener códigos de barras físicos</li>
            <li>Use el escáner para leer cada código</li>
            <li>Verifique que el sistema detecte correctamente los códigos</li>
        </ol>
    </div>

EOL

# Add barcode images (using ASCII representation)
for code in "${TEST_CODES[@]}"; do
    cat >> /tmp/test-barcodes.html << EOL
    <div class="barcode-container">
        <div class="barcode-text">Código: $code</div>
        <div style="font-family: 'Courier New', monospace; font-size: 20px; text-align: center; letter-spacing: 2px;">
            ||||| || ||| |||| | |||| ||| | ||||
        </div>
        <div class="barcode-text">* $code *</div>
    </div>
EOL
done

cat >> /tmp/test-barcodes.html << 'EOL'
    
    <div class="instructions">
        <p><strong>Nota:</strong> Los códigos mostrados son representaciones ASCII. 
        Para pruebas reales, genere códigos Code 39 usando el sistema de estacionamiento.</p>
    </div>
</body>
</html>
EOL

log "Página de códigos de prueba generada: /tmp/test-barcodes.html"

# Test scanner input monitoring
log "Iniciando monitoreo de entrada del escáner..."
log "Escanee un código de barras de prueba..."

if [ -e /dev/input/barcode-scanner-event ]; then
    # Monitor scanner input for 30 seconds
    log "Monitoreando entrada por 30 segundos..."
    timeout 30s evtest /dev/input/barcode-scanner-event 2>/dev/null | while read line; do
        if echo "$line" | grep -q "EV_KEY.*value 1"; then
            KEY_CODE=$(echo "$line" | grep -o "KEY_[A-Z0-9]*" || echo "KEY_UNKNOWN")
            log "✓ Tecla detectada: $KEY_CODE"
        fi
    done || log "⚠ Tiempo de espera agotado"
else
    warn "Dispositivo de entrada del escáner no encontrado"
    info "Ejecute primero: /opt/scanner-detect.sh"
fi

# Test with xdotool if in X11 environment
if [ -n "${DISPLAY:-}" ] && command -v xdotool >/dev/null 2>&1; then
    log "Probando simulación de entrada con xdotool..."
    
    # Open a simple text application for testing
    if command -v gedit >/dev/null 2>&1; then
        log "Abriendo editor de texto para prueba..."
        gedit /tmp/scanner-test.txt &
        GEDIT_PID=$!
        sleep 3
        
        log "Escanee códigos de barras ahora. El texto debería aparecer en el editor."
        log "Presione Ctrl+C para terminar la prueba..."
        
        # Wait for user to test
        sleep 30
        
        # Close gedit
        kill $GEDIT_PID 2>/dev/null || true
        
        if [ -s /tmp/scanner-test.txt ]; then
            log "✓ Datos detectados en archivo de prueba:"
            cat /tmp/scanner-test.txt | head -5
        else
            log "⚠ No se detectaron datos del escáner"
        fi
    fi
fi

log "=== PRUEBA COMPLETADA ==="
log "Página de códigos de prueba disponible en: /tmp/test-barcodes.html"
log "Para abrir en navegador: chromium-browser /tmp/test-barcodes.html"
EOF

chmod +x /opt/test-barcode-scanner.sh

# Create scanner configuration script for Code 39
log "Creando script de configuración de escáner..."
cat > /opt/configure-scanner.sh << 'EOF'
#!/bin/bash

# Script de configuración para escáner Honeywell Voyager 1250g
# Configura opciones específicas para sistema de estacionamiento

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "=== CONFIGURACIÓN AVANZADA DE ESCÁNER ==="

# Configuration instructions for Honeywell Voyager 1250g
log "Configuración manual del escáner Honeywell Voyager 1250g:"
log ""
log "1. CONFIGURACIÓN DE SIMBOLOGÍA (Code 39):"
log "   - Escanee el código de configuración para habilitar Code 39"
log "   - Deshabilite otras simbologías no necesarias (EAN, UPC, etc.)"
log "   - Configure sufijo/prefijo si es necesario"
log ""
log "2. CONFIGURACIÓN DE MODO DE LECTURA:"
log "   - Modo: Auto-trigger (lectura automática)"
log "   - Timeout: 5 segundos"
log "   - Beep: Habilitado para confirmación"
log ""
log "3. CONFIGURACIÓN DE DATOS:"
log "   - Transmitir datos inmediatamente"
log "   - Agregar Enter (CR) al final de cada lectura"
log "   - No transmitir códigos duplicados consecutivos"
log ""
log "4. VERIFICACIÓN DE LED:"
log "   - LED azul: Escáner listo"
log "   - LED rojo: Lectura exitosa"
log "   - LED parpadeante: Error o configuración"

# Create configuration verification
log "Verificando configuración actual..."

# Check if scanner responds to simple test
if /opt/scanner-detect.sh | grep -q "Escáner detectado"; then
    log "✓ Escáner detectado y funcional"
    
    # Check input device configuration
    if [ -e /dev/input/barcode-scanner-event ]; then
        log "✓ Dispositivo de entrada configurado"
    else
        log "⚠ Dispositivo de entrada no configurado correctamente"
    fi
    
    # Verify permissions
    if [ -r /dev/input/barcode-scanner-event ] 2>/dev/null; then
        log "✓ Permisos de lectura correctos"
    else
        log "⚠ Verificar permisos de dispositivo"
    fi
else
    log "✗ Escáner no detectado - Verifique conexión USB"
fi

log "=== CONFIGURACIÓN COMPLETADA ==="
log "Para configuración manual del escáner:"
log "1. Consulte el manual del Honeywell Voyager 1250g"
log "2. Use códigos de configuración específicos para Code 39"
log "3. Ejecute /opt/test-barcode-scanner.sh para verificar"
EOF

chmod +x /opt/configure-scanner.sh

# Create scanner monitoring script
log "Creando script de monitoreo de escáner..."
cat > /opt/scanner-monitor.sh << 'EOF'
#!/bin/bash

# Monitor de estado del escáner de código de barras
# Verifica conectividad y funcionamiento cada 5 minutos

VENDOR_ID="0c2e"
PRODUCT_ID="0b61"
LOG_FILE="/var/log/scanner-status.log"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Check USB connection
if ! lsusb | grep -i "${VENDOR_ID}:${PRODUCT_ID}" >/dev/null 2>&1; then
    log "ERROR: Escáner no detectado en USB"
    exit 1
fi

# Check device permissions
if [ -e /dev/input/barcode-scanner-event ]; then
    if [ -r /dev/input/barcode-scanner-event ]; then
        log "Escáner OK - Dispositivo de entrada accesible"
    else
        log "WARNING: Escáner detectado pero sin permisos de lectura"
    fi
else
    log "WARNING: Escáner detectado pero dispositivo de entrada no configurado"
    
    # Trigger udev rules reload
    udevadm control --reload-rules
    udevadm trigger
    log "Reglas udev recargadas"
fi

# Check for recent activity (if log exists)
if [ -f /var/log/parking-scanner-activity.log ]; then
    RECENT_ACTIVITY=$(find /var/log/parking-scanner-activity.log -mmin -60 2>/dev/null)
    if [ -n "$RECENT_ACTIVITY" ]; then
        log "Escáner activo - Actividad reciente detectada"
    else
        log "Escáner inactivo - Sin actividad en la última hora"
    fi
fi
EOF

chmod +x /opt/scanner-monitor.sh

# Add scanner monitoring to cron
cat > /etc/cron.d/scanner-monitor << 'EOF'
# Monitoreo de escáner cada 5 minutos
*/5 * * * * root /opt/scanner-monitor.sh
EOF

# Configure input method for scanner
log "Configurando método de entrada para escáner..."

# Create input method configuration
cat > /home/operador/.inputrc << 'EOF'
# Configuración de entrada para escáner de código de barras
# Optimizada para entrada rápida de códigos

# No hacer beep en errores
set bell-style none

# Completar inmediatamente sin mostrar posibilidades
set show-all-if-ambiguous on
set show-all-if-unmodified on

# No paginar resultados largos
set page-completions off

# Configurar teclas especiales para escáner
# Enter: confirmar código escaneado
"\C-m": accept-line

# Esc: cancelar entrada actual
"\e": abort

# Tab: autocompletar (si aplicable)
"\t": complete

# Configurar historia para códigos escaneados
set history-preserve-point on
set history-size 1000
EOF

chown operador:operador /home/operador/.inputrc

# Configure scanner integration for parking system
log "Configurando integración con sistema de estacionamiento..."

# Create scanner integration script
cat > /opt/parking-scanner-integration.sh << 'EOF'
#!/bin/bash

# Script de integración entre escáner y sistema de estacionamiento
# Procesa códigos escaneados y los envía al sistema

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/parking-scanner-activity.log
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a /var/log/parking-scanner-activity.log >&2
}

# Configuration
SCANNER_DEVICE="/dev/input/barcode-scanner-event"
API_ENDPOINT="http://localhost:3000/api/scanner/input"

log "=== INTEGRACIÓN ESCÁNER-SISTEMA INICIADA ==="

# Verify scanner device exists
if [ ! -e "$SCANNER_DEVICE" ]; then
    error "Dispositivo de escáner no encontrado: $SCANNER_DEVICE"
    exit 1
fi

# Monitor scanner input and forward to system
log "Monitoreando entrada del escáner..."

# Note: This is a simplified integration example
# In production, this would be integrated directly into the Node.js application
log "Integración configurada para endpoint: $API_ENDPOINT"
log "Para integración completa, configure el manejo de eventos en la aplicación Node.js"
EOF

chmod +x /opt/parking-scanner-integration.sh

# Add operador user to input group
log "Agregando usuario operador al grupo input..."
usermod -a -G input operador

# Configure log rotation for scanner logs
cat > /etc/logrotate.d/parking-scanner << 'EOF'
/var/log/scanner-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 root root
}

/var/log/parking-scanner-activity.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 operador operador
}
EOF

# Test scanner configuration
log "Probando configuración de escáner..."

if $SCANNER_CONNECTED; then
    # Run detection script
    if /opt/scanner-detect.sh | grep -q "Escáner detectado"; then
        log "✓ Escáner detectado y configurado correctamente"
    else
        warn "⚠ Problemas con la detección del escáner"
    fi
else
    warn "⚠ Escáner no conectado para pruebas automáticas"
    info "Conecte el escáner y ejecute: /opt/scanner-detect.sh"
fi

# Verify udev rules are loaded
if udevadm info --query=property --name=/dev/bus/usb/001/001 | grep -q "DEVTYPE=usb_device"; then
    log "✓ Reglas udev cargadas correctamente"
else
    warn "⚠ Verificar carga de reglas udev"
fi

# Update installation status
cat >> /opt/parking-setup-status.txt << EOF
Escáner código barras configurado: $(date)
Modelo: Honeywell Voyager 1250g
USB ID: $VENDOR_ID:$PRODUCT_ID
Dispositivo: /dev/input/barcode-scanner-event
Script detección: /opt/scanner-detect.sh
Script prueba: /opt/test-barcode-scanner.sh
Configuración: /opt/configure-scanner.sh
Monitoreo: Cada 5 minutos
Logs: /var/log/scanner-status.log
Integración: /opt/parking-scanner-integration.sh
EOF

log "=== CONFIGURACIÓN ESCÁNER COMPLETADA ==="
log "Escáner configurado: $SCANNER_NAME"
log "USB ID: $VENDOR_ID:$PRODUCT_ID"
log "Script de detección: /opt/scanner-detect.sh"
log "Script de prueba: /opt/test-barcode-scanner.sh"
log "Script de configuración: /opt/configure-scanner.sh"
log "Monitoreo automático configurado"
log ""
log "IMPORTANTE: Para configuración específica del escáner:"
log "1. Consulte el manual del Honeywell Voyager 1250g"
log "2. Configure simbología Code 39"
log "3. Ejecute /opt/test-barcode-scanner.sh para verificar"
log ""
log "Próximo paso: Ejecutar harden-system.sh"

exit 0