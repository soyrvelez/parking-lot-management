# Hardware Compatibility Guide

## Parking Lot Management System - Supported Hardware

This document outlines tested and compatible hardware for the parking lot management system.

---

## 🖥️ Tested ThinkPad Models

### Fully Tested and Supported

| Model | CPU | RAM | Storage | USB Ports | Display | Status |
|-------|-----|-----|---------|-----------|---------|---------|
| ThinkPad T14 Gen 2 | AMD Ryzen 5 PRO | 16GB | 512GB SSD | 2x USB-A, 2x USB-C | 14" FHD | ✅ Excellent |
| ThinkPad T15 Gen 2 | Intel i5-1135G7 | 8GB | 256GB SSD | 2x USB-A, 2x USB-C | 15.6" FHD | ✅ Excellent |
| ThinkPad X1 Carbon Gen 8 | Intel i7-10510U | 16GB | 1TB SSD | 2x USB-A, 2x USB-C | 14" WQHD | ✅ Excellent |
| ThinkPad X1 Carbon Gen 9 | Intel i7-1165G7 | 16GB | 512GB SSD | 2x USB-A, 2x USB-C | 14" FHD | ✅ Excellent |

### Compatible (Not Fully Tested)

| Model | Notes | Compatibility |
|-------|-------|---------------|
| ThinkPad T14s | Similar to T14, should work | ⚠️ Likely Compatible |
| ThinkPad P14s | Professional workstation variant | ⚠️ Likely Compatible |
| ThinkPad L14/L15 | Budget line, may have driver issues | ⚠️ Partial Support |
| ThinkPad E14/E15 | Entry level, limited testing | ❓ Unknown |

### Not Recommended

- **ThinkPad models older than 2018** (Gen 6 and below)
- **Models with less than 8GB RAM**
- **Models without USB 3.0 ports**

---

## 🖨️ Thermal Printer Compatibility

### Primary Supported (Tested)

#### Epson TM-T20III
- **Connection:** USB, Ethernet, Serial
- **Paper Width:** 80mm (3.15")
- **Print Speed:** 250mm/sec
- **USB ID:** `04b8:0202` or `04b8:0203`
- **Status:** ✅ Fully Supported
- **Configuration:** Automatic via USB, Manual for network

```bash
# Test command
sudo /opt/test-thermal-printer.sh
```

### Secondary Supported (Compatible)

#### Epson TM-T20II
- **Connection:** USB, Serial
- **USB ID:** `04b8:0201`
- **Status:** ✅ Compatible
- **Notes:** Older model, all features supported

#### Epson TM-T88V
- **Connection:** USB, Ethernet, Serial
- **USB ID:** `04b8:0202`
- **Status:** ✅ Compatible
- **Notes:** Higher-end model, full compatibility

#### Star Micronics TSP143IIIBI
- **Connection:** USB, Bluetooth
- **USB ID:** `0519:0003`
- **Status:** ⚠️ Partial Support
- **Notes:** Requires additional driver configuration

### Network Printer Configuration

For network-connected printers:

```bash
# Default network printer IP
PRINTER_IP="192.168.1.100"

# Test network connectivity
ping $PRINTER_IP

# Manual CUPS configuration
lpadmin -p EpsonTM-T20III -E -v socket://$PRINTER_IP:9100 -m raw
```

---

## 📱 Barcode Scanner Compatibility

### Primary Supported (Tested)

#### Honeywell Voyager 1250g
- **Connection:** USB HID
- **Symbologies:** Code 39, Code 128, UPC, EAN
- **USB ID:** `0c2e:0b61`
- **Status:** ✅ Fully Supported
- **Scan Rate:** 72 scans/sec
- **Configuration:** Code 39 enabled by default

```bash
# Test command
/opt/test-barcode-scanner.sh
```

#### Configuration Codes for Honeywell Voyager 1250g

**Enable Code 39:**
```
*CODE39ON*
```

**Disable EAN/UPC (recommended):**
```
*EANUPCOFF*
```

**Set suffix to Enter:**
```
*SUFFIXENTER*
```

### Secondary Supported

#### Honeywell Voyager 1200g (Wired)
- **USB ID:** `0c2e:0b6a`
- **Status:** ✅ Compatible
- **Notes:** Same configuration as 1250g

#### Symbol/Zebra LS2208
- **USB ID:** `05e0:1200`
- **Status:** ⚠️ Partial Support
- **Notes:** Requires manual udev rules

### Scanner Setup Requirements

1. **USB HID Mode:** Scanner must be configured as USB HID device
2. **Code 39 Support:** Primary barcode format for parking tickets
3. **Suffix Character:** Configure to send Enter (CR) after scan
4. **Auto-trigger Mode:** Automatic scanning when barcode detected

---

## 💻 System Requirements

### Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | Intel i3 or AMD Ryzen 3 | Intel i5 or AMD Ryzen 5 |
| **RAM** | 4GB | 8GB |
| **Storage** | 128GB SSD | 256GB SSD |
| **USB Ports** | 2x USB 2.0 | 2x USB 3.0 |
| **Network** | Ethernet or WiFi | Gigabit Ethernet |
| **Display** | 1024x768 | 1920x1080 |

### Operating System Support

| OS Version | Support Level | Notes |
|------------|---------------|-------|
| Ubuntu 22.04 LTS | ✅ Fully Supported | Recommended |
| Ubuntu 20.04 LTS | ✅ Fully Supported | Stable |
| Ubuntu 18.04 LTS | ⚠️ Legacy Support | End of support soon |
| Other Linux | ❓ Unknown | May require modifications |

---

## 🔌 Connectivity Requirements

### Network Configuration

#### Wired Network (Recommended)
- **Speed:** 100 Mbps minimum, 1 Gbps preferred
- **Switch ports:** Managed switch recommended
- **VLAN:** Optional, can be configured

#### WiFi Network
- **Standard:** 802.11n minimum, 802.11ac preferred
- **Security:** WPA2 or WPA3
- **Bandwidth:** Dedicated or QoS-managed

### Port Requirements

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Web Interface | 3000 | HTTP/TCP | Operator and admin access |
| API Server | 5000 | HTTP/TCP | Backend services |
| SSH Admin | 22 | SSH/TCP | Remote administration |
| Printer (Network) | 9100 | RAW/TCP | Thermal printer communication |

---

## 🧪 Hardware Testing Procedures

### Pre-Installation Hardware Check

```bash
# Run comprehensive hardware check
./scripts/preflight-check.sh

# Check specific hardware
lsusb | grep -i "epson\|honeywell"
lscpu | grep "Model name"
free -h
df -h
```

### Post-Installation Testing

```bash
# Test all hardware components
sudo ./scripts/test/test-system.sh

# Test kiosk mode specifically
sudo ./scripts/test/test-kiosk-mode.sh

# Validate complete installation
./scripts/validate-installation.sh
```

### Hardware Troubleshooting

#### Printer Issues
```bash
# Check printer status
lpstat -p
sudo /opt/check-usb-printer.sh

# Test print job
echo "Test print" | lp -d EpsonTM-T20III

# Check CUPS logs
sudo tail -f /var/log/cups/error_log
```

#### Scanner Issues
```bash
# Check scanner detection
/opt/scanner-detect.sh
lsusb | grep -i honeywell

# Test input events
sudo evtest /dev/input/barcode-scanner-event

# Check udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## 📋 Hardware Procurement Guide

### Recommended Purchase Configuration

**For a complete parking lot management kiosk:**

1. **ThinkPad T14 Gen 2 or newer**
   - AMD Ryzen 5 PRO or Intel i5
   - 16GB RAM
   - 256GB SSD minimum
   - Windows license (will be replaced with Ubuntu)

2. **Epson TM-T20III Thermal Printer**
   - USB interface model: `C31CH51001`
   - Ethernet interface model: `C31CH51002`
   - Paper rolls: 80mm thermal paper
   - Cables: USB-A to USB-B cable

3. **Honeywell Voyager 1250g Scanner**
   - Model: `MS1250G-2USB-1`
   - USB cable included
   - Stand optional: `46-46128` (AutoStand)

### Budget Alternative Configuration

**For cost-conscious deployments:**

1. **Used/Refurbished ThinkPad T14 Gen 1**
   - Intel i5-10210U or AMD Ryzen 5 PRO 4650U
   - 8GB RAM (minimum acceptable)
   - 256GB SSD

2. **Epson TM-T20II** (refurbished)
   - USB interface
   - Older but compatible model

3. **Honeywell Voyager 1200g** (wired)
   - Basic model without advanced features
   - Full compatibility maintained

### Supplier Recommendations

#### Hardware Vendors
- **Dell Business Direct** (ThinkPads)
- **CDW** (Complete solutions)
- **Insight** (Volume discounts)
- **Amazon Business** (Small quantities)

#### POS Equipment Specialists
- **POSGuys** (Printers and scanners)
- **Barcodes Inc** (Scanner specialists)
- **POS Paper Plus** (Thermal paper supplies)

---

## 🔧 Maintenance and Support

### Hardware Maintenance Schedule

| Component | Daily | Weekly | Monthly | Annually |
|-----------|-------|--------|---------|----------|
| **Printer** | Paper check | Clean print head | Replace paper rolls | Professional service |
| **Scanner** | Lens cleaning | Cable inspection | Firmware check | Replacement if needed |
| **ThinkPad** | Visual inspection | Dust removal | Software updates | Hardware diagnostics |

### Replacement Parts Inventory

**Keep in stock:**
- Thermal paper rolls (80mm x 80mm)
- USB cables (USB-A to USB-B)
- Cleaning cards for printer
- Lens cleaning wipes for scanner

### Support Contacts

- **Hardware Issues:** Contact supplier or manufacturer
- **Software Issues:** Check `TROUBLESHOOTING.md`
- **Integration Issues:** Run diagnostic scripts

---

## 📞 Technical Support Matrix

| Issue Type | First Step | Second Step | Escalation |
|------------|------------|-------------|------------|
| **Hardware Detection** | Run `/opt/scanner-detect.sh` | Check USB connections | Replace hardware |
| **Print Quality** | Clean print head | Replace paper | Replace printer |
| **Scan Accuracy** | Clean scanner lens | Reconfigure symbology | Replace scanner |
| **Performance** | Check system resources | Review logs | Hardware upgrade |

For hardware-specific support, always include:
- Model numbers and serial numbers
- USB IDs (`lsusb` output)
- Error messages from diagnostic scripts
- System specifications (`lscpu`, `free -h`, `df -h`)