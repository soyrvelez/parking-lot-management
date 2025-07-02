/**
 * Thermal Printer Service - Epson TM-T20III Integration
 * 
 * Provides comprehensive thermal printing functionality with:
 * - USB and TCP connection management with retry logic
 * - Automatic USB device detection (/dev/usb/lp0, /dev/ttyUSB0)
 * - 58mm paper formatting (32 character width)
 * - Spanish character encoding (UTF-8) support
 * - Print queue for offline scenarios
 * - Hardware health monitoring
 * - Integration with i18n system for Spanish receipts
 */

import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { access, constants } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { 
  PrinterConfig, 
  PrintJob, 
  PrinterStatus, 
  ReceiptData, 
  HardwareError,
  PrinterConnectionState,
  HARDWARE_CONSTANTS 
} from '../../../shared/types/hardware';
import { i18n } from '../../../shared/localization';

export class ThermalPrinterService extends EventEmitter {
  private printer: ThermalPrinter | null = null;
  private config: PrinterConfig;
  private printQueue: PrintJob[] = [];
  private status: PrinterStatus;
  private connectionState: PrinterConnectionState = 'DISCONNECTED';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isProcessingQueue = false;
  private isCupsPrinter = false;
  private cupsPrinterName = '';

  constructor(config?: Partial<PrinterConfig>) {
    super();
    
    this.config = {
      interfaceType: config?.interfaceType || HARDWARE_CONSTANTS.PRINTER.DEFAULT_INTERFACE_TYPE,
      host: config?.host || HARDWARE_CONSTANTS.PRINTER.DEFAULT_HOST,
      port: config?.port || HARDWARE_CONSTANTS.PRINTER.DEFAULT_PORT,
      devicePath: config?.devicePath || this.detectBestPrinterDevice(),
      timeout: config?.timeout || HARDWARE_CONSTANTS.PRINTER.DEFAULT_TIMEOUT,
      retryAttempts: config?.retryAttempts || HARDWARE_CONSTANTS.PRINTER.DEFAULT_RETRY_ATTEMPTS,
      retryDelay: config?.retryDelay || HARDWARE_CONSTANTS.PRINTER.DEFAULT_RETRY_DELAY,
      paperWidth: config?.paperWidth || HARDWARE_CONSTANTS.PRINTER.PAPER_WIDTH_58MM,
      encoding: config?.encoding || HARDWARE_CONSTANTS.PRINTER.ENCODING
    };

    this.status = {
      connected: false,
      online: false,
      paperStatus: 'UNKNOWN',
      coverOpen: false,
      cutterStatus: 'UNKNOWN',
      temperature: 'UNKNOWN',
      lastUpdate: new Date(),
      queueLength: 0,
      totalPrintJobs: 0,
      failedJobs: 0
    };

    this.initializePrinter();
    this.startHealthCheck();
  }

  /**
   * Initialize thermal printer with proper configuration (USB or TCP)
   */
  private initializePrinter(): void {
    try {
      if (this.config.interfaceType === 'usb') {
        // Check if this is a CUPS printer (macOS)
        if (this.config.devicePath.startsWith('printer:')) {
          this.isCupsPrinter = true;
          this.cupsPrinterName = this.config.devicePath.replace('printer:', '');
          // For CUPS printers, we'll handle printing differently
          this.printer = null;
        } else {
          // Standard USB device path for Linux
          this.isCupsPrinter = false;
          // On Linux, use the device path directly without 'printer:' prefix
          const interfaceString = process.platform === 'linux' 
            ? this.config.devicePath 
            : `printer:${this.config.devicePath}`;
          this.printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: interfaceString,
            characterSet: CharacterSet.PC858_EURO,
            removeSpecialCharacters: false,
            lineCharacter: '-',
            breakLine: BreakLine.WORD,
            options: {
              timeout: this.config.timeout
            }
          });
        }
      } else {
        // TCP connection
        this.isCupsPrinter = false;
        const interfaceString = `tcp://${this.config.host}:${this.config.port}`;
        this.printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: interfaceString,
          characterSet: CharacterSet.PC858_EURO,
          removeSpecialCharacters: false,
          lineCharacter: '-',
          breakLine: BreakLine.WORD,
          options: {
            timeout: this.config.timeout
          }
        });
      }

      this.emit('printerInitialized');
    } catch (error) {
      this.handleError('PRINTER', 'INIT_FAILED', i18n.t('hardware.printer_init_failed'), error);
    }
  }

  /**
   * Detect best printer device based on platform
   */
  private detectBestPrinterDevice(): string {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS - prioritize CUPS printers
      return 'printer:ThermalPrinter';
    } else if (platform === 'linux') {
      // Linux - prioritize most common USB devices first
      // Most Ubuntu systems use /dev/usb/lp1 for first USB printer
      const linuxDevices = [
        '/dev/usb/lp1',   // Most common on Ubuntu for USB printers
        '/dev/usb/lp0',   // Default USB printer
        HARDWARE_CONSTANTS.PRINTER.USB_SYMLINK,     // /dev/thermal-printer (udev rule)
        HARDWARE_CONSTANTS.PRINTER.ALTERNATIVE_USB_DEVICE, // /dev/ttyUSB0
        '/dev/lp0',  // Standard line printer
      ];
      return linuxDevices[0];
    } else {
      // Windows or other - use network connection as fallback
      return HARDWARE_CONSTANTS.PRINTER.DEFAULT_USB_DEVICE;
    }
  }

  /**
   * Detect available USB thermal printer device (legacy method)
   */
  private detectUSBDevice(): string {
    return this.detectBestPrinterDevice();
  }

  /**
   * Check if USB device exists and is accessible
   */
  private async checkUSBDevice(devicePath: string): Promise<boolean> {
    try {
      // Handle CUPS printer on macOS
      if (devicePath.startsWith('printer:')) {
        // Check if CUPS printer exists by running lpstat
        const { exec } = require('child_process');
        const printerName = devicePath.replace('printer:', '');
        
        return new Promise((resolve) => {
          exec(`lpstat -p ${printerName}`, (error: any) => {
            resolve(!error);
          });
        });
      }
      
      // For Linux USB devices, check if device file exists
      // Device files don't support standard R/W permission checks
      // so we just check if the file exists
      await fs.access(devicePath, constants.F_OK);
      
      // Additional check for Linux: verify it's a character device
      if (process.platform === 'linux') {
        try {
          const stats = await fs.stat(devicePath);
          // Check if it's a character device (like /dev/usb/lp1)
          if (stats.isCharacterDevice()) {
            return true;
          }
        } catch (statError) {
          // If stat fails, fall back to basic existence check
          return true;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find available USB printer device
   */
  private async findUSBDevice(): Promise<string | null> {
    // Platform-specific device priority order
    let usbDevices: string[];
    
    if (process.platform === 'darwin') {
      // macOS - prioritize CUPS printers
      usbDevices = [
        'printer:ThermalPrinter',
        HARDWARE_CONSTANTS.PRINTER.USB_SYMLINK,
        HARDWARE_CONSTANTS.PRINTER.DEFAULT_USB_DEVICE,
        '/dev/lp0',
        '/dev/lp1'
      ];
    } else if (process.platform === 'linux') {
      // Linux - prioritize common USB character devices
      usbDevices = [
        '/dev/usb/lp1',  // Most common on Ubuntu for USB printers
        '/dev/usb/lp0',  // Default USB printer
        '/dev/lp1',      // Alternative line printer
        '/dev/lp0',      // Standard line printer
        HARDWARE_CONSTANTS.PRINTER.USB_SYMLINK,     // /dev/thermal-printer (custom udev rule)
        HARDWARE_CONSTANTS.PRINTER.ALTERNATIVE_USB_DEVICE, // /dev/ttyUSB0
      ];
    } else {
      // Windows/other - use default order
      usbDevices = [
        HARDWARE_CONSTANTS.PRINTER.USB_SYMLINK,
        HARDWARE_CONSTANTS.PRINTER.DEFAULT_USB_DEVICE,
        HARDWARE_CONSTANTS.PRINTER.ALTERNATIVE_USB_DEVICE,
        '/dev/lp0',
        '/dev/lp1'
      ];
    }

    for (const device of usbDevices) {
      if (await this.checkUSBDevice(device)) {
        return device;
      }
    }

    return null;
  }

  /**
   * Check if CUPS printer is available and ready
   */
  private async checkCupsPrinter(): Promise<boolean> {
    return new Promise((resolve) => {
      exec(`lpstat -p ${this.cupsPrinterName}`, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          // Check if printer is idle and enabled
          const isIdle = stdout.includes('idle');
          const isEnabled = stdout.includes('enabled');
          resolve(isIdle && isEnabled);
        }
      });
    });
  }

  /**
   * Connect to thermal printer with retry logic
   */
  public async connect(): Promise<boolean> {
    if (this.connectionState === 'CONNECTING') {
      return false;
    }

    this.connectionState = 'CONNECTING';
    this.emit('connecting');

    // For USB connections, validate device availability first
    if (this.config.interfaceType === 'usb') {
      const availableDevice = await this.findUSBDevice();
      if (!availableDevice) {
        const errorMessage = i18n.t('hardware.usb_device_not_found');
        this.handleError('CONNECTION', 'USB_DEVICE_NOT_FOUND', errorMessage);
        this.connectionState = 'ERROR';
        this.status.connected = false;
        this.status.online = false;
        this.emit('disconnected');
        this.emit('statusUpdate', this.status);
        this.scheduleReconnect();
        return false;
      }
      
      // Update device path if a different device was found
      if (availableDevice !== this.config.devicePath) {
        this.config.devicePath = availableDevice;
        this.initializePrinter(); // Reinitialize with new device path
      }
    }

    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        if (this.isCupsPrinter) {
          // For CUPS printers, check using lpstat
          const isConnected = await this.checkCupsPrinter();
          if (isConnected) {
            this.connectionState = 'CONNECTED';
            this.status.connected = true;
            this.status.online = true;
            this.status.lastUpdate = new Date();
            
            this.emit('connected');
            this.emit('statusUpdate', this.status);
            
            // Start processing queue if there are pending jobs
            if (this.printQueue.length > 0) {
              this.processQueue();
            }
            
            return true;
          }
        } else {
          // Standard thermal printer library
          if (!this.printer) {
            this.initializePrinter();
          }

          const isConnected = await this.printer!.isPrinterConnected();
          if (isConnected) {
            this.connectionState = 'CONNECTED';
            this.status.connected = true;
            this.status.online = true;
            this.status.lastUpdate = new Date();
            
            this.emit('connected');
            this.emit('statusUpdate', this.status);
            
            // Start processing queue if there are pending jobs
            if (this.printQueue.length > 0) {
              this.processQueue();
            }
            
            return true;
          }
        }
      } catch (error) {
        attempts++;
        const connectionType = this.config.interfaceType === 'usb' ? 'USB' : 'TCP';
        const errorMessage = i18n.t('hardware.connection_failed', { 
          type: connectionType,
          attempt: attempts, 
          max: this.config.retryAttempts 
        });
        
        if (attempts < this.config.retryAttempts) {
          this.emit('connectionRetry', { attempt: attempts, error: errorMessage });
          await this.delay(this.config.retryDelay);
        } else {
          this.handleError('CONNECTION', 'CONNECT_FAILED', errorMessage, error);
        }
      }
    }

    this.connectionState = 'ERROR';
    this.status.connected = false;
    this.status.online = false;
    this.emit('disconnected');
    this.emit('statusUpdate', this.status);
    
    // Schedule reconnection attempt
    this.scheduleReconnect();
    return false;
  }

  /**
   * Disconnect from thermal printer
   */
  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectionState = 'DISCONNECTED';
    this.status.connected = false;
    this.status.online = false;
    this.status.lastUpdate = new Date();
    
    this.emit('disconnected');
    this.emit('statusUpdate', this.status);
  }

  /**
   * Print entry ticket with barcode
   */
  public async printEntryTicket(receiptData: ReceiptData): Promise<boolean> {
    const content = this.formatEntryTicket(receiptData);
    return this.addToPrintQueue({
      id: `ENTRY_${receiptData.ticketNumber}_${Date.now()}`,
      type: 'ENTRY_TICKET',
      content,
      priority: 'HIGH',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Print payment receipt
   */
  public async printPaymentReceipt(receiptData: ReceiptData): Promise<boolean> {
    const content = this.formatPaymentReceipt(receiptData);
    return this.addToPrintQueue({
      id: `PAYMENT_${receiptData.ticketNumber}_${Date.now()}`,
      type: 'PAYMENT_RECEIPT',
      content,
      priority: 'HIGH',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Print lost ticket receipt
   */
  public async printLostTicketReceipt(receiptData: ReceiptData): Promise<boolean> {
    const content = this.formatLostTicketReceipt(receiptData);
    return this.addToPrintQueue({
      id: `LOST_${receiptData.plateNumber}_${Date.now()}`,
      type: 'LOST_TICKET',
      content,
      priority: 'HIGH',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Print pension receipt
   */
  public async printPensionReceipt(receiptData: ReceiptData): Promise<boolean> {
    const content = this.formatPensionReceipt(receiptData);
    return this.addToPrintQueue({
      id: `PENSION_${receiptData.plateNumber}_${Date.now()}`,
      type: 'PENSION_RECEIPT',
      content,
      priority: 'NORMAL',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Print test receipt
   */
  public async printTestReceipt(): Promise<boolean> {
    const content = this.formatTestReceipt();
    return this.addToPrintQueue({
      id: `TEST_${Date.now()}`,
      type: 'TEST_PRINT',
      content,
      priority: 'LOW',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Print partner business ticket
   */
  public async printPartnerTicket(ticketData: any): Promise<boolean> {
    const content = this.formatPartnerTicket(ticketData);
    return this.addToPrintQueue({
      id: `PARTNER_${ticketData.ticketNumber}_${Date.now()}`,
      type: 'ENTRY_TICKET', // Use existing type that works
      content,
      priority: 'HIGH',
      createdAt: new Date(),
      attempts: 0,
      status: 'PENDING'
    });
  }

  /**
   * Format entry ticket with Spanish template
   */
  private formatEntryTicket(data: ReceiptData): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('receipt.parking_title')));
    lines.push(this.centerText(i18n.t('receipt.entry_ticket')));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    
    // Ticket info
    lines.push(i18n.t('receipt.ticket_number', { number: data.ticketNumber }));
    lines.push(i18n.t('receipt.plate_number', { plate: data.plateNumber }));
    lines.push('');
    
    // Entry time (if available)
    if (data.entryTime) {
      // DEBUG: Log the actual date being formatted
      console.log('🔍 DEBUG: Entry time raw:', data.entryTime);
      console.log('🔍 DEBUG: Entry time type:', typeof data.entryTime);
      
      // Ensure we have a proper Date object in Mexico City timezone
      const entryDate = new Date(data.entryTime);
      console.log('🔍 DEBUG: Entry date parsed:', entryDate);
      console.log('🔍 DEBUG: Entry date formatted:', i18n.formatDateTime(entryDate));
      
      lines.push(i18n.t('receipt.entry_time', { 
        time: i18n.formatDateTime(entryDate) 
      }));
    }
    lines.push('');
    
    // Instructions
    lines.push(this.centerText(i18n.t('customer.keep_receipt')));
    lines.push(this.centerText(i18n.t('customer.welcome')));
    lines.push('');
    
    // Real barcode (Code 39 format) - use the provided barcode field
    if (data.barcode) {
      console.log('🔍 DEBUG: Adding barcode pattern for ESC/POS conversion:', data.barcode);
      // Add the *BARCODE* pattern - this will be converted to actual barcode commands by processBarcodes()
      lines.push(this.centerText(`*${data.barcode}*`));
      // Don't add plain text here - the barcode processor will add it automatically
    } else {
      // Fallback to ticket number if no barcode provided
      console.log('🔍 DEBUG: No barcode, using ticket number:', data.ticketNumber);
      lines.push(this.centerText(`*${data.ticketNumber}*`));
      // Don't add plain text here - the barcode processor will add it automatically
    }
    lines.push('');
    
    // Footer
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('customer.drive_safely')));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Format payment receipt with Spanish template
   */
  private formatPaymentReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('receipt.parking_title')));
    lines.push(this.centerText(i18n.t('receipt.payment_receipt')));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    
    // Ticket info
    lines.push(i18n.t('receipt.ticket_number', { number: data.ticketNumber }));
    lines.push(i18n.t('receipt.plate_number', { plate: data.plateNumber }));
    lines.push('');
    
    // Time details
    if (data.entryTime) {
      lines.push(i18n.t('receipt.entry_time', { 
        time: i18n.formatDateTime(data.entryTime) 
      }));
    }
    lines.push(i18n.t('receipt.exit_time', { 
      time: i18n.formatDateTime(data.exitTime!) 
    }));
    
    // Duration
    const duration = i18n.formatDuration(data.durationMinutes!);
    lines.push(i18n.t('receipt.total_time', { duration }));
    lines.push('');
    
    // Payment details
    lines.push(i18n.t('receipt.total_amount', { 
      amount: i18n.formatPesos(data.totalAmount) 
    }));
    lines.push(i18n.t('receipt.payment_method', { 
      method: i18n.t(`paymentMethods.${data.paymentMethod?.toLowerCase()}`) 
    }));
    
    if (data.change && data.change > 0) {
      lines.push(i18n.t('receipt.change_given', { 
        amount: i18n.formatPesos(data.change) 
      }));
    }
    lines.push('');
    
    // Footer
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('customer.thank_you')));
    lines.push(this.centerText(i18n.t('customer.drive_safely')));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Format lost ticket receipt
   */
  private formatLostTicketReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('receipt.parking_title')));
    lines.push(this.centerText(i18n.t('receipt.lost_ticket')));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    
    // Vehicle info
    lines.push(i18n.t('receipt.plate_number', { plate: data.plateNumber }));
    lines.push(i18n.t('parking.lost_ticket'));
    lines.push('');
    
    // Payment
    lines.push(i18n.t('receipt.lost_ticket_fee', { 
      amount: i18n.formatPesos(data.totalAmount) 
    }));
    lines.push(i18n.t('receipt.payment_method', { 
      method: i18n.t('payment.efectivo') 
    }));
    
    if (data.change && data.change > 0) {
      lines.push(i18n.t('receipt.change_given', { 
        amount: i18n.formatPesos(data.change) 
      }));
    }
    lines.push('');
    
    // Footer
    lines.push(this.centerText(i18n.t('customer.thank_you')));
    lines.push(this.centerText(i18n.t('customer.drive_safely')));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Format pension receipt
   */
  private formatPensionReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('receipt.parking_title')));
    lines.push(this.centerText(i18n.t('receipt.pension_receipt')));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    
    // Customer info
    if (data.customerName) {
      lines.push(i18n.t('receipt.customer_name', { name: data.customerName }));
    }
    lines.push(i18n.t('receipt.plate_number', { plate: data.plateNumber }));
    lines.push('');
    
    // Pension details
    lines.push(i18n.t('receipt.monthly_pension'));
    lines.push(i18n.t('receipt.total_amount', { 
      amount: i18n.formatPesos(data.totalAmount) 
    }));
    
    if (data.validUntil) {
      lines.push(i18n.t('receipt.valid_until', { 
        date: i18n.formatDate(data.validUntil) 
      }));
    }
    lines.push('');
    
    // Footer
    lines.push(this.centerText(i18n.t('customer.thank_you')));
    lines.push(this.centerText(i18n.t('customer.enjoy_service')));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Format test receipt
   */
  private formatTestReceipt(): string {
    const lines: string[] = [];
    
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('hardware.test_print')));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    lines.push(i18n.t('hardware.printer_connected'));
    lines.push(i18n.formatDateTime(new Date()));
    lines.push('');
    lines.push(this.centerText(i18n.t('hardware.test_successful')));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Format partner business ticket with Spanish template
   */
  private formatPartnerTicket(data: any): string {
    const lines: string[] = [];
    
    // Header
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push(this.centerText(i18n.t('receipt.parking_title')));
    lines.push(this.centerText('*** BOLETO DE SOCIO ***'));
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    lines.push('');
    
    // Partner Business Info
    lines.push(`Socio: ${data.partnerName}`);
    lines.push(`Tipo: ${data.businessType}`);
    lines.push('-'.repeat(this.config.paperWidth));
    
    // Vehicle and Entry Info
    lines.push(`Placa: ${data.plateNumber}`);
    lines.push(`Entrada: ${data.entryTime}`);
    
    // Customer info if provided
    if (data.customerName) {
      lines.push(`Cliente: ${data.customerName}`);
    }
    lines.push('');
    
    // Pricing Information
    lines.push(`Tarifa: ${data.rate}`);
    if (data.maxHours) {
      lines.push(`Válido: ${data.maxHours}`);
    }
    lines.push('-'.repeat(this.config.paperWidth));
    
    // Barcode (Code 39) - using standard format for ESC/POS processing
    lines.push(this.centerText(`*${data.barcode}*`));
    lines.push('-'.repeat(this.config.paperWidth));
    
    // Special instructions
    if (data.specialInstructions) {
      lines.push(this.centerText('INSTRUCCIONES ESPECIALES:'));
      lines.push(this.centerText(data.specialInstructions));
      lines.push('');
    }
    
    // Footer
    lines.push(this.centerText('*** IMPORTANTE ***'));
    lines.push(this.centerText('SOLICITE SELLO DEL NEGOCIO'));
    lines.push(this.centerText('SIN SELLO = TARIFA REGULAR'));
    lines.push('');
    lines.push(this.centerText('Conserve su boleto'));
    if (data.specialInstructions) {
      lines.push(this.centerText('Válido solo con compra'));
    }
    lines.push(this.centerText('='.repeat(this.config.paperWidth)));
    
    return lines.join(HARDWARE_CONSTANTS.PRINTER.LINE_SEPARATOR);
  }

  /**
   * Center text within paper width
   */
  private centerText(text: string): string {
    const padding = Math.max(0, Math.floor((this.config.paperWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Add job to print queue
   */
  private async addToPrintQueue(job: PrintJob): Promise<boolean> {
    // Prevent queue overflow
    if (this.printQueue.length >= HARDWARE_CONSTANTS.MAX_QUEUE_SIZE) {
      this.handleError('PRINTER', 'QUEUE_FULL', i18n.t('hardware.queue_full'));
      return false;
    }

    this.printQueue.push(job);
    this.status.queueLength = this.printQueue.length;
    this.emit('jobQueued', job);
    this.emit('statusUpdate', this.status);

    // Start processing if connected
    if (this.status.connected && !this.isProcessingQueue) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Process print queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.status.connected || this.printQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    this.emit('queueProcessingStarted');

    while (this.printQueue.length > 0 && this.status.connected) {
      const job = this.printQueue.shift()!;
      job.status = 'PRINTING';
      this.emit('jobStarted', job);

      try {
        const success = await this.executeJob(job);
        if (success) {
          job.status = 'COMPLETED';
          this.status.totalPrintJobs++;
          this.emit('jobCompleted', job);
        } else {
          job.attempts++;
          if (job.attempts < HARDWARE_CONSTANTS.MAX_RETRY_ATTEMPTS) {
            job.status = 'PENDING';
            job.lastAttempt = new Date();
            this.printQueue.unshift(job); // Return to front of queue
            this.emit('jobRetry', job);
          } else {
            job.status = 'FAILED';
            this.status.failedJobs++;
            this.emit('jobFailed', job);
          }
        }
      } catch (error) {
        job.status = 'FAILED';
        job.error = error instanceof Error ? error.message : String(error);
        this.status.failedJobs++;
        this.emit('jobFailed', job);
      }

      this.status.queueLength = this.printQueue.length;
      this.emit('statusUpdate', this.status);
    }

    this.isProcessingQueue = false;
    this.emit('queueProcessingCompleted');
  }

  /**
   * Format content with ESC/POS commands for thermal printer
   */
  private formatContentForThermalPrinter(content: string): string {
    const ESC = '\x1B';
    const GS = '\x1D';
    const LF = '\n';
    
    let formatted = '';
    
    // Initialize printer
    formatted += ESC + '@';  // ESC @ - Initialize printer
    
    // Set character set for Spanish characters
    formatted += ESC + 'R' + '\x0C';  // ESC R 12 - Set character set to Latin
    
    // Process content and convert barcode patterns to ESC/POS commands
    let processedContent = this.processBarcodes(content);
    formatted += processedContent;
    
    // Add feed lines for cutting space
    for (let i = 0; i < HARDWARE_CONSTANTS.PRINTER.FEED_LINES; i++) {
      formatted += LF;
    }
    
    // Cut paper
    formatted += GS + 'V' + '\x41' + '\x00';  // GS V 65 0 - Full cut
    
    return formatted;
  }

  /**
   * Process content to convert barcode patterns to ESC/POS barcode commands
   * CRITICAL: Places barcodes at document START for proper printer interpretation
   */
  private processBarcodes(content: string): string {
    const GS = '\x1D';
    const LF = '\n';
    
    console.log('🔍 DEBUG: processBarcodes input content length:', content.length);
    console.log('🔍 DEBUG: processBarcodes input contains asterisk patterns:', content.includes('*'));
    
    // Extract all barcode patterns first
    const barcodeMatches: Array<{match: string, data: string}> = [];
    content.replace(/\*([A-Z0-9\-]+)\*/g, (match, barcodeData) => {
      barcodeMatches.push({match, data: barcodeData});
      console.log('🔍 DEBUG: Found barcode pattern:', barcodeData);
      return match; // Don't modify yet
    });
    
    if (barcodeMatches.length === 0) {
      return content; // No barcodes to process
    }
    
    // Build barcode commands section (goes at the BEGINNING after init)
    let barcodeSection = '';
    for (const barcode of barcodeMatches) {
      console.log('🔍 DEBUG: Converting barcode to ESC/POS:', barcode.data);
      
      // Use the WORKING format from Test 3: GS k 4 *DATA* NULL
      barcodeSection += GS + 'k' + '\x04' + '*' + barcode.data + '*' + '\x00';
      barcodeSection += LF + LF; // Extra space after barcode
      barcodeSection += barcode.data + LF; // Human readable
      barcodeSection += LF; // Extra spacing
      
      console.log('🔍 DEBUG: Generated barcode command hex:', 
        Buffer.from(GS + 'k' + '\x04' + '*' + barcode.data + '*' + '\x00', 'latin1').toString('hex'));
    }
    
    // Remove barcode patterns from original content completely
    let cleanContent = content;
    for (const barcode of barcodeMatches) {
      cleanContent = cleanContent.replace(barcode.match, '');
    }
    
    // Combine: original content with barcode section INSERTED at strategic position
    // Find a good insertion point (after header but before main content)
    const headerEnd = cleanContent.indexOf('\n\n');
    if (headerEnd !== -1) {
      // Insert after header section
      const beforeContent = cleanContent.substring(0, headerEnd + 2);
      const afterContent = cleanContent.substring(headerEnd + 2);
      const result = beforeContent + barcodeSection + afterContent;
      
      console.log('🔍 DEBUG: Barcode section inserted after header');
      console.log('🔍 DEBUG: processBarcodes output length:', result.length);
      return result;
    } else {
      // Fallback: prepend barcode section
      const result = barcodeSection + cleanContent;
      console.log('🔍 DEBUG: Barcode section prepended to content');
      console.log('🔍 DEBUG: processBarcodes output length:', result.length);
      return result;
    }
  }

  /**
   * Try direct device writing as fallback (macOS)
   */
  private async tryDirectDeviceWrite(content: string): Promise<boolean> {
    // Check for common macOS USB printer device paths
    const possibleDevices = [
      '/dev/tty.usbmodem*',
      '/dev/cu.usbmodem*',
      '/dev/tty.usbserial*',
      '/dev/cu.usbserial*'
    ];
    
    for (const devicePattern of possibleDevices) {
      try {
        // Use shell globbing to find actual device
        const { stdout } = await promisify(exec)(`ls ${devicePattern} 2>/dev/null | head -1`);
        const device = stdout.trim();
        
        if (device) {
          await fs.writeFile(device, content, 'binary');
          return true;
        }
      } catch (error) {
        // Continue to next device pattern
        continue;
      }
    }
    
    return false;
  }

  /**
   * Execute print job using CUPS with raw printing (macOS)
   */
  private async executeJobCups(job: PrintJob): Promise<boolean> {
    return new Promise((resolve) => {
      // Create ESC/POS formatted content for thermal printer
      const escPosContent = this.formatContentForThermalPrinter(job.content);
      const tempFile = `/tmp/parking-print-${Date.now()}.prn`;
      
      // DEBUG: Log what we're trying to print
      console.log('🔍 DEBUG: Original job content:', JSON.stringify(job.content));
      console.log('🔍 DEBUG: Processed ESC/POS content length:', escPosContent.length);
      console.log('🔍 DEBUG: ESC/POS content (first 200 chars):', 
        escPosContent.substring(0, 200).replace(/[\x00-\x1F]/g, (m) => `\\x${m.charCodeAt(0).toString(16).padStart(2, '0')}`));
      console.log('🔍 DEBUG: Temp file:', tempFile);
      
      fs.writeFile(tempFile, Buffer.from(escPosContent, 'latin1'))
        .then(() => {
          // Use lpr with raw option to bypass CUPS formatting
          // DEBUG: Save a copy before printing
          const debugFile = `/tmp/debug-barcode-${Date.now()}.prn`;
          exec(`cp "${tempFile}" "${debugFile}"`, () => {
            console.log('🔍 DEBUG: Saved copy to:', debugFile);
          });
          
          exec(`lpr -P ${this.cupsPrinterName} -o raw "${tempFile}"`, (error, stdout, stderr) => {
            // Clean up temp file (but keep debug copy)
            fs.unlink(tempFile).catch(() => {}); // Ignore cleanup errors
            
            if (error) {
              // Try alternative method - direct device writing if available
              this.tryDirectDeviceWrite(escPosContent)
                .then((success) => {
                  if (success) {
                    this.emit('printJobExecuted', job);
                    resolve(true);
                  } else {
                    this.handleError('PRINTER', 'CUPS_PRINT_FAILED', `CUPS print failed: ${error.message}`, error);
                    resolve(false);
                  }
                })
                .catch(() => {
                  this.handleError('PRINTER', 'CUPS_PRINT_FAILED', `CUPS print failed: ${error.message}`, error);
                  resolve(false);
                });
            } else {
              this.emit('printJobExecuted', job);
              resolve(true);
            }
          });
        })
        .catch((error) => {
          this.handleError('PRINTER', 'FILE_WRITE_ERROR', `Failed to write temp file: ${error.message}`, error);
          resolve(false);
        });
    });
  }

  /**
   * Execute individual print job
   */
  private async executeJob(job: PrintJob): Promise<boolean> {
    if (!this.status.connected) {
      return false;
    }

    try {
      console.log('🔍 DEBUG: executeJob called, isCupsPrinter:', this.isCupsPrinter);
      console.log('🔍 DEBUG: job:', JSON.stringify(job, null, 2));
      
      if (this.isCupsPrinter) {
        // Use CUPS printing for macOS
        console.log('🔍 DEBUG: Using CUPS printing path');
        return await this.executeJobCups(job);
      } else {
        // Use standard thermal printer library
        if (!this.printer) {
          return false;
        }

        // Clear printer buffer
        this.printer.clear();
        
        // Set character encoding for Spanish characters
        this.printer.setCharacterSet(CharacterSet.PC858_EURO);
        
        // Print content
        this.printer.println(job.content);
        
        // Add feed lines and cut
        for (let i = 0; i < HARDWARE_CONSTANTS.PRINTER.FEED_LINES; i++) {
          this.printer.newLine();
        }
        
        // Execute print
        const success = await this.printer.execute();
        
        if (success) {
          this.emit('printJobExecuted', job);
          return true;
        } else {
          this.handleError('PRINTER', 'PRINT_FAILED', i18n.t('hardware.print_failed'));
          return false;
        }
      }
    } catch (error) {
      this.handleError('PRINTER', 'EXECUTION_ERROR', i18n.t('hardware.execution_error'), error);
      return false;
    }
  }

  /**
   * Get current printer status
   */
  public getStatus(): PrinterStatus {
    return { ...this.status };
  }

  /**
   * Get current queue
   */
  public getQueue(): PrintJob[] {
    return [...this.printQueue];
  }

  /**
   * Clear print queue
   */
  public clearQueue(): void {
    this.printQueue = [];
    this.status.queueLength = 0;
    this.emit('queueCleared');
    this.emit('statusUpdate', this.status);
  }

  /**
   * Handle errors with Spanish messages
   */
  private handleError(type: 'PRINTER' | 'CONNECTION', code: string, message: string, error?: any): void {
    const hardwareError: HardwareError = {
      type,
      code,
      message,
      timestamp: new Date(),
      context: error ? { originalError: error.message } : undefined,
      resolved: false
    };

    this.status.lastError = message;
    this.status.lastUpdate = new Date();
    
    this.emit('error', hardwareError);
    this.emit('statusUpdate', this.status);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.retryDelay);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, HARDWARE_CONSTANTS.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health check (USB and TCP)
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.printer || !this.status.connected) {
      return;
    }

    try {
      let isConnected = false;
      
      if (this.config.interfaceType === 'usb') {
        // For USB, check if device still exists and is accessible
        const deviceAvailable = await this.checkUSBDevice(this.config.devicePath!);
        if (deviceAvailable) {
          isConnected = await this.printer.isPrinterConnected();
        }
      } else {
        // For TCP, just check printer connection
        isConnected = await this.printer.isPrinterConnected();
      }
      
      if (!isConnected && this.status.connected) {
        this.status.connected = false;
        this.status.online = false;
        this.connectionState = 'ERROR';
        this.emit('disconnected');
        this.scheduleReconnect();
      }
    } catch (error) {
      this.handleError('PRINTER', 'HEALTH_CHECK_FAILED', i18n.t('hardware.health_check_failed'), error);
    }

    this.status.lastUpdate = new Date();
    this.emit('statusUpdate', this.status);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.disconnect();
    this.removeAllListeners();
  }
}