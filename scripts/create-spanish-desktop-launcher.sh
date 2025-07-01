#!/bin/bash

# Script para crear lanzador en escritorio español de Ubuntu
# Compatible con Ubuntu 24.04 en español

set -e

# Colores para salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Creador de Lanzador para Sistema de Estacionamiento ===${NC}"
echo ""

# Detectar directorio de escritorio en español
DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Escritorio")

# Verificar que el directorio existe
if [ ! -d "$DESKTOP_DIR" ]; then
    echo -e "${YELLOW}Creando directorio Escritorio...${NC}"
    mkdir -p "$DESKTOP_DIR"
fi

echo -e "${GREEN}Directorio detectado: $DESKTOP_DIR${NC}"

# IP del ThinkPad
THINKPAD_IP="192.168.100.156"
FRONTEND_PORT="3001"

# Crear archivo .desktop para modo desarrollo
cat > "$DESKTOP_DIR/parking-desarrollo.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Parking - Desarrollo
Name[es]=Estacionamiento - Desarrollo
Comment=Sistema de Gestión de Estacionamiento (Modo Desarrollo)
Comment[es]=Sistema de Gestión de Estacionamiento (Modo Desarrollo)
Exec=firefox http://${THINKPAD_IP}:${FRONTEND_PORT}
Icon=firefox
Terminal=false
Categories=Application;Development;
StartupNotify=true
EOF

# Crear archivo .desktop para modo kiosko
cat > "$DESKTOP_DIR/parking-kiosko.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Parking - Kiosko
Name[es]=Estacionamiento - Kiosko
Comment=Sistema de Estacionamiento en Modo Kiosko
Comment[es]=Sistema de Estacionamiento en Modo Kiosko
Exec=firefox --kiosk --new-instance --no-remote http://${THINKPAD_IP}:${FRONTEND_PORT}
Icon=firefox
Terminal=false
Categories=Application;
StartupNotify=true
EOF

# Dar permisos de ejecución
chmod +x "$DESKTOP_DIR/parking-desarrollo.desktop"
chmod +x "$DESKTOP_DIR/parking-kiosko.desktop"

# En Ubuntu 24.04, marcar como confiable puede requerir esto:
if command -v gio &> /dev/null; then
    echo -e "${YELLOW}Marcando archivos como confiables...${NC}"
    gio set "$DESKTOP_DIR/parking-desarrollo.desktop" metadata::trusted true 2>/dev/null || true
    gio set "$DESKTOP_DIR/parking-kiosko.desktop" metadata::trusted true 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✅ Lanzadores creados exitosamente en:${NC}"
echo "   - $DESKTOP_DIR/parking-desarrollo.desktop"
echo "   - $DESKTOP_DIR/parking-kiosko.desktop"
echo ""
echo -e "${YELLOW}Para usar los lanzadores:${NC}"
echo "1. Hacer doble clic en el icono en el Escritorio"
echo "2. Si pregunta, seleccionar 'Confiar y Lanzar'"
echo ""
echo -e "${YELLOW}URLs configuradas:${NC}"
echo "   - Desarrollo: http://${THINKPAD_IP}:${FRONTEND_PORT}"
echo "   - Kiosko: Pantalla completa sin controles"
echo ""

# Opcional: Crear copia en aplicaciones del sistema
echo -e "${YELLOW}¿Desea instalar en el menú de aplicaciones? (s/n)${NC}"
read -r respuesta

if [[ "$respuesta" =~ ^[Ss]$ ]]; then
    # Directorio de aplicaciones locales
    APPS_DIR="$HOME/.local/share/applications"
    mkdir -p "$APPS_DIR"
    
    cp "$DESKTOP_DIR/parking-desarrollo.desktop" "$APPS_DIR/"
    cp "$DESKTOP_DIR/parking-kiosko.desktop" "$APPS_DIR/"
    
    echo -e "${GREEN}✅ Instalado en menú de aplicaciones${NC}"
    echo "   Buscar 'Estacionamiento' en el menú de aplicaciones"
fi

echo ""
echo -e "${GREEN}¡Configuración completa!${NC}"