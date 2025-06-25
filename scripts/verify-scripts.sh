#\!/bin/bash

echo "=== VERIFICATION REPORT: Phase Scripts Referenced in install-all.sh ==="
echo ""

# Scripts referenced in install-all.sh
declare -A scripts=(
    ["setup/setup-system.sh"]="REQUIRED"
    ["setup/setup-database.sh"]="REQUIRED"
    ["setup/setup-kiosk.sh"]="REQUIRED"
    ["hardware/setup-printer.sh"]="REQUIRED"
    ["hardware/setup-scanner.sh"]="REQUIRED"
    ["security/harden-system.sh"]="REQUIRED"
    ["security/setup-remote-admin.sh"]="REQUIRED"
    ["deploy/deploy-parking-system.sh"]="REQUIRED"
    ["deploy/setup-systemd-services.sh"]="REQUIRED"
    ["backup/setup-backups.sh"]="REQUIRED"
    ["test/test-system.sh"]="OPTIONAL"
    ["test/test-kiosk-mode.sh"]="OPTIONAL"
)

echo "REQUIRED SCRIPTS:"
echo "================="
for script in "${\!scripts[@]}"; do
    if [[ "${scripts[$script]}" == "REQUIRED" ]]; then
        if [ -f "$script" ]; then
            echo "✓ $script - EXISTS"
        else
            echo "✗ $script - MISSING"
        fi
    fi
done | sort

echo ""
echo "OPTIONAL SCRIPTS (for development/test modes):"
echo "============================================="
for script in "${\!scripts[@]}"; do
    if [[ "${scripts[$script]}" == "OPTIONAL" ]]; then
        if [ -f "$script" ]; then
            echo "✓ $script - EXISTS"
        else
            echo "✗ $script - MISSING"
        fi
    fi
done | sort

echo ""
echo "ADDITIONAL SCRIPTS FOUND:"
echo "========================"
find . -name "*.sh" | grep -v "./verify-scripts.sh" | while read -r file; do
    rel_path="${file#./}"
    if [[ ! "${scripts[$rel_path]+isset}" ]]; then
        echo "• $rel_path"
    fi
done | sort

echo ""
echo "SUMMARY:"
echo "========"
required_count=0
required_missing=0
optional_count=0
optional_missing=0

for script in "${\!scripts[@]}"; do
    if [[ "${scripts[$script]}" == "REQUIRED" ]]; then
        ((required_count++))
        [ \! -f "$script" ] && ((required_missing++))
    else
        ((optional_count++))
        [ \! -f "$script" ] && ((optional_missing++))
    fi
done

echo "Required scripts: $required_count total, $required_missing missing"
echo "Optional scripts: $optional_count total, $optional_missing missing"

if [ $required_missing -eq 0 ]; then
    echo ""
    echo "✓ ALL REQUIRED SCRIPTS ARE PRESENT"
else
    echo ""
    echo "✗ MISSING REQUIRED SCRIPTS - Installation will fail\!"
fi

if [ $optional_missing -gt 0 ]; then
    echo ""
    echo "Note: Missing optional scripts will only affect development/test modes"
fi
