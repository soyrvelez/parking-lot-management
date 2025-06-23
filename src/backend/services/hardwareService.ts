import { HardwareHealth, PrinterStatus, ScannerStatus, HARDWARE_CONSTANTS } from '../../shared/types/hardware';
import * as net from 'net';

class HardwareService {
  private lastPrinterCheck: Date = new Date();
  private lastScannerCheck: Date = new Date();
  private printerStatus: PrinterStatus = {
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
  
  private scannerStatus: ScannerStatus = {
    connected: false,
    ready: false,
    totalScans: 0,
    failedScans: 0,
    timeoutCount: 0,
    manualEntryCount: 0,
    focusActive: false,
    lastUpdate: new Date()
  };

  /**
   * Check printer connectivity
   */
  private async checkPrinterConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(HARDWARE_CONSTANTS.PRINTER.DEFAULT_TIMEOUT);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(
        HARDWARE_CONSTANTS.PRINTER.DEFAULT_PORT, 
        HARDWARE_CONSTANTS.PRINTER.DEFAULT_HOST
      );
    });
  }

  /**
   * Update printer status
   */
  private async updatePrinterStatus(): Promise<void> {
    const isConnected = await this.checkPrinterConnection();
    
    this.printerStatus = {
      ...this.printerStatus,
      connected: isConnected,
      online: isConnected,
      paperStatus: isConnected ? 'OK' : 'UNKNOWN',
      coverOpen: false,
      cutterStatus: isConnected ? 'OK' : 'UNKNOWN',
      temperature: isConnected ? 'NORMAL' : 'UNKNOWN',
      lastUpdate: new Date()
    };
    
    this.lastPrinterCheck = new Date();
  }

  /**
   * Update scanner status (simulated for now)
   */
  private updateScannerStatus(): void {
    // In production, this would check USB HID device status
    // For now, we simulate the scanner as always connected
    this.scannerStatus = {
      ...this.scannerStatus,
      connected: true,
      ready: true,
      focusActive: true,
      lastUpdate: new Date()
    };
    
    this.lastScannerCheck = new Date();
  }

  /**
   * Get current hardware health status
   */
  async getHardwareHealth(): Promise<HardwareHealth> {
    // Check if we need to update status (cache for 10 seconds)
    const now = new Date();
    const printerAge = now.getTime() - this.lastPrinterCheck.getTime();
    const scannerAge = now.getTime() - this.lastScannerCheck.getTime();
    
    if (printerAge > 10000) {
      await this.updatePrinterStatus();
    }
    
    if (scannerAge > 10000) {
      this.updateScannerStatus();
    }
    
    // Determine overall status
    let overallStatus: HardwareHealth['overallStatus'] = 'HEALTHY';
    
    if (!this.printerStatus.connected || !this.scannerStatus.connected) {
      overallStatus = 'CRITICAL';
    } else if (this.printerStatus.paperStatus === 'LOW' || !this.scannerStatus.ready) {
      overallStatus = 'DEGRADED';
    }
    
    return {
      printer: this.printerStatus,
      scanner: this.scannerStatus,
      lastHealthCheck: new Date(),
      overallStatus,
      errors: []
    };
  }

  /**
   * Increment scan counter
   */
  recordScan(success: boolean): void {
    this.scannerStatus.totalScans++;
    if (!success) {
      this.scannerStatus.failedScans++;
    }
    this.scannerStatus.lastScan = new Date();
  }

  /**
   * Increment print job counter
   */
  recordPrintJob(success: boolean): void {
    this.printerStatus.totalPrintJobs++;
    if (!success) {
      this.printerStatus.failedJobs++;
    }
  }
}

// Export singleton instance
export const hardwareService = new HardwareService();