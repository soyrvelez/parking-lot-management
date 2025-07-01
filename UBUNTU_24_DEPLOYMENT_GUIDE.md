# 🚀 UBUNTU 24.04.02 COMPLETE DEPLOYMENT GUIDE
## Sistema de Gestión de Estacionamiento - ThinkPad

> **⚡ GUÍA ÚNICA Y COMPLETA**: Esta guía consolida TODOS los pasos necesarios para instalar el sistema desde cero en Ubuntu 24.04.02 LTS

---

## 📋 TABLA DE CONTENIDOS

1. [**PRE-INSTALACIÓN**](#-fase-1-pre-instalación-30-min)
   - Verificación de Ubuntu 24.04.02
   - Preparación del sistema
   - Configuración de red

2. [**CONFIGURACIÓN DE AMBIENTE**](#-fase-2-configuración-de-ambiente-20-min)
   - Archivo .env completo
   - Seguridad y contraseñas
   - Configuración de hardware

3. [**INSTALACIÓN DEL SISTEMA**](#-fase-3-instalación-del-sistema-90-120-min)
   - Instalación paso a paso
   - Verificación después de cada fase
   - Solución de problemas

4. [**PRUEBAS DE HARDWARE**](#-fase-4-pruebas-de-hardware-30-min)
   - Impresora térmica
   - Scanner de códigos
   - Configuración de display

5. [**VERIFICACIÓN FINAL**](#-fase-5-verificación-final-20-min)
   - Pruebas funcionales
   - Lista de verificación
   - Inicio de operaciones

6. [**TROUBLESHOOTING**](#-troubleshooting-reference)
   - Problemas comunes Ubuntu 24.04
   - Comandos de emergencia
   - Recuperación del sistema

---

## 🔧 FASE 1: PRE-INSTALACIÓN (30 min)

### **PASO 1.1: Verificar Ubuntu 24.04.02**

```bash
# Verificar versión exacta de Ubuntu
lsb_release -a
```

**✅ Salida esperada:**
```
Distributor ID: Ubuntu
Description:    Ubuntu 24.04.2 LTS
Release:        24.04
Codename:       noble
```

**❌ Si no es 24.04.02:**
- Actualizar con: `sudo apt update && sudo apt upgrade`
- O descargar ISO correcta de: https://ubuntu.com/download

### 🚨 **ADVERTENCIAS CRÍTICAS UBUNTU 24.04.02**

**⚠️ IMPORTANTE:** Ubuntu 24.04 tiene diferencias significativas con versiones anteriores:

1. **PostgreSQL 16 (no 14):** El sistema instalará PostgreSQL 16 por defecto
2. **GDM3 (no LightDM):** El gestor de pantalla por defecto es GDM3
3. **Node.js 18:** Viene preinstalado, no necesita repositorios externos

**✅ Verificar compatibilidad:**
```bash
# Verificar versión de PostgreSQL disponible
apt search postgresql | grep "postgresql-[0-9]" | head -5

# Verificar gestor de pantalla actual
systemctl status gdm3 lightdm 2>/dev/null | grep -E "(gdm3|lightdm).*active"

# Verificar Node.js disponible
apt show nodejs | grep Version
```

### **PASO 1.2: Preparar sistema base**

```bash
# 1. Actualizar sistema completo
sudo apt update
```

**✅ Verificar:** No debe haber errores de "404" o "GPG"

```bash
# 2. Instalar actualizaciones
sudo apt upgrade -y
```

**⏱️ Tiempo estimado:** 10-15 minutos

```bash
# 3. Instalar herramientas esenciales
sudo apt install -y curl wget git net-tools openssh-server screen htop
```

**✅ Verificar cada herramienta:**
```bash
which curl wget git     # Debe mostrar rutas para cada comando
```

### **PASO 1.3: Configurar usuario administrador**

```bash
# 1. Crear usuario si no existe
sudo adduser administrador
```

**📝 Ingresar:**
- Contraseña segura (anotar en lugar seguro)
- Nombre completo: "Administrador Sistema"
- Resto: presionar ENTER

```bash
# 2. Dar permisos sudo
sudo usermod -aG sudo administrador

# 3. Verificar permisos
su - administrador
sudo whoami
```

**✅ Debe responder:** `root`

### **PASO 1.4: Obtener información de red**

```bash
# 1. Obtener IP actual del ThinkPad
ip addr show | grep "inet " | grep -v "127.0.0.1"
```

**📝 Anotar IP:** Por ejemplo `192.168.1.45`

```bash
# 2. Verificar gateway
ip route | grep default
```

**📝 Anotar Gateway:** Por ejemplo `192.168.1.1`

```bash
# 3. Probar conectividad
ping -c 4 8.8.8.8
```

**✅ Debe mostrar:** "4 packets transmitted, 4 received"

### **PASO 1.5: Habilitar SSH para instalación remota**

```bash
# 1. Iniciar servicio SSH
sudo systemctl start ssh
sudo systemctl enable ssh

# 2. Verificar estado
sudo systemctl status ssh
```

**✅ Debe mostrar:** "active (running)"

```bash
# 3. Configurar firewall
sudo ufw allow 22/tcp
sudo ufw --force enable

# 4. Obtener IP para conexión remota
hostname -I
```

**📝 Desde tu MacBook ahora puedes conectar con:**
```bash
ssh administrador@IP_DEL_THINKPAD
```

---

## 📄 FASE 2: CONFIGURACIÓN DE AMBIENTE (20 min)

### **PASO 2.1: Descargar código fuente**

```bash
# Conectado como administrador
cd /home/administrador

# 1. Crear estructura de directorios
mkdir -p deployments
cd deployments

# 2. Clonar repositorio
git clone https://github.com/TU_USUARIO/parking-lot-management.git
# O si tienes el código en USB:
# cp -r /media/USB/parking-lot-management ./

# 3. Entrar al directorio
cd parking-lot-management

# 4. Verificar archivos
ls -la
```

**✅ Debes ver:** carpetas `src/`, `scripts/`, archivos `.env.production.template`

### **PASO 2.2: Configurar permisos de scripts**

```bash
# Dar permisos de ejecución a TODOS los scripts
find scripts/ -name "*.sh" -exec chmod +x {} \;

# Verificar permisos
ls -la scripts/*.sh
```

**✅ Todos deben mostrar:** `-rwxr-xr-x` (con x de ejecución)

### **PASO 2.3: Crear archivo de configuración**

```bash
# 1. Copiar template
cp .env.production.template .env

# 2. Generar contraseña segura para base de datos
openssl rand -base64 32
```

**📝 Copiar resultado** (ejemplo: `K8n3Qp5R7tW9xY2aB4cD6fH8jL0mN2P4`)

```bash
# 3. Generar JWT secret
openssl rand -hex 32
```

**📝 Copiar resultado** (ejemplo: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`)

```bash
# 4. Editar archivo de configuración
nano .env
```

### **PASO 2.4: Configuración completa del archivo .env**

**📝 REEMPLAZAR TODO el contenido con esto (ajustando valores marcados):**

```bash
# ====================================
# CONFIGURACIÓN DE PRODUCCIÓN
# Sistema de Estacionamiento
# ====================================

# Base de Datos - CAMBIAR CONTRASEÑA
DATABASE_URL="postgresql://parking_user:TU_CONTRASEÑA_AQUÍ@localhost:5432/parking_lot_prod"

# Seguridad JWT - CAMBIAR SECRET
JWT_SECRET="TU_JWT_SECRET_AQUÍ"
JWT_EXPIRES_IN="24h"

# Configuración de Aplicación
NODE_ENV="production"
API_PORT=4000
FRONTEND_PORT=3000
LOG_LEVEL="info"

# ====================================
# CONFIGURACIÓN DE IMPRESORA
# ====================================

# OPCIÓN A: Impresora USB (RECOMENDADO)
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# OPCIÓN B: Impresora de Red (comentar arriba y descomentar abajo)
#PRINTER_INTERFACE_TYPE="network"
#PRINTER_HOST="192.168.1.100"
#PRINTER_PORT=9100

# Configuración común de impresora
PRINTER_TIMEOUT=5000
PRINTER_RETRY_ATTEMPTS=3
PRINTER_PAPER_WIDTH=58
PRINTER_CHARSET="CP437"
PRINTER_CUT_COMMAND=true

# ====================================
# CONFIGURACIÓN DE RED
# ====================================

# CAMBIAR ESTAS IPs POR LA IP DEL THINKPAD
CORS_ORIGIN="http://TU_IP_THINKPAD_AQUÍ"
FRONTEND_URL="http://TU_IP_THINKPAD_AQUÍ"

# ====================================
# CONFIGURACIÓN FINANCIERA
# ====================================

# Moneda y precisión
CURRENCY="MXN"
DECIMAL_PRECISION=2
MAX_TRANSACTION_AMOUNT=99999.99
MIN_TRANSACTION_AMOUNT=0.01
ENABLE_FINANCIAL_AUDIT=true
FINANCIAL_ROUNDING_MODE="HALF_UP"

# Configuración de caja
MAX_BILL_VALUE=500
LOST_TICKET_FEE=100.00
GRACE_PERIOD_MINUTES=15

# ====================================
# CONFIGURACIÓN DE HARDWARE
# ====================================

# Scanner de códigos de barras
SCANNER_ENABLED=true
SCANNER_AUTO_FOCUS=true
BARCODE_TYPE="CODE39"

# Display
KIOSK_MODE=true
DISPLAY_RESOLUTION="1920x1080"
HIDE_CURSOR=true

# ====================================
# SEGURIDAD Y LÍMITES
# ====================================

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=50
SESSION_TIMEOUT_MINUTES=1440
ENABLE_CONSOLE_LOGS=false

# ====================================
# RUTAS Y DIRECTORIOS
# ====================================

BACKUP_PATH="/var/backups/parking"
LOG_PATH="/var/log/parking-system"
TEMP_PATH="/tmp/parking"
UPLOAD_PATH="/opt/parking-system/uploads"

# ====================================
# NOTAS IMPORTANTES:
# 1. Reemplazar TU_CONTRASEÑA_AQUÍ con la generada
# 2. Reemplazar TU_JWT_SECRET_AQUÍ con el generado  
# 3. Reemplazar TU_IP_THINKPAD_AQUÍ con IP real
# 4. NO commitear este archivo a git
# ====================================
```

**Guardar archivo:** `Ctrl+X`, luego `Y`, luego `ENTER`

### **PASO 2.5: Verificar configuración**

```bash
# 1. Verificar que el archivo existe y no está vacío
ls -la .env
cat .env | grep -E "(DATABASE_URL|JWT_SECRET|CORS_ORIGIN)"
```

**✅ Debe mostrar:** Las 3 líneas con valores configurados (sin las contraseñas reales por seguridad)

```bash
# 2. Verificar sintaxis del archivo
grep -n "=" .env | wc -l
```

**✅ Debe mostrar:** Un número alrededor de 35-40 (líneas con configuración)

---

## 🏗️ FASE 3: INSTALACIÓN DEL SISTEMA (90-120 min)

### **PASO 3.1: Ejecutar verificación previa**

```bash
# 1. Ejecutar verificación de compatibilidad Ubuntu 24.04
cd /home/administrador/deployments/parking-lot-management
sudo ./scripts/ubuntu-24-compatibility-check.sh
```

**✅ Debe mostrar:**
- ✓ Ubuntu 24.04.2 detectado
- ✓ PostgreSQL 16 disponible
- ✓ Gestor de pantalla identificado
- ✓ Node.js 18 disponible

```bash
# 2. Verificar requisitos del sistema
sudo ./scripts/preflight-check.sh
```

**✅ Revisar resultado:**
- ✓ OS: Ubuntu 24.04
- ✓ RAM: mínimo 4GB disponible
- ✓ Disco: mínimo 20GB libre
- ✓ Red: conexión activa

**❌ Si hay errores:** Resolver antes de continuar

### **PASO 3.2: Crear sesión persistente**

```bash
# Instalar screen para mantener instalación activa
sudo apt install -y screen

# Crear nueva sesión
screen -S instalacion

# Verificar que estás en screen
echo $STY
```

**✅ Debe mostrar algo como:** `12345.instalacion`

### **PASO 3.3: Iniciar instalación**

```bash
# 1. Asegurarse de estar en el directorio correcto
pwd
# Debe mostrar: /home/administrador/deployments/parking-lot-management

# 2. Iniciar instalación completa
sudo ./scripts/install-all.sh production
```

### **PASO 3.4: Monitorear progreso de instalación**

La instalación pasará por estas fases:

#### **FASE 1/10: setup-system (15 min)**
```
Installing system packages...
Configuring system settings...
Setting up users and permissions...
```

**Si falla aquí:**
```bash
# Ver logs detallados
tail -n 50 /var/log/parking-installation-*.log

# Continuar desde esta fase
sudo ./scripts/install-all.sh production --continue-from setup-system
```

#### **FASE 2/10: setup-database (15 min)**
```
Installing PostgreSQL 16...
Creating database and user...
Setting up initial schema...
```

**Si falla aquí:**
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Si no está instalado, instalar manualmente (Ubuntu 24.04 usa PostgreSQL 16)
sudo apt install -y postgresql-16 postgresql-contrib

# Si necesitas PostgreSQL 14 específicamente:
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-14 postgresql-contrib

# Continuar
sudo ./scripts/install-all.sh production --continue-from setup-database
```

#### **FASE 3/10: setup-kiosk (10 min)**
```
Installing display manager...
Configuring kiosk mode...
Setting up auto-login...
```

**⚠️ CRÍTICO UBUNTU 24.04:** Esta fase maneja el cambio de GDM3 a LightDM

**Si aparecen preguntas:**
1. **"Configuring gdm3"** → Seleccionar **"No"** 
2. **"Default display manager"** → Seleccionar **"lightdm"**
3. **"Disable gdm3?"** → Seleccionar **"Yes"**

**Si falla en esta fase:**
```bash
# Cambio manual de GDM3 a LightDM
sudo systemctl stop gdm3
sudo systemctl disable gdm3
sudo apt install -y lightdm
sudo dpkg-reconfigure lightdm
sudo systemctl enable lightdm
sudo systemctl start lightdm
```

#### **FASES 4-10: Continuación**
- setup-printer (10 min)
- setup-scanner (5 min)  
- harden-system (10 min)
- setup-remote-admin (5 min)
- deploy-parking-system (20 min)
- setup-systemd-services (10 min)
- setup-backups (5 min)

### **PASO 3.5: Si necesitas salir de la instalación**

```bash
# Para desconectar temporalmente (instalación continúa)
# Presionar: Ctrl+A, luego D

# Para reconectar
screen -r instalacion

# Para ver todas las sesiones
screen -ls
```

### **PASO 3.6: Verificar instalación completa**

Al finalizar debes ver:
```
=== INSTALACIÓN COMPLETA FINALIZADA EXITOSAMENTE ===
Total time: 95 minutes
Check installation log at: /var/log/parking-installation-*.log
```

**Salir de screen:** `exit`

---

## 🔌 FASE 4: PRUEBAS DE HARDWARE (30 min)

### **PASO 4.1: Configurar impresora térmica**

#### **Opción A: Impresora USB**

```bash
# 1. Conectar impresora al puerto USB
# 2. Verificar detección
lsusb | grep -i epson
```

**✅ Debe mostrar:** `Seiko Epson Corp.` o similar

```bash
# 3. Verificar dispositivo
ls -la /dev/usb/lp*
```

**✅ Debe mostrar:** `/dev/usb/lp0` con permisos

```bash
# 4. Probar impresión básica
echo "PRUEBA IMPRESORA" | sudo tee /dev/usb/lp0
```

**✅ Debe:** Imprimir texto en la impresora

**❌ Si no imprime:**
```bash
# Verificar permisos
sudo chmod 666 /dev/usb/lp0

# Agregar usuario al grupo lp
sudo usermod -a -G lp administrador
sudo usermod -a -G lp parking

# Reintentar prueba
```

#### **Opción B: Impresora de Red**

```bash
# 1. Verificar conectividad
ping -c 4 192.168.1.100  # Cambiar por IP de tu impresora
```

**✅ Debe:** Responder los 4 pings

```bash
# 2. Verificar puerto
nc -zv 192.168.1.100 9100
```

**✅ Debe mostrar:** `Connection succeeded`

```bash
# 3. Probar impresión
echo "PRUEBA RED" | nc 192.168.1.100 9100
```

### **PASO 4.2: Configurar scanner de códigos**

```bash
# 1. Conectar scanner al puerto USB
# 2. Verificar detección
lsusb | grep -i honeywell
```

**✅ Debe mostrar:** `Honeywell` o `HID` device

```bash
# 3. Probar lectura
# Abrir editor de texto
nano test_scanner.txt

# Escanear un código de barras
# El texto debe aparecer automáticamente
```

**✅ Verificar:** El código aparece como texto

### **PASO 4.3: Ajustar resolución de pantalla**

```bash
# 1. Detectar resoluciones disponibles
DISPLAY=:0 xrandr
```

**📝 Anotar resolución deseada** (ej: 1920x1080)

```bash
# 2. Si necesitas cambiar resolución
sudo nano /home/operador/.config/openbox/autostart
```

**Buscar línea con `xrandr` y cambiar a:**
```bash
xrandr -s 1920x1080  # Tu resolución aquí
```

---

## ✅ FASE 5: VERIFICACIÓN FINAL (20 min)

### **PASO 5.1: Ejecutar verificación automática**

```bash
# Ejecutar script de verificación completo
cd /home/administrador/deployments/parking-lot-management
./scripts/verify-deployment.sh
```

**✅ Debe mostrar:**
- Sistema Operativo: ✓
- Servicios: ✓ (PostgreSQL, Nginx, etc.)
- Aplicación: ✓ (Backend y Frontend)
- Hardware: ✓ (Impresora accesible)
- Base de datos: ✓

### **PASO 5.2: Verificación manual de servicios**

```bash
# 1. Verificar servicios críticos
sudo systemctl status postgresql
sudo systemctl status parking-system
sudo systemctl status nginx
```

**✅ Todos deben mostrar:** `active (running)`

```bash
# 2. Verificar aplicación web
curl -I http://localhost:3000
```

**✅ Debe responder:** `HTTP/1.1 200 OK`

### **PASO 5.3: Prueba funcional completa**

```bash
# 1. Abrir navegador (si estás en el ThinkPad)
firefox http://localhost:3000 &

# O desde tu MacBook
open http://IP_DEL_THINKPAD:3000
```

#### **Prueba 1: Entrada de vehículo**
1. Click en "ENTRADA"
2. Ingresar placa: `TEST-001`
3. Click "GENERAR BOLETO"
4. ✅ Debe imprimir boleto con código de barras

#### **Prueba 2: Sistema de pensiones**
1. Click en "PENSIÓN"
2. Llenar:
   - Nombre: "Cliente Prueba"
   - Placa: "ABC-123"
   - Duración: 3 meses
3. ✅ **VERIFICAR:** Total = $2,400 (3 × $800)
4. Click "PROCESAR PAGO"
5. ✅ Debe procesar correctamente

#### **Prueba 3: Salida con scanner**
1. Escanear código del boleto de prueba
2. ✅ Sistema debe calcular tarifa
3. Ingresar pago
4. ✅ Debe calcular cambio correctamente

### **PASO 5.4: Configurar inicio automático**

```bash
# 1. Habilitar servicios para inicio automático
sudo systemctl enable postgresql
sudo systemctl enable parking-system
sudo systemctl enable lightdm

# 2. Verificar configuración
sudo systemctl list-unit-files | grep -E "(parking|postgresql|lightdm)"
```

**✅ Todos deben mostrar:** `enabled`

### **PASO 5.5: Reinicio final de prueba**

```bash
# 1. Reiniciar sistema
sudo reboot
```

**Después del reinicio:**
1. ✅ Sistema debe iniciar en modo kiosko
2. ✅ Aplicación debe abrir automáticamente
3. ✅ No debe pedir contraseña

---

## 🚨 TROUBLESHOOTING REFERENCE

### **PROBLEMA 1: Ubuntu 24.04 no inicia en modo kiosko**

**Síntomas:** Pantalla de login aparece o sistema inicia con GDM3

**Causa:** Ubuntu 24.04 usa GDM3 por defecto, no LightDM

**Solución Ubuntu 24.04:**
```bash
# 1. Entrar con Ctrl+Alt+F2
# 2. Login como administrador
# 3. Verificar qué gestor está activo
systemctl status gdm3 lightdm

# 4. Si GDM3 está activo, cambiar a LightDM
sudo systemctl stop gdm3
sudo systemctl disable gdm3
sudo apt install -y lightdm
sudo dpkg-reconfigure lightdm  # Seleccionar lightdm
sudo systemctl enable lightdm

# 5. Configurar autologin
sudo nano /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
```

**Contenido:**
```ini
[Seat:*]
autologin-guest=false
autologin-user=operador
autologin-user-timeout=0
user-session=openbox
```

```bash
# 6. Reiniciar sistema
sudo reboot
```

### **PROBLEMA 2: Aplicación no responde**

```bash
# 1. Verificar logs
sudo journalctl -u parking-system -n 50

# 2. Verificar proceso
ps aux | grep node

# 3. Reiniciar servicio
sudo systemctl restart parking-system

# 4. Verificar puerto
sudo lsof -i :3000
```

### **PROBLEMA 3: Base de datos no conecta**

```bash
# 1. Verificar PostgreSQL (Ubuntu 24.04 usa versión 16 por defecto)
sudo -u postgres psql -c "SELECT version();"

# 2. Si aparece PostgreSQL 16 pero scripts esperan 14:
# Verificar si el servicio está en puerto correcto
sudo netstat -plnt | grep :5432

# 3. Verificar base de datos existe
sudo -u postgres psql -l | grep parking

# 4. Para Ubuntu 24.04 con PostgreSQL 16:
# Verificar configuración específica de versión
ls /etc/postgresql/*/main/postgresql.conf
sudo cat /etc/postgresql/16/main/postgresql.conf | grep port

# 5. Verificar credenciales en .env
grep DATABASE_URL /opt/parking-system/.env

# 6. Probar conexión manual
sudo -u postgres psql parking_lot_prod
```

### **PROBLEMA 4: Impresora no funciona**

```bash
# Para USB:
# 1. Reconectar cable USB
# 2. Verificar detección
dmesg | tail -20 | grep -i usb

# 3. Reiniciar servicio de impresión
sudo systemctl restart cups

# Para Red:
# 1. Verificar IP correcta en .env
grep PRINTER_HOST /opt/parking-system/.env

# 2. Probar conectividad
telnet IP_IMPRESORA 9100
```

### **PROBLEMA 5: Scanner no lee códigos**

```bash
# 1. Verificar modo de operación (debe ser HID)
# 2. Probar en terminal
cat > /tmp/scanner_test.txt
# Escanear código
# Presionar Ctrl+C

# 3. Ver resultado
cat /tmp/scanner_test.txt
```

---

## 🛡️ COMANDOS DE EMERGENCIA

### **Acceso remoto de emergencia**
```bash
# Desde MacBook
ssh administrador@IP_THINKPAD

# Ver estado general
sudo systemctl status parking-system
sudo journalctl -u parking-system -f
```

### **Reiniciar servicios**
```bash
# Solo aplicación
sudo systemctl restart parking-system

# Todo el sistema
sudo reboot
```

### **Modo recovery (si sistema no inicia)**
1. Reiniciar y mantener `Shift` presionado
2. Seleccionar "Advanced options"
3. Seleccionar "Recovery mode"
4. Seleccionar "root - Drop to root shell"
5. Ejecutar:
```bash
mount -o remount,rw /
systemctl disable lightdm
reboot
```

### **Backup de emergencia**
```bash
# Backup rápido de base de datos
sudo -u postgres pg_dump parking_lot_prod > /tmp/backup_$(date +%Y%m%d).sql

# Backup de configuración
sudo tar -czf /tmp/config_backup_$(date +%Y%m%d).tar.gz /opt/parking-system/.env
```

---

## 📞 CHECKLIST FINAL DE ENTREGA

### **Sistema Operativo**
- [ ] Ubuntu 24.04.02 LTS instalado y actualizado
- [ ] Usuario `administrador` configurado con sudo
- [ ] Usuario `operador` para kiosko creado
- [ ] SSH habilitado para soporte remoto

### **Aplicación**
- [ ] Sistema accesible en `http://IP_THINKPAD:3000`
- [ ] Backend respondiendo en puerto 4000
- [ ] Base de datos PostgreSQL funcionando
- [ ] Servicios iniciando automáticamente

### **Hardware**
- [ ] Impresora térmica imprimiendo boletos
- [ ] Scanner leyendo códigos de barras
- [ ] Resolución de pantalla correcta
- [ ] Modo kiosko activado

### **Funcionalidad**
- [ ] Entrada de vehículos funciona
- [ ] Sistema de pensiones cobra correctamente
- [ ] Cálculo de tarifas preciso
- [ ] Impresión de boletos y recibos

### **Seguridad**
- [ ] Firewall configurado
- [ ] Contraseñas seguras establecidas
- [ ] Modo kiosko bloqueando acceso
- [ ] Respaldos automáticos configurados

### **Documentación**
- [ ] Credenciales documentadas
- [ ] IPs de red anotadas
- [ ] Procedimientos de emergencia explicados
- [ ] Contactos de soporte establecidos

---

## 🎉 ¡SISTEMA LISTO!

Si completaste todos los pasos, tu sistema de estacionamiento está:
- ✅ Instalado completamente
- ✅ Configurado para producción
- ✅ Probado y verificado
- ✅ Listo para operar

**Para soporte técnico:**
- SSH: `ssh administrador@IP_THINKPAD`
- Logs: `sudo journalctl -u parking-system -f`
- Reiniciar: `sudo systemctl restart parking-system`

¡El operador puede comenzar a usar el sistema inmediatamente! 🚗💰