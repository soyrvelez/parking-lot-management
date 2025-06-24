#!/usr/bin/env node

/**
 * Direct Printer Test for macOS Development
 * Tests Epson TM-T20III without full application stack
 */

const net = require('net');
const fs = require('fs');

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const CUT_PAPER = GS + 'V' + '\x41' + '\x00';
const LINE_FEED = '\n';

// Configuration
const PRINTER_IP = process.argv[2] || '192.168.1.100';
const PRINTER_PORT = 9100;

console.log(`Testing Epson TM-T20III at ${PRINTER_IP}:${PRINTER_PORT}`);

// Create test receipt content
function createTestReceipt() {
    let receipt = '';
    
    // Initialize printer
    receipt += INIT;
    
    // Header
    receipt += ALIGN_CENTER;
    receipt += BOLD_ON;
    receipt += 'PRUEBA DE IMPRESORA' + LINE_FEED;
    receipt += BOLD_OFF;
    receipt += 'Sistema de Estacionamiento' + LINE_FEED;
    receipt += '------------------------' + LINE_FEED;
    receipt += LINE_FEED;
    
    // Content
    receipt += ALIGN_LEFT;
    receipt += `Fecha: ${new Date().toLocaleString('es-MX')}` + LINE_FEED;
    receipt += `IP Impresora: ${PRINTER_IP}` + LINE_FEED;
    receipt += `Puerto: ${PRINTER_PORT}` + LINE_FEED;
    receipt += LINE_FEED;
    
    // Spanish characters test
    receipt += 'Caracteres Especiales:' + LINE_FEED;
    receipt += 'ñ Ñ á é í ó ú ¿ ¡ $ €' + LINE_FEED;
    receipt += LINE_FEED;
    
    // Barcode test
    receipt += ALIGN_CENTER;
    receipt += 'Código de Barras:' + LINE_FEED;
    // Code 39 barcode
    receipt += GS + 'k' + '\x04' + 'TEST123\x00';
    receipt += LINE_FEED;
    receipt += 'TEST123' + LINE_FEED;
    receipt += LINE_FEED;
    
    // Footer
    receipt += '------------------------' + LINE_FEED;
    receipt += 'Prueba Exitosa!' + LINE_FEED;
    receipt += ALIGN_LEFT;
    
    // Cut paper
    receipt += LINE_FEED + LINE_FEED + LINE_FEED;
    receipt += CUT_PAPER;
    
    return receipt;
}

// Send data to printer
function printTest() {
    const client = new net.Socket();
    const receipt = createTestReceipt();
    
    client.setTimeout(5000);
    
    client.connect(PRINTER_PORT, PRINTER_IP, () => {
        console.log('✓ Connected to printer');
        console.log('Sending test receipt...');
        
        client.write(Buffer.from(receipt, 'binary'), (err) => {
            if (err) {
                console.error('✗ Error writing to printer:', err);
            } else {
                console.log('✓ Data sent to printer');
            }
            
            setTimeout(() => {
                client.end();
            }, 1000);
        });
    });
    
    client.on('error', (err) => {
        console.error('✗ Connection error:', err.message);
        console.log('\nTroubleshooting:');
        console.log('1. Check printer is powered on');
        console.log('2. Check printer IP address (current: ' + PRINTER_IP + ')');
        console.log('3. Ensure printer and Mac are on same network');
        console.log('4. Try: ping ' + PRINTER_IP);
    });
    
    client.on('timeout', () => {
        console.error('✗ Connection timeout');
        client.destroy();
    });
    
    client.on('close', () => {
        console.log('Connection closed');
    });
}

// Alternative: Save receipt to file for debugging
function saveReceiptToFile() {
    const receipt = createTestReceipt();
    const filename = `test-receipt-${Date.now()}.prn`;
    
    fs.writeFileSync(filename, receipt, 'binary');
    console.log(`\nReceipt saved to: ${filename}`);
    console.log('You can send this file directly to printer with:');
    console.log(`  nc ${PRINTER_IP} ${PRINTER_PORT} < ${filename}`);
}

// Main execution
console.log('\nEpson TM-T20III Direct Test\n');

if (process.argv.includes('--save')) {
    saveReceiptToFile();
} else {
    console.log('Testing network connection...');
    
    // Quick ping test first
    const spawn = require('child_process').spawn;
    const ping = spawn('ping', ['-c', '1', '-t', '2', PRINTER_IP]);
    
    ping.on('close', (code) => {
        if (code === 0) {
            console.log('✓ Printer is reachable\n');
            printTest();
        } else {
            console.error('✗ Cannot reach printer at ' + PRINTER_IP);
            console.log('\nUse --save flag to save receipt to file instead');
        }
    });
}