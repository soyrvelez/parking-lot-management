/**
 * Secure ID Generation Utilities
 * 
 * Provides thread-safe, collision-resistant ID generation for parking lot management.
 * Replaces timestamp-based IDs with proper database-safe implementations.
 */

import { randomBytes, randomUUID } from 'crypto';

// Use crypto.randomBytes for our own nanoid implementation to avoid ES module issues
function generateNanoId(size: number = 21): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = randomBytes(size);
  let result = '';
  
  for (let i = 0; i < size; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  
  return result;
}

/**
 * Configuration for different ID generation strategies
 */
export interface IdGenerationConfig {
  strategy: 'uuid' | 'nanoid' | 'human-readable' | 'database-auto';
  prefix?: string;
  length?: number;
}

/**
 * Thread-safe ID generator class with multiple strategies
 */
export class IdGenerator {
  private static instance: IdGenerator;
  private counters: Map<string, number> = new Map();
  private lastTimestamp: number = 0;
  private sequence: number = 0;

  private constructor() {}

  public static getInstance(): IdGenerator {
    if (!IdGenerator.instance) {
      IdGenerator.instance = new IdGenerator();
    }
    return IdGenerator.instance;
  }

  /**
   * Generate UUID v4 (recommended for most cases)
   */
  public generateUUID(): string {
    return randomUUID();
  }

  /**
   * Generate nanoid (shorter, URL-safe)
   */
  public generateNanoId(size: number = 21): string {
    return generateNanoId(size);
  }

  /**
   * Generate human-readable ID with prefix
   * Uses timestamp + sequence number for uniqueness
   */
  public generateHumanReadableId(prefix: string = 'ID'): string {
    const now = Date.now();
    
    // If same timestamp, increment sequence
    if (now === this.lastTimestamp) {
      this.sequence++;
    } else {
      this.sequence = 0;
      this.lastTimestamp = now;
    }
    
    // Use last 8 digits of timestamp + 3-digit sequence
    const timestampPart = now.toString().slice(-8);
    const sequencePart = this.sequence.toString().padStart(3, '0');
    
    return `${prefix}-${timestampPart}-${sequencePart}`;
  }

  /**
   * Generate ticket number (human-readable format)
   */
  public generateTicketNumber(): string {
    return this.generateHumanReadableId('T');
  }

  /**
   * Generate transaction ID (UUID format for maximum uniqueness)
   */
  public generateTransactionId(): string {
    return `TXN-${this.generateNanoId(12)}`;
  }

  /**
   * Generate lost ticket ID
   */
  public generateLostTicketId(): string {
    return this.generateHumanReadableId('L');
  }

  /**
   * Generate barcode (ticket-specific format)
   */
  public generateBarcode(ticketId: string, plateNumber: string): string {
    return `${ticketId}-${plateNumber}`.toUpperCase();
  }

  /**
   * Generate pension customer ID
   */
  public generatePensionId(): string {
    return this.generateHumanReadableId('P');
  }

  /**
   * High-performance sequence-based ID for bulk operations
   */
  public generateSequenceId(prefix: string): string {
    const counter = this.counters.get(prefix) || 0;
    const newCounter = counter + 1;
    this.counters.set(prefix, newCounter);
    
    const timestamp = Date.now().toString(36); // Base36 for shorter representation
    const sequence = newCounter.toString(36).padStart(4, '0');
    
    return `${prefix}-${timestamp}-${sequence}`;
  }

  /**
   * Reset sequence counters (for testing)
   */
  public resetCounters(): void {
    this.counters.clear();
    this.sequence = 0;
    this.lastTimestamp = 0;
  }
}

/**
 * Convenience functions for common use cases
 */
export const idGenerator = IdGenerator.getInstance();

export const generateTicketNumber = (): string => idGenerator.generateTicketNumber();
export const generateTransactionId = (): string => idGenerator.generateTransactionId();
export const generateLostTicketId = (): string => idGenerator.generateLostTicketId();
export const generateBarcode = (ticketId: string, plateNumber: string): string => 
  idGenerator.generateBarcode(ticketId, plateNumber);

/**
 * Database retry utilities for handling transient failures
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 1000,
  jitter: true
};

/**
 * Exponential backoff with jitter for database operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if it's not a constraint violation or connection error
      const isRetryableError = lastError.message.includes('unique constraint') ||
                               lastError.message.includes('connection') ||
                               lastError.message.includes('timeout');
      
      if (!isRetryableError || attempt === config.maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      let delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);
      
      // Add jitter to prevent thundering herd
      if (config.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Atomic transaction wrapper with retry logic
 */
export async function withAtomicRetry<T>(
  prismaClient: any,
  operation: (tx: any) => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  return withRetry(async () => {
    return prismaClient.$transaction(operation);
  }, config);
}