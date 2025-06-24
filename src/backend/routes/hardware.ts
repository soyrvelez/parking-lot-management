import { Router } from 'express';
import { i18n } from '../../shared/localization';
import { hardwareService } from '../services/hardwareService';
import { ThermalPrinterService } from '../services/printer/thermal-printer.service';

const router = Router();

// Initialize thermal printer service
const thermalPrinter = new ThermalPrinterService();

// Hardware status endpoint
router.get('/status', async (req, res) => {
  try {
    const health = await hardwareService.getHardwareHealth();
    
    // Add enhanced printer status information
    const printerStatus = {
      connected: true, // In real implementation, check actual printer connection
      paperLevel: 'OK', // Check paper sensor
      temperature: 'NORMAL', // Check printer temperature
      lastPrintJob: new Date().toISOString(),
      queueSize: 0, // Number of pending print jobs
      errorCount: 0 // Number of recent print errors
    };

    const enhancedHealth = {
      ...health,
      printer: {
        ...health.printer,
        ...printerStatus
      }
    };
    
    res.json({
      success: true,
      message: i18n.t('hardware.status_check'),
      data: enhancedHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Hardware status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Error al verificar el estado del hardware',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Print ticket endpoint for operator interface (supports reprint)
router.post('/print-ticket', async (req, res) => {
  try {
    const { ticketId, plateNumber, entryTime, barcode, reprint = false } = req.body;
    
    console.log(`🔍 DEBUG: Print request - ticketId: ${ticketId}, plate: ${plateNumber}, reprint: ${reprint}`);
    
    // Connect printer if not connected
    const status = thermalPrinter.getStatus();
    if (!status.connected) {
      console.log('🔍 DEBUG: Connecting to printer...');
      const connected = await thermalPrinter.connect();
      if (!connected) {
        throw new Error('Failed to connect to printer');
      }
    }
    
    // Create receipt data for entry ticket
    const receiptData = {
      ticketNumber: ticketId,
      plateNumber: plateNumber,
      entryTime: new Date(entryTime),
      barcode: barcode,
      location: 'Estacionamiento Principal'
    };

    console.log('🔍 DEBUG: Receipt data created:', JSON.stringify(receiptData));
    
    // Print the entry ticket
    const printResult = await thermalPrinter.printEntryTicket(receiptData);
    
    console.log('🔍 DEBUG: Print result:', printResult);
    
    if (printResult) {
      const action = reprint ? 'Reprinting' : 'Printing';
      console.log(`📄 ${action} ticket: ${ticketId} - SUCCESS`);
      
      res.json({
        success: true,
        message: reprint ? 'Boleto reimpreso exitosamente' : i18n.t('hardware.ticket_printed'),
        data: {
          ticketId,
          printedAt: new Date().toISOString(),
          printerStatus: 'CONNECTED',
          isReprint: reprint
        },
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Print operation failed');
    }
    
  } catch (error) {
    console.error('Print ticket error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRINT_ERROR',
        message: i18n.t('hardware.print_failed'),
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Print receipt endpoint for payment completion (supports reprint)
router.post('/print-receipt', (req, res) => {
  try {
    const { ticketId, amountPaid, change, reprint = false } = req.body;
    
    // In a real implementation, this would interface with the thermal printer
    // For now, we'll simulate successful printing
    const action = reprint ? 'Reprinting' : 'Printing';
    console.log(`🧾 ${action} receipt: Ticket ${ticketId}, Paid ${amountPaid}, Change ${change}`);
    
    res.json({
      success: true,
      message: reprint ? 'Recibo reimpreso exitosamente' : i18n.t('hardware.receipt_printed'),
      data: {
        ticketId,
        amountPaid,
        change,
        printedAt: new Date().toISOString(),
        printerStatus: 'CONNECTED',
        isReprint: reprint
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Print receipt error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRINT_ERROR',
        message: i18n.t('hardware.print_failed'),
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Print lost ticket receipt endpoint (supports reprint)
router.post('/print-lost-ticket-receipt', (req, res) => {
  try {
    const { 
      transactionId, 
      plateNumber, 
      cashReceived, 
      change, 
      lostTicketFee,
      reprint = false 
    } = req.body;
    
    // In a real implementation, this would interface with the thermal printer
    // For now, we'll simulate successful printing
    const action = reprint ? 'Reprinting' : 'Printing';
    console.log(`🎫 ${action} lost ticket receipt: ${transactionId}, Plate: ${plateNumber}, Fee: ${lostTicketFee}`);
    
    res.json({
      success: true,
      message: reprint ? 'Recibo de boleto extraviado reimpreso exitosamente' : 'Recibo de boleto extraviado impreso exitosamente',
      data: {
        transactionId,
        plateNumber,
        lostTicketFee,
        cashReceived,
        change,
        printedAt: new Date().toISOString(),
        printerStatus: 'CONNECTED',
        isReprint: reprint
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Print lost ticket receipt error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRINT_ERROR',
        message: i18n.t('hardware.print_failed'),
        timestamp: new Date().toISOString()
      }
    });
  }
});

export { router as hardwareRoutes };