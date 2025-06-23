#!/bin/bash
set -euo pipefail

# Script: Thermal Printer Setup for Parking Management System
# Purpose: Configure Epson TM-T20III thermal printer via USB connection
# Usage: sudo ./setup-printer.sh

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

log "=== CONFIGURACIÓN IMPRESORA TÉRMICA USB EPSON TM-T20III ==="

# USB printer configuration
PRINTER_NAME="EpsonTM-T20III"
USB_DEVICE_PATHS=(
    "/dev/thermal-printer"  # Preferred udev symlink
    "/dev/usb/lp0"         # Standard USB line printer
    "/dev/lp0"             # Alternative line printer
    "/dev/ttyUSB0"         # USB to serial adapter
    "/dev/lp1"             # Alternative line printer
)

# Install CUPS and USB printer utilities
log "Instalando CUPS y utilidades de impresión USB..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt install -y \
    cups \
    cups-client \
    cups-bsd \
    cups-filters \
    system-config-printer \
    printer-driver-escpr \
    udev \
    usbutils \
    lsusb

# Install specific Epson thermal printer drivers if available
log "Instalando drivers de impresora térmica Epson..."
apt install -y printer-driver-escpr* || warn "Drivers específicos de Epson no disponibles"

# Start and enable CUPS service
log "Iniciando servicios de impresión..."
systemctl start cups
systemctl enable cups

# Configure udev rules for USB thermal printer
log "Configurando reglas udev para impresora térmica USB..."
cat > /etc/udev/rules.d/99-thermal-printer.rules << 'EOF'
# Epson TM-T20III thermal printer USB configuration
# Create consistent device symlink and set permissions

# Epson TM-T20III (common USB IDs)
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0202", MODE="0666", GROUP="lp", SYMLINK+="thermal-printer"
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{idProduct}=="0203", MODE="0666", GROUP="lp", SYMLINK+="thermal-printer"

# Generic thermal printer fallback
SUBSYSTEM=="usb", ATTRS{manufacturer}=="EPSON", ATTRS{product}=="TM-T20III", MODE="0666", GROUP="lp", SYMLINK+="thermal-printer"

# Line printer devices
KERNEL=="lp[0-9]*", MODE="0666", GROUP="lp"
SUBSYSTEM=="usb", SUBSYSTEMS=="usb", KERNEL=="lp[0-9]*", MODE="0666", GROUP="lp"

# USB to serial devices (for thermal printers)
KERNEL=="ttyUSB[0-9]*", ATTRS{idVendor}=="04b8", MODE="0666", GROUP="lp"
EOF

# Reload udev rules
log "Recargando reglas udev..."
udevadm control --reload-rules
udevadm trigger

# Function to detect USB thermal printer
detect_usb_printer() {
    log "Detectando impresora térmica USB..."
    
    # Check for Epson thermal printer via lsusb
    if lsusb | grep -i epson | grep -E "(04b8:020[23]|TM-T20)"; then
        info "✓ Impresora térmica Epson detectada via USB"
        return 0
    fi
    
    # Check for USB line printer devices
    for device in "${USB_DEVICE_PATHS[@]}"; do
        if [ -e "$device" ]; then
            info "✓ Dispositivo de impresora USB encontrado: $device"
            return 0
        fi
    done
    
    warn "⚠ No se detectó impresora térmica USB"
    return 1
}

# Function to set up USB permissions
setup_usb_permissions() {
    log "Configurando permisos USB para usuario operador..."
    
    # Add operador user to lp group for printer access
    if id "operador" &>/dev/null; then
        usermod -a -G lp operador
        info "✓ Usuario operador agregado al grupo lp"
    else
        warn "⚠ Usuario operador no encontrado - se agregará en setup-system.sh"
    fi
    
    # Set permissions for USB printer devices
    for device in "${USB_DEVICE_PATHS[@]}"; do
        if [ -e "$device" ]; then
            chmod 666 "$device"
            chgrp lp "$device"
            info "✓ Permisos configurados para $device"
        fi
    done
}

# Configure CUPS for USB thermal printer
log "Configurando CUPS para impresora térmica USB..."
cat > /etc/cups/cupsd.conf << 'EOF'
# CUPS Configuration for USB Thermal Printer - Parking System

LogLevel warn
MaxLogSize 0
PageLogFormat

# Administrator access
SystemGroup lpadmin
SystemGroupAuthKey system.print.admin

# Listen for connections
Listen localhost:631
Listen /run/cups/cups.sock

# Web interface and remote administration
WebInterface Yes
DefaultAuthType Basic

# Browsing
Browsing Off
BrowseLocalProtocols none
DefaultShared No

# Access control
<Location />
  Order allow,deny
  Allow localhost
  Allow 127.0.0.1
</Location>

<Location /admin>
  Order allow,deny
  Allow localhost
  Allow 127.0.0.1
  Require user @SYSTEM
</Location>

<Location /admin/conf>
  AuthType Default
  Require user @SYSTEM
  Order allow,deny
  Allow localhost
  Allow 127.0.0.1
</Location>

# Policy for USB thermal printer operations
<Policy default>
  JobPrivateAccess default
  JobPrivateValues default
  SubscriptionPrivateAccess default
  SubscriptionPrivateValues default
  
  <Limit Create-Job Print-Job Print-URI Validate-Job>
    Order deny,allow
    Allow all
  </Limit>
  
  <Limit Send-Document Send-URI Hold-Job Release-Job Restart-Job Purge-Jobs Set-Job-Attributes>
    Require user @OWNER @SYSTEM
    Order deny,allow
    Allow all
  </Limit>
  
  <Limit CUPS-Add-Modify-Printer CUPS-Delete-Printer CUPS-Set-Default CUPS-Get-Devices>
    AuthType Default
    Require user @SYSTEM
    Order deny,allow
    Allow all
  </Limit>
  
  <Limit All>
    Order deny,allow
    Allow all
  </Limit>
</Policy>
EOF

# Restart CUPS with new configuration
log "Reiniciando CUPS con nueva configuración..."
systemctl restart cups
sleep 3

# Detect and configure USB printer
if detect_usb_printer; then
    setup_usb_permissions
    
    # Find available USB device
    USB_DEVICE=""
    for device in "${USB_DEVICE_PATHS[@]}"; do
        if [ -e "$device" ]; then
            USB_DEVICE="$device"
            break
        fi
    done
    
    if [ -n "$USB_DEVICE" ]; then
        log "Configurando impresora térmica en $USB_DEVICE..."
        
        # Remove existing printer if it exists
        lpadmin -x "$PRINTER_NAME" 2>/dev/null || true
        
        # Add USB thermal printer to CUPS
        log "Agregando impresora térmica a CUPS..."
        lpadmin -p "$PRINTER_NAME" \
                -E \
                -v "serial:$USB_DEVICE?baud=9600" \
                -m "raw" \
                -o printer-error-policy=retry-job \
                -o printer-op-policy=default \
                -L "Parking System Thermal Printer" \
                -D "Epson TM-T20III USB Thermal Printer"
        
        # Set as default printer
        lpadmin -d "$PRINTER_NAME"
        
        # Enable printer
        cupsenable "$PRINTER_NAME"
        cupsaccept "$PRINTER_NAME"
        
        info "✓ Impresora térmica configurada exitosamente"
    else
        error "✗ No se encontró dispositivo USB válido para impresora"
        exit 1
    fi
else
    warn "⚠ No se detectó impresora térmica USB - configuración manual requerida"
fi

# Create USB printer test script
log "Creando script de prueba de impresora USB..."
cat > /opt/test-thermal-printer.sh << 'EOF'
#!/bin/bash

# USB Thermal Printer Test Script
echo "=== PRUEBA DE IMPRESORA TÉRMICA USB ==="

# Check USB device availability
echo "Verificando dispositivos USB..."
USB_DEVICES=("/dev/thermal-printer" "/dev/usb/lp0" "/dev/lp0" "/dev/ttyUSB0")
FOUND_DEVICE=""

for device in "${USB_DEVICES[@]}"; do
    if [ -e "$device" ]; then
        echo "✓ Dispositivo encontrado: $device"
        FOUND_DEVICE="$device"
        break
    fi
done

if [ -z "$FOUND_DEVICE" ]; then
    echo "✗ No se encontró dispositivo de impresora USB"
    exit 1
fi

# Check device permissions
if [ -r "$FOUND_DEVICE" ] && [ -w "$FOUND_DEVICE" ]; then
    echo "✓ Permisos de dispositivo correctos"
else
    echo "✗ Sin permisos para acceder al dispositivo"
    exit 1
fi

# Check CUPS printer
if lpstat -p EpsonTM-T20III >/dev/null 2>&1; then
    echo "✓ Impresora configurada en CUPS"
else
    echo "✗ Impresora no configurada en CUPS"
fi

# Test print via CUPS
echo "Enviando trabajo de prueba..."
if echo "IMPRESIÓN DE PRUEBA
================
Fecha: $(date)
Impresora: USB
Estado: Funcionando
================
" | lp -d EpsonTM-T20III 2>/dev/null; then
    echo "✓ Trabajo de impresión enviado exitosamente"
else
    echo "✗ Error enviando trabajo de impresión"
    exit 1
fi

echo "=== PRUEBA COMPLETADA ==="
EOF

chmod +x /opt/test-thermal-printer.sh

# Create USB printer status monitoring script
cat > /opt/check-usb-printer.sh << 'EOF'
#!/bin/bash

# USB Printer Status Monitoring Script
echo "=== ESTADO IMPRESORA TÉRMICA USB ==="

# Check USB device presence
USB_DEVICES=("/dev/thermal-printer" "/dev/usb/lp0" "/dev/lp0" "/dev/ttyUSB0")
echo "Dispositivos USB:"
for device in "${USB_DEVICES[@]}"; do
    if [ -e "$device" ]; then
        echo "  ✓ $device (disponible)"
        ls -la "$device"
    else
        echo "  ✗ $device (no encontrado)"
    fi
done

echo ""
echo "Impresoras Epson USB detectadas:"
lsusb | grep -i epson || echo "  Ninguna encontrada"

echo ""
echo "Estado CUPS:"
lpstat -p 2>/dev/null || echo "  CUPS no disponible"

echo ""
echo "Trabajos de impresión pendientes:"
lpq 2>/dev/null || echo "  Ninguno"
EOF

chmod +x /opt/check-usb-printer.sh

# Update system status
log "Actualizando estado del sistema..."
cat >> /opt/parking-setup-status.txt << EOF
Impresora térmica USB configurada: $(date)
Dispositivo: Epson TM-T20III USB
CUPS: Configurado para USB
Reglas udev: Instaladas
Permisos: Configurados para grupo lp
Script de prueba: /opt/test-thermal-printer.sh
Script de estado: /opt/check-usb-printer.sh
EOF

log "=== CONFIGURACIÓN IMPRESORA TÉRMICA USB COMPLETADA ==="
log "Dispositivos USB configurados:"
for device in "${USB_DEVICE_PATHS[@]}"; do
    if [ -e "$device" ]; then
        info "  ✓ $device"
    fi
done

log ""
log "PRÓXIMOS PASOS:"
log "1. Conectar impresora Epson TM-T20III via USB"
log "2. Ejecutar: /opt/test-thermal-printer.sh"
log "3. Verificar estado: /opt/check-usb-printer.sh"
log "4. La aplicación usará automáticamente la impresora USB"
log ""
log "CONFIGURACIÓN:"
log "- Interface: USB (automático)"
log "- Dispositivo: $USB_DEVICE"
log "- Nombre CUPS: $PRINTER_NAME"
log "- Usuario: operador (grupo lp)"

exit 0