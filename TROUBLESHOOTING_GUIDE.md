# 🔧 GUÍA DE SOLUCIÓN DE PROBLEMAS - SISTEMA DE ESTACIONAMIENTO

## 📋 ÍNDICE DE PROBLEMAS COMUNES

1. [Problemas del Sistema de Pensiones](#sistema-de-pensiones)
2. [Problemas de Impresión](#problemas-de-impresión)
3. [Problemas de Base de Datos](#problemas-de-base-de-datos)
4. [Problemas de Red](#problemas-de-red)
5. [Problemas de Scanner](#problemas-de-scanner)
6. [Problemas de Interfaz](#problemas-de-interfaz)
7. [Problemas de Rendimiento](#problemas-de-rendimiento)
8. [Problemas de Seguridad](#problemas-de-seguridad)

---

## 🎯 SISTEMA DE PENSIONES

### ❌ PROBLEMA: Cliente de pensión cobra solo 1 mes cuando selecciono varios meses
**Status**: ✅ CORREGIDO en última versión

**Síntomas**:
- Al registrar pensión de 3 meses, solo cobra $800 en lugar de $2,400
- El cliente obtiene 3 meses pero solo paga 1

**Solución**:
```bash
# Verificar que tiene la última versión
cd /home/parking/parking-system
git pull origin main
npm install
npm run build
pm2 restart all
```

### ❌ PROBLEMA: Pantalla de pago se cierra inmediatamente después de registrar pensión
**Status**: ✅ CORREGIDO en última versión

**Síntomas**:
- Después de registrar cliente nuevo, la pantalla de pago aparece y desaparece
- No hay oportunidad de procesar el pago

**Verificación**:
```bash
# Revisar logs del frontend
pm2 logs parking-frontend --lines 100 | grep -i "payment"
```

### ❌ PROBLEMA: Error "Cliente de pensión inactivo" al cobrar
**Status**: ✅ CORREGIDO en última versión

**Síntomas**:
- Al intentar cobrar a cliente nuevo: "BusinessLogicError: Cliente de pensión inactivo"
- Sistema se crashea

**Solución temporal** (si no puede actualizar):
```sql
-- Activar manualmente el cliente
sudo -u postgres psql parking_lot_prod
UPDATE "PensionCustomer" SET "isActive" = true WHERE "plateNumber" = 'ABC-123';
```

### ❌ PROBLEMA: Monto de pensión mayor a $9,999 causa error

**Síntomas**:
- Error al procesar pensiones con tarifa mensual alta
- Mensaje: "Amount exceeds maximum"

**Solución**:
El sistema ya maneja montos grandes correctamente. Si persiste:
```bash
# Verificar en logs
pm2 logs parking-backend | grep -i "money\|amount"

# Reiniciar servicios
pm2 restart all
```

---

## 🖨️ PROBLEMAS DE IMPRESIÓN

### ❌ PROBLEMA: Impresora no imprime boletos

**Diagnóstico**:
```bash
# 1. Verificar conectividad
ping 192.168.1.100

# 2. Verificar puerto
nc -zv 192.168.1.100 9100

# 3. Verificar estado en sistema
curl http://localhost:4000/api/hardware/status
```

**Soluciones**:

1. **Impresora apagada o sin papel**:
   - Verificar LED verde en impresora
   - Revisar papel térmico 58mm
   - Presionar botón FEED para prueba

2. **Problema de red**:
   ```bash
   # Reiniciar interfaz de red
   sudo ifconfig eth0 down
   sudo ifconfig eth0 up
   
   # Verificar IP de impresora
   arp -a | grep 192.168.1.100
   ```

3. **Cola de impresión atascada**:
   ```bash
   # Ver cola de impresión
   curl http://localhost:4000/api/hardware/queue
   
   # Limpiar cola si necesario
   pm2 restart parking-backend
   ```

### ❌ PROBLEMA: Código de barras no se imprime o es ilegible

**Verificación**:
```bash
# Probar impresión directa
echo -e "\x1b@TEST\n*ABC123*\n\x1d\x56\x41\x03" | nc 192.168.1.100 9100
```

**Soluciones**:
1. Limpiar cabezal de impresión con alcohol isopropílico
2. Verificar calidad del papel térmico
3. Ajustar densidad de impresión en configuración

---

## 💾 PROBLEMAS DE BASE DE DATOS

### ❌ PROBLEMA: "Configuración de precios no encontrada"

**Síntomas**:
- Error 500 al cargar precios
- Sistema de pensiones no muestra tarifa

**Solución**:
```bash
# Ejecutar seed de base de datos
cd /home/parking/parking-system
npm run db:seed

# Verificar datos
sudo -u postgres psql parking_lot_prod -c "SELECT * FROM \"PricingConfig\";"
```

### ❌ PROBLEMA: Error de conexión a base de datos

**Diagnóstico**:
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
sudo -u postgres psql -c "SELECT 1;"

# Revisar configuración
cat /home/parking/parking-system/.env | grep DATABASE_URL
```

**Soluciones**:
```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Verificar permisos
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE parking_lot_prod TO parking_user;
\q
```

---

## 🌐 PROBLEMAS DE RED

### ❌ PROBLEMA: Sistema no accesible desde navegador

**Verificación**:
```bash
# Verificar servicios
pm2 status
curl http://localhost:3001
curl http://localhost:4000/api/parking/status
```

**Soluciones**:

1. **Frontend no carga**:
   ```bash
   pm2 restart parking-frontend
   pm2 logs parking-frontend --lines 50
   ```

2. **API no responde**:
   ```bash
   pm2 restart parking-backend
   pm2 logs parking-backend --lines 50
   ```

3. **Firewall bloqueando**:
   ```bash
   sudo ufw status
   sudo ufw allow 3001/tcp
   sudo ufw allow 4000/tcp
   ```

---

## 📷 PROBLEMAS DE SCANNER

### ❌ PROBLEMA: Scanner no lee códigos de barras

**Diagnóstico**:
1. Abrir editor de texto
2. Apuntar scanner a código
3. Presionar gatillo

**Soluciones**:

1. **Scanner no envía datos**:
   - Verificar cable USB conectado
   - Probar en otro puerto USB
   - LED debe estar verde

2. **Formato incorrecto**:
   ```bash
   # El scanner debe estar en modo HID (teclado)
   # Escanear código de configuración del manual
   ```

3. **No agrega Enter al final**:
   - Configurar sufijo CR+LF en scanner
   - Consultar manual Honeywell 1250g

---

## 💻 PROBLEMAS DE INTERFAZ

### ❌ PROBLEMA: Modo kiosko no funciona

**Síntomas**:
- Se puede salir del navegador
- Barra de tareas visible
- Menús accesibles

**Solución**:
```bash
# Verificar configuración
cat /home/parking/.config/openbox/autostart

# Reiniciar sesión gráfica
sudo systemctl restart lightdm
```

### ❌ PROBLEMA: Pantalla en blanco o error de carga

**Verificación**:
```bash
# Revisar consola del navegador (F12)
# Ver logs del frontend
pm2 logs parking-frontend
```

**Soluciones**:
1. Limpiar caché del navegador: `Ctrl+Shift+R`
2. Reiniciar servicios: `pm2 restart all`
3. Verificar compilación: `cd /home/parking/parking-system && npm run build`

---

## ⚡ PROBLEMAS DE RENDIMIENTO

### ❌ PROBLEMA: Sistema muy lento

**Diagnóstico**:
```bash
# Verificar recursos
htop
df -h
free -m

# Verificar logs grandes
du -sh /home/parking/.pm2/logs/*
```

**Soluciones**:

1. **Limpiar logs**:
   ```bash
   pm2 flush
   ```

2. **Reiniciar servicios**:
   ```bash
   pm2 restart all
   sudo systemctl restart postgresql
   ```

3. **Limpiar base de datos** (solo si hay muchos registros antiguos):
   ```sql
   -- Eliminar tickets antiguos (más de 30 días)
   DELETE FROM "Ticket" WHERE "exitTime" < NOW() - INTERVAL '30 days';
   ```

---

## 🔒 PROBLEMAS DE SEGURIDAD

### ❌ PROBLEMA: Usuario puede salir del modo kiosko

**Soluciones**:
```bash
# Deshabilitar teclas de sistema
sudo dpkg-reconfigure keyboard-configuration

# Verificar permisos de usuario
groups parking
# NO debe estar en sudo, admin, etc.
```

### ❌ PROBLEMA: Acceso no autorizado al sistema

**Verificación**:
```bash
# Revisar logs de acceso
sudo journalctl -u ssh -n 50
last -n 20
```

**Soluciones**:
```bash
# Deshabilitar SSH si no es necesario
sudo systemctl disable ssh
sudo systemctl stop ssh

# O restringir acceso
sudo ufw deny ssh
```

---

## 📞 CONTACTO DE EMERGENCIA

Si ninguna solución funciona:

1. **Reinicio seguro del sistema**:
   ```bash
   # Guardar estado actual
   pm2 save
   
   # Reiniciar sistema
   sudo reboot
   ```

2. **Modo de emergencia** (operación manual):
   - Use calculadora para tarifas
   - Anote placas en papel
   - Procese pagos al restaurar sistema

3. **Soporte técnico**:
   - Logs necesarios: `/home/parking/.pm2/logs/`
   - Configuración: `/home/parking/parking-system/.env`
   - Estado: `pm2 status` y `systemctl status`

---

## 🔄 PROCEDIMIENTO DE RECUPERACIÓN COMPLETA

Si el sistema está completamente dañado:

```bash
# 1. Respaldar datos actuales
sudo -u postgres pg_dump parking_lot_prod > backup_emergency.sql

# 2. Reinstalar aplicación
cd /home/parking
git clone https://github.com/[tu-repo]/parking-system.git parking-system-new
cd parking-system-new

# 3. Copiar configuración
cp ../parking-system/.env .

# 4. Instalar dependencias
npm install
npm run build

# 5. Restaurar base de datos
sudo -u postgres psql parking_lot_prod < backup_emergency.sql

# 6. Reiniciar servicios
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

---

## ✅ PREVENCIÓN DE PROBLEMAS

1. **Respaldos diarios**: Verificar que se ejecutan
2. **Monitoreo**: Revisar logs regularmente
3. **Mantenimiento**: Limpiar logs y datos antiguos mensualmente
4. **Capacitación**: Operadores deben conocer procedimientos básicos
5. **Documentación**: Mantener contactos y procedimientos actualizados

---

**Última actualización**: Diciembre 2024
**Versión del sistema**: 1.0.0 (con correcciones de pensiones)