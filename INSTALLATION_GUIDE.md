# Sistema de Gestión de Estacionamiento - Guía de Instalación Completa

## Descripción General
Esta guía proporciona instrucciones completas paso a paso para implementar el Sistema de Gestión de Estacionamiento en una Lenovo ThinkPad con Ubuntu LTS en modo kiosco para uso del operador. El sistema está optimizado para estacionamientos mexicanos con interfaz completamente en español.

## CONFIGURACIÓN Y REQUISITOS DE HARDWARE

### 1. Requisitos de Configuración de ThinkPad
#### Modelos Recomendados
- **ThinkPad Serie T**: T480, T490, T14 (Alta durabilidad)
- **ThinkPad Serie E**: E480, E490, E14 (Opción económica)
- **ThinkPad Serie L**: L480, L490, L14 (Balance precio/rendimiento)

#### Especificaciones Mínimas
```
Procesador: Intel Core i5 de 8va generación o superior
RAM: 8GB DDR4 (16GB recomendado para mejor rendimiento)
Almacenamiento: 256GB SSD NVMe (512GB recomendado)
Pantalla: 14" o 15.6" con resolución 1920x1080
Puertos USB: Mínimo 3 puertos USB-A disponibles
Red: Puerto Ethernet Gigabit + WiFi 802.11ac
Teclado: Español Latinoamericano
```

#### Requisitos de Red
- Conexión Ethernet estable para impresora
- WiFi como respaldo de conectividad
- Ancho de banda mínimo: 10 Mbps simétrico
- IP estática recomendada para el equipo

### 2. Configuración de Hardware Periférico

#### Impresora Térmica Epson TM-T20III
```bash
# Especificaciones de Conexión
Modelo: Epson TM-T20III con interfaz Ethernet
IP predeterminada: 192.168.1.100
Puerto: 9100 (Raw printing)
Ancho de papel: 80mm
Tipo de papel: Térmico estándar

# Configuración de Red de la Impresora
1. Conectar impresora a switch/router con cable Ethernet
2. Encender impresora manteniendo botón FEED
3. Se imprimirá configuración actual
4. Configurar IP estática usando utilidad Epson:
   - IP: 192.168.1.100
   - Máscara: 255.255.255.0
   - Gateway: 192.168.1.1
```

#### Procedimiento de Carga de Papel
```
1. Abrir cubierta de impresora
2. Insertar rollo con papel saliendo por abajo
3. Tirar papel hasta que sobresalga de la salida
4. Cerrar cubierta firmemente
5. Presionar FEED para avanzar papel
```

#### Escáner de Código de Barras Honeywell Voyager 1250g
```bash
# Especificaciones de Conexión
Interfaz: USB HID (Emulación de teclado)
Vendor ID: 0x0c2e
Product ID: 0x0b61
Simbología: Code 39
Modo: Trigger manual o automático

# Configuración del Escáner
1. Conectar a puerto USB disponible
2. Escáner se configura automáticamente como teclado
3. LED debe mostrar luz azul cuando está listo
4. Probar con código de barras de muestra
```

## PREPARACIÓN DEL SISTEMA UBUNTU

### 3. Instalación y Configuración de Ubuntu LTS

#### Descarga de Ubuntu 22.04 LTS
```bash
# Descargar imagen ISO oficial
wget https://releases.ubuntu.com/22.04/ubuntu-22.04.4-desktop-amd64.iso

# Verificar integridad SHA256
echo "45c9e05c19d3c0e29231ebb204c0ca55cb16cd50224b119651ceeb9dc5c62a9f *ubuntu-22.04.4-desktop-amd64.iso" | sha256sum -c

# Crear USB booteable (reemplazar sdX con dispositivo USB)
sudo dd if=ubuntu-22.04.4-desktop-amd64.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

#### Procedimiento de Instalación Limpia
```
1. Configurar BIOS/UEFI:
   - Deshabilitar Secure Boot
   - Habilitar USB Legacy Support
   - Configurar orden de arranque: USB primero
   - Establecer contraseña de administrador BIOS

2. Arrancar desde USB e instalar:
   - Seleccionar "Instalar Ubuntu"
   - Idioma: Español (México)
   - Teclado: Español (Latinoamérica)
   - Instalación mínima + Actualizaciones durante instalación
   - Borrar disco e instalar Ubuntu (CUIDADO: borra todo)
   - Zona horaria: America/Mexico_City
   - Usuario: operador
   - Contraseña: [Contraseña segura]
   - Nombre del equipo: parking-terminal-01
   - Habilitar inicio de sesión automático
```

#### Configuración Post-Instalación
```bash
# Actualizar sistema completo
sudo apt update && sudo apt upgrade -y

# Configurar idioma español para todo el sistema
sudo locale-gen es_MX.UTF-8
sudo update-locale LANG=es_MX.UTF-8 LC_ALL=es_MX.UTF-8

# Configurar zona horaria Ciudad de México
sudo timedatectl set-timezone America/Mexico_City
sudo timedatectl set-ntp true

# Instalar paquetes esenciales
sudo apt install -y \
  curl wget git vim htop net-tools \
  build-essential software-properties-common \
  openssh-server ufw fail2ban \
  unattended-upgrades apt-listchanges
```

### 4. Seguridad del Sistema y Bloqueo

#### Crear Cuenta de Operador Bloqueada
```bash
# Configurar restricciones para usuario operador
sudo mkdir -p /etc/security/limits.d/
sudo tee /etc/security/limits.d/operador.conf << 'EOF'
# Limitar recursos para usuario operador
operador soft nproc 256
operador hard nproc 512
operador soft nofile 4096
operador hard nofile 8192
operador soft priority 19
operador hard priority 19
operador soft cpu 1440
operador hard cpu 1440
EOF

# Remover capacidades administrativas
sudo deluser operador sudo 2>/dev/null || true
sudo gpasswd -d operador adm 2>/dev/null || true
```

#### Deshabilitar Servicios Innecesarios
```bash
# Servicios a deshabilitar para seguridad
SERVICES_TO_DISABLE=(
  "bluetooth"
  "cups-browsed"
  "ModemManager"
  "whoopsie"
  "apport"
  "kerneloops"
  "speech-dispatcher"
  "brltty"
  "colord"
  "switcheroo-control"
)

for service in "${SERVICES_TO_DISABLE[@]}"; do
  sudo systemctl stop $service 2>/dev/null || true
  sudo systemctl disable $service 2>/dev/null || true
  sudo systemctl mask $service 2>/dev/null || true
done
```

#### Configurar Firewall UFW
```bash
# Configurar firewall restrictivo
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir solo servicios necesarios
sudo ufw allow 22/tcp comment 'SSH Admin'
sudo ufw allow 3001/tcp comment 'Frontend Parking'
sudo ufw allow 4000/tcp comment 'Backend API'
sudo ufw allow from 192.168.1.0/24 to any port 5432 comment 'PostgreSQL Local'
sudo ufw allow from 192.168.1.100 comment 'Impresora Epson'

# Limitar intentos SSH
sudo ufw limit ssh/tcp

# Verificar reglas
sudo ufw status numbered
```

### 5. Configuración de Modo Kiosco

#### Instalar Software de Kiosco
```bash
# Instalar componentes necesarios para kiosco
sudo apt install -y \
  xorg openbox lightdm \
  chromium-browser \
  unclutter xdotool wmctrl \
  x11-xserver-utils \
  pulseaudio pavucontrol \
  plymouth-theme-ubuntu-logo

# Configurar Plymouth para arranque limpio
sudo update-alternatives --config default.plymouth
sudo update-initramfs -u
```

#### Configurar Inicio Automático de Sesión
```bash
# Configurar LightDM para autologin
sudo tee /etc/lightdm/lightdm.conf.d/50-parking-autologin.conf << 'EOF'
[Seat:*]
autologin-user=operador
autologin-user-timeout=0
user-session=openbox
greeter-hide-users=true
greeter-show-manual-login=false
allow-guest=false
EOF

# Crear configuración de Openbox
mkdir -p /home/operador/.config/openbox
chown -R operador:operador /home/operador/.config
```

#### Script de Inicio de Kiosco
```bash
# Crear script principal de kiosco
sudo tee /opt/parking-kiosk-start.sh << 'EOF'
#!/bin/bash

# Configuración de logs
LOG_FILE="/var/log/parking-kiosk.log"
exec 1>>$LOG_FILE
exec 2>&1

echo "[$(date)] Iniciando sistema de estacionamiento..."

# Esperar a que X esté listo
while ! xset q &>/dev/null; do
    sleep 1
done

# Configuración de pantalla
xset s off                      # Deshabilitar salvapantallas
xset -dpms                      # Deshabilitar gestión de energía
xset s noblank                  # Evitar pantalla negra
unclutter -idle 0.5 -root &     # Ocultar cursor del mouse

# Configurar resolución (ajustar según monitor)
DISPLAY_OUTPUT=$(xrandr | grep " connected" | head -1 | cut -d" " -f1)
xrandr --output $DISPLAY_OUTPUT --mode 1920x1080 --rate 60

# Deshabilitar teclas problemáticas
xmodmap -e "keycode 64 ="       # Alt izquierdo
xmodmap -e "keycode 108 ="      # Alt derecho  
xmodmap -e "keycode 37 ="       # Ctrl izquierdo
xmodmap -e "keycode 105 ="      # Ctrl derecho
xmodmap -e "keycode 9 ="        # Escape

# Iniciar aplicación de estacionamiento
cd /opt/parking-system
export NODE_ENV=production
export DISPLAY=:0
npm run start:prod &
APP_PID=$!

# Esperar a que la aplicación esté lista
echo "[$(date)] Esperando inicio de aplicación..."
for i in {1..30}; do
    if curl -s http://localhost:3001 > /dev/null; then
        echo "[$(date)] Aplicación lista"
        break
    fi
    sleep 1
done

# Lanzar navegador en modo kiosco
chromium-browser \
    --kiosk \
    --no-first-run \
    --disable-translate \
    --disable-infobars \
    --disable-suggestions-service \
    --disable-save-password-bubble \
    --disable-session-crashed-bubble \
    --disable-desktop-notifications \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-features=TranslateUI \
    --disable-ipc-flooding-protection \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --disable-pull-to-refresh-effect \
    --enable-features=OverlayScrollbar \
    --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
    --window-position=0,0 \
    --window-size=1920,1080 \
    --start-fullscreen \
    --app=http://localhost:3001/operator &

BROWSER_PID=$!

# Monitorear procesos
while true; do
    if ! kill -0 $APP_PID 2>/dev/null; then
        echo "[$(date)] Aplicación terminada, reiniciando..."
        killall chromium-browser 2>/dev/null
        exec $0
    fi
    if ! kill -0 $BROWSER_PID 2>/dev/null; then
        echo "[$(date)] Navegador terminado, reiniciando..."
        exec $0
    fi
    sleep 5
done
EOF

sudo chmod +x /opt/parking-kiosk-start.sh
```

## INSTALACIÓN DE SOFTWARE

### 6. Node.js y Dependencias del Sistema

#### Instalar Node.js 20 LTS
```bash
# Instalar Node.js desde NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar versión compatible

# Instalar herramientas de compilación
sudo apt install -y gcc g++ make python3-pip
```

#### Instalar y Configurar PostgreSQL
```bash
# Instalar PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-contrib-14

# Configurar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql << 'EOF'
-- Crear usuario para parking
CREATE USER parking_user WITH PASSWORD 'ParkingMexico2024$';

-- Crear base de datos
CREATE DATABASE parking_lot OWNER parking_user;

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE parking_lot TO parking_user;
ALTER USER parking_user CREATEDB;

-- Configurar conexiones
ALTER SYSTEM SET listen_addresses = 'localhost';
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';

-- Aplicar cambios
SELECT pg_reload_conf();
\q
EOF

# Guardar credenciales de forma segura
echo "ParkingMexico2024$" | sudo tee /opt/parking-db-password
sudo chmod 600 /opt/parking-db-password
sudo chown operador:operador /opt/parking-db-password
```

### 7. Despliegue del Sistema de Estacionamiento

#### Clonar y Configurar el Sistema
```bash
# Crear directorio de aplicación
sudo mkdir -p /opt/parking-system
sudo chown operador:operador /opt/parking-system

# Clonar repositorio (como usuario operador)
sudo -u operador bash << 'EOF'
cd /opt/parking-system
git clone https://github.com/tu-organizacion/parking-lot-management.git .

# Instalar dependencias
npm install --production

# Construir aplicación
npm run build
EOF
```

#### Configurar Variables de Entorno
```bash
# Crear archivo de configuración de producción
sudo tee /opt/parking-system/.env.production << 'EOF'
# Base de Datos
DATABASE_URL="postgresql://parking_user:ParkingMexico2024$@localhost:5432/parking_lot"
NODE_ENV=production

# Puertos de Aplicación
PORT=4000
FRONTEND_PORT=3001

# Configuración de Seguridad
JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
SESSION_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
ADMIN_DEFAULT_PASSWORD="Admin2024Mexico$"

# Configuración de Hardware
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
PRINTER_MODEL=EPSON_TM_T20III
SCANNER_VENDOR_ID=0x0c2e
SCANNER_PRODUCT_ID=0x0b61

# Localización México
TIMEZONE=America/Mexico_City
LOCALE=es_MX.UTF-8
CURRENCY=MXN
COUNTRY_CODE=MX

# Límites de Tasa
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# Configuración de Logs
LOG_LEVEL=info
LOG_FILE=/var/log/parking-system/app.log
AUDIT_LOG_FILE=/var/log/parking-system/audit.log
ERROR_LOG_FILE=/var/log/parking-system/error.log

# Configuración de Respaldos
BACKUP_ENABLED=true
BACKUP_PATH=/opt/parking-backups
BACKUP_RETENTION_DAYS=30

# Configuración de Estacionamiento
MAX_PARKING_SPACES=150
BUSINESS_NAME="Estacionamiento Central"
BUSINESS_ADDRESS="Centro, Ciudad de México"
BUSINESS_RFC="EST990101XXX"
BUSINESS_PHONE="55-1234-5678"

# Tarifas Predeterminadas (en pesos mexicanos)
DEFAULT_HOURLY_RATE=30
DEFAULT_DAILY_MAX=200
DEFAULT_LOST_TICKET_FEE=300
DEFAULT_PENSION_MONTHLY=1500

# Configuración de Impresión
PRINT_BUSINESS_LOGO=true
PRINT_FOOTER_MESSAGE="Gracias por su preferencia"
PRINT_INCLUDE_RFC=true
PRINT_INCLUDE_PHONE=true
EOF

# Asegurar archivo de configuración
sudo chmod 600 /opt/parking-system/.env.production
sudo chown operador:operador /opt/parking-system/.env.production
```

### 8. Configuración del Entorno de Producción

#### Inicializar Base de Datos
```bash
# Ejecutar como usuario operador
sudo -u operador bash << 'EOF'
cd /opt/parking-system

# Cargar variables de entorno
export $(cat .env.production | grep -v '^#' | xargs)

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate deploy

# Cargar datos iniciales
npx prisma db seed

# Verificar conexión
npx prisma db execute --file ./scripts/verify-db.sql
EOF
```

#### Configurar Servicios Systemd
```bash
# Servicio principal del sistema
sudo tee /etc/systemd/system/parking-backend.service << 'EOF'
[Unit]
Description=Sistema de Estacionamiento - Backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=operador
Group=operador
WorkingDirectory=/opt/parking-system
EnvironmentFile=/opt/parking-system/.env.production
ExecStartPre=/bin/bash -c 'until pg_isready -h localhost; do sleep 1; done'
ExecStart=/usr/bin/node dist/backend/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/parking-system/backend.log
StandardError=append:/var/log/parking-system/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Servicio frontend
sudo tee /etc/systemd/system/parking-frontend.service << 'EOF'
[Unit]
Description=Sistema de Estacionamiento - Frontend
After=network.target parking-backend.service
Requires=parking-backend.service

[Service]
Type=simple
User=operador
Group=operador
WorkingDirectory=/opt/parking-system
EnvironmentFile=/opt/parking-system/.env.production
ExecStart=/usr/bin/npm run start:frontend
Restart=always
RestartSec=10
StandardOutput=append:/var/log/parking-system/frontend.log
StandardError=append:/var/log/parking-system/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Crear directorios de logs
sudo mkdir -p /var/log/parking-system
sudo chown -R operador:operador /var/log/parking-system

# Habilitar servicios
sudo systemctl daemon-reload
sudo systemctl enable parking-backend parking-frontend
```

## IMPLEMENTACIÓN DE MODO KIOSCO

### 9. Configuración del Navegador en Kiosco

#### Configuración de Openbox
```bash
# Crear configuración de Openbox para kiosco
mkdir -p /home/operador/.config/openbox
tee /home/operador/.config/openbox/rc.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance>
    <strength>10</strength>
    <screen_edge_strength>20</screen_edge_strength>
  </resistance>
  
  <applications>
    <application class="*">
      <fullscreen>yes</fullscreen>
      <maximized>yes</maximized>
      <decor>no</decor>
    </application>
  </applications>

  <keyboard>
    <!-- Deshabilitar todas las combinaciones peligrosas -->
    <keybind key="A-F4">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="A-Tab">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="C-A-Delete">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="C-A-T">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="C-A-L">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="C-A-D">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="C-Escape">
      <action name="UnmaximizeFull"/>
    </keybind>
    <keybind key="Print">
      <action name="UnmaximizeFull"/>
    </keybind>
  </keyboard>

  <mouse>
    <dragThreshold>1</dragThreshold>
    <doubleClickTime>500</doubleClickTime>
    <screenEdgeWarpTime>0</screenEdgeWarpTime>
    <screenEdgeWarpMouse>false</screenEdgeWarpMouse>
    
    <context name="Desktop">
      <mousebind button="Left" action="Press">
        <action name="UnmaximizeFull"/>
      </mousebind>
      <mousebind button="Middle" action="Press">
        <action name="UnmaximizeFull"/>
      </mousebind>
      <mousebind button="Right" action="Press">
        <action name="UnmaximizeFull"/>
      </mousebind>
    </context>
  </mouse>

  <menu>
    <hideDelay>0</hideDelay>
    <middle>no</middle>
    <submenuShowDelay>0</submenuShowDelay>
    <submenuHideDelay>0</submenuHideDelay>
    <applicationIcons>no</applicationIcons>
  </menu>
</openbox_config>
EOF

# Autostart de Openbox
tee /home/operador/.config/openbox/autostart << 'EOF'
# Configuración inicial de pantalla
xset s off &
xset -dpms &
xset s noblank &

# Ocultar cursor
unclutter -idle 0.5 -root &

# Deshabilitar el menú contextual
xmodmap -e "pointer = 1 2 32 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 3" &

# Iniciar sistema de estacionamiento
/opt/parking-kiosk-start.sh &
EOF

chown -R operador:operador /home/operador/.config
```

### 10. Optimización de Interfaz para Operador

#### Configuración de TouchPad/TrackPoint
```bash
# Crear configuración para ThinkPad
sudo tee /etc/X11/xorg.conf.d/50-thinkpad-trackpad.conf << 'EOF'
Section "InputClass"
    Identifier "ThinkPad TrackPoint"
    MatchProduct "TrackPoint"
    Option "AccelerationProfile" "2"
    Option "AccelerationNumerator" "1"
    Option "AccelerationDenominator" "1"
    Option "ConstantDeceleration" "2"
EndSection

Section "InputClass"
    Identifier "ThinkPad TouchPad"
    MatchProduct "TouchPad"
    MatchIsTouchpad "on"
    Option "Tapping" "on"
    Option "TappingButtonMap" "lmr"
    Option "DisableWhileTyping" "on"
    Option "PalmDetection" "on"
    Option "PalmMinWidth" "8"
    Option "PalmMinZ" "100"
EndSection
EOF
```

#### Configuración de Idioma Español
```bash
# Instalar paquetes de idioma completos
sudo apt install -y \
  language-pack-es \
  language-pack-es-base \
  language-pack-gnome-es \
  language-pack-gnome-es-base \
  firefox-locale-es \
  thunderbird-locale-es \
  libreoffice-l10n-es \
  hunspell-es

# Configurar locale español mexicano
sudo locale-gen es_MX.UTF-8
sudo update-locale LANG=es_MX.UTF-8

# Variables de entorno para español
sudo tee /etc/environment << 'EOF'
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
LANG="es_MX.UTF-8"
LANGUAGE="es_MX:es"
LC_ALL="es_MX.UTF-8"
LC_NUMERIC="es_MX.UTF-8"
LC_TIME="es_MX.UTF-8"
LC_MONETARY="es_MX.UTF-8"
LC_PAPER="es_MX.UTF-8"
LC_IDENTIFICATION="es_MX.UTF-8"
LC_NAME="es_MX.UTF-8"
LC_ADDRESS="es_MX.UTF-8"
LC_TELEPHONE="es_MX.UTF-8"
LC_MEASUREMENT="es_MX.UTF-8"
TZ="America/Mexico_City"
EOF
```

## SEGURIDAD Y MANTENIMIENTO

### 11. Endurecimiento de Seguridad del Sistema

#### Configurar SSH para Acceso Remoto
```bash
# Configuración segura de SSH
sudo tee /etc/ssh/sshd_config.d/99-parking-security.conf << 'EOF'
# Puerto SSH (considerar cambiar del 22 default)
Port 22

# Seguridad de autenticación
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes

# Usuarios permitidos
AllowUsers admin
DenyUsers operador root

# Límites de conexión
MaxAuthTries 3
MaxSessions 2
MaxStartups 2:30:5

# Timeouts
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 30

# Seguridad adicional
X11Forwarding no
PermitEmptyPasswords no
PermitUserEnvironment no
StrictModes yes
Protocol 2

# Logging
LogLevel VERBOSE
SyslogFacility AUTH
EOF

# Crear usuario administrativo
sudo useradd -m -s /bin/bash -G sudo admin
echo "admin:AdminParking2024$" | sudo chpasswd

# Configurar fail2ban para SSH
sudo tee /etc/fail2ban/jail.d/sshd.conf << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
ignoreip = 127.0.0.1/8 ::1
EOF

sudo systemctl restart sshd fail2ban
```

#### Configurar VPN para Acceso Remoto (Opcional)
```bash
# Instalar WireGuard para acceso VPN seguro
sudo apt install -y wireguard

# Generar claves
wg genkey | sudo tee /etc/wireguard/private.key
sudo chmod 600 /etc/wireguard/private.key
sudo cat /etc/wireguard/private.key | wg pubkey | sudo tee /etc/wireguard/public.key

# Configuración del servidor (ajustar según red)
sudo tee /etc/wireguard/wg0.conf << 'EOF'
[Interface]
Address = 10.10.10.1/24
ListenPort = 51820
PrivateKey = [PRIVATE_KEY_HERE]

# Reglas de firewall para VPN
PostUp = ufw allow 51820/udp
PostUp = iptables -A FORWARD -i %i -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o ens33 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ens33 -j MASQUERADE

[Peer]
# Configuración del administrador remoto
PublicKey = [ADMIN_PUBLIC_KEY]
AllowedIPs = 10.10.10.2/32
EOF
```

### 12. Procedimientos de Mantenimiento

#### Script de Mantenimiento Diario
```bash
# Crear script de mantenimiento
sudo tee /opt/parking-system/maintenance/daily-maintenance.sh << 'EOF'
#!/bin/bash

LOG_FILE="/var/log/parking-system/maintenance.log"
exec 1>>$LOG_FILE
exec 2>&1

echo "=== Mantenimiento Diario - $(date) ==="

# 1. Verificar servicios
echo "Verificando servicios..."
systemctl is-active parking-backend || systemctl restart parking-backend
systemctl is-active parking-frontend || systemctl restart parking-frontend

# 2. Limpiar logs antiguos
echo "Limpiando logs..."
find /var/log/parking-system -name "*.log" -mtime +30 -delete
journalctl --vacuum-time=30d

# 3. Verificar espacio en disco
echo "Espacio en disco:"
df -h / /opt /var

# 4. Verificar conectividad de hardware
echo "Verificando hardware..."
ping -c 1 192.168.1.100 && echo "Impresora: OK" || echo "Impresora: ERROR"
lsusb | grep -q "Honeywell" && echo "Escáner: OK" || echo "Escáner: ERROR"

# 5. Respaldo incremental
echo "Ejecutando respaldo..."
/opt/parking-system/maintenance/backup-incremental.sh

# 6. Verificar base de datos
sudo -u postgres psql parking_lot -c "SELECT COUNT(*) FROM tickets WHERE created_at < NOW() - INTERVAL '1 year';"

echo "=== Mantenimiento completado ==="
EOF

sudo chmod +x /opt/parking-system/maintenance/daily-maintenance.sh

# Agregar a cron
echo "0 3 * * * root /opt/parking-system/maintenance/daily-maintenance.sh" | sudo tee /etc/cron.d/parking-maintenance
```

#### Script de Respaldo Automático
```bash
# Script de respaldo completo
sudo tee /opt/parking-system/maintenance/backup-full.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/parking-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="parking_backup_$DATE"

# Crear directorio de respaldo
mkdir -p $BACKUP_DIR/$BACKUP_NAME

# 1. Respaldar base de datos
PGPASSWORD=$(cat /opt/parking-db-password) pg_dump \
  -h localhost -U parking_user -d parking_lot \
  -f $BACKUP_DIR/$BACKUP_NAME/database.sql

# 2. Respaldar archivos de configuración
cp -r /opt/parking-system/.env* $BACKUP_DIR/$BACKUP_NAME/
cp -r /opt/parking-system/config $BACKUP_DIR/$BACKUP_NAME/

# 3. Respaldar logs importantes
cp -r /var/log/parking-system $BACKUP_DIR/$BACKUP_NAME/logs

# 4. Comprimir respaldo
cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME
rm -rf $BACKUP_NAME

# 5. Mantener solo últimos 30 días
find $BACKUP_DIR -name "parking_backup_*.tar.gz" -mtime +30 -delete

# 6. Copiar a ubicación remota (si está configurada)
if [ -n "$REMOTE_BACKUP_PATH" ]; then
  rsync -av $BACKUP_NAME.tar.gz $REMOTE_BACKUP_PATH/
fi

echo "Respaldo completado: $BACKUP_NAME.tar.gz"
EOF

sudo chmod +x /opt/parking-system/maintenance/backup-full.sh
```

## PRUEBAS Y VALIDACIÓN

### 13. Pruebas Completas del Sistema

#### Script de Prueba Integral
```bash
# Crear suite de pruebas
sudo tee /opt/parking-system/tests/system-test.sh << 'EOF'
#!/bin/bash

echo "=== PRUEBAS DEL SISTEMA DE ESTACIONAMIENTO ==="

# Variables de prueba
TEST_RESULTS="/tmp/parking-test-results.txt"
ERRORS=0

# Función de prueba
test_component() {
    local name=$1
    local command=$2
    echo -n "Probando $name... "
    if eval $command &>/dev/null; then
        echo "✓ OK"
        echo "$name: PASS" >> $TEST_RESULTS
    else
        echo "✗ ERROR"
        echo "$name: FAIL" >> $TEST_RESULTS
        ((ERRORS++))
    fi
}

# 1. Pruebas de Sistema
test_component "Sistema Operativo" "[ -f /etc/os-release ]"
test_component "Zona Horaria" "[ $(timedatectl show -p Timezone --value) = 'America/Mexico_City' ]"
test_component "Idioma Español" "locale | grep -q es_MX"

# 2. Pruebas de Red
test_component "Conectividad Internet" "ping -c 1 8.8.8.8"
test_component "DNS" "nslookup google.com"
test_component "Firewall Activo" "sudo ufw status | grep -q active"

# 3. Pruebas de Servicios
test_component "PostgreSQL" "systemctl is-active postgresql"
test_component "Backend Parking" "systemctl is-active parking-backend"
test_component "Frontend Parking" "systemctl is-active parking-frontend"
test_component "SSH" "systemctl is-active sshd"

# 4. Pruebas de Hardware
test_component "Impresora Ping" "ping -c 1 192.168.1.100"
test_component "Escáner USB" "lsusb | grep -q Honeywell"

# 5. Pruebas de Aplicación
test_component "API Backend" "curl -s http://localhost:4000/api/health | grep -q ok"
test_component "Frontend Web" "curl -s http://localhost:3001 | grep -q parking"

# 6. Pruebas de Seguridad
test_component "Usuario Operador Sin Sudo" "! groups operador | grep -q sudo"
test_component "SSH Sin Password" "grep -q 'PasswordAuthentication no' /etc/ssh/sshd_config.d/*"

# Resumen
echo ""
echo "=== RESUMEN DE PRUEBAS ==="
echo "Total de pruebas: $(wc -l < $TEST_RESULTS)"
echo "Pruebas exitosas: $(grep -c PASS $TEST_RESULTS)"
echo "Pruebas fallidas: $ERRORS"

if [ $ERRORS -eq 0 ]; then
    echo "✓ TODAS LAS PRUEBAS PASARON"
    exit 0
else
    echo "✗ HAY PRUEBAS QUE FALLARON"
    cat $TEST_RESULTS | grep FAIL
    exit 1
fi
EOF

sudo chmod +x /opt/parking-system/tests/system-test.sh
```

#### Validación de Flujo Completo
```bash
# Script de prueba de flujo operacional
sudo tee /opt/parking-system/tests/operational-flow-test.sh << 'EOF'
#!/bin/bash

echo "=== PRUEBA DE FLUJO OPERACIONAL ==="

# 1. Simular entrada de vehículo
echo "1. Probando registro de entrada..."
curl -X POST http://localhost:4000/api/parking/entry \
  -H "Content-Type: application/json" \
  -d '{"plateNumber": "TEST-123", "operatorId": "test"}'

# 2. Simular escaneo de ticket
echo "2. Probando búsqueda de ticket..."
TICKET_ID="20240101120000TEST123"
curl -X GET http://localhost:4000/api/parking/ticket/$TICKET_ID

# 3. Simular cálculo de pago
echo "3. Probando cálculo de tarifa..."
curl -X POST http://localhost:4000/api/parking/calculate \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "'$TICKET_ID'", "hours": 2}'

# 4. Simular proceso de pago
echo "4. Probando registro de pago..."
curl -X POST http://localhost:4000/api/parking/payment \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "'$TICKET_ID'", "amount": 60, "received": 100}'

# 5. Verificar impresión
echo "5. Probando sistema de impresión..."
/opt/parking-system/tests/test-printer.sh

echo "=== FLUJO OPERACIONAL COMPLETADO ==="
EOF

sudo chmod +x /opt/parking-system/tests/operational-flow-test.sh
```

### 14. Configuración de Capacitación para Operadores

#### Crear Modo de Entrenamiento
```bash
# Configurar base de datos de entrenamiento
sudo -u postgres psql << 'EOF'
CREATE DATABASE parking_training TEMPLATE parking_lot;
GRANT ALL PRIVILEGES ON DATABASE parking_training TO parking_user;
EOF

# Script para activar modo entrenamiento
sudo tee /opt/parking-system/training/enable-training-mode.sh << 'EOF'
#!/bin/bash

echo "Activando modo de entrenamiento..."

# Cambiar a base de datos de entrenamiento
sed -i 's/parking_lot/parking_training/g' /opt/parking-system/.env.production

# Agregar banner de entrenamiento
echo "TRAINING_MODE=true" >> /opt/parking-system/.env.production

# Reiniciar servicios
systemctl restart parking-backend parking-frontend

echo "Modo de entrenamiento activado"
echo "Para desactivar, ejecute: /opt/parking-system/training/disable-training-mode.sh"
EOF

sudo chmod +x /opt/parking-system/training/enable-training-mode.sh
```

#### Materiales de Capacitación en Español
```bash
# Crear guía rápida para operadores
sudo tee /home/operador/Desktop/GUIA_RAPIDA_OPERADOR.txt << 'EOF'
GUÍA RÁPIDA DEL OPERADOR - SISTEMA DE ESTACIONAMIENTO

=== OPERACIONES BÁSICAS ===

1. ENTRADA DE VEHÍCULO
   - Cliente llega a la entrada
   - Presionar botón "NUEVA ENTRADA"
   - Ingresar PLACAS del vehículo
   - Presionar "IMPRIMIR TICKET"
   - Entregar ticket al cliente

2. SALIDA/COBRO
   - Escanear código de barras del ticket
   - Sistema muestra monto a cobrar
   - Recibir pago del cliente
   - Ingresar monto recibido
   - Presionar "PROCESAR PAGO"
   - Sistema imprime recibo
   - Abrir barrera de salida

3. TICKET PERDIDO
   - Presionar "TICKET PERDIDO"
   - Ingresar PLACAS del vehículo
   - Verificar tiempo en sistema
   - Cobrar tarifa de ticket perdido ($300)
   - Procesar pago normal

4. PENSIÓN MENSUAL
   - Presionar "PENSIÓN"
   - Buscar cliente por placas
   - Verificar vigencia
   - Si está vencida, cobrar mensualidad
   - Permitir entrada/salida

=== PROBLEMAS COMUNES ===

IMPRESORA NO IMPRIME:
- Verificar papel
- Verificar cable de red
- Llamar a soporte si persiste

ESCÁNER NO LEE:
- Limpiar lente del escáner
- Verificar conexión USB
- Ingresar código manual

SISTEMA LENTO:
- Esperar 30 segundos
- Si no responde, llamar soporte

=== CONTACTOS DE EMERGENCIA ===

Soporte Técnico: 55-1234-5678
Supervisor: 55-8765-4321
Emergencias: 911

=== HORARIOS ===
Lunes a Viernes: 6:00 AM - 10:00 PM
Sábados: 7:00 AM - 10:00 PM
Domingos: 8:00 AM - 8:00 PM
EOF

# Hacer visible en escritorio
chmod 644 /home/operador/Desktop/GUIA_RAPIDA_OPERADOR.txt
```

## DESPLIEGUE EN PRODUCCIÓN

### 15. Configuración Final de Producción

#### Lista de Verificación Pre-Producción
```bash
# Script de verificación final
sudo tee /opt/parking-system/deploy/pre-production-check.sh << 'EOF'
#!/bin/bash

echo "=== VERIFICACIÓN PRE-PRODUCCIÓN ==="

READY=true

# Verificaciones críticas
checks=(
    "PostgreSQL activo:systemctl is-active postgresql"
    "Backend activo:systemctl is-active parking-backend"
    "Frontend activo:systemctl is-active parking-frontend"
    "Impresora alcanzable:ping -c 1 192.168.1.100"
    "Escáner detectado:lsusb | grep -q Honeywell"
    "Firewall configurado:sudo ufw status | grep -q active"
    "Modo kiosco configurado:[ -f /opt/parking-kiosk-start.sh ]"
    "Respaldos configurados:[ -f /opt/parking-system/maintenance/backup-full.sh ]"
    "SSL/TLS configurado:[ -f /etc/nginx/ssl/parking.crt ]"
    "Monitoreo activo:systemctl is-active prometheus node_exporter"
)

for check in "${checks[@]}"; do
    IFS=':' read -r name command <<< "$check"
    echo -n "Verificando $name... "
    if eval $command &>/dev/null; then
        echo "✓"
    else
        echo "✗"
        READY=false
    fi
done

if $READY; then
    echo ""
    echo "✓ SISTEMA LISTO PARA PRODUCCIÓN"
    echo ""
    echo "Próximos pasos:"
    echo "1. Realizar respaldo completo"
    echo "2. Documentar configuración actual"
    echo "3. Capacitar operadores"
    echo "4. Iniciar período de prueba"
else
    echo ""
    echo "✗ SISTEMA NO ESTÁ LISTO"
    echo "Corrija los problemas antes de continuar"
fi
EOF

sudo chmod +x /opt/parking-system/deploy/pre-production-check.sh
```

### 16. Lista de Verificación Go-Live

#### Checklist Final de Implementación
```bash
# Crear checklist interactivo
sudo tee /opt/parking-system/deploy/go-live-checklist.sh << 'EOF'
#!/bin/bash

echo "=== CHECKLIST GO-LIVE - SISTEMA DE ESTACIONAMIENTO ==="
echo "Responda S/N a cada pregunta"
echo ""

CHECKS_PASSED=0
TOTAL_CHECKS=20

ask_check() {
    local question=$1
    read -p "✓ $question (S/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        ((CHECKS_PASSED++))
        return 0
    else
        return 1
    fi
}

# Hardware
echo "== VERIFICACIÓN DE HARDWARE =="
ask_check "¿ThinkPad instalada en ubicación final?"
ask_check "¿Impresora conectada y probada?"
ask_check "¿Escáner conectado y probado?"
ask_check "¿UPS instalado y configurado?"
ask_check "¿Red cableada estable?"

# Software
echo -e "\n== VERIFICACIÓN DE SOFTWARE =="
ask_check "¿Sistema operativo actualizado?"
ask_check "¿Aplicación de parking instalada?"
ask_check "¿Base de datos inicializada?"
ask_check "¿Modo kiosco funcionando?"
ask_check "¿Servicios automáticos activos?"

# Configuración
echo -e "\n== VERIFICACIÓN DE CONFIGURACIÓN =="
ask_check "¿Tarifas configuradas correctamente?"
ask_check "¿Información del negocio actualizada?"
ask_check "¿Impresión de tickets probada?"
ask_check "¿Respaldos automáticos configurados?"
ask_check "¿Acceso remoto SSH probado?"

# Operacional
echo -e "\n== VERIFICACIÓN OPERACIONAL =="
ask_check "¿Operadores capacitados?"
ask_check "¿Guías de usuario entregadas?"
ask_check "¿Procedimientos de emergencia documentados?"
ask_check "¿Contactos de soporte actualizados?"
ask_check "¿Período de prueba completado?"

# Resumen
echo -e "\n=== RESUMEN ==="
echo "Verificaciones completadas: $CHECKS_PASSED de $TOTAL_CHECKS"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
    echo "✓ SISTEMA LISTO PARA INICIAR OPERACIONES"
    echo ""
    echo "Ejecute: systemctl start parking-kiosk"
else
    echo "✗ Faltan $(($TOTAL_CHECKS - $CHECKS_PASSED)) verificaciones"
    echo "Complete todas las verificaciones antes de iniciar"
fi
EOF

sudo chmod +x /opt/parking-system/deploy/go-live-checklist.sh
```

## SOLUCIÓN DE PROBLEMAS Y SOPORTE

### 17. Resolución de Problemas Comunes

#### Guía de Diagnóstico Rápido
```bash
# Herramienta de diagnóstico
sudo tee /usr/local/bin/parking-diagnostics << 'EOF'
#!/bin/bash

echo "=== DIAGNÓSTICO DEL SISTEMA DE ESTACIONAMIENTO ==="
echo "Fecha: $(date)"
echo ""

# Función para verificar servicio
check_service() {
    local service=$1
    local status=$(systemctl is-active $service 2>/dev/null)
    
    if [ "$status" = "active" ]; then
        echo "✓ $service: Activo"
    else
        echo "✗ $service: $status"
        echo "  Últimas líneas del log:"
        journalctl -u $service -n 5 --no-pager | sed 's/^/  /'
    fi
}

# Verificar servicios críticos
echo "== SERVICIOS =="
check_service "postgresql"
check_service "parking-backend"
check_service "parking-frontend"
check_service "networking"

# Verificar conectividad
echo -e "\n== CONECTIVIDAD =="
echo -n "Internet: "
ping -c 1 8.8.8.8 &>/dev/null && echo "✓ OK" || echo "✗ Sin conexión"

echo -n "Impresora (192.168.1.100): "
ping -c 1 192.168.1.100 &>/dev/null && echo "✓ OK" || echo "✗ No responde"

echo -n "Base de datos: "
sudo -u postgres pg_isready &>/dev/null && echo "✓ OK" || echo "✗ No disponible"

# Verificar hardware
echo -e "\n== HARDWARE =="
echo -n "Escáner USB: "
lsusb | grep -q "Honeywell" && echo "✓ Detectado" || echo "✗ No detectado"

# Espacio en disco
echo -e "\n== ESPACIO EN DISCO =="
df -h / /opt /var | grep -v tmpfs

# Últimos errores
echo -e "\n== ÚLTIMOS ERRORES =="
journalctl -p err -n 10 --no-pager

# Sugerencias
echo -e "\n== ACCIONES SUGERIDAS =="
if ! systemctl is-active parking-backend &>/dev/null; then
    echo "- Reiniciar backend: sudo systemctl restart parking-backend"
fi
if ! ping -c 1 192.168.1.100 &>/dev/null; then
    echo "- Verificar cable de red de la impresora"
    echo "- Verificar que la impresora esté encendida"
fi
if ! lsusb | grep -q "Honeywell"; then
    echo "- Reconectar escáner USB"
    echo "- Probar en otro puerto USB"
fi
EOF

sudo chmod +x /usr/local/bin/parking-diagnostics
```

### 18. Procedimientos de Emergencia

#### Manual de Recuperación de Emergencias
```bash
# Crear procedimientos de emergencia
sudo tee /opt/parking-system/emergency/PROCEDIMIENTOS_EMERGENCIA.md << 'EOF'
# PROCEDIMIENTOS DE EMERGENCIA - SISTEMA DE ESTACIONAMIENTO

## PROBLEMA: Sistema Completamente Bloqueado

### Síntomas:
- Pantalla congelada
- No responde a clicks o teclado
- No se puede acceder a menús

### Solución:
1. Mantener presionado botón de encendido 10 segundos
2. Esperar 30 segundos
3. Encender equipo nuevamente
4. Sistema debe iniciar automáticamente

## PROBLEMA: No Imprime Tickets

### Verificación Rápida:
```bash
ping 192.168.1.100
```

### Soluciones:
1. Verificar papel en impresora
2. Verificar cable de red conectado
3. Apagar y encender impresora
4. En terminal administrativa:
   ```bash
   sudo systemctl restart cups
   /opt/parking-system/tests/test-printer.sh
   ```

## PROBLEMA: Escáner No Lee Códigos

### Verificación:
```bash
lsusb | grep Honeywell
```

### Soluciones:
1. Desconectar y reconectar USB
2. Probar en otro puerto USB
3. Limpiar lente con paño suave
4. Reiniciar sistema si persiste

## PROBLEMA: Sistema Muy Lento

### Diagnóstico:
```bash
htop
df -h
```

### Soluciones:
1. Verificar espacio en disco
2. Reiniciar servicios:
   ```bash
   sudo systemctl restart parking-backend parking-frontend
   ```
3. Limpiar caché del navegador:
   ```bash
   rm -rf /home/operador/.cache/chromium
   ```

## PROBLEMA: No Hay Conexión a Internet

### Verificación:
```bash
ip addr show
ping 8.8.8.8
```

### Soluciones:
1. Verificar cable de red
2. Reiniciar servicio de red:
   ```bash
   sudo systemctl restart networking
   ```
3. Verificar con proveedor de internet

## ACCESO DE EMERGENCIA

### Salir del Modo Kiosco:
1. Ctrl + Alt + F2 (acceder a terminal)
2. Login: admin
3. Password: [Proporcionada por IT]

### Reiniciar Modo Kiosco:
```bash
sudo systemctl restart lightdm
```

## CONTACTOS DE EMERGENCIA

**Soporte Técnico 24/7**: 55-1234-5678
**WhatsApp Soporte**: +52 55 9876 5432
**Email**: soporte@parking-system.mx

**Proveedor Internet**: [Nombre] - Tel: [Número]
**Electricista**: [Nombre] - Tel: [Número]
EOF
```

## DOCUMENTACIÓN Y ENTREGABLES

### 19. Paquete de Documentación Completo

#### Generar Documentación Automática
```bash
# Script para generar toda la documentación
sudo tee /opt/parking-system/docs/generate-all-docs.sh << 'EOF'
#!/bin/bash

DOC_DIR="/opt/parking-system/documentation"
mkdir -p $DOC_DIR/{operator,admin,technical}

echo "Generando documentación completa..."

# 1. Manual del Operador (Español)
cat > $DOC_DIR/operator/MANUAL_OPERADOR.pdf << 'EODOC'
[Aquí iría el contenido del manual del operador en formato PDF]
EODOC

# 2. Guía del Administrador
cat > $DOC_DIR/admin/GUIA_ADMINISTRADOR.md << 'EODOC'
# Guía del Administrador - Sistema de Estacionamiento

## Acceso Remoto
- SSH: ssh admin@[IP_DEL_SISTEMA]
- VPN: Configuración en /etc/wireguard/

## Comandos Útiles
- Ver estado: parking-status
- Diagnóstico: parking-diagnostics
- Respaldo manual: /opt/parking-system/maintenance/backup-full.sh

## Monitoreo
- Logs: /var/log/parking-system/
- Métricas: http://localhost:9090 (Prometheus)
EODOC

# 3. Documentación Técnica
cat > $DOC_DIR/technical/TECHNICAL_SPECS.md << 'EODOC'
# Especificaciones Técnicas

## Stack Tecnológico
- OS: Ubuntu 22.04 LTS
- Runtime: Node.js 20 LTS
- Database: PostgreSQL 14
- Frontend: React/Next.js
- Backend: Express/TypeScript
EODOC

echo "Documentación generada en: $DOC_DIR"
EOF

sudo chmod +x /opt/parking-system/docs/generate-all-docs.sh
```

### 20. Materiales de Soporte

#### Kit de Soporte Completo
```bash
# Crear estructura de soporte
sudo mkdir -p /opt/parking-support/{scripts,docs,tools,backups}

# Herramienta de soporte remoto
sudo tee /opt/parking-support/tools/remote-support.sh << 'EOF'
#!/bin/bash

echo "=== HERRAMIENTA DE SOPORTE REMOTO ==="
echo "1. Generar reporte de sistema"
echo "2. Reiniciar servicios"
echo "3. Ver logs en tiempo real"
echo "4. Ejecutar diagnóstico"
echo "5. Crear respaldo de emergencia"
echo "6. Salir"

read -p "Seleccione opción: " option

case $option in
    1) parking-diagnostics > /tmp/system-report.txt
       echo "Reporte generado en /tmp/system-report.txt";;
    2) sudo systemctl restart parking-backend parking-frontend
       echo "Servicios reiniciados";;
    3) journalctl -f -u parking-backend -u parking-frontend;;
    4) parking-diagnostics;;
    5) /opt/parking-system/maintenance/backup-full.sh;;
    6) exit 0;;
    *) echo "Opción inválida";;
esac
EOF

sudo chmod +x /opt/parking-support/tools/remote-support.sh
```

## CONFIGURACIÓN FINAL Y OPTIMIZACIÓN

### Optimización de Rendimiento
```bash
# Configurar optimizaciones del sistema
sudo tee /etc/sysctl.d/99-parking-performance.conf << 'EOF'
# Optimizaciones de red
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# Optimizaciones de memoria
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Optimizaciones de sistema
kernel.sched_migration_cost_ns = 5000000
kernel.sched_autogroup_enabled = 0
EOF

sudo sysctl -p /etc/sysctl.d/99-parking-performance.conf
```

### Script de Instalación Automatizada
```bash
# Crear instalador maestro
sudo tee /opt/parking-installer.sh << 'EOF'
#!/bin/bash

echo "==================================="
echo "INSTALADOR - SISTEMA ESTACIONAMIENTO"
echo "==================================="
echo ""
echo "Este script instalará completamente el sistema."
echo "Tiempo estimado: 45-60 minutos"
echo ""
read -p "¿Continuar? (S/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

# Ejecutar todos los pasos de instalación
bash ./01-prepare-system.sh
bash ./02-install-dependencies.sh
bash ./03-setup-parking-system.sh
bash ./04-configure-kiosk.sh
bash ./05-security-hardening.sh
bash ./06-setup-maintenance.sh
bash ./07-final-verification.sh

echo ""
echo "=== INSTALACIÓN COMPLETADA ==="
echo "Reinicie el sistema para activar el modo kiosco"
echo "sudo reboot"
EOF

sudo chmod +x /opt/parking-installer.sh
```

---

## RESUMEN DE IMPLEMENTACIÓN

Esta guía proporciona una implementación completa del Sistema de Gestión de Estacionamiento optimizado para México, incluyendo:

1. **Hardware**: Configuración completa de ThinkPad, impresora Epson y escáner Honeywell
2. **Software**: Ubuntu LTS con modo kiosco completamente bloqueado
3. **Seguridad**: Sistema endurecido con acceso remoto seguro
4. **Localización**: Interfaz 100% en español mexicano
5. **Mantenimiento**: Procedimientos automatizados y documentados
6. **Soporte**: Herramientas de diagnóstico y recuperación

El sistema está diseñado para ser altamente confiable, fácil de usar para operadores no técnicos, y con capacidad de administración remota para soporte técnico.

### Contacto de Implementación
Para asistencia durante la implementación:
- Email: soporte@parking-system.mx
- Tel: +52 55 1234 5678
- Horario: Lunes a Viernes 9:00 - 18:00 (Hora de México)

---

*Versión 2.0 - Diciembre 2024*
*Sistema de Gestión de Estacionamiento - Hecho en México*