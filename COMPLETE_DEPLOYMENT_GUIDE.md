# 🚀 GUÍA COMPLETA DE INSTALACIÓN - SISTEMA DE ESTACIONAMIENTO

## 📖 PARA USUARIOS NO TÉCNICOS

Esta guía te llevará paso a paso desde cero hasta tener tu sistema de estacionamiento funcionando completamente. **No necesitas conocimientos técnicos** - solo sigue cada paso en orden.

---

## 🎯 LO QUE VAS A LOGRAR

Al finalizar esta guía tendrás:
- ✅ Sistema de estacionamiento funcionando en ThinkPad
- ✅ Impresora térmica imprimiendo boletos
- ✅ Scanner de códigos de barras funcionando
- ✅ Sistema de pensiones corregido (cobra correctamente por meses)
- ✅ Interfaz web para el operador
- ✅ Acceso remoto desde tu MacBook para soporte

---

## 📋 ANTES DE EMPEZAR

### ✅ **EQUIPO NECESARIO**

**ThinkPad (donde se instalará el sistema):**
- [ ] Lenovo ThinkPad T480 o superior
- [ ] Mínimo 8GB de RAM
- [ ] Mínimo 256GB de espacio en disco
- [ ] Ubuntu 20.04 LTS o superior instalado
- [ ] Conexión a internet

**Impresora Térmica:**
- [ ] Epson TM-T20III
- [ ] Papel térmico 58mm instalado
- [ ] Cable USB O Cable Ethernet (recomendado: USB)

**Scanner de Códigos:**
- [ ] Honeywell Voyager 1250g
- [ ] Cable USB conectado

**Tu MacBook (para instalación remota):**
- [ ] Conexión a internet
- [ ] Acceso SSH al ThinkPad

### 🌐 **INFORMACIÓN DE RED**

**ESCOGE UNA OPCIÓN:**

**Opción A: Impresora USB (RECOMENDADO - MÁS FÁCIL)**
- ✅ Funciona en cualquier red
- ✅ Puedes instalar en oficina y mover a ubicación final
- ✅ No necesitas configurar IPs de impresora
- 📋 Solo necesitas: IP que tendrá el ThinkPad en ubicación final

**Opción B: Impresora de Red**
- ⚠️ Requiere planificación de red
- 📋 Necesitas: IP del ThinkPad e IP de la impresora en ubicación final
- 🔧 Más configuración pero puede ser mejor para algunas instalaciones

---

# 📅 CRONOLOGÍA COMPLETA DE INSTALACIÓN

## 🔧 FASE 1: PREPARACIÓN INICIAL (30 minutos)

### **Paso 1.1: Configurar acceso SSH desde tu MacBook**

```bash
# En tu MacBook - abrir Terminal
# 1. Generar clave SSH (si no tienes una)
ssh-keygen -t ed25519 -C "estacionamiento@tuempresa.com"

# 2. Presionar ENTER 3 veces (acepta valores por defecto)

# 3. Copiar clave al ThinkPad (reemplazar IP_THINKPAD)
ssh-copy-id administrador@IP_THINKPAD

# 4. Probar conexión
ssh administrador@IP_THINKPAD "whoami"
# Debe responder: administrador
```

**🔍 ¿Cómo conseguir IP_THINKPAD?**
- En el ThinkPad: abrir terminal y escribir `ip addr show`
- Buscar línea que dice `inet 192.168.X.X` (esa es tu IP)
- **Ejemplo**: `192.168.1.45`, `10.0.0.25`, etc.

### **Paso 1.2: Descargar código en ThinkPad**

```bash
# Conectar al ThinkPad desde MacBook
ssh administrador@IP_THINKPAD

# Una vez conectado, ejecutar en ThinkPad:
# 1. Instalar git si no está
sudo apt update && sudo apt install -y git

# 2. Crear directorio y descargar código
mkdir -p /home/administrador/deployments
cd /home/administrador/deployments

# 3. Clonar repositorio (reemplazar con tu URL real)
git clone https://github.com/TU_USUARIO/parking-lot-management.git

# 4. Verificar descarga
cd parking-lot-management
ls -la
# Debes ver carpetas: src/, scripts/, etc.

# 5. Dar permisos a scripts
chmod +x scripts/*.sh
find scripts/ -name "*.sh" -exec chmod +x {} \;

# 6. Cerrar conexión SSH
exit
```

---

## ⚙️ FASE 2: CONFIGURACIÓN DE AMBIENTE (45 minutos)

### **Paso 2.1: Crear archivo de configuración**

```bash
# En tu MacBook - ir al proyecto
cd /Users/velez/dev/parking-lot-management

# Crear archivo de configuración desde template
cp .env.production.template .env.production

# Abrir para editar (puedes usar cualquier editor)
open .env.production
# O usar: nano .env.production
```

### **Paso 2.2: Llenar configuración paso a paso**

**📄 Abrir el archivo `.env.production` y cambiar:**

#### **🔐 SEGURIDAD (OBLIGATORIO CAMBIAR)**

```bash
# 1. CONTRASEÑA DE BASE DE DATOS
# CAMBIAR ESTA LÍNEA:
DATABASE_URL="postgresql://parking_user:CHANGE_THIS_PASSWORD@localhost:5432/parking_lot_prod"

# POR ALGO COMO:
DATABASE_URL="postgresql://parking_user:MiEstacionamiento2024!@localhost:5432/parking_lot_prod"
```

**💡 Consejos para contraseña segura:**
- Mínimo 12 caracteres
- Incluir mayúsculas, minúsculas, números y símbolos
- **Ejemplos**: `Estac2024!Seguro`, `ParkingDB$2024`, `MiClave#Super123`

```bash
# 2. CLAVE SECRETA JWT
# En MacBook Terminal, generar clave aleatoria:
openssl rand -hex 32

# Copiar el resultado (se ve así: a1b2c3d4e5f6789012345678...)
# CAMBIAR ESTA LÍNEA:
JWT_SECRET="GENERATE_SECURE_RANDOM_JWT_SECRET_HERE"

# POR EL RESULTADO DEL COMANDO:
JWT_SECRET="a1b2c3d4e5f6789012345678901234567890abcdef1234567890"
```

#### **🖨️ CONFIGURACIÓN DE IMPRESORA**

**Opción A: USB (Recomendado)**
```bash
# USAR ESTAS LÍNEAS:
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# COMENTAR (agregar # al inicio) ESTAS LÍNEAS:
# PRINTER_INTERFACE_TYPE="network" 
# PRINTER_HOST="192.168.1.100"
# PRINTER_PORT=9100
```

**Opción B: Red**
```bash
# COMENTAR (agregar # al inicio) ESTAS LÍNEAS:
# PRINTER_INTERFACE_TYPE="usb"
# PRINTER_DEVICE_PATH="/dev/usb/lp0"

# USAR ESTAS LÍNEAS (cambiar IP por la real):
PRINTER_INTERFACE_TYPE="network" 
PRINTER_HOST="192.168.1.100"  # ← Cambiar por IP real de impresora
PRINTER_PORT=9100
```

#### **🌐 CONFIGURACIÓN DE RED**

```bash
# CAMBIAR ESTAS LÍNEAS con la IP que tendrá el ThinkPad:
CORS_ORIGIN="http://192.168.1.50"    # ← IP del ThinkPad
FRONTEND_URL="http://192.168.1.50"   # ← Misma IP del ThinkPad
```

**🔍 ¿Qué IP usar?**
- Si instalas y usas en la misma red: usar IP actual del ThinkPad
- Si instalas en oficina y moverás a otro lugar: usar IP que tendrá en ubicación final
- Si no sabes: usar `192.168.1.50` (funciona en muchas redes)

#### **💰 CONFIGURACIÓN DE TARIFAS**

```bash
# Ajustar según tu negocio:
MAX_BILL_VALUE=500              # Billete más grande que aceptas
LOST_TICKET_FEE=100.00         # Tarifa por boleto perdido
GRACE_PERIOD_MINUTES=15        # Minutos gratis al entrar
```

**Ejemplos por ciudad:**
- **CDMX**: `LOST_TICKET_FEE=150.00`
- **Guadalajara**: `LOST_TICKET_FEE=100.00`
- **Monterrey**: `LOST_TICKET_FEE=200.00`

### **Paso 2.3: Verificar archivo final**

**Tu archivo `.env.production` debe verse así:**

```bash
# Ejemplo de configuración completa
DATABASE_URL="postgresql://parking_user:MiEstacionamiento2024!@localhost:5432/parking_lot_prod"
JWT_SECRET="f4e3d2c1b0a9876543210fedcba9876543210abcdef0123456789"
NODE_ENV="production"
API_PORT=4000
FRONTEND_PORT=3000

# Impresora USB (recomendado)
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# Red del ThinkPad
CORS_ORIGIN="http://192.168.1.50"
FRONTEND_URL="http://192.168.1.50"

# Tarifas
MAX_BILL_VALUE=500
LOST_TICKET_FEE=100.00
GRACE_PERIOD_MINUTES=15
```

### **Paso 2.4: Enviar configuración al ThinkPad**

```bash
# Desde MacBook - copiar archivo al ThinkPad
scp .env.production administrador@IP_THINKPAD:/home/administrador/deployments/parking-lot-management/.env

# Verificar que se copió
ssh administrador@IP_THINKPAD "ls -la /home/administrador/deployments/parking-lot-management/.env"
```

---

## 🏗️ FASE 3: INSTALACIÓN DEL SISTEMA (90-120 minutos)

### **Paso 3.1: Preparar sesión de instalación**

```bash
# Conectar al ThinkPad con screen para sesión persistente
ssh administrador@IP_THINKPAD

# Instalar screen para mantener sesión activa
sudo apt install -y screen

# Crear sesión persistente
screen -S instalacion

# Navegar al directorio del proyecto
cd /home/administrador/deployments/parking-lot-management
```

### **Paso 3.2: Ejecutar instalación**

```bash
# Verificar que estás en el directorio correcto
pwd
# Debe mostrar: /home/administrador/deployments/parking-lot-management

# Ejecutar instalación completa
sudo ./scripts/install-all.sh production
```

**⏱️ DURANTE LA INSTALACIÓN (90-120 minutos):**

La instalación progresará por 10 fases:
1. **setup-system** - Configurar Ubuntu (15 min)
2. **setup-database** - Instalar PostgreSQL (15 min)
3. **setup-kiosk** - Configurar modo kiosko (10 min)
4. **setup-printer** - Configurar impresora (10 min)
5. **setup-scanner** - Configurar scanner (5 min)
6. **harden-system** - Seguridad del sistema (10 min)
7. **setup-remote-admin** - Acceso remoto (5 min)
8. **deploy-parking-system** - Instalar aplicación (20 min)
9. **setup-systemd-services** - Configurar servicios (10 min)
10. **setup-backups** - Configurar respaldos (5 min)

**💡 Consejos durante instalación:**
- Puedes cerrar Terminal de MacBook, la instalación seguirá
- Para reconectar: `ssh administrador@IP_THINKPAD` luego `screen -r instalacion`
- Si hay errores, el script te dirá cómo continuar

### **Paso 3.3: Si la instalación falla**

```bash
# Si hay un error en alguna fase, puedes continuar desde donde falló
sudo ./scripts/install-all.sh --continue-from NOMBRE_FASE

# Ejemplo: si falló en deploy-parking-system
sudo ./scripts/install-all.sh --continue-from deploy-parking-system

# Ver ayuda con todas las fases disponibles
sudo ./scripts/install-all.sh --help
```

### **Paso 3.4: Verificar instalación exitosa**

```bash
# Al final debes ver:
# "=== INSTALACIÓN COMPLETA FINALIZADA EXITOSAMENTE ==="

# Verificar servicios funcionando
sudo systemctl status parking-system
sudo systemctl status postgresql
sudo systemctl status nginx

# Salir de screen
# Presionar: Ctrl + A, luego D

# Cerrar SSH
exit
```

---

## 🧪 FASE 4: PRUEBAS Y VERIFICACIÓN (30 minutos)

### **Paso 4.1: Probar acceso web**

```bash
# Desde MacBook - probar que el sistema responde
curl -I http://IP_THINKPAD/health

# Debe responder: HTTP/1.1 200 OK

# Abrir en navegador
open http://IP_THINKPAD
```

### **Paso 4.2: Verificar script automatizado**

```bash
# Ejecutar verificación completa
ssh administrador@IP_THINKPAD "/home/administrador/deployments/parking-lot-management/scripts/verify-deployment.sh"

# Debe mostrar resultados de todas las verificaciones
```

### **Paso 4.3: Probar flujo completo**

**🎫 Prueba de entrada de vehículo:**
1. Abrir `http://IP_THINKPAD` en navegador
2. Hacer clic en "ENTRADA"
3. Ingresar placa: "TEST-001"
4. Hacer clic en "GENERAR BOLETO"
5. ✅ Debe crear boleto e imprimir (si impresora conectada)

**💰 Prueba de sistema de pensiones (CRÍTICO):**
1. Hacer clic en "PENSIÓN"
2. Llenar datos:
   - Nombre: "Cliente Prueba"
   - Placa: "PENS-001"
   - Duración: **3 meses**
3. ✅ **VERIFICAR**: Debe mostrar total **$2,400 MXN** (3 × $800)
4. Hacer clic en "PROCESAR PAGO"
5. ✅ **VERIFICAR**: Pantalla de pago NO se cierra automáticamente
6. Ingresar $2,400 MXN
7. ✅ **VERIFICAR**: Pago se procesa sin errores
8. ✅ **VERIFICAR**: Cliente queda activo por 3 meses

**🔍 Prueba de boleto perdido:**
1. Hacer clic en "BOLETO PERDIDO"
2. ✅ Verificar tarifa correcta (según configuración)
3. Procesar pago de prueba

---

## 🔧 FASE 5: CONFIGURACIÓN DE HARDWARE (20 minutos)

### **Paso 5.1: Verificar impresora**

**Si usas USB:**
```bash
# Conectar impresora con cable USB al ThinkPad
# Verificar que se detecta
ssh administrador@IP_THINKPAD "lsusb | grep -i epson"

# Probar impresión
ssh administrador@IP_THINKPAD "echo 'PRUEBA DE IMPRESORA' > /dev/usb/lp0"
```

**Si usas Red:**
```bash
# Verificar conectividad de impresora
ssh administrador@IP_THINKPAD "ping -c 3 IP_IMPRESORA"

# Probar puerto de impresión
ssh administrador@IP_THINKPAD "nc -zv IP_IMPRESORA 9100"

# Probar impresión
ssh administrador@IP_THINKPAD "echo 'PRUEBA DE IMPRESORA' | nc IP_IMPRESORA 9100"
```

### **Paso 5.2: Verificar scanner**

```bash
# Conectar scanner con cable USB al ThinkPad
# Verificar que se detecta
ssh administrador@IP_THINKPAD "lsusb | grep -i honeywell"

# Probar scanner:
# 1. Abrir aplicación web
# 2. En cualquier campo de texto, escanear un código de barras
# 3. Debe aparecer el texto del código automáticamente
```

---

## 🚚 FASE 6: TRASLADO A UBICACIÓN FINAL (si aplica)

### **Si instalaste en oficina y vas a mover a ubicación final:**

#### **Con impresora USB (fácil):**
1. ✅ Apagar ThinkPad
2. ✅ Trasladar todo el equipo
3. ✅ Conectar a nueva red
4. ✅ Encender ThinkPad
5. ✅ Si IP cambió, actualizar configuración:

```bash
# Conectar al ThinkPad con nueva IP
ssh administrador@NUEVA_IP_THINKPAD

# Editar configuración
sudo nano /opt/parking-system/.env

# Cambiar estas líneas:
CORS_ORIGIN="http://NUEVA_IP_THINKPAD"
FRONTEND_URL="http://NUEVA_IP_THINKPAD"

# Guardar archivo (Ctrl+X, Y, Enter)

# Reiniciar sistema
sudo systemctl restart parking-system

# Verificar funcionamiento
curl http://NUEVA_IP_THINKPAD/health
```

#### **Con impresora de red (requiere más pasos):**
```bash
# Además de los pasos anteriores, también cambiar:
PRINTER_HOST="NUEVA_IP_IMPRESORA"

# Reiniciar y verificar impresión
sudo systemctl restart parking-system
echo "PRUEBA NUEVA RED" | nc NUEVA_IP_IMPRESORA 9100
```

---

## 👨‍💼 FASE 7: CAPACITACIÓN DEL OPERADOR (30 minutos)

### **Paso 7.1: Flujos básicos**

**🚗 Entrada de vehículo:**
1. Pantalla principal → "ENTRADA"
2. Escribir placa del vehículo
3. "GENERAR BOLETO"
4. Entregar boleto impreso al cliente

**🚗 Salida y pago:**
1. Escanear código del boleto con scanner
2. Sistema calcula tarifa automáticamente
3. Cliente paga → ingresar monto recibido
4. Sistema calcula cambio
5. Entregar recibo y cambio

**🏢 Registro de pensión:**
1. "PENSIÓN" → "NUEVO CLIENTE"
2. Llenar datos del cliente
3. **IMPORTANTE**: Seleccionar duración en meses
4. **VERIFICAR**: Monto total es correcto (meses × tarifa)
5. "PROCESAR PAGO"
6. Cobrar monto completo
7. Entregar recibo con vigencia

**🎫 Boleto perdido:**
1. "BOLETO PERDIDO"
2. Cobrar tarifa especial
3. Entregar recibo

### **Paso 7.2: Procedimientos de emergencia**

**Si falla el sistema:**
1. Anotar todas las placas y pagos en papel
2. Llamar a soporte técnico
3. Reiniciar sistema: "Ctrl + Alt + Del"

**Si falla la impresora:**
1. Verificar papel térmico
2. Verificar conexión USB/Ethernet
3. Escribir boletos a mano temporalmente

**Contacto de soporte:**
- SSH desde MacBook: `ssh administrador@IP_THINKPAD`
- Reiniciar servicio: `sudo systemctl restart parking-system`
- Ver errores: `sudo journalctl -u parking-system --lines 20`

---

## 📊 FASE 8: MONITOREO Y MANTENIMIENTO

### **Paso 8.1: Verificaciones diarias**

**Cada mañana verificar:**
```bash
# Desde MacBook - verificar que todo funciona
curl http://IP_THINKPAD/health

# Ver estado de servicios
ssh administrador@IP_THINKPAD "sudo systemctl status parking-system"

# Ver espacio en disco
ssh administrador@IP_THINKPAD "df -h"
```

### **Paso 8.2: Respaldos automáticos**

```bash
# Verificar que respaldos funcionan
ssh administrador@IP_THINKPAD "ls -la /var/backups/parking/"

# Ejecutar respaldo manual
ssh administrador@IP_THINKPAD "sudo /opt/parking-backup.sh"
```

### **Paso 8.3: Comandos útiles de soporte**

```bash
# Reiniciar sistema completo
ssh administrador@IP_THINKPAD "sudo reboot"

# Reiniciar solo aplicación
ssh administrador@IP_THINKPAD "sudo systemctl restart parking-system"

# Ver logs de errores
ssh administrador@IP_THINKPAD "sudo journalctl -u parking-system -f"

# Ver uso de memoria
ssh administrador@IP_THINKPAD "free -h"

# Ver procesos de la aplicación
ssh administrador@IP_THINKPAD "ps aux | grep parking"
```

---

## ✅ LISTA DE VERIFICACIÓN FINAL

### **Sistema funcionando:**
- [ ] Aplicación web accesible en `http://IP_THINKPAD`
- [ ] Entrada de vehículo funciona
- [ ] Impresión de boletos funciona
- [ ] Scanner lee códigos de barras
- [ ] **Sistema de pensiones cobra correctamente por duración**
- [ ] Boleto perdido funciona
- [ ] Acceso SSH desde MacBook funciona

### **Configuración completada:**
- [ ] Archivo `.env.production` configurado correctamente
- [ ] Contraseña de base de datos segura establecida
- [ ] JWT secret generado y configurado
- [ ] Impresora configurada (USB o Red)
- [ ] IPs de red correctas
- [ ] Tarifas configuradas según negocio

### **Hardware verificado:**
- [ ] ThinkPad funcionando estable
- [ ] Impresora térmica imprimiendo correctamente
- [ ] Scanner leyendo códigos automáticamente
- [ ] Red estable y accesible

### **Documentación y soporte:**
- [ ] Operador capacitado en flujos básicos
- [ ] Contactos de soporte documentados
- [ ] Procedimientos de emergencia explicados
- [ ] Acceso remoto configurado y probado

---

## 📞 SOPORTE TÉCNICO

### **Para problemas comunes:**
1. **Sistema no responde**: Reiniciar con `sudo systemctl restart parking-system`
2. **Impresora no funciona**: Verificar cables y ejecutar `lsusb`
3. **Scanner no lee**: Verificar conexión USB y probar en cualquier campo de texto
4. **Pensiones cobran mal**: Sistema ya corregido, debe cobrar monto × duración

### **Para emergencias:**
- Acceso remoto: `ssh administrador@IP_THINKPAD`
- Logs de error: `sudo journalctl -u parking-system --lines 50`
- Reinicio completo: `sudo reboot`

### **Archivos importantes:**
- Configuración: `/opt/parking-system/.env`
- Logs: `/var/log/parking-system/`
- Respaldos: `/var/backups/parking/`
- Scripts: `/home/administrador/deployments/parking-lot-management/scripts/`

---

## 🎉 ¡FELICITACIONES!

Tu sistema de estacionamiento está completamente instalado y funcionando. El operador puede comenzar a usar el sistema inmediatamente.

**Características instaladas:**
✅ Sistema corregido de pensiones (cobra correctamente por duración)  
✅ Interfaz simple para operador  
✅ Impresión automática de boletos  
✅ Scanner de códigos de barras  
✅ Cálculo automático de tarifas  
✅ Sistema de respaldos  
✅ Acceso remoto para soporte  
✅ Modo kiosko seguro  

**¡Tu estacionamiento está listo para operar!** 🚗💰