# 🚀 Guía Rápida: Modo Desarrollo en Ubuntu 24.04 (Español)

## Información del Sistema
- **IP ThinkPad**: 192.168.100.156
- **Puerto Frontend**: 3001 (NO 3000)
- **Puerto Backend**: 4000
- **Directorios en Español**: ~/Escritorio, ~/Documentos, etc.

## 🔧 Instalación Rápida (30 minutos)

### Paso 1: Preparar Sistema
```bash
# Conectar por SSH
ssh administrador@192.168.100.156

# Ir al directorio del proyecto
cd /home/administrador/deployments/parking-lot-management

# Verificar que tienes el código
ls -la
```

### Paso 2: Configurar Archivo .env
```bash
# Copiar archivo de configuración Ubuntu
cp .env.ubuntu .env

# Verificar configuración
cat .env | grep -E "(DATABASE_URL|FRONTEND_URL|PRINTER)"
```

### Paso 3: Instalar Dependencias
```bash
# Instalar dependencias del backend
npm install

# Instalar dependencias del frontend
cd src/frontend
npm install
cd ../..
```

### Paso 4: Configurar Base de Datos
```bash
# Crear base de datos
sudo -u postgres psql -c "CREATE DATABASE parking_lot_dev;"
sudo -u postgres psql -c "CREATE USER parking_user WITH PASSWORD 'parking123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE parking_lot_dev TO parking_user;"

# Ejecutar migraciones
npx prisma generate
npx prisma db push
```

### Paso 5: Iniciar Modo Desarrollo
```bash
# Iniciar ambos servidores
npm run dev
```

**Verificar que funciona:**
- Backend: http://192.168.100.156:4000/health
- Frontend: http://192.168.100.156:3001

## 🖥️ Crear Acceso Directo en Escritorio

```bash
# Crear launcher en el Escritorio
cat > ~/Escritorio/parking-dev.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Parking - Modo Dev
Comment=Sistema de Estacionamiento (Desarrollo)
Exec=firefox http://192.168.100.156:3001
Icon=firefox
Terminal=false
Categories=Application;Development;
EOF

# Dar permisos de ejecución
chmod +x ~/Escritorio/parking-dev.desktop
```

## 🖨️ Configurar Hardware

### Impresora Epson TM-T20III
```bash
# Conectar impresora por USB y verificar
ls -la /dev/usb/lp0

# Dar permisos
sudo chmod 666 /dev/usb/lp0

# Probar impresora
echo "PRUEBA IMPRESORA" | sudo tee /dev/usb/lp0
```

### Scanner Honeywell
- Conectar por USB
- No requiere configuración (funciona como teclado)
- Probar escaneando un código en cualquier campo de texto

## 🚀 Inicio Rápido con Screen

```bash
# Crear sesión persistente
screen -S parking-dev

# Iniciar desarrollo
cd /home/administrador/deployments/parking-lot-management
npm run dev

# Desconectar sin cerrar: Ctrl+A, luego D
# Reconectar: screen -r parking-dev
```

## ⚠️ Solución de Problemas Comunes

### Error: Puerto 3001 en uso
```bash
# Ver qué usa el puerto
sudo lsof -i :3001

# Matar proceso si es necesario
sudo kill -9 [PID]
```

### Error: No se puede conectar a PostgreSQL
```bash
# Verificar que PostgreSQL está corriendo
sudo systemctl status postgresql

# Reiniciar si es necesario
sudo systemctl restart postgresql
```

### Error: Impresora no responde
```bash
# Verificar conexión USB
lsusb | grep Epson

# Verificar permisos
ls -la /dev/usb/lp0

# Reinstalar permisos
sudo usermod -a -G lp administrador
sudo chmod 666 /dev/usb/lp0
```

### Error: Frontend muestra "Cannot connect"
- Verificar que usas IP 192.168.100.156:3001 (NO localhost)
- Verificar que backend está corriendo en puerto 4000
- Revisar archivo .env tiene las IPs correctas

## 📝 Comandos Útiles

```bash
# Ver logs en tiempo real
npm run dev 2>&1 | tee desarrollo.log

# Verificar servicios
ps aux | grep node

# Ver puertos abiertos
sudo netstat -tlnp | grep -E "(3001|4000)"

# Reiniciar todo
pkill node
npm run dev
```

## 🏁 Modo Kiosko Simple

Para abrir automáticamente en modo kiosko:
```bash
# Crear script de inicio
cat > ~/iniciar-parking.sh << 'EOF'
#!/bin/bash
cd /home/administrador/deployments/parking-lot-management
screen -dmS parking-dev npm run dev
sleep 10
firefox --kiosk http://192.168.100.156:3001
EOF

chmod +x ~/iniciar-parking.sh
```

## ✅ Verificación Final

1. Abrir navegador en: http://192.168.100.156:3001
2. Verificar que aparece la interfaz del operador
3. Probar entrada de vehículo
4. Verificar que imprime boleto
5. Escanear código de barras

**¡Sistema listo para desarrollo!** 🎉