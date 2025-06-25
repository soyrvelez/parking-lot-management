# 📋 GUÍA COMPLETA: CONFIGURACIÓN DE AMBIENTE DE PRODUCCIÓN

## 🎯 PARA USUARIOS NO TÉCNICOS

Esta guía te ayudará a configurar correctamente el archivo `.env.production` para tu sistema de estacionamiento, incluso si no tienes experiencia técnica.

---

## 📍 ESCENARIO: INSTALACIÓN EN UNA RED, DESPLIEGUE EN OTRA

### ✅ **SI USAS IMPRESORA USB**: ¡No hay problema!
- Puedes instalar en cualquier red y mover el equipo sin cambios
- La impresora USB funciona en cualquier ubicación
- **Recomendado para máxima portabilidad**

### ⚠️ **SI USAS IMPRESORA DE RED**: Necesitas reconfigurar
- Debes conocer las IPs de la red final antes de la instalación
- O actualizar la configuración después del traslado

---

## 🛠️ CONFIGURACIÓN PASO A PASO

### PASO 1: Ubicar el archivo template
```bash
# En tu MacBook, ir al directorio del proyecto
cd /Users/velez/dev/parking-lot-management

# Copiar el template
cp .env.production.template .env.production
```

### PASO 2: Abrir editor de texto
```bash
# Usar cualquier editor de texto (nano, TextEdit, VS Code)
nano .env.production
# O simplemente abrir con TextEdit desde Finder
```

---

## 📝 CÓMO LLENAR CADA VARIABLE

### 🔐 **1. CONFIGURACIÓN DE BASE DE DATOS**

**¿Qué es?** La conexión a donde se guardan todos los datos del estacionamiento.

```bash
# CAMBIAR ESTA LÍNEA:
DATABASE_URL="postgresql://parking_user:CHANGE_THIS_PASSWORD@localhost:5432/parking_lot_prod"

# POR ALGO COMO:
DATABASE_URL="postgresql://parking_user:MiPassword2024!@localhost:5432/parking_lot_prod"
```

**Instrucciones:**
1. Reemplazar `CHANGE_THIS_PASSWORD` con una contraseña segura
2. Usar mínimo 12 caracteres, incluir números y símbolos
3. **Ejemplos de buenas contraseñas**: `Estac2024!Seguro`, `ParkingDB$2024`, `MiClave#Super123`

---

### 🔑 **2. CLAVE SECRETA JWT**

**¿Qué es?** Una clave para proteger la seguridad del sistema.

```bash
# CAMBIAR ESTA LÍNEA:
JWT_SECRET="GENERATE_SECURE_RANDOM_JWT_SECRET_HERE"

# GENERAR UNA NUEVA CLAVE:
```

**Instrucciones:**
1. En tu MacBook, abrir Terminal
2. Ejecutar: `openssl rand -hex 32`
3. Copiar el resultado (se ve así: `a1b2c3d4e5f6789012345678901234567890abcdef`)
4. Pegar en el archivo reemplazando `GENERATE_SECURE_RANDOM_JWT_SECRET_HERE`

**Ejemplo final:**
```bash
JWT_SECRET="a1b2c3d4e5f6789012345678901234567890abcdef1234567890"
```

---

### 🖨️ **3. CONFIGURACIÓN DE IMPRESORA**

#### **OPCIÓN A: IMPRESORA USB (RECOMENDADO)**

**¿Cuándo usar?** Si conectas la impresora directamente al ThinkPad con cable USB.

```bash
# USAR ESTAS LÍNEAS:
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# COMENTAR (agregar # al inicio) ESTAS LÍNEAS:
# PRINTER_INTERFACE_TYPE="network" 
# PRINTER_HOST="192.168.1.100"
# PRINTER_PORT=9100
```

**✅ VENTAJAS USB:**
- Funciona en cualquier red
- No necesitas conocer IPs
- Fácil de instalar y mover

#### **OPCIÓN B: IMPRESORA DE RED**

**¿Cuándo usar?** Si la impresora está conectada por cable Ethernet a la red.

**NECESITAS SABER:**
- La IP que tendrá la impresora en la red final
- Coordinar con el administrador de la red

```bash
# COMENTAR (agregar # al inicio) ESTAS LÍNEAS:
# PRINTER_INTERFACE_TYPE="usb"
# PRINTER_DEVICE_PATH="/dev/usb/lp0"

# USAR ESTAS LÍNEAS:
PRINTER_INTERFACE_TYPE="network" 
PRINTER_HOST="192.168.1.100"  # ← CAMBIAR por la IP real
PRINTER_PORT=9100
```

**Cómo conseguir la IP de la impresora:**
1. Preguntar al administrador de red del lugar final
2. O usar la pantalla de la impresora: Menú → Configuración → Red → IP
3. **Ejemplo de IPs comunes**: `192.168.1.100`, `10.0.0.50`, `172.16.1.20`

---

### 🌐 **4. CONFIGURACIÓN DE RED DEL THINKPAD**

**¿Qué necesitas?** La IP que tendrá el ThinkPad en la red final.

```bash
# CAMBIAR ESTAS LÍNEAS:
CORS_ORIGIN="http://192.168.1.50"
FRONTEND_URL="http://192.168.1.50"

# POR LA IP REAL DEL THINKPAD:
CORS_ORIGIN="http://10.0.0.25"      # ← Ejemplo
FRONTEND_URL="http://10.0.0.25"     # ← Mismo IP
```

**Cómo conseguir la IP del ThinkPad:**
1. Preguntar al administrador de red
2. O planificar: "Quiero que el ThinkPad tenga la IP X.X.X.X"
3. **Si no sabes**, usar `192.168.1.50` (funciona en muchas redes)

---

### 💰 **5. CONFIGURACIÓN FINANCIERA**

**¿Qué cambiar?** Los precios y límites de tu estacionamiento.

```bash
# CONFIGURAR SEGÚN TUS TARIFAS:
MAX_BILL_VALUE=500              # ← Billete más grande que aceptas
LOST_TICKET_FEE=100.00         # ← Tarifa por boleto perdido
GRACE_PERIOD_MINUTES=15        # ← Minutos gratis al entrar
```

**Ejemplos por ciudad:**
- **CDMX**: `MAX_BILL_VALUE=500`, `LOST_TICKET_FEE=150`
- **Guadalajara**: `MAX_BILL_VALUE=500`, `LOST_TICKET_FEE=100`
- **Monterrey**: `MAX_BILL_VALUE=500`, `LOST_TICKET_FEE=200`

---

## 📋 EJEMPLO COMPLETO PARA USUARIO NO TÉCNICO

### **ESCENARIO**: Estacionamiento en plaza comercial, usando impresora USB

```bash
# Base de datos
DATABASE_URL="postgresql://parking_user:PlazaSur2024!@localhost:5432/parking_lot_prod"

# Seguridad
JWT_SECRET="f4e3d2c1b0a9876543210fedcba9876543210abcdef0123456789"

# Aplicación
NODE_ENV="production"
API_PORT=4000
FRONTEND_PORT=3000

# Impresora USB (fácil, funciona en cualquier red)
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"

# Red (IP que asignará el administrador de la plaza)
CORS_ORIGIN="http://192.168.100.50"
FRONTEND_URL="http://192.168.100.50"

# Tarifas
MAX_BILL_VALUE=500
LOST_TICKET_FEE=120.00
GRACE_PERIOD_MINUTES=15
```

---

## 🚚 PROCESO DE TRASLADO A UBICACIÓN FINAL

### **CON IMPRESORA USB (FÁCIL)**

1. ✅ **Instalar en red de desarrollo/oficina**
2. ✅ **Probar todo funcionando**
3. ✅ **Trasladar ThinkPad a ubicación final**
4. ✅ **Conectar a nueva red**
5. ✅ **Actualizar solo las IPs de red si es necesario**

### **CON IMPRESORA DE RED (REQUIERE PLANIFICACIÓN)**

1. 📋 **Conseguir IPs de la red final ANTES de instalar**
2. ⚙️ **Configurar .env.production con IPs finales**
3. 🏗️ **Instalar sistema**
4. 🚚 **Trasladar equipment**
5. 🔌 **Conectar y verificar IPs coinciden**

---

## 🆘 COMANDOS DE EMERGENCIA PARA CAMBIO DE RED

### **SI NECESITAS CAMBIAR IPs DESPUÉS DEL TRASLADO:**

```bash
# 1. Conectar por SSH al ThinkPad
ssh parking@[IP_ACTUAL_THINKPAD]

# 2. Editar configuración
sudo nano /opt/parking-system/.env

# 3. Cambiar estas líneas:
CORS_ORIGIN="http://[NUEVA_IP_THINKPAD]"
FRONTEND_URL="http://[NUEVA_IP_THINKPAD]"
PRINTER_HOST="[NUEVA_IP_IMPRESORA]"  # Solo si usa red

# 4. Reiniciar sistema
sudo systemctl restart parking-system

# 5. Verificar funcionamiento
curl http://[NUEVA_IP_THINKPAD]/health
```

---

## ✅ LISTA DE VERIFICACIÓN FINAL

**Antes de la instalación:**
- [ ] Contraseña de base de datos cambiada
- [ ] JWT secret generado con `openssl rand -hex 32`
- [ ] Tipo de impresora elegido (USB recomendado)
- [ ] IPs de red final confirmadas (si usando red)
- [ ] Tarifas configuradas correctamente

**Si cambias de red después:**
- [ ] Actualizar CORS_ORIGIN con nueva IP del ThinkPad
- [ ] Actualizar FRONTEND_URL con nueva IP del ThinkPad
- [ ] Actualizar PRINTER_HOST si usas impresora de red
- [ ] Reiniciar servicio: `sudo systemctl restart parking-system`
- [ ] Probar: `curl http://[NUEVA_IP]/health`

---

## 📞 CONTACTO DE SOPORTE

**Si tienes problemas:**
1. Revisar este documento paso a paso
2. Verificar que todas las IPs sean correctas
3. Contactar soporte técnico con el mensaje de error específico

**Logs para compartir con soporte:**
```bash
# Ver errores recientes
sudo journalctl -u parking-system --lines 50
```