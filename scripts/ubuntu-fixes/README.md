# Ubuntu Deployment Fix Package

This directory contains improved deployment scripts that address common issues when installing the parking management system on Ubuntu, particularly on ThinkPad hardware.

## Quick Start

1. **Run the preflight check first:**
   ```bash
   sudo bash scripts/ubuntu-fixes/preflight-check-ubuntu.sh
   ```
   Review and fix any reported issues before proceeding.

2. **Use the improved deployment script:**
   ```bash
   sudo bash scripts/ubuntu-fixes/deploy-ubuntu-improved.sh
   ```
   This script includes checkpoints and better error handling.

## Files Overview

### Core Scripts

- **`preflight-check-ubuntu.sh`** - Comprehensive system validation
  - Checks Ubuntu version compatibility
  - Detects display manager conflicts
  - Validates network configuration
  - Identifies package manager issues
  - Tests hardware compatibility
  
- **`deploy-ubuntu-improved.sh`** - Master deployment orchestrator
  - Runs all installation phases with error handling
  - Supports checkpoint recovery
  - Enables SSH before kiosk mode
  - Creates system restore points

- **`setup-kiosk-improved.sh`** - Enhanced kiosk configuration
  - Automatic display resolution detection
  - Better error handling for display managers
  - Recovery mechanisms built-in
  - ThinkPad-specific optimizations

- **`fix-display-manager.sh`** - Resolves display manager conflicts
  - Safely transitions from GDM3/others to LightDM
  - Creates configuration backups
  - Provides restore scripts

### Documentation

- **`UBUNTU_DEPLOYMENT_GUIDE.md`** - Comprehensive troubleshooting guide
  - Common issues and solutions
  - Recovery procedures
  - Best practices
  - Emergency recovery steps

## Key Improvements

1. **Better Error Handling**
   - Scripts continue on non-critical failures
   - Clear error messages with solutions
   - Checkpoint system for resuming failed installations

2. **Display Manager Safety**
   - Detects and resolves conflicts before they break the system
   - Automatic backup of existing configurations
   - Safe transition between display managers

3. **Kiosk Mode Protection**
   - SSH enabled before kiosk activation
   - Multiple recovery methods documented
   - Automatic display detection instead of hardcoded values

4. **Hardware Compatibility**
   - ThinkPad-specific optimizations
   - Dynamic resolution detection
   - Fallback configurations for various models

## Usage Scenarios

### Fresh Installation
```bash
# 1. Check system readiness
sudo bash scripts/ubuntu-fixes/preflight-check-ubuntu.sh

# 2. Fix any reported issues

# 3. Run improved deployment
sudo bash scripts/ubuntu-fixes/deploy-ubuntu-improved.sh
```

### Failed Installation Recovery
```bash
# Continue from last checkpoint
sudo bash scripts/ubuntu-fixes/deploy-ubuntu-improved.sh --continue

# Or start fresh
sudo bash scripts/ubuntu-fixes/deploy-ubuntu-improved.sh --clean
```

### Display Manager Issues
```bash
# If system is accessible but display manager is broken
sudo bash scripts/ubuntu-fixes/fix-display-manager.sh
```

### Kiosk Mode Issues
```bash
# If kiosk mode renders system unusable:
# 1. Access via SSH (if enabled)
# 2. Or boot to recovery mode
# 3. Then run:
sudo rm /etc/lightdm/lightdm.conf.d/50-parking-kiosk.conf
sudo systemctl restart lightdm
```

## Safety Features

1. **Pre-deployment Validation**
   - System requirements check
   - Service conflict detection
   - Package manager state validation

2. **Deployment Protection**
   - SSH enabled before kiosk mode
   - System restore points created
   - Configuration backups maintained

3. **Recovery Options**
   - Multiple recovery methods documented
   - Restore scripts automatically generated
   - Checkpoint system for resuming

## Troubleshooting

If deployment fails:

1. Check the log file shown in the output
2. Review `UBUNTU_DEPLOYMENT_GUIDE.md` for specific error solutions
3. Use checkpoint recovery: `--continue` flag
4. Access system via SSH if kiosk mode is problematic

## Testing Recommendations

1. **Always test in a VM first**
2. **Keep SSH access enabled during initial deployments**
3. **Create system backups before deployment**
4. **Have Ubuntu Live USB ready for emergency recovery**

## Support

For detailed troubleshooting, see `UBUNTU_DEPLOYMENT_GUIDE.md` in this directory.