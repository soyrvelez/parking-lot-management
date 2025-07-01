#!/bin/bash

# Script de inicio para modo desarrollo en Ubuntu
# Compatible con Ubuntu 24.04 español
# IP ThinkPad: 192.168.100.156

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuración
THINKPAD_IP="192.168.100.156"
FRONTEND_PORT="3001"
BACKEND_PORT="4000"
PROJECT_DIR="/home/administrador/deployments/parking-lot-management"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} Sistema de Estacionamiento - Dev Mode${NC}"
echo -e "${BLUE} IP: ${THINKPAD_IP}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar directorio del proyecto
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Directorio del proyecto no encontrado${NC}"
    echo "Esperado en: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Archivo .env no encontrado${NC}"
    if [ -f ".env.ubuntu" ]; then
        echo -e "${GREEN}Copiando .env.ubuntu a .env...${NC}"
        cp .env.ubuntu .env
    else
        echo -e "${RED}Error: No se encuentra archivo de configuración${NC}"
        exit 1
    fi
fi

# Verificar node_modules
echo -e "${YELLOW}Verificando dependencias...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Instalando dependencias del backend...${NC}"
    npm install
fi

if [ ! -d "src/frontend/node_modules" ]; then
    echo -e "${YELLOW}Instalando dependencias del frontend...${NC}"
    cd src/frontend
    npm install
    cd ../..
fi

# Verificar PostgreSQL
echo -e "${YELLOW}Verificando PostgreSQL...${NC}"
if ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}PostgreSQL no está activo. Iniciando...${NC}"
    sudo systemctl start postgresql
fi

# Verificar base de datos
echo -e "${YELLOW}Verificando base de datos...${NC}"
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw parking_lot_dev; then
    echo -e "${YELLOW}Creando base de datos...${NC}"
    sudo -u postgres psql <<EOF
CREATE DATABASE parking_lot_dev;
CREATE USER parking_user WITH PASSWORD 'parking123';
GRANT ALL PRIVILEGES ON DATABASE parking_lot_dev TO parking_user;
EOF
fi

# Generar Prisma client
echo -e "${YELLOW}Generando Prisma client...${NC}"
npx prisma generate

# Aplicar migraciones
echo -e "${YELLOW}Aplicando migraciones...${NC}"
npx prisma db push

# Verificar puertos disponibles
echo -e "${YELLOW}Verificando puertos...${NC}"
if lsof -i :$FRONTEND_PORT > /dev/null 2>&1; then
    echo -e "${RED}Puerto $FRONTEND_PORT en uso${NC}"
    echo "¿Desea detener el proceso? (s/n)"
    read -r respuesta
    if [[ "$respuesta" =~ ^[Ss]$ ]]; then
        PID=$(lsof -t -i:$FRONTEND_PORT)
        kill -9 $PID
        echo -e "${GREEN}Proceso detenido${NC}"
    fi
fi

if lsof -i :$BACKEND_PORT > /dev/null 2>&1; then
    echo -e "${RED}Puerto $BACKEND_PORT en uso${NC}"
    echo "¿Desea detener el proceso? (s/n)"
    read -r respuesta
    if [[ "$respuesta" =~ ^[Ss]$ ]]; then
        PID=$(lsof -t -i:$BACKEND_PORT)
        kill -9 $PID
        echo -e "${GREEN}Proceso detenido${NC}"
    fi
fi

# Iniciar servidores
echo ""
echo -e "${GREEN}Iniciando servidores de desarrollo...${NC}"
echo -e "${BLUE}Backend: http://${THINKPAD_IP}:${BACKEND_PORT}${NC}"
echo -e "${BLUE}Frontend: http://${THINKPAD_IP}:${FRONTEND_PORT}${NC}"
echo ""
echo -e "${YELLOW}Presiona Ctrl+C para detener${NC}"
echo ""

# Opción de usar screen
echo -e "${YELLOW}¿Iniciar en sesión screen? (recomendado) (s/n)${NC}"
read -r use_screen

if [[ "$use_screen" =~ ^[Ss]$ ]]; then
    # Verificar si screen está instalado
    if ! command -v screen &> /dev/null; then
        echo -e "${YELLOW}Instalando screen...${NC}"
        sudo apt-get install -y screen
    fi
    
    # Verificar si ya existe sesión
    if screen -list | grep -q "parking-dev"; then
        echo -e "${YELLOW}Sesión screen existente encontrada${NC}"
        echo "¿Reconectar a sesión existente? (s/n)"
        read -r reconnect
        if [[ "$reconnect" =~ ^[Ss]$ ]]; then
            screen -r parking-dev
            exit 0
        else
            screen -S parking-dev -X quit
        fi
    fi
    
    echo -e "${GREEN}Iniciando en screen...${NC}"
    echo "Para desconectar: Ctrl+A, luego D"
    echo "Para reconectar: screen -r parking-dev"
    sleep 2
    
    screen -S parking-dev npm run dev
else
    # Iniciar directamente
    npm run dev
fi