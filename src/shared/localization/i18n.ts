import { LocaleConfig, TranslationKey } from '../types/financial';
import { esMX } from './es-MX';

/**
 * I18n system for parking lot management
 * Configured for Mexican Spanish with Mexico City timezone
 */
export class I18n {
  private static instance: I18n;
  private locale: LocaleConfig;
  private translations: TranslationKey;
  private translationCache: Map<string, string>;
  
  // Cached formatters for performance optimization
  private static formatters: {
    currency?: Intl.NumberFormat;
    number?: Intl.NumberFormat;
    date?: Intl.DateTimeFormat;
    time?: Intl.DateTimeFormat;
    dateTime?: Intl.DateTimeFormat;
  } = {};

  private constructor() {
    this.locale = {
      language: 'es-MX',
      country: 'MX',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    };
    this.translations = esMX;
    this.translationCache = new Map();
    
    // Initialize cached formatters
    this.initializeFormatters();
  }

  private initializeFormatters(): void {
    I18n.formatters.currency = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    I18n.formatters.number = new Intl.NumberFormat('es-MX');
    
    I18n.formatters.date = new Intl.DateTimeFormat('es-MX', {
      timeZone: this.locale.timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    I18n.formatters.time = new Intl.DateTimeFormat('es-MX', {
      timeZone: this.locale.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    I18n.formatters.dateTime = new Intl.DateTimeFormat('es-MX', {
      timeZone: this.locale.timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  public static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  /**
   * Get translation for a nested key path with caching and improved type safety
   * Example: t('parking.ticket') returns 'Boleto'
   */
  public t(keyPath: string, variables?: Record<string, any>): string {
    // Create cache key that includes variables for proper caching
    const cacheKey = variables ? `${keyPath}:${JSON.stringify(variables)}` : keyPath;
    
    // Check cache first for performance
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }
    
    // Validate key path format
    if (!keyPath || typeof keyPath !== 'string') {
      return `[${keyPath}]`;
    }
    
    const keys = keyPath.split('.');
    let current: unknown = this.translations;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Cache the miss and return error indicator
        this.translationCache.set(cacheKey, `[${keyPath}]`);
        return `[${keyPath}]`;
      }
    }
    
    let result = typeof current === 'string' ? current : `[${keyPath}]`;
    
    // Interpolate variables if provided
    if (variables && typeof result === 'string') {
      result = this.interpolateTemplate(result, variables);
    }
    
    // Cache successful translation
    this.translationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Interpolate template variables in a string
   * Supports {variable} syntax
   */
  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (key in variables) {
        const value = variables[key];
        return value !== null && value !== undefined ? String(value) : match;
      }
      return match; // Keep original placeholder if variable not found
    });
  }

  /**
   * Get current locale configuration
   */
  public getLocale(): LocaleConfig {
    return { ...this.locale };
  }

  /**
   * Format currency amount in Mexican pesos using cached formatter
   */
  public formatCurrency(amount: number): string {
    if (!I18n.formatters.currency) {
      this.initializeFormatters();
    }
    
    try {
      return I18n.formatters.currency!.format(amount);
    } catch (error) {
      // Fallback for invalid amounts
      return `$${amount.toFixed(2)}`;
    }
  }

  /**
   * Format date in Mexican format (DD/MM/YYYY) with Mexico City timezone
   */
  public formatDate(date: Date): string {
    if (!I18n.formatters.date) {
      this.initializeFormatters();
    }
    
    try {
      return I18n.formatters.date!.format(date);
    } catch (error) {
      // Fallback for invalid dates
      return date.toLocaleDateString('es-MX');
    }
  }

  /**
   * Format time in 24-hour format with Mexico City timezone
   */
  public formatTime(date: Date): string {
    if (!I18n.formatters.time) {
      this.initializeFormatters();
    }
    
    try {
      return I18n.formatters.time!.format(date);
    } catch (error) {
      // Fallback for invalid dates
      return date.toLocaleTimeString('es-MX', { hour12: false });
    }
  }

  /**
   * Format complete datetime with Mexico City timezone
   */
  public formatDateTime(date: Date): string {
    if (!I18n.formatters.dateTime) {
      this.initializeFormatters();
    }
    
    try {
      return I18n.formatters.dateTime!.format(date);
    } catch (error) {
      // Fallback for invalid dates
      return `${this.formatDate(date)}, ${this.formatTime(date)}`;
    }
  }

  /**
   * Get current Mexico City time
   */
  public now(): Date {
    return new Date();
  }

  /**
   * Get Mexico City timezone offset
   */
  public getTimezoneOffset(): string {
    try {
      const date = new Date();
      const offset = date.toLocaleString('es-MX', {
        timeZone: this.locale.timezone,
        timeZoneName: 'short',
      });
      return offset.split(' ').pop() || 'CST';
    } catch (error) {
      return 'CST'; // Safe fallback
    }
  }

  /**
   * Format duration in Spanish (e.g., "2 horas 15 minutos")
   */
  public formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} ${this.t('time.minutes')}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : this.t('time.hours')}`;
    }
    
    return `${hours} ${hours === 1 ? 'hora' : this.t('time.hours')} ${remainingMinutes} ${this.t('time.minutes')}`;
  }

  /**
   * Format amount with Mexican peso notation using cached formatter
   */
  public formatPesos(amount: number): string {
    if (amount === 0) {
      return this.t('currency.free');
    }
    
    const wholeAmount = Math.floor(amount);
    const centavos = Math.round((amount - wholeAmount) * 100);
    
    // Use cached number formatter for thousands separators
    if (!I18n.formatters.number) {
      this.initializeFormatters();
    }
    
    try {
      const formattedWhole = I18n.formatters.number!.format(wholeAmount);
      
      if (centavos === 0) {
        return `$${formattedWhole} ${this.t('currency.pesos')}`;
      }
      
      return `$${formattedWhole}.${centavos.toString().padStart(2, '0')} ${this.t('currency.pesos')}`;
    } catch (error) {
      // Fallback formatting
      return `$${amount.toFixed(2)} ${this.t('currency.pesos')}`;
    }
  }

  /**
   * Generate a complete receipt template with proper Spanish formatting
   */
  public generateReceiptTemplate(data: {
    ticketNumber: string;
    plateNumber: string;
    entryTime: Date;
    exitTime: Date;
    durationMinutes: number;
    totalAmount: number;
    paymentMethod: string;
    change?: number;
  }): string {
    const lines = [
      this.t('receipt.header_line1'),
      this.t('receipt.header_line2'),
      this.t('receipt.separator_line'),
      '',
      `${this.t('parking.ticket')}: ${data.ticketNumber}`,
      `${this.t('parking.plate')}: ${data.plateNumber}`,
      '',
      `${this.t('receipt.entry_time_label')} ${this.formatDateTime(data.entryTime)}`,
      `${this.t('receipt.exit_time_label')} ${this.formatDateTime(data.exitTime)}`,
      `${this.t('receipt.duration_label')} ${this.formatDuration(data.durationMinutes)}`,
      '',
      `${this.t('receipt.total_label')} ${this.formatPesos(data.totalAmount)}`,
      `${this.t('receipt.payment_method_label')} ${data.paymentMethod}`,
    ];
    
    if (data.change && data.change > 0) {
      lines.push(`${this.t('receipt.change_label')} ${this.formatPesos(data.change)}`);
    }
    
    lines.push(
      '',
      this.t('receipt.separator_line'),
      this.t('receipt.footer_thank_you'),
      this.t('receipt.footer_drive_safely'),
      ''
    );
    
    return lines.join('\n');
  }

  /**
   * Clear translation cache (useful for testing or memory management)
   */
  public clearCache(): void {
    this.translationCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.translationCache.size,
      keys: Array.from(this.translationCache.keys())
    };
  }
}


// Export singleton instance for easy use
export const i18n = I18n.getInstance();

// Export convenience function
export const t = (keyPath: string): string => i18n.t(keyPath);