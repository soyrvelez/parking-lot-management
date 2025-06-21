import { Router } from 'express';
import { i18n } from '../../shared/localization';

const router = Router();

// Hardware status endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: i18n.t('hardware.status_check'),
    timestamp: new Date().toISOString()
  });
});

// Print ticket endpoint for operator interface
router.post('/print-ticket', (req, res) => {
  try {
    const { ticketId } = req.body;
    
    // In a real implementation, this would interface with the thermal printer
    // For now, we'll simulate successful printing
    console.log(`📄 Printing ticket: ${ticketId}`);
    
    res.json({
      success: true,
      message: i18n.t('hardware.ticket_printed'),
      data: {
        ticketId,
        printedAt: new Date().toISOString(),
        printerStatus: 'CONNECTED'
      },
      timestamp: new Date().toISOString()
    });
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

// Print receipt endpoint for payment completion
router.post('/print-receipt', (req, res) => {
  try {
    const { ticketId, amountPaid, change } = req.body;
    
    // In a real implementation, this would interface with the thermal printer
    // For now, we'll simulate successful printing
    console.log(`🧾 Printing receipt: Ticket ${ticketId}, Paid ${amountPaid}, Change ${change}`);
    
    res.json({
      success: true,
      message: i18n.t('hardware.receipt_printed'),
      data: {
        ticketId,
        amountPaid,
        change,
        printedAt: new Date().toISOString(),
        printerStatus: 'CONNECTED'
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

export { router as hardwareRoutes };