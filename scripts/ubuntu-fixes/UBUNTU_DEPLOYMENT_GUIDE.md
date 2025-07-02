# Ubuntu Deployment Troubleshooting Guide

## Overview
This guide addresses common issues when deploying the parking management system on Ubuntu, particularly on ThinkPad hardware.

## Pre-Installation Steps

### 1. Run the Preflight Check
Always start with the preflight check to identify potential issues:

```bash
sudo bash scripts/ubuntu-fixes/preflight-check-ubuntu.sh
```

This will generate a detailed report of any system configuration issues.

### 2. System Requirements
- Ubuntu 20.04 LTS or newer (22.04 LTS recommended)
- Minimum 4GB RAM (8GB recommended)
- 20GB free disk space
- Active network connection
- ThinkPad or compatible hardware

## Common Installation Issues and Solutions

### Issue 1: Display Manager Conflicts

**Symptoms:**
- Black screen after reboot
- Unable to login
- System hangs at boot

**Cause:** Ubuntu Desktop often comes with GDM3 pre-installed, which conflicts with LightDM.

**Solution:**
```bash
# Check current display manager
systemctl status gdm3 lightdm

# If GDM3 is active, switch to LightDM
sudo systemctl stop gdm3
sudo systemctl disable gdm3
sudo apt-get install lightdm
sudo dpkg-reconfigure lightdm  # Select lightdm when prompted
sudo systemctl enable lightdm
```

### Issue 2: Kiosk Mode Renders System Unusable

**Symptoms:**
- Cannot exit kiosk mode
- No way to access terminal
- System appears frozen

**Prevention:**
1. Always test in a virtual machine first
2. Enable SSH before configuring kiosk mode:
   ```bash
   sudo systemctl enable ssh
   sudo ufw allow 22/tcp
   ```

**Recovery Methods:**

**Method 1: Boot to Recovery Mode**
1. Reboot the system
2. Hold Shift during boot to access GRUB menu
3. Select "Advanced options for Ubuntu"
4. Select recovery mode
5. Choose "root - Drop to root shell prompt"
6. Disable autologin:
   ```bash
   rm /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
   systemctl disable lightdm
   reboot
   ```

**Method 2: Use TTY Console**
1. Press Ctrl+Alt+F2 to switch to TTY2
2. Login as admin user
3. Disable kiosk mode:
   ```bash
   sudo systemctl stop lightdm
   sudo rm /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
   sudo systemctl start lightdm
   ```

**Method 3: SSH Access (if enabled)**
```bash
ssh admin@<thinkpad-ip>
sudo systemctl stop lightdm
sudo mv /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf /tmp/
sudo systemctl start lightdm
```

### Issue 3: Package Installation Failures

**Symptoms:**
- "Unable to locate package" errors
- Dependency conflicts
- Lock file errors

**Solutions:**

```bash
# Fix dpkg locks
sudo killall apt apt-get
sudo rm /var/lib/apt/lists/lock
sudo rm /var/cache/apt/archives/lock
sudo rm /var/lib/dpkg/lock*
sudo dpkg --configure -a
sudo apt-get update

# Fix broken packages
sudo apt-get install -f
sudo apt-get clean
sudo apt-get autoclean

# Update package lists
sudo apt-get update
sudo apt-get upgrade
```

### Issue 4: Service Start Failures

**Symptoms:**
- parking-system service won't start
- Application not accessible
- Health check failures

**Diagnosis:**
```bash
# Check service status
sudo systemctl status parking-system

# Check logs
sudo journalctl -u parking-system -n 100

# Check if port is in use
sudo lsof -i :3000
```

**Common Fixes:**
```bash
# Ensure proper permissions
sudo chown -R parking:parking /opt/parking-system

# Check environment file
cat /opt/parking-system/.env

# Manually test the application
cd /opt/parking-system
sudo -u parking npm start
```

### Issue 5: Display Resolution Issues

**Symptoms:**
- Wrong resolution in kiosk mode
- Display not fitting screen
- Black borders around application

**Solution:**
Use the improved kiosk setup script which includes automatic display detection:

```bash
sudo bash scripts/ubuntu-fixes/setup-kiosk-improved.sh
```

If issues persist, manually set resolution:
```bash
# Find available resolutions
xrandr

# Edit autostart file
sudo nano /home/operador/.config/openbox/autostart
# Change the resolution in the xrandr command
```

### Issue 6: Hardware-Specific ThinkPad Issues

**For ThinkPad TrackPoint/TouchPad:**
```bash
# Install ThinkPad extras
sudo apt-get install tp-smapi-dkms hdapsd

# Configure TrackPoint sensitivity
echo -n 200 | sudo tee /sys/devices/platform/i8042/serio1/serio2/sensitivity
```

**For Display Brightness:**
```bash
# Install brightness control
sudo apt-get install xbacklight

# Add to autostart
echo "xbacklight -set 80" >> /home/operador/.config/openbox/autostart
```

## Deployment Best Practices

### 1. Use the Improved Scripts
Always use the improved scripts in `scripts/ubuntu-fixes/`:
- `preflight-check-ubuntu.sh` - Run before installation
- `setup-kiosk-improved.sh` - For kiosk configuration
- `fix-display-manager.sh` - To resolve display manager issues

### 2. Test in Stages
1. First test in a VM
2. Test on similar hardware
3. Deploy to production with SSH enabled
4. Disable SSH after confirming stability

### 3. Create Restore Points
Before major changes:
```bash
# Create system backup
sudo timeshift --create --comments "Before parking system deployment"

# Or use the built-in backup
sudo tar -czf /backup/system-$(date +%Y%m%d).tar.gz /etc /opt /home
```

### 4. Monitor Deployment
```bash
# Watch installation logs
tail -f /var/log/parking-installation-*.log

# Monitor system resources
htop

# Check service status
watch -n 2 'systemctl status parking-system'
```

## Post-Installation Verification

### 1. Verify All Services
```bash
# Check all parking services
systemctl status parking-system
systemctl status parking-kiosk-monitor
systemctl status lightdm

# Verify network connectivity
ping -c 4 8.8.8.8
curl http://localhost:3000/health
```

### 2. Test Kiosk Mode
Before final reboot:
```bash
# Test kiosk startup script manually
sudo -u operador DISPLAY=:0 /opt/parking-kiosk-launcher.sh
```

### 3. Verify Hardware
```bash
# Test printer connection
ping 192.168.1.100

# Test scanner (if USB)
lsusb | grep Honeywell
```

## Emergency Recovery Procedure

If the system becomes completely unusable:

1. **Boot from Ubuntu Live USB**
2. **Mount the system partition:**
   ```bash
   sudo mount /dev/sda1 /mnt  # Adjust device as needed
   ```
3. **Remove kiosk configuration:**
   ```bash
   sudo rm /mnt/etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
   sudo rm /mnt/home/operador/.config/openbox/autostart
   ```
4. **Reboot normally**

## Support Resources

### Log Files
- Installation: `/var/log/parking-installation-*.log`
- Kiosk: `/var/log/parking-kiosk.log`
- Application: `/var/log/parking-system.log`
- Recovery: `/var/log/parking-recovery.log`

### Configuration Files
- LightDM: `/etc/lightdm/lightdm.conf.d/`
- OpenBox: `/home/operador/.config/openbox/`
- SystemD: `/etc/systemd/system/parking-*.service`

### Backup Locations
- Pre-install: `/opt/parking-backups/`
- Config backups: `/opt/parking-backups/kiosk-*/`

## Contact Support

If issues persist after following this guide:
1. Collect all log files
2. Run the preflight check and save the report
3. Document the specific error messages
4. Note the ThinkPad model and Ubuntu version