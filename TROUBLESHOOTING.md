# 🛠️ Parking Lot Management System - Troubleshooting Guide

## Quick Problem Resolution

### 🚨 Emergency Recovery Commands

If the system stops working, try these commands in order:

```bash
# 1. Restart the main service
sudo systemctl restart parking-system

# 2. Check service status
sudo systemctl status parking-system

# 3. View recent logs
sudo journalctl -u parking-system -n 50

# 4. Restart the entire system
sudo reboot
```

---

## 📋 Common Issues & Solutions

### 1. **Kiosk Mode Not Starting**

**Symptoms:** Desktop shows instead of parking interface

**Solutions:**
```bash
# Check kiosk user
sudo -u kiosk whoami

# Restart kiosk service
sudo systemctl restart parking-kiosk

# Verify autostart file
ls -la /home/kiosk/.config/autostart/
```

### 2. **Printer Not Working**

**Symptoms:** No tickets printing, printer errors

**Solutions:**
```bash
# Check printer connection
lpinfo -v

# Restart CUPS service
sudo systemctl restart cups

# Check printer status
lpstat -p

# Re-run printer setup
sudo ./scripts/hardware/setup-printer.sh
```

### 3. **Scanner Not Recognized**

**Symptoms:** Barcode scanning not working

**Solutions:**
```bash
# Check USB devices
lsusb | grep -i honeywell

# Check device permissions
ls -la /dev/bus/usb/*/*

# Restart with scanner connected
sudo reboot
```

### 4. **Website Not Loading**

**Symptoms:** Browser shows error or blank page

**Solutions:**
```bash
# Check if services are running
sudo systemctl status parking-system
curl http://localhost:3000

# Check ports
sudo netstat -tlnp | grep -E ":3000|:5000"

# Restart application
sudo systemctl restart parking-system
```

### 5. **Database Errors**

**Symptoms:** "Database not found" or connection errors

**Solutions:**
```bash
# Check database file
ls -la /opt/parking-system/prisma/dev.db

# Check database permissions
sudo chown -R parking:parking /opt/parking-system/

# Reinitialize database
cd /opt/parking-system
sudo -u parking npm run db:reset
```

### 6. **Admin Panel Access Issues**

**Symptoms:** Cannot login to admin panel

**Solutions:**
```bash
# Reset admin password
cd /opt/parking-system
sudo -u parking npm run reset-admin-password

# Check admin service
curl http://localhost:5000/api/admin/health

# Verify environment variables
sudo cat /opt/parking-system/.env | grep JWT
```

---

## 🔧 Advanced Diagnostics

### System Health Check
```bash
# Run comprehensive validation
sudo ./scripts/validate-installation.sh

# Check system resources
htop
df -h
free -h

# View all service logs
sudo journalctl -xe
```

### Network Diagnostics
```bash
# Check network connectivity
ping google.com

# Verify local services
nmap localhost

# Check firewall status
sudo ufw status verbose
```

### Hardware Diagnostics
```bash
# Check all USB devices
lsusb -t

# Check printer queue
lpq

# Test printer connection
echo "Test print" | lp

# Check hardware logs
dmesg | grep -i -E "(usb|printer|scanner)"
```

---

## 📞 Getting Help

### Logs to Check
1. **Application Logs:** `sudo journalctl -u parking-system -f`
2. **System Logs:** `sudo journalctl -xe`
3. **Installation Log:** `/tmp/parking-system-install.log`
4. **Printer Logs:** `sudo journalctl -u cups -f`

### Information to Gather
Before contacting support, collect:

```bash
# System information
uname -a
lsb_release -a
free -h
df -h

# Service status
sudo systemctl status parking-system
sudo systemctl status parking-kiosk

# Recent logs
sudo journalctl -u parking-system -n 50 > ~/parking-logs.txt
```

### Contact Information
- **System Administrator:** [Your contact info]
- **Technical Support:** [Support contact]
- **Emergency Contact:** [Emergency contact]

---

## 🔄 Complete System Reset

If all else fails, you can completely reinstall:

```bash
# 1. Stop all services
sudo systemctl stop parking-system parking-kiosk

# 2. Remove installation
sudo rm -rf /opt/parking-system
sudo userdel -r parking 2>/dev/null || true
sudo userdel -r kiosk 2>/dev/null || true

# 3. Re-run installer
cd ~/parking-lot-management
sudo ./scripts/install-all.sh

# 4. Validate installation
./scripts/validate-installation.sh
```

---

## 🛡️ Security Notes

- **Never share admin credentials**
- **Always use SSH for remote access**
- **Keep the system updated monthly**
- **Backup the database weekly**

---

## 📝 Maintenance Schedule

### Daily
- Check printer paper and ink
- Verify scanner functionality
- Monitor system performance

### Weekly
- Review system logs
- Check disk space
- Backup database

### Monthly
- Update system packages
- Check security settings
- Review user access

---

*For emergency situations, contact your system administrator immediately.*