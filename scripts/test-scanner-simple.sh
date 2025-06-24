#!/bin/bash

echo "🔍 HONEYWELL VOYAGER 1250G SCANNER TEST"
echo "========================================"
echo ""
echo "✅ Scanner detected:"
system_profiler SPUSBDataType | grep -A 8 "Voyager-1250"
echo ""
echo "📋 Scanner Test Instructions:"
echo "1. Make sure the scanner LED is on (red or white light)"
echo "2. Point scanner at any barcode"
echo "3. Press trigger or scan automatically"
echo "4. The barcode data should appear below"
echo ""
echo "Ready to test? The scanner will act like a keyboard."
echo "Scan any barcode now (or press Enter to skip):"
echo ""

# Create a simple input test
read -t 30 scanned_data

if [ -n "$scanned_data" ]; then
    echo ""
    echo "🎉 SUCCESS! Scanner is working!"
    echo "📊 Scanned data: $scanned_data"
    echo "📏 Data length: ${#scanned_data} characters"
    echo ""
    
    # Validate if it looks like a barcode
    if [[ ${#scanned_data} -ge 6 && ${#scanned_data} -le 30 ]]; then
        echo "✅ Data looks like a valid barcode"
    else
        echo "⚠️  Unusual barcode length - verify scanner settings"
    fi
    
    # Test for Code 39 compatibility (alphanumeric)
    if [[ $scanned_data =~ ^[A-Z0-9\ \-\.]+$ ]]; then
        echo "✅ Code 39 compatible format"
    else
        echo "ℹ️  Contains non-Code39 characters (may need symbology check)"
    fi
    
else
    echo ""
    echo "⏰ No scan detected in 30 seconds"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Check scanner LED is on"
    echo "   2. Try different barcode"
    echo "   3. Clean scanner window"
    echo "   4. Check USB connection"
fi

echo ""
echo "📱 Test with application:"
echo "   1. npm run dev"
echo "   2. Go to operator interface"
echo "   3. Try scanning in ticket lookup field"
echo ""