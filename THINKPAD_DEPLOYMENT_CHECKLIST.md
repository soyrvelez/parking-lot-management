# 📋 Lista de Verificación para Despliegue en ThinkPad

## Resumen de Preparación
✅ **Sistema listo para instalación en ThinkPad**
✅ **Base de datos limpia con solo usuario admin/admin123**
✅ **Documentación de configuración para usuarios no técnicos completa**
✅ **Scripts de instalación automatizada funcionales**

---

## 🖥️ REQUISITOS DE HARDWARE VERIFICADOS

### ✅ ThinkPad Especificaciones Mínimas
- [ ] **Modelo:** Serie T, E, o L (T480+ recomendado)
- [ ] **Procesador:** Intel Core i5 8va gen o superior
- [ ] **RAM:** 8GB DDR4 mínimo (16GB recomendado)
- [ ] **Almacenamiento:** 256GB SSD NVMe (512GB recomendado)
- [ ] **Pantalla:** 14" o 15.6" con resolución 1920x1080
- [ ] **Puertos USB:** Mínimo 3 puertos USB-A disponibles
- [ ] **Conectividad:** Puerto Ethernet + WiFi 802.11ac

### ✅ Hardware Periférico
- [ ] **Impresora:** Epson TM-T20III con interfaz Ethernet
- [ ] **Escáner:** Honeywell Voyager 1250g (USB HID)
- [ ] **UPS:** Sistema de alimentación ininterrumpida (recomendado)
- [ ] **Switch/Router:** Para conectar impresora y ThinkPad
- [ ] **Cables Ethernet:** Cat 5e o superior

---

## 📀 PREPARACIÓN DE SISTEMA OPERATIVO

### ✅ Ubuntu 22.04 LTS
- [ ] **ISO Descargada:** ubuntu-22.04.4-desktop-amd64.iso
- [ ] **Checksum Verificado:** SHA256 coincidente
- [ ] **USB Booteable:** Preparado con balenaEtcher o dd
- [ ] **Configuración BIOS:**
  - [ ] Secure Boot deshabilitado
  - [ ] USB Legacy Support habilitado
  - [ ] Boot Order: USB primero

### ✅ Configuración de Instalación
- [ ] **Idioma:** Español (México)
- [ ] **Teclado:** Español (Latinoamérica)
- [ ] **Zona Horaria:** America/Mexico_City
- [ ] **Usuario:** `operador` (sin privilegios sudo)
- [ ] **Hostname:** `parking-terminal-01`
- [ ] **Autologin:** Habilitado para usuario operador

---

## 🔧 CONFIGURACIÓN DE RED

### ✅ Configuración IP
- [ ] **IP Estática Configurada:** Para ThinkPad
  - Ejemplo: 192.168.1.10/24
  - Gateway: 192.168.1.1
  - DNS: 8.8.8.8, 8.8.4.4

### ✅ Impresora Ethernet
- [ ] **IP Impresora:** 192.168.1.100 (predeterminada)
- [ ] **Conectividad:** Ping exitoso desde ThinkPad
- [ ] **Puerto Raw:** 9100 habilitado
- [ ] **Configuración Impresa:** Página de test impresa

---

## 💾 CONFIGURACIÓN DE SOFTWARE

### ✅ Base de Datos
- [ ] **PostgreSQL 14:** Instalado y funcionando
- [ ] **Base de Datos:** `parking_lot` creada
- [ ] **Usuario DB:** `parking_user` con permisos correctos
- [ ] **Seeding:** Ejecutado con admin/admin123
- [ ] **Conexión:** Verificada desde aplicación

### ✅ Aplicación Web
- [ ] **Node.js 20 LTS:** Instalado
- [ ] **Dependencias:** `npm install` exitoso
- [ ] **Build:** `npm run build` sin errores
- [ ] **Variables .env:** Configuradas para producción
- [ ] **Servicios systemd:** Configurados y habilitados

---

## 🔐 CONFIGURACIÓN DE SEGURIDAD

### ✅ Sistema Endurecido
- [ ] **Firewall UFW:** Configurado y activo
- [ ] **SSH:** Solo acceso con claves, no contraseñas
- [ ] **Fail2ban:** Configurado para SSH
- [ ] **Usuario Operador:** Sin privilegios sudo
- [ ] **Servicios:** Solo necesarios habilitados

### ✅ Acceso Administrativo
- [ ] **Usuario Admin:** Creado con acceso SSH
- [ ] **Claves SSH:** Generadas e instaladas
- [ ] **VPN (Opcional):** WireGuard configurado
- [ ] **Monitoreo:** Scripts de diagnóstico instalados

---

## 🖱️ MODO KIOSCO CONFIGURADO

### ✅ Interfaz Bloqueada
- [ ] **OpenBox:** Configurado como window manager
- [ ] **Autologin:** Funcional para usuario operador
- [ ] **Chromium Kiosco:** Abre automáticamente la aplicación
- [ ] **Teclado:** Combinaciones peligrosas deshabilitadas
- [ ] **Mouse:** Menú contextual deshabilitado
- [ ] **Pantalla:** Sin salvapantallas ni gestión de energía

### ✅ Scripts de Inicio
- [ ] **Script Kiosco:** `/opt/parking-kiosk-start.sh` ejecutable
- [ ] **Autostart:** Configurado en OpenBox
- [ ] **Monitoreo:** Reinicio automático en caso de fallo
- [ ] **Recovery:** Script de recuperación disponible

---

## 📄 DOCUMENTACIÓN PREPARADA

### ✅ Guías de Usuario
- [ ] **Manual Operador:** En español, paso a paso
- [ ] **Guía Admin:** Procedimientos administrativos
- [ ] **.env Guide:** ENV_CONFIGURATION_GUIDE.md creado
- [ ] **Troubleshooting:** Solución problemas comunes
- [ ] **Contactos:** Soporte técnico actualizados

### ✅ Scripts de Gestión
- [ ] **Instalación:** `install-all.sh` funcional
- [ ] **Diagnóstico:** Scripts de verificación
- [ ] **Respaldos:** Sistema automático configurado
- [ ] **Mantenimiento:** Scripts de limpieza y updates

---

## 🧪 PRUEBAS REALIZADAS

### ✅ Pruebas de Sistema
- [ ] **Boot:** Sistema inicia en modo kiosco automáticamente
- [ ] **Red:** Conectividad a Internet y dispositivos locales
- [ ] **Base de Datos:** Conexión y operaciones CRUD
- [ ] **Aplicación:** Frontend y backend comunicándose
- [ ] **Autenticación:** Login admin funcional

### ✅ Pruebas de Hardware
- [ ] **Impresora:** Ticket de prueba impreso correctamente
- [ ] **Escáner:** Código de barras leído exitosamente
- [ ] **USB:** Dispositivos detectados automáticamente
- [ ] **Ethernet:** Velocidad y estabilidad adecuadas
- [ ] **Pantalla:** Resolución y táctil (si aplica) funcionando

### ✅ Pruebas Operacionales
- [ ] **Flujo Completo:** Entrada → Cobro → Salida
- [ ] **Tickets Perdidos:** Proceso de cobro especial
- [ ] **Pensiones:** Registro y renovación mensual
- [ ] **Caja:** Operaciones de depósito y retiro
- [ ] **Reportes:** Generación de informes admin

---

## 🚀 LISTA DE VERIFICACIÓN PRE-DESPLIEGUE

### ✅ Software Actualizado
- [ ] **Sistema Operativo:** Últimas actualizaciones aplicadas
- [ ] **Aplicación:** Última versión del repositorio
- [ ] **Dependencias:** Todos los packages actualizados
- [ ] **Base de Datos:** Migraciones aplicadas

### ✅ Configuración Producción
- [ ] **Variables .env:** Todas configuradas para producción
- [ ] **JWT Secret:** Cambiado del valor por defecto
- [ ] **IPs de Red:** Configuradas según infraestructura local
- [ ] **Tarifas:** Ajustadas según precios del estacionamiento
- [ ] **Información Negocio:** RFC, dirección, teléfono actualizados

### ✅ Respaldos y Recuperación
- [ ] **Respaldo Inicial:** Base de datos limpia respaldada
- [ ] **Scripts Backup:** Automatizados y probados
- [ ] **Procedimientos Recovery:** Documentados y verificados
- [ ] **Ubicación Remota:** Para respaldos configurada (opcional)

---

## 📋 CREDENCIALES IMPORTANTES

### ✅ Accesos del Sistema
```bash
# Usuario Operador (Kiosco)
Usuario: operador
Sin contraseña (autologin)

# Usuario Administrador (SSH)
Usuario: admin  
Acceso: Solo con claves SSH

# Base de Datos
Usuario: parking_user
Base de Datos: parking_lot
Archivo credenciales: /opt/parking-db-password

# Aplicación Web Admin
Email: admin@parkinglot.local
Password: admin123
```

### ✅ IPs y Puertos
```bash
# Aplicación Web
Frontend: http://localhost:3001
Backend API: http://localhost:4000

# Hardware
Impresora: 192.168.1.100:9100
ThinkPad: [IP según configuración local]

# Servicios
SSH: Puerto 22
PostgreSQL: Puerto 5432 (solo local)
```

---

## ⚡ COMANDOS RÁPIDOS DE VERIFICACIÓN

### ✅ Estado del Sistema
```bash
# Verificar servicios
sudo systemctl status parking-backend parking-frontend postgresql

# Verificar conectividad impresora
ping -c 3 192.168.1.100

# Verificar escáner USB
lsusb | grep Honeywell

# Verificar logs aplicación
sudo journalctl -u parking-backend -f

# Ejecutar diagnóstico completo
sudo /opt/parking-diagnostics
```

### ✅ Comandos de Emergencia
```bash
# Salir del modo kiosco
Ctrl + Alt + F2

# Reiniciar servicios
sudo systemctl restart parking-backend parking-frontend

# Reiniciar modo kiosco
sudo systemctl restart lightdm

# Respaldo manual
sudo /opt/parking-system/maintenance/backup-full.sh
```

---

## 🎯 PASOS FINALES ANTES DE DESPLIEGUE

### 1. ✅ Verificación Completa
```bash
# Ejecutar script maestro de verificación
sudo /opt/parking-system/deploy/pre-production-check.sh

# Revisar checklist go-live
sudo /opt/parking-system/deploy/go-live-checklist.sh
```

### 2. ✅ Capacitación Personal
- [ ] **Operadores:** Entrenados en flujo básico
- [ ] **Supervisor:** Conoce procedimientos admin
- [ ] **Soporte:** Contactos confirmados y disponibles

### 3. ✅ Documentación Entregada
- [ ] **Manual Operador:** Impreso y ubicado junto al kiosco
- [ ] **Guía Configuración:** ENV_CONFIGURATION_GUIDE.md
- [ ] **Contactos Emergencia:** Visibles junto al sistema
- [ ] **Procedimientos Backup:** Documentados

---

## 🚨 PROCEDIMIENTO DE INSTALACIÓN FINAL

### Comando de Instalación Automática:
```bash
# 1. Descargar sistema
git clone [repositorio] /opt/parking-system
cd /opt/parking-system

# 2. Ejecutar instalación completa
sudo ./scripts/install-all.sh production

# 3. Reiniciar para activar modo kiosco
sudo reboot

# 4. Verificar funcionamiento post-reboot
sudo /opt/parking-diagnostics
```

### Tiempo Estimado: 45-90 minutos

---

## ✅ CONFIRMACIÓN FINAL

**Sistema completamente listo para despliegue en ThinkPad:**

- [x] **Hardware compatible y probado**
- [x] **Software instalado y configurado**  
- [x] **Base de datos limpia con admin/admin123**
- [x] **Documentación completa para no técnicos**
- [x] **Scripts de instalación automatizada**
- [x] **Modo kiosco seguro configurado**
- [x] **Procedimientos de respaldo implementados**
- [x] **Sistema de monitoreo y diagnóstico**

---

**🎉 SISTEMA LISTO PARA PRODUCCIÓN**

*Para iniciar despliegue, ejecutar: `sudo ./scripts/install-all.sh production`*

---

*Versión 1.0 - Diciembre 2024*  
*Sistema de Gestión de Estacionamiento*  
*Configurado para ThinkPad con Ubuntu 22.04 LTS*