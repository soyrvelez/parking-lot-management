#!/bin/bash

# Chromium Installation Fix for Ubuntu 22.04+
# Handles the transition from .deb to snap packaging

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
warn() { echo -e "${YELLOW}[WARNING] $1${NC}"; }
info() { echo -e "${BLUE}[INFO] $1${NC}"; }

# Check root
if [[ $EUID -ne 0 ]]; then
   error "Este script debe ejecutarse como root (sudo)"
   exit 1
fi

log "=== CONFIGURACIÓN DE CHROMIUM PARA UBUNTU ==="

# Detect Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    ubuntu_version=$(echo "$VERSION_ID" | cut -d. -f1)
    log "Ubuntu version detected: $VERSION_ID"
else
    error "Cannot detect Ubuntu version"
    exit 1
fi

# Function to install chromium based on Ubuntu version
install_chromium() {
    if [ "$ubuntu_version" -ge 22 ]; then
        log "Ubuntu 22.04+ detected - using snap package"
        
        # Ensure snapd is installed and working
        if ! command -v snap >/dev/null 2>&1; then
            log "Installing snapd..."
            apt-get update
            apt-get install -y snapd
            systemctl enable --now snapd
            systemctl enable --now snapd.socket
        fi
        
        # Wait for snapd to be ready
        log "Waiting for snapd to be ready..."
        local retries=0
        while [ $retries -lt 30 ]; do
            if snap version >/dev/null 2>&1; then
                log "Snapd is ready"
                break
            fi
            retries=$((retries + 1))
            log "Waiting for snapd... attempt $retries/30"
            sleep 2
        done
        
        if [ $retries -eq 30 ]; then
            error "Snapd failed to become ready"
            exit 1
        fi
        
        # Install chromium snap
        if ! snap list chromium >/dev/null 2>&1; then
            log "Installing Chromium snap..."
            snap install chromium
        else
            log "Chromium snap already installed"
        fi
        
        # Create compatibility symlink for scripts expecting chromium-browser
        if [ ! -L /usr/bin/chromium-browser ]; then
            log "Creating compatibility symlink..."
            ln -sf /snap/bin/chromium /usr/bin/chromium-browser
        fi
        
        # Test chromium installation
        if snap list chromium >/dev/null 2>&1; then
            log "✓ Chromium snap installed successfully"
            return 0
        else
            error "✗ Failed to install Chromium snap"
            return 1
        fi
        
    else
        log "Ubuntu 20.04 or earlier detected - using apt package"
        
        # Remove any existing snap chromium
        if snap list chromium >/dev/null 2>&1; then
            warn "Removing existing Chromium snap..."
            snap remove chromium
        fi
        
        # Install traditional deb package
        if ! dpkg -l chromium-browser >/dev/null 2>&1; then
            log "Installing Chromium browser via apt..."
            apt-get update
            apt-get install -y chromium-browser
        else
            log "Chromium browser already installed"
        fi
        
        # Test chromium installation
        if dpkg -l chromium-browser >/dev/null 2>&1; then
            log "✓ Chromium browser installed successfully"
            return 0
        else
            error "✗ Failed to install Chromium browser"
            return 1
        fi
    fi
}

# Function to configure chromium for kiosk mode
configure_chromium_kiosk() {
    log "Configuring Chromium for kiosk mode..."
    
    # Create chromium configuration directory for operador user
    mkdir -p /home/operador/.config/chromium/Default
    chown -R operador:operador /home/operador/.config
    
    # Create kiosk-friendly preferences
    cat > /home/operador/.config/chromium/Default/Preferences << 'EOF'
{
   "browser": {
      "check_default_browser": false,
      "show_home_button": false
   },
   "distribution": {
      "import_bookmarks": false,
      "import_history": false,
      "import_search_engine": false,
      "make_chrome_default": false,
      "make_chrome_default_for_user": false,
      "verbose_logging": false
   },
   "first_run_tabs": [ ],
   "homepage": "http://localhost:3000/operator",
   "homepage_is_newtabpage": false,
   "session": {
      "restore_on_startup": 4,
      "startup_urls": [ "http://localhost:3000/operator" ]
   }
}
EOF
    
    chown operador:operador /home/operador/.config/chromium/Default/Preferences
    
    log "✓ Chromium kiosk configuration created"
}

# Function to test chromium functionality
test_chromium() {
    log "Testing Chromium installation..."
    
    local chromium_cmd=""
    if [ "$ubuntu_version" -ge 22 ]; then
        chromium_cmd="/snap/bin/chromium"
    else
        chromium_cmd="chromium-browser"
    fi
    
    # Test version
    if $chromium_cmd --version >/dev/null 2>&1; then
        local version=$($chromium_cmd --version)
        log "✓ Chromium version: $version"
    else
        error "✗ Chromium version check failed"
        return 1
    fi
    
    # Test kiosk mode flags (dry run)
    if $chromium_cmd --help 2>&1 | grep -q "\-\-kiosk"; then
        log "✓ Kiosk mode support confirmed"
    else
        warn "⚠ Kiosk mode flag not found in help"
    fi
    
    return 0
}

# Function to create chromium wrapper script
create_chromium_wrapper() {
    log "Creating Chromium wrapper script..."
    
    cat > /opt/chromium-kiosk-wrapper.sh << 'EOF'
#!/bin/bash

# Chromium Kiosk Wrapper Script
# Handles different chromium installations across Ubuntu versions

detect_chromium() {
    if [ -x /snap/bin/chromium ]; then
        echo "/snap/bin/chromium"
    elif command -v chromium-browser >/dev/null 2>&1; then
        echo "chromium-browser"
    elif command -v chromium >/dev/null 2>&1; then
        echo "chromium"
    else
        echo ""
    fi
}

CHROMIUM_CMD=$(detect_chromium)

if [ -z "$CHROMIUM_CMD" ]; then
    echo "ERROR: No Chromium installation found"
    exit 1
fi

# Execute chromium with all provided arguments
exec "$CHROMIUM_CMD" "$@"
EOF
    
    chmod +x /opt/chromium-kiosk-wrapper.sh
    log "✓ Chromium wrapper created at /opt/chromium-kiosk-wrapper.sh"
}

# Main execution
main() {
    log "Starting Chromium installation for Ubuntu $VERSION_ID..."
    
    # Install chromium
    if ! install_chromium; then
        error "Failed to install Chromium"
        exit 1
    fi
    
    # Configure for kiosk mode
    configure_chromium_kiosk
    
    # Test installation
    if ! test_chromium; then
        error "Chromium installation test failed"
        exit 1
    fi
    
    # Create wrapper script
    create_chromium_wrapper
    
    log "=== CHROMIUM INSTALLATION COMPLETED ==="
    log ""
    log "Installation summary:"
    log "- Ubuntu version: $VERSION_ID"
    if [ "$ubuntu_version" -ge 22 ]; then
        log "- Package type: Snap"
        log "- Command: /snap/bin/chromium"
        log "- Symlink: /usr/bin/chromium-browser → /snap/bin/chromium"
    else
        log "- Package type: APT (.deb)"
        log "- Command: chromium-browser"
    fi
    log "- Wrapper script: /opt/chromium-kiosk-wrapper.sh"
    log "- Kiosk config: /home/operador/.config/chromium/"
    log ""
    log "To use in scripts, call: /opt/chromium-kiosk-wrapper.sh [options]"
    
    exit 0
}

# Run main function
main