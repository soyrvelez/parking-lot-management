# Guía de Configuración de Variables de Entorno (.env)

## Descripción General
Este archivo contiene la configuración principal del Sistema de Gestión de Estacionamiento. Las variables de entorno permiten personalizar el comportamiento del sistema sin modificar el código fuente.

## ⚠️ IMPORTANTE
- **NO BORRAR** ninguna línea de este archivo
- Solo cambiar los **valores** después del signo `=`
- **NO CAMBIAR** los nombres de las variables (antes del `=`)
- Reiniciar el sistema después de hacer cambios

---

## 📊 CONFIGURACIÓN DE BASE DE DATOS

### `DATABASE_URL`
**Qué hace:** Conecta el sistema con la base de datos donde se guardan todos los datos.
**Formato:** `"postgresql://usuario:contraseña@servidor:puerto/nombre_base"`
**Ejemplo producción:** `"postgresql://parking_user:MiContraseña123@localhost:5432/parking_lot"`
**❌ NO CAMBIAR** en instalación normal

### `DATABASE_URL_PRODUCTION` 
**Qué hace:** Configuración alternativa para servidor remoto (si aplica).
**❌ NO CAMBIAR** en instalación normal

---

## 🔐 CONFIGURACIÓN DE SEGURIDAD

### `JWT_SECRET`
**Qué hace:** Clave secreta para proteger las sesiones de los usuarios.
**Valor recomendado:** Una cadena aleatoria de al menos 32 caracteres
**Ejemplo:** `"mi-clave-super-secreta-del-estacionamiento-2024"`
**⚠️ CAMBIAR** en producción por seguridad

### `JWT_EXPIRES_IN`
**Qué hace:** Tiempo antes de que expire una sesión de usuario.
**Valores disponibles:** 
- `"1h"` = 1 hora
- `"8h"` = 8 horas  
- `"24h"` = 24 horas
**Recomendado:** `"8h"` para operadores

---

## 💰 CONFIGURACIÓN FINANCIERA

### `CURRENCY`
**Qué hace:** Moneda utilizada en todo el sistema.
**Valor:** `"MXN"` (Pesos Mexicanos)
**❌ NO CAMBIAR**

### `MAX_TRANSACTION_AMOUNT`
**Qué hace:** Monto máximo permitido por transacción.
**Formato:** Número decimal (sin símbolos)
**Ejemplo:** `"999999.99"` = $999,999.99 pesos máximo
**🔧 CAMBIAR** si necesita manejar montos más grandes

### `MIN_TRANSACTION_AMOUNT`
**Qué hace:** Monto mínimo permitido por transacción.
**Valor recomendado:** `"0.01"` = 1 centavo mínimo
**❌ NO CAMBIAR** normalmente

---

## 🖨️ CONFIGURACIÓN DE IMPRESORA

### `PRINTER_INTERFACE_TYPE`
**Qué hace:** Tipo de conexión de la impresora.
**Valores disponibles:**
- `"tcp"` = Conexión por red/Ethernet (RECOMENDADO)
- `"usb"` = Conexión USB directa
**Cambiar a:** `"tcp"` para impresora Epson TM-T20III

### `PRINTER_HOST` (Solo si PRINTER_INTERFACE_TYPE=tcp)
**Qué hace:** Dirección IP de la impresora en la red.
**Valor predeterminado:** `"192.168.1.100"`
**🔧 CAMBIAR** si su impresora tiene IP diferente
**📍 Cómo encontrar IP:** Imprimir página de configuración de la impresora

### `PRINTER_PORT` (Solo si PRINTER_INTERFACE_TYPE=tcp)
**Qué hace:** Puerto de comunicación con la impresora.
**Valor:** `9100` (estándar para Epson)
**❌ NO CAMBIAR**

### `PRINTER_DEVICE_PATH` (Solo si PRINTER_INTERFACE_TYPE=usb)
**Qué hace:** Ruta del dispositivo USB de la impresora.
**Valores comunes:**
- `"/dev/usb/lp0"`
- `"/dev/lp0"`
- `"/dev/ttyUSB0"`
**🔧 CAMBIAR** solo si conexión USB no funciona

### `PRINTER_TIMEOUT`
**Qué hace:** Tiempo de espera para la impresora (en milisegundos).
**Valor:** `5000` = 5 segundos
**🔧 AUMENTAR** si impresora es lenta: `10000` = 10 segundos

### `PRINTER_PAPER_WIDTH`
**Qué hace:** Ancho del papel térmico en caracteres.
**Valor:** `32` (para papel de 80mm)
**❌ NO CAMBIAR** con papel estándar

---

## 🌐 CONFIGURACIÓN DE APLICACIÓN

### `NODE_ENV`
**Qué hace:** Ambiente de ejecución del sistema.
**Valores:**
- `"production"` = Producción (RECOMENDADO para kiosco)
- `"development"` = Desarrollo
**Usar:** `"production"` en ThinkPad

### `API_PORT`
**Qué hace:** Puerto donde funciona el servidor interno.
**Valor:** `4000`
**❌ NO CAMBIAR**

### `FRONTEND_PORT`
**Qué hace:** Puerto donde funciona la interfaz web.
**Valor:** `3001`
**❌ NO CAMBIAR**

### `LOG_LEVEL`
**Qué hace:** Nivel de detalle en los registros del sistema.
**Valores disponibles:**
- `"error"` = Solo errores
- `"warn"` = Errores y advertencias
- `"info"` = Información general (RECOMENDADO)
- `"debug"` = Información detallada

---

## 🔒 CONFIGURACIÓN DE SEGURIDAD WEB

### `RATE_LIMIT_MAX_REQUESTS`
**Qué hace:** Máximo número de operaciones por minuto por usuario.
**Valor:** `100` = 100 operaciones por minuto
**🔧 AJUSTAR** si hay muchos operadores: `200`

### `CORS_ORIGIN`
**Qué hace:** Direcciones web permitidas para acceder al sistema.
**Valor:** `"http://localhost:3001"`
**❌ NO CAMBIAR** en instalación local

---

## 💵 CONFIGURACIÓN DE OPERACIONES

### `MAX_BILL_VALUE`
**Qué hace:** Valor máximo de billete aceptado.
**Ejemplo:** `500` = No aceptar billetes de más de $500
**🔧 CAMBIAR** según política del estacionamiento

### `LOST_TICKET_FEE`
**Qué hace:** Tarifa por boleto perdido.
**Formato:** Número decimal
**Ejemplo:** `300.00` = $300 pesos por boleto perdido
**🔧 CAMBIAR** según tarifas del estacionamiento

### `GRACE_PERIOD_MINUTES`
**Qué hace:** Minutos de cortesía para salir sin costo adicional.
**Ejemplo:** `15` = 15 minutos después del pago
**🔧 AJUSTAR** según política del estacionamiento

---

## 📋 EJEMPLO DE ARCHIVO .env CONFIGURADO

```bash
# Base de Datos
DATABASE_URL="postgresql://parking_user:ParkingMexico2024@localhost:5432/parking_lot"

# Seguridad  
JWT_SECRET="mi-estacionamiento-centro-clave-secreta-2024"
JWT_EXPIRES_IN="8h"

# Finanzas
CURRENCY="MXN"
MAX_TRANSACTION_AMOUNT="999999.99"
MIN_TRANSACTION_AMOUNT="0.01"

# Impresora (Conexión de red)
PRINTER_INTERFACE_TYPE="tcp"
PRINTER_HOST="192.168.1.100"
PRINTER_PORT=9100
PRINTER_TIMEOUT=5000
PRINTER_PAPER_WIDTH=32

# Aplicación
NODE_ENV="production"
API_PORT=4000
FRONTEND_PORT=3001
LOG_LEVEL="info"

# Seguridad Web
RATE_LIMIT_MAX_REQUESTS=150
CORS_ORIGIN="http://localhost:3001"

# Operaciones
MAX_BILL_VALUE=500
LOST_TICKET_FEE=300.00
GRACE_PERIOD_MINUTES=15
```

---

## 🔧 PASOS PARA CAMBIAR CONFIGURACIÓN

### 1. Acceder al Archivo
```bash
sudo nano /opt/parking-system/.env.production
```

### 2. Hacer Cambios
- Ubicar la variable que desea cambiar
- Modificar SOLO el valor después del `=`
- Mantener las comillas `"` si las tiene

### 3. Guardar Cambios
- En nano: presionar `Ctrl + X`, luego `Y`, luego `Enter`

### 4. Reiniciar Servicios
```bash
sudo systemctl restart parking-backend parking-frontend
```

### 5. Verificar Funcionamiento
- Esperar 30 segundos
- Probar una operación básica
- Si hay problemas, revisar: `sudo journalctl -u parking-backend -f`

---

## ❗ PROBLEMAS COMUNES

### "Error de conexión a base de datos"
**Solución:** Verificar `DATABASE_URL` - usuario, contraseña y nombre de base correctos

### "Impresora no responde"
**Soluciones:**
1. Verificar `PRINTER_HOST` es la IP correcta de la impresora
2. Probar: `ping 192.168.1.100` (cambiar por su IP)
3. Verificar cable de red de la impresora

### "Sesiones expiran muy rápido"
**Solución:** Aumentar `JWT_EXPIRES_IN` a `"12h"` o `"24h"`

### "Movimientos de dinero muy lentos"
**Solución:** Aumentar `MAX_TRANSACTION_AMOUNT` si maneja cantidades grandes

---

## 📞 SOPORTE

Si necesita ayuda para configurar estas variables:

**Soporte Técnico:** 
- Email: soporte@parking-system.mx
- Teléfono: +52 55 1234 5678
- Horario: Lunes a Viernes 9:00 - 18:00

**Antes de llamar, tenga listo:**
- Modelo exacto de impresora
- IP actual de la impresora (imprimir página de configuración)
- Descripción del problema específico
- Valores actuales en el archivo .env

---

*Versión 1.0 - Diciembre 2024*
*Sistema de Gestión de Estacionamiento*