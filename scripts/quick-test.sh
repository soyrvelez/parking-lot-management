#!/bin/bash

echo "🔍 Quick Operator Interface Validation"
echo "======================================"

# Test backend health
echo -n "1. Backend Health: "
if curl -s http://localhost:4000/health | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ PASSED"
else
    echo "❌ FAILED"
fi

# Test hardware status
echo -n "2. Hardware Status: "
if curl -s http://localhost:4000/api/hardware/status | jq -e '.data.printer' > /dev/null 2>&1; then
    echo "✅ PASSED"
else
    echo "❌ FAILED"
fi

# Test ticket lookup
echo -n "3. Ticket Lookup: "
if curl -s http://localhost:4000/api/parking/tickets/lookup/PARK123456 | jq -e '.data.plateNumber' > /dev/null 2>&1; then
    echo "✅ PASSED"
else
    echo "❌ FAILED"
fi

# Test frontend
echo -n "4. Frontend Access: "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
    echo "✅ PASSED"
else
    echo "❌ FAILED"
fi

echo ""
echo "🚀 READY FOR TESTING!"
echo "Open: http://localhost:3001"
echo ""
echo "📋 Test Barcodes:"
echo "   • PARK123456 - Active ticket"
echo "   • MEX456 - Pension customer"
echo ""
echo "⌨️  Keyboard Shortcuts:"
echo "   • F5: +$100   F6: +$200   F7: +$500"
echo "   • F9: Clear   F12: Confirm Payment"