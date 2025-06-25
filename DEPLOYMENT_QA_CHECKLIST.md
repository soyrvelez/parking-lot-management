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

### 0.3 Transferir Archivos de Configuración (si aplica)
```bash
# Desde MacBook - copiar archivos de configuración sensibles
[ ] scp .env.production parking@[IP_THINKPAD]:/home/parking/deployments/parking-lot-management/.env
[ ] scp database-credentials.txt parking@[IP_THINKPAD]:/home/parking/deployments/parking-lot-management/

# Verificar archivos transferidos
[ ] ssh parking@[IP_THINKPAD] "ls -la /home/parking/deployments/parking-lot-management/"
```

### 0.4 Verificación de Permisos y Estructura
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

## 📦 FASE 2: INSTALACIÓN DEL SISTEMA (VIA SSH)

### 2.1 Preparación
```bash
# Via SSH - navegar al directorio del proyecto
[ ] ssh parking@[IP_THINKPAD]
[ ] cd /home/parking/deployments/parking-lot-management

# Verificar scripts de instalación
[ ] ls -la scripts/install-all.sh
[ ] ls -la scripts/setup/
[ ] ls -la scripts/deploy/

# Asegurar permisos de ejecución
[ ] chmod +x scripts/install-all.sh
[ ] find scripts/ -name "*.sh" -exec chmod +x {} \;
```

### 2.2 Instalación de Dependencias Base
```bash
# Actualizar sistema operativo
[ ] sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
[ ] sudo apt install -y curl wget git build-essential software-properties-common

# Verificar espacio en disco (mínimo 10GB)
[ ] df -h /
```

### 2.3 Ejecución de Instalación Completa
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

## 🔧 FASE 3: CONFIGURACIÓN DE LA APLICACIÓN (VIA SSH)

### 3.1 Verificar Instalación Completada
```bash
# Via SSH - verificar estado final de instalación
[ ] ssh parking@[IP_THINKPAD]
[ ] cat /opt/parking-installation-status.txt

# Verificar que todas las fases se completaron
[ ] grep "Estado: EXITOSO" /opt/parking-installation-status.txt
```

### 3.2 Configuración de Base de Datos
```bash
# Verificar PostgreSQL activo
[ ] sudo systemctl status postgresql

# Verificar conexión a PostgreSQL
[ ] sudo -u postgres psql -c "SELECT version();"

# Verificar base de datos creada
[ ] sudo -u postgres psql -l | grep parking_lot_prod

# Navegar al directorio de la aplicación
[ ] cd /opt/parking-system

# Verificar esquema con Prisma (si aplicable)
[ ] npx prisma db status || echo "Prisma no configurado - usando SQL directo"
```

### 3.3 Configuración de Entorno
```bash
# Verificar archivo .env generado por instalación
[ ] cat /opt/parking-system/.env

# Variables críticas a verificar:
[ ] grep "DATABASE_URL" /opt/parking-system/.env
[ ] grep "NODE_ENV=production" /opt/parking-system/.env
[ ] grep "PRINTER_IP=192.168.1.100" /opt/parking-system/.env
[ ] grep "JWT_SECRET" /opt/parking-system/.env

# Si falta alguna variable, agregarla:
[ ] echo "MISSING_VAR=value" >> /opt/parking-system/.env
```

### 3.4 Inicialización de Datos
```bash
# El script de instalación debería haber creado datos iniciales
# Verificar datos en la base de datos:

[ ] sudo -u postgres psql parking_lot_prod -c "SELECT * FROM pricing_config;"
[ ] sudo -u postgres psql parking_lot_prod -c "SELECT username, role FROM system_users;"
[ ] sudo -u postgres psql parking_lot_prod -c "SELECT * FROM cash_register;"

# Si no hay datos, ejecutar seed manualmente:
[ ] cd /home/parking/deployments/parking-lot-management
[ ] npm run db:seed
```

### 3.5 Copiar Código de Aplicación Actual
```bash
# Copiar código más reciente sobre la instalación base
[ ] cd /home/parking/deployments/parking-lot-management

# Hacer backup de la aplicación instalada
[ ] sudo cp -r /opt/parking-system /opt/parking-system.backup

# Copiar archivos actualizados
[ ] sudo cp -r src/* /opt/parking-system/src/ 2>/dev/null || true
[ ] sudo cp package*.json /opt/parking-system/
[ ] sudo cp -r prisma/ /opt/parking-system/ 2>/dev/null || true

# Preservar configuración
[ ] sudo cp /opt/parking-system.backup/.env /opt/parking-system/.env

# Instalar dependencias actualizadas
[ ] cd /opt/parking-system
[ ] sudo npm install

# Construir aplicación
[ ] sudo npm run build || echo "Build no disponible - usando código directo"

# Corregir permisos
[ ] sudo chown -R parking:parking /opt/parking-system
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

## 🚀 FASE 5: INICIO DE SERVICIOS (VIA SSH)

### 5.1 Iniciar Servicios del Sistema
```bash
# Iniciar servicio principal de estacionamiento
[ ] sudo systemctl start parking-system
[ ] sudo systemctl enable parking-system

# Verificar estado de servicios
[ ] sudo systemctl status parking-system
[ ] sudo systemctl status postgresql
[ ] sudo systemctl status nginx

# Ver logs de inicio
[ ] sudo journalctl -u parking-system -f --lines 50
```

### 5.2 Verificar Acceso Web
```bash
# Probar acceso local en ThinkPad
[ ] curl -I http://localhost:3000/health
[ ] curl -I http://localhost/

# Desde MacBook - probar acceso remoto
[ ] curl -I http://[IP_THINKPAD]/
[ ] curl -I http://[IP_THINKPAD]/health
```

---

## 🧪 FASE 6: PRUEBAS FUNCIONALES (ACCESO WEB)

### 6.1 Acceso a la Aplicación
```bash
# Desde MacBook - abrir navegador
[ ] open http://[IP_THINKPAD]

# O usar SSH tunnel para acceso seguro
[ ] ssh -L 8080:[IP_THINKPAD]:80 parking@[IP_THINKPAD]
[ ] open http://localhost:8080
```

### 6.2 Flujo de Entrada de Vehículo
1. [ ] Pantalla principal del operador carga correctamente
2. [ ] Presionar "ENTRADA" funciona
3. [ ] Ingresar placa "TEST-001"
4. [ ] Boleto se crea exitosamente
5. [ ] **Verificar en logs**: `ssh parking@[IP_THINKPAD] "tail -f /var/log/parking-system/*.log"`

### 6.3 Flujo de Salida y Pago
1. [ ] Usar código de barras del boleto creado
2. [ ] Sistema calcula tarifa correctamente
3. [ ] Ingresar monto de pago
4. [ ] Cambio se calcula correctamente
5. [ ] Pago se procesa sin errores

### 6.4 Sistema de Pensiones (CRÍTICO - NUEVAS CORRECCIONES)
**PRUEBA CRÍTICA - Verificar correcciones implementadas:**

1. [ ] Registrar nuevo cliente de pensión:
   - [ ] Nombre: "Cliente Prueba SSH"
   - [ ] Placa: "PENS-SSH1"
   - [ ] Duración: **3 meses**
   - [ ] **VERIFICAR**: Muestra total **$2,400 MXN** (3 × $800)
   
2. [ ] Sistema navega a pantalla de pago:
   - [ ] **VERIFICAR**: NO hay redirección automática
   - [ ] Pantalla de pago permanece abierta
   - [ ] Muestra monto correcto: $2,400 MXN
   
3. [ ] Procesar pago inicial:
   - [ ] Ingresar $2,400 MXN
   - [ ] **VERIFICAR**: Pago se procesa sin crashes
   - [ ] Cliente se activa correctamente
   - [ ] **Verificar en BD**: `ssh parking@[IP_THINKPAD] "sudo -u postgres psql parking_lot_prod -c \"SELECT name, monthly_rate, start_date, end_date, is_active FROM pension_customers WHERE plate_number='PENS-SSH1';\";"`

### 6.5 Pruebas de Monto Alto (>$9,999)
1. [ ] Registrar pensión de 15 meses: $12,000 MXN
2. [ ] **VERIFICAR**: Sistema maneja monto sin errores
3. [ ] **VERIFICAR**: Formatting correcto en pantalla

### 6.6 Boleto Perdido
1. [ ] Seleccionar "Boleto Perdido"
2. [ ] Verificar tarifa: $100 MXN (configuración actual)
3. [ ] Procesar pago
4. [ ] **Verificar en logs**: transacción registrada correctamente

---

## 🔌 FASE 7: INTEGRACIÓN DE HARDWARE (VIA SSH)

### 7.1 Impresora Térmica - Pruebas Remotas
```bash
# Via SSH - probar conectividad de impresora
[ ] ssh parking@[IP_THINKPAD] "ping -c 3 192.168.1.100"

# Probar puerto de impresión
[ ] ssh parking@[IP_THINKPAD] "nc -zv 192.168.1.100 9100"

# Prueba de impresión directa
[ ] ssh parking@[IP_THINKPAD] "echo 'PRUEBA SSH DEPLOYMENT' | nc 192.168.1.100 9100"

# Verificar API de hardware
[ ] ssh parking@[IP_THINKPAD] "curl -s http://localhost/api/hardware/status | jq ." || ssh parking@[IP_THINKPAD] "curl -s http://localhost/api/hardware/status"
```

### 7.2 Scanner de Códigos - Configuración Remota
```bash
# Verificar dispositivos USB conectados
[ ] ssh parking@[IP_THINKPAD] "lsusb | grep -i honeywell"

# Verificar configuración HID
[ ] ssh parking@[IP_THINKPAD] "ls -la /dev/input/by-id/ | grep -i honeywell"

# Prueba de scanner con aplicación
# (Requiere acceso físico al ThinkPad para escanear código)
```

### 7.3 Pruebas de Hardware Integradas
```bash
# Desde la aplicación web - realizar prueba completa:
# 1. Crear boleto con impresión
# 2. Escanear código de barras generado
# 3. Verificar flujo completo

# Monitorear logs durante pruebas de hardware
[ ] ssh parking@[IP_THINKPAD] "tail -f /var/log/parking-system/*.log | grep -i 'printer\|scanner\|barcode'"
```

---

## 🛡️ FASE 8: SEGURIDAD Y RESPALDOS (VIA SSH)

### 8.1 Verificación de Seguridad
```bash
# Verificar firewall UFW
[ ] ssh parking@[IP_THINKPAD] "sudo ufw status verbose"

# Verificar reglas de firewall
[ ] ssh parking@[IP_THINKPAD] "sudo ufw status numbered"

# Verificar SSH configurado correctamente
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl status ssh"

# Verificar fail2ban (si está instalado)
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl status fail2ban" || echo "fail2ban no instalado"

# Verificar usuarios del sistema
[ ] ssh parking@[IP_THINKPAD] "getent passwd | grep -E '(parking|admin)'"
```

### 8.2 Configuración de Respaldos
```bash
# Verificar script de respaldo
[ ] ssh parking@[IP_THINKPAD] "ls -la /opt/parking-backup.sh"

# Verificar configuración de cron
[ ] ssh parking@[IP_THINKPAD] "sudo crontab -l | grep backup"

# Ejecutar respaldo manual de prueba
[ ] ssh parking@[IP_THINKPAD] "sudo /opt/parking-backup.sh"

# Verificar que se creó el respaldo
[ ] ssh parking@[IP_THINKPAD] "ls -la /var/backups/parking/ | tail -5"
```

### 8.3 Configuración de Actualizaciones
```bash
# Verificar actualizaciones automáticas
[ ] ssh parking@[IP_THINKPAD] "sudo apt list --upgradable"

# Configurar actualizaciones automáticas de seguridad
[ ] ssh parking@[IP_THINKPAD] "sudo dpkg-reconfigure -plow unattended-upgrades"
```

---

## 📊 FASE 9: MONITOREO Y LOGS (VIA SSH)

### 9.1 Verificación de Servicios Activos
```bash
# Verificar todos los servicios críticos
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl status postgresql"
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl status nginx"
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl status parking-system"

# Si hay PM2 configurado
[ ] ssh parking@[IP_THINKPAD] "pm2 status" || echo "PM2 no configurado"

# Verificar puertos en uso
[ ] ssh parking@[IP_THINKPAD] "sudo netstat -tlnp | grep -E ':(80|443|3000|5432)'"
```

### 9.2 Análisis de Logs
```bash
# Logs del sistema
[ ] ssh parking@[IP_THINKPAD] "sudo journalctl -u parking-system --lines 50 --no-pager"

# Logs de nginx
[ ] ssh parking@[IP_THINKPAD] "sudo tail -50 /var/log/nginx/access.log"
[ ] ssh parking@[IP_THINKPAD] "sudo tail -50 /var/log/nginx/error.log"

# Logs de la aplicación
[ ] ssh parking@[IP_THINKPAD] "sudo tail -50 /var/log/parking-system/*.log" || echo "Logs de aplicación no encontrados"

# Verificar errores críticos
[ ] ssh parking@[IP_THINKPAD] "sudo journalctl --priority=err --since today"
```

### 9.3 Monitoreo de Recursos
```bash
# Uso de CPU y memoria
[ ] ssh parking@[IP_THINKPAD] "top -b -n 1 | head -20"

# Espacio en disco
[ ] ssh parking@[IP_THINKPAD] "df -h"

# Procesos de la aplicación
[ ] ssh parking@[IP_THINKPAD] "ps aux | grep -E '(node|postgres|nginx)'"
```

### 9.4 Script de Verificación Automatizada
```bash
# Ejecutar script de verificación completa
[ ] ssh parking@[IP_THINKPAD] "sudo /home/parking/deployments/parking-lot-management/scripts/verify-deployment.sh"

# Revisar resultados
[ ] ssh parking@[IP_THINKPAD] "echo 'Script de verificación completado con código de salida: $?'"
```

---

## 🚨 FASE 10: PLAN DE CONTINGENCIA Y DOCUMENTACIÓN

### 10.1 Configurar Acceso Remoto de Emergencia
```bash
# Configurar VPN/túnel SSH para acceso remoto
[ ] ssh parking@[IP_THINKPAD] "sudo ufw allow from [IP_MACBOOK] to any port 22"

# Crear usuario de emergencia
[ ] ssh parking@[IP_THINKPAD] "sudo useradd -m -s /bin/bash emergency-admin"
[ ] ssh parking@[IP_THINKPAD] "sudo usermod -aG sudo emergency-admin"

# Configurar autologin para emergencias
[ ] ssh parking@[IP_THINKPAD] "sudo systemctl disable ssh" || echo "SSH mantenido activo para soporte"
```

### 10.2 Documentación de Credenciales
```bash
# Descargar información crítica al MacBook
[ ] scp parking@[IP_THINKPAD]:/opt/parking-installation-status.txt ./deployment-status-$(date +%Y%m%d).txt
[ ] scp parking@[IP_THINKPAD]:/opt/parking-setup-status.txt ./setup-status-$(date +%Y%m%d).txt

# Crear archivo de credenciales locales (NO subir a git)
[ ] cat > ./CREDENTIALS-THINKPAD.txt << EOF
# CREDENCIALES THINKPAD ESTACIONAMIENTO
# GENERADO: $(date)
# IP THINKPAD: [IP_THINKPAD]

# Sistema Operativo
Usuario Operador: parking
Usuario Admin: emergency-admin

# Base de Datos
URL: postgresql://parking_user:PASSWORD@localhost:5432/parking_lot_prod
Usuario BD: parking_user

# Aplicación Web
URL: http://[IP_THINKPAD]/
Usuario Admin: admin
Password: admin123 (CAMBIAR INMEDIATAMENTE)

# SSH desde MacBook
ssh parking@[IP_THINKPAD]
ssh emergency-admin@[IP_THINKPAD]

# Comandos Útiles
Logs: sudo journalctl -u parking-system -f
Restart: sudo systemctl restart parking-system
Status: sudo systemctl status parking-system
Backup: sudo /opt/parking-backup.sh

EOF
```

### 10.3 Números de Contacto
- [ ] Soporte técnico: ________________
- [ ] Administrador del sistema: ________________
- [ ] Proveedor de Internet: ________________
- [ ] **SSH desde MacBook**: ssh parking@[IP_THINKPAD]

---

## ✅ FASE 11: ENTREGA FINAL Y CAPACITACIÓN

### 11.1 Capacitación Remota del Operador
```bash
# Establecer sesión compartida para capacitación
[ ] ssh parking@[IP_THINKPAD]
[ ] # Navegar junto con operador por la interfaz web

# Capacitación vía navegador desde MacBook
[ ] open http://[IP_THINKPAD]
```

**Procedimientos a demostrar:**
- [ ] Entrada de vehículo: placa → imprimir boleto
- [ ] Salida y pago: escanear → calcular → cobrar → recibo
- [ ] **Sistema de pensiones**: registro → duración → pago completo
- [ ] Boleto perdido: tarifa especial → recibo
- [ ] Cerrar turno: verificar caja

### 11.2 Documentación Entregada (Digital)
```bash
# Descargar documentación al MacBook
[ ] scp parking@[IP_THINKPAD]:/home/parking/deployments/parking-lot-management/TROUBLESHOOTING_GUIDE.md ./
[ ] scp parking@[IP_THINKPAD]:/home/parking/deployments/parking-lot-management/DEPLOYMENT_QA_CHECKLIST.md ./

# Crear manual de operador simplificado
[ ] cat > MANUAL_OPERADOR_RAPIDO.md << 'EOF'
# MANUAL RÁPIDO - OPERADOR ESTACIONAMIENTO

## INICIO DIARIO
1. Verificar que sistema esté encendido
2. URL: http://localhost (debe abrir automáticamente)

## ENTRADA VEHÍCULO
1. Clic "ENTRADA"
2. Escribir placa
3. Clic "GENERAR BOLETO"
4. Entregar boleto al cliente

## SALIDA Y PAGO
1. Escanear código del boleto
2. Sistema calcula tarifa
3. Ingresar dinero recibido
4. Entregar cambio y recibo

## PENSIÓN
1. Clic "PENSIÓN"
2. Llenar datos del cliente
3. Seleccionar duración (meses)
4. VERIFICAR monto total correcto
5. Procesar pago
6. Entregar recibo

## EMERGENCIAS
- Si falla sistema: Anotar placas en papel
- Soporte: ssh parking@[IP_THINKPAD]
- Reiniciar: sudo systemctl restart parking-system

EOF
```

### 11.3 Verificación Final Completa
```bash
# Ejecutar verificación automatizada final
[ ] ssh parking@[IP_THINKPAD] "/home/parking/deployments/parking-lot-management/scripts/verify-deployment.sh"

# Verificar que todo funciona sin intervención
[ ] curl -I http://[IP_THINKPAD]/health

# Test final del sistema de pensiones
[ ] echo "Realizar prueba manual de pensión 6 meses: debe cobrar 6 × 800 = 4800 MXN"
```

**Criterios de Aceptación Final:**
- [ ] Sistema funcionando 30 min sin errores
- [ ] Operador completa flujos sin asistencia
- [ ] **Pensiones cobra monto correcto por duración**
- [ ] Hardware impresora/scanner operativo
- [ ] Acceso SSH desde MacBook funcionando
- [ ] Respaldos automáticos configurados
- [ ] Documentación completa entregada

---

## 📝 NOTAS IMPORTANTES PARA DESPLIEGUE VIA SSH

1. **Tiempo estimado total**: 3-4 horas incluyendo capacitación remota
2. **Horario recomendado**: Realizar fuera de horas pico
3. **Personal requerido**: 1 técnico remoto (MacBook) + 1 operador local (ThinkPad)
4. **Conexión SSH**: Mantener conexión estable durante todo el proceso
5. **Respaldo previo**: Siempre respaldar datos existentes antes de actualizar
6. **Screen/tmux**: Usar para evitar pérdida de sesión durante instalación larga

## 🎯 CRITERIOS DE ÉXITO ESPECÍFICOS

✅ **Sistema de pensiones**: Cobra correctamente por duración seleccionada (ej: 3 meses = $2,400 MXN)  
✅ **Acceso SSH estable**: Conexión desde MacBook sin interrupciones  
✅ **Interfaz web accesible**: http://[IP_THINKPAD] responde correctamente  
✅ **Hardware funcional**: Impresora y scanner integrados correctamente  
✅ **Verificación automatizada**: Script verify-deployment.sh ejecuta sin errores  
✅ **Capacitación remota completada**: Operador maneja sistema independientemente  
✅ **Documentación descargada**: Manuales y guías disponibles en MacBook  

## 🔄 COMANDOS RÁPIDOS DE EMERGENCIA

```bash
# Desde MacBook - Diagnóstico rápido
ssh parking@[IP_THINKPAD] "sudo systemctl status parking-system"
ssh parking@[IP_THINKPAD] "curl -I http://localhost/health"
ssh parking@[IP_THINKPAD] "sudo journalctl -u parking-system --lines 20"

# Reinicio de emergencia
ssh parking@[IP_THINKPAD] "sudo systemctl restart parking-system"

# Ver logs en tiempo real
ssh parking@[IP_THINKPAD] "sudo journalctl -u parking-system -f"

# Verificación completa automatizada
ssh parking@[IP_THINKPAD] "/home/parking/deployments/parking-lot-management/scripts/verify-deployment.sh"
```

---

**Fecha de Despliegue**: _______________  
**Técnico Responsable (MacBook)**: _______________  
**Operador Local (ThinkPad)**: _______________  
**IP ThinkPad**: _______________  
**Verificación SSH Exitosa**: [ ] ✅  
**Sistema de Pensiones Validado**: [ ] ✅  
**Firma de Conformidad**: _______________