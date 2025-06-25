# 🚀 LISTA DE VERIFICACIÓN QA - DESPLIEGUE EN THINKPAD

## ✅ ESTADO ACTUAL DEL SISTEMA

### 🎯 Correcciones Críticas Implementadas

- [x] **Sistema de Pensiones**: Corregido el cobro incorrecto (ahora cobra monto completo por duración seleccionada)
- [x] **Pantalla de Pago**: Corregida la redirección automática (ahora muestra formulario de pago)
- [x] **Procesamiento de Pagos**: Corregido el crash con clientes inactivos
- [x] **Estabilidad Frontend**: Agregadas validaciones null y manejo de errores mejorado
- [x] **Soporte de Montos Grandes**: Verificado soporte para pensiones >$9,999 MXN

---

## 🖥️ FASE 0: PREPARACIÓN INICIAL (DESDE MACBOOK VIA SSH)

### 0.1 Configuración SSH en MacBook
```bash
# Generar clave SSH si no existe
[ ] ssh-keygen -t ed25519 -C "deployer@estacionamiento"

# Copiar clave pública al ThinkPad
[ ] ssh-copy-id parking@[IP_THINKPAD]

# Probar conexión SSH
[ ] ssh parking@[IP_THINKPAD] "whoami"
```

### 0.2 Clonar Repositorio en ThinkPad
```bash
# Conectar via SSH al ThinkPad
[ ] ssh parking@[IP_THINKPAD]

# Instalar git si no está presente
[ ] sudo apt update && sudo apt install -y git

# Crear directorio para el proyecto
[ ] mkdir -p /home/parking/deployments

# Clonar repositorio (reemplazar con URL real)
[ ] cd /home/parking/deployments
[ ] git clone https://github.com/[usuario]/parking-lot-management.git

# Verificar código descargado
[ ] cd parking-lot-management
[ ] ls -la
[ ] git log --oneline -5
```

### 0.3 Crear Archivo de Configuración de Producción
```bash
# En MacBook - crear .env.production desde template
[ ] cd /Users/velez/dev/parking-lot-management
[ ] cp .env.production.template .env.production

# Editar .env.production para producción
[ ] nano .env.production
```

**Variables CRÍTICAS que DEBES cambiar en .env.production:**

1. **DATABASE_URL**: Cambiar password por uno seguro
   ```
   "postgresql://parking_user:TU_PASSWORD_SEGURO@localhost:5432/parking_lot_prod"
   ```

2. **JWT_SECRET**: Generar clave secreta aleatoria (32+ caracteres)
   ```bash
   # Generar JWT secret aleatorio:
   [ ] openssl rand -hex 32
   # Copiar resultado al archivo .env.production
   ```

3. **Configuración de impresora**: Elegir USB o Red
   - **USB (recomendado)**: `PRINTER_INTERFACE_TYPE="usb"` y `PRINTER_DEVICE_PATH="/dev/usb/lp0"`
   - **Red**: `PRINTER_INTERFACE_TYPE="network"` y `PRINTER_HOST="192.168.1.100"`

4. **IPs de red**: Verificar que coincidan con tu configuración
   - ThinkPad IP: `192.168.1.50`
   - CORS_ORIGIN: `http://192.168.1.50`

**Ejemplo de configuración final (USB):**
```bash
DATABASE_URL="postgresql://parking_user:MySecure2024Pass!@localhost:5432/parking_lot_prod"
JWT_SECRET="a1b2c3d4e5f6789012345678901234567890abcdef1234567890"
NODE_ENV="production"
PRINTER_INTERFACE_TYPE="usb"
PRINTER_DEVICE_PATH="/dev/usb/lp0"
CORS_ORIGIN="http://192.168.1.50"
# ... resto de configuración desde template
```

### 0.4 Transferir Archivos de Configuración
```bash
# Desde MacBook - copiar archivo de configuración de producción
[ ] scp .env.production parking@[IP_THINKPAD]:/home/parking/deployments/parking-lot-management/.env

# Verificar archivo transferido
[ ] ssh parking@[IP_THINKPAD] "ls -la /home/parking/deployments/parking-lot-management/.env"

# Verificar contenido (sin mostrar secrets)
[ ] ssh parking@[IP_THINKPAD] "grep -E '^[A-Z_]+=' /home/parking/deployments/parking-lot-management/.env | head -10"
```

### 0.5 Verificación de Permisos y Estructura
```bash
# Via SSH en ThinkPad
[ ] cd /home/parking/deployments/parking-lot-management

# Verificar estructura del proyecto
[ ] ls -la src/
[ ] ls -la scripts/

# Dar permisos de ejecución a scripts
[ ] chmod +x scripts/*.sh
[ ] chmod +x scripts/**/*.sh

# Verificar scripts de instalación
[ ] ls -la scripts/install-all.sh
[ ] head -10 scripts/install-all.sh
```

---

## 📋 FASE 1: PRE-INSTALACIÓN (VIA SSH)

### 1.1 Verificación de Hardware ThinkPad

- [ ] **Modelo**: Lenovo ThinkPad T480 o superior
- [ ] **RAM**: Mínimo 8GB instalados
- [ ] **Almacenamiento**: Mínimo 256GB SSD
- [ ] **Estado de Batería**: >80% de capacidad
- [ ] **Teclado y Trackpad**: Funcionando correctamente
- [ ] **Puertos USB**: Mínimo 2 puertos funcionales

### 1.2 Periféricos Requeridos

- [ ] **Impresora Térmica**: Epson TM-T20III conectada y encendida
  - [ ] Cable Ethernet conectado
  - [ ] Papel térmico 58mm instalado
  - [ ] LED de estado verde
- [ ] **Scanner de Códigos**: Honeywell Voyager 1250g
  - [ ] Cable USB conectado
  - [ ] Configurado en modo HID (teclado)
  - [ ] Probado con código de barras de prueba

### 1.3 Configuración de Red

- [ ] **IP Estática del ThinkPad**: 192.168.1.50
- [ ] **IP de la Impresora**: 192.168.1.100
- [ ] **Gateway**: 192.168.1.1
- [ ] **DNS**: 8.8.8.8, 8.8.4.4
- [ ] **Conexión a Internet**: Verificada con `ping google.com`

---

## 📦 FASE 2: INSTALACIÓN DEL SISTEMA

### 2.1 Preparación

```bash
# Verificar que el script de instalación esté presente
[ ] ls -la scripts/install-all.sh
[ ] chmod +x scripts/install-all.sh
```

### 2.2 Ejecución de Instalación

```bash
# Ejecutar instalación completa (45-90 minutos)
# IMPORTANTE: Mantener sesión SSH activa con screen/tmux
[ ] sudo apt install -y screen
[ ] screen -S deployment

# Dentro de screen:
[ ] cd /home/parking/deployments/parking-lot-management
[ ] sudo ./scripts/install-all.sh production

# Para salir de screen sin detener: Ctrl+A, D
# Para reconectar: screen -r deployment
```

### 2.4 Monitoreo de Instalación desde MacBook

```bash
# Desde MacBook - monitorear logs de instalación
[ ] ssh parking@[IP_THINKPAD] "tail -f /var/log/parking-installation-*.log"

# O reconectar a screen para ver progreso
[ ] ssh parking@[IP_THINKPAD]
[ ] screen -r deployment
```

### 2.3 Verificación Post-Instalación

- [ ] Sistema operativo actualizado
- [ ] PostgreSQL instalado y ejecutándose
- [ ] Node.js v18+ instalado
- [ ] PM2 instalado globalmente
- [ ] Nginx configurado y ejecutándose
- [ ] Modo kiosko configurado

---

## 🔧 FASE 3: CONFIGURACIÓN DE LA APLICACIÓN

### 3.1 Base de Datos

```bash
# Verificar conexión a PostgreSQL
[ ] sudo -u postgres psql -c "SELECT version();"

# Verificar base de datos creada
[ ] sudo -u postgres psql -l | grep parking_lot_prod

# Verificar esquema de base de datos
[ ] cd /home/parking/parking-system && npx prisma db push
```

### 3.2 Configuración de Entorno

```bash
# Verificar archivo .env
[ ] cat /home/parking/parking-system/.env

# Variables críticas a verificar:
[ ] DATABASE_URL=postgresql://parking_user:SecurePassword123!@localhost:5432/parking_lot_prod
[ ] NODE_ENV=production
[ ] PRINTER_HOST=192.168.1.100
[ ] PRINTER_PORT=9100
[ ] JWT_SECRET=(valor seguro generado)
```

### 3.3 Inicialización de Datos

```bash
# Ejecutar seed de base de datos
[ ] cd /home/parking/parking-system && npm run db:seed

# Verificar datos iniciales:
[ ] Configuración de precios creada ($800 MXN mensual)
[ ] Usuario admin creado
[ ] Caja registradora inicializada
```

---

## 🖥️ FASE 4: VERIFICACIÓN DE MODO KIOSKO

### 4.1 Configuración de Usuario

- [ ] Usuario `parking` creado sin privilegios sudo
- [ ] Contraseña establecida: `ParkingKiosk2024!`
- [ ] Inicio de sesión automático configurado

### 4.2 Interfaz de Kiosko

- [ ] Chromium abre automáticamente en pantalla completa
- [ ] URL correcta: `http://localhost:3001`
- [ ] Sin barra de direcciones visible
- [ ] Sin menús del navegador
- [ ] Alt+F4 deshabilitado

### 4.3 Restricciones de Seguridad

- [ ] Ctrl+Alt+F1-F7 deshabilitado
- [ ] Acceso a terminal bloqueado
- [ ] USB storage deshabilitado
- [ ] Firewall UFW activo

---

## 🧪 FASE 5: PRUEBAS FUNCIONALES

### 5.1 Flujo de Entrada de Vehículo

1. [ ] Pantalla principal del operador carga correctamente
2. [ ] Presionar "ENTRADA" funciona
3. [ ] Ingresar placa "TEST-001"
4. [ ] Boleto se crea exitosamente
5. [ ] Impresora imprime boleto con código de barras
6. [ ] Código de barras legible: `*TITTEST001*`

### 5.2 Flujo de Salida y Pago

1. [ ] Escanear código de barras del boleto
2. [ ] Sistema calcula tarifa correctamente
3. [ ] Ingresar monto de pago
4. [ ] Cambio se calcula correctamente
5. [ ] Pago se procesa sin errores
6. [ ] Recibo se imprime correctamente

### 5.3 Sistema de Pensiones (CRÍTICO - NUEVAS CORRECCIONES)

1. [ ] Registrar nuevo cliente de pensión:
   - [ ] Nombre: "Cliente Prueba"
   - [ ] Placa: "PENS-001"
   - [ ] Duración: 2 meses
   - [ ] **VERIFICAR**: Muestra total $1,600 MXN (2 × $800)
2. [ ] Sistema navega a pantalla de pago:
   - [ ] **VERIFICAR**: NO hay redirección automática
   - [ ] Pantalla de pago permanece abierta
3. [ ] Procesar pago inicial:
   - [ ] Ingresar $1,600 MXN
   - [ ] **VERIFICAR**: Pago se procesa sin crashes
   - [ ] Cliente se activa correctamente
   - [ ] Recibo muestra período correcto (2 meses)

### 5.4 Boleto Perdido

1. [ ] Seleccionar "Boleto Perdido"
2. [ ] Verificar tarifa: $50 MXN
3. [ ] Procesar pago
4. [ ] Recibo especial se imprime

---

## 🔌 FASE 6: INTEGRACIÓN DE HARDWARE

### 6.1 Impresora Térmica

```bash
# Prueba de conectividad
[ ] ping 192.168.1.100

# Prueba de impresión directa
[ ] echo "PRUEBA" | nc 192.168.1.100 9100

# Verificar cola de impresión
[ ] curl http://localhost:4000/api/hardware/status
```

### 6.2 Scanner de Códigos

1. [ ] Abrir bloc de notas
2. [ ] Escanear código de prueba
3. [ ] Verificar que aparece texto: `*TITABC123*`
4. [ ] Verificar Enter automático al final

---

## 🛡️ FASE 7: SEGURIDAD Y RESPALDOS

### 7.1 Seguridad

- [ ] Firewall UFW activo con reglas correctas
- [ ] SSH deshabilitado o con acceso restringido
- [ ] Contraseñas seguras establecidas
- [ ] Actualizaciones automáticas configuradas

### 7.2 Respaldos

```bash
# Verificar script de respaldo
[ ] ls -la /home/parking/backup/backup.sh

# Verificar cron job
[ ] sudo crontab -l | grep backup

# Ejecutar respaldo manual
[ ] sudo /home/parking/backup/backup.sh
```

---

## 📊 FASE 8: MONITOREO Y LOGS

### 8.1 Servicios Activos

```bash
# Verificar todos los servicios
[ ] sudo systemctl status postgresql
[ ] sudo systemctl status nginx
[ ] pm2 status
[ ] pm2 logs parking-backend --lines 50
```

### 8.2 Logs de Aplicación

- [ ] Logs de backend sin errores críticos
- [ ] Transacciones registrándose correctamente
- [ ] Auditoría funcionando

---

## 🚨 FASE 9: PLAN DE CONTINGENCIA

### 9.1 Números de Contacto

- [ ] Soporte técnico: ******\_\_\_\_******
- [ ] Administrador del sistema: ******\_\_\_\_******
- [ ] Proveedor de Internet: ******\_\_\_\_******

### 9.2 Procedimientos de Emergencia

- [ ] Documento de recuperación impreso y disponible
- [ ] USB de recuperación preparado
- [ ] Contraseñas de emergencia documentadas

---

## ✅ FASE 10: ENTREGA FINAL

### 10.1 Capacitación del Operador

- [ ] Demostrar entrada de vehículo
- [ ] Demostrar cobro y salida
- [ ] Demostrar registro de pensión
- [ ] Demostrar manejo de boleto perdido
- [ ] Entregar guía rápida impresa

### 10.2 Documentación Entregada

- [ ] Manual del operador (impreso)
- [ ] Guía de solución de problemas
- [ ] Contactos de soporte
- [ ] Procedimientos de cierre diario

### 10.3 Verificación Final

- [ ] Sistema funcionando en modo producción
- [ ] Operador capacitado y cómodo
- [ ] Hardware funcionando correctamente
- [ ] Respaldos configurados
- [ ] Cliente satisfecho con la instalación

---

## 📝 NOTAS IMPORTANTES

1. **Tiempo estimado total**: 2-3 horas incluyendo capacitación
2. **Horario recomendado**: Realizar fuera de horas pico
3. **Personal requerido**: 1 técnico + 1 operador para capacitación
4. **Respaldo previo**: Siempre respaldar datos existentes antes de actualizar

## 🎯 CRITERIOS DE ÉXITO

✅ Sistema operativo sin errores durante 30 minutos continuos
✅ Operador puede completar todas las tareas básicas sin asistencia
✅ Hardware (impresora y scanner) funcionando confiablemente
✅ Respaldos automáticos verificados
✅ Documentación completa entregada

---

**Fecha de Despliegue**: ******\_\_\_******
**Técnico Responsable**: ******\_\_\_******
**Firma de Conformidad**: ******\_\_\_******
