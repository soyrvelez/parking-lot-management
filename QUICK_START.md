# 🚀 Quick Start Guide - ThinkPad Kiosk Setup

## For Non-Technical Users

This guide will help you set up the parking lot management system on your ThinkPad in simple steps.

---

## 📦 What You Need

### Hardware
- ✅ ThinkPad with Ubuntu 20.04+ or 22.04+
- ✅ Epson TM-T20III thermal printer
- ✅ Honeywell Voyager 1250g barcode scanner
- ✅ Internet connection
- ✅ USB cables

### Before You Start
- ✅ ThinkPad is powered on and connected to internet
- ✅ You have admin/sudo access to the ThinkPad
- ✅ Printer and scanner are nearby (don't connect yet)

---

## 🎯 Installation Steps

### Step 1: Download the System
1. Open Terminal (Ctrl+Alt+T)
2. Copy and paste this command:
```bash
git clone https://github.com/soyrvelez/parking-lot-management.git
cd parking-lot-management
```

### Step 2: Run the Automatic Installer
1. Copy and paste this command:
```bash
chmod +x scripts/install-all.sh
sudo ./scripts/install-all.sh
```

2. **Enter your password when prompted**
3. **Wait for installation to complete** (5-10 minutes)
4. **Don't close the terminal until you see "INSTALLATION COMPLETED!"**

### Step 3: Connect Hardware
1. **Connect the printer:**
   - Plug USB cable from printer to ThinkPad
   - OR configure network printer if using WiFi

2. **Connect the scanner:**
   - Plug USB cable from scanner to ThinkPad
   - Scanner should beep when connected

### Step 4: Restart System
1. Type this command:
```bash
sudo reboot
```

2. **ThinkPad will restart automatically**
3. **System will start in kiosk mode** (fullscreen parking interface)

---

## ✅ Verification

After restart, you should see:
- ✅ **Full-screen parking interface** (no desktop visible)
- ✅ **"Nueva Entrada" tab** is selected
- ✅ **Status bar at bottom** shows system information
- ✅ **Hardware indicators** show printer/scanner status

---

## 🎛️ Admin Access (For Configuration)

### From Another Computer:
1. Open web browser
2. Go to: `http://[ThinkPad-IP]:3000/admin`
3. Login with:
   - **Username:** `admin`
   - **Password:** `admin123`
4. **IMPORTANT:** Change password immediately!

### From the ThinkPad (SSH):
1. Press Ctrl+Alt+F2 (opens terminal)
2. Login as: `admin`
3. Password: `admin123`
4. Run: `ssh admin@localhost`

---

## 🧪 Test the System

### Test Ticket Creation:
1. On kiosk interface, click "Nueva Entrada"
2. Type a license plate (e.g., "ABC123")
3. Click "CREAR BOLETO"
4. **Printer should print a ticket**

### Test Barcode Scanning:
1. Click "Escanear" tab
2. Scan the barcode on the printed ticket
3. **System should show payment screen**

### Test Payment:
1. Enter payment amount
2. Click "PROCESAR PAGO"
3. **Printer should print receipt**

---

## 🚨 If Something Goes Wrong

### Quick Fixes:
```bash
# Restart the parking system
sudo systemctl restart parking-system

# Check if everything is working
./scripts/validate-installation.sh

# View recent errors
sudo journalctl -u parking-system -n 20
```

### Common Issues:
- **Black screen:** Press any key or click mouse
- **Printer not working:** Check USB connection and power
- **Scanner not working:** Unplug and reconnect USB
- **Can't access admin:** Check network connection

### Get Help:
1. **Check troubleshooting guide:** `TROUBLESHOOTING.md`
2. **View installation log:** `/tmp/parking-system-install.log`
3. **Contact your IT support**

---

## 📊 Daily Operation

### For Operators:
- **Interface is automatic** - just follow the screen prompts
- **Use mouse or touch** to navigate
- **Scanner beeps** when reading barcodes successfully
- **Printer automatically** prints tickets and receipts

### For Managers:
- **Access admin panel** from any computer/phone
- **View real-time stats** and reports
- **Export data** to PDF or CSV
- **Monitor system health** remotely

---

## 🔐 Security Features

- ✅ **Kiosk mode** prevents unauthorized access
- ✅ **No desktop access** for operators
- ✅ **Automatic login** for parking interface
- ✅ **Remote admin access** only via SSH/web
- ✅ **Encrypted data** transmission
- ✅ **Firewall protection** enabled

---

## 🎉 You're Ready!

Your ThinkPad is now a professional parking lot management kiosk:

- 🎯 **Easy for operators** to use
- 🛡️ **Secure and locked down**
- 📊 **Professional reporting**
- 🔧 **Remote management**
- 💰 **Revenue tracking**

**Enjoy your automated parking system!** 🚗💨