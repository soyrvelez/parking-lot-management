import { Request, Response, NextFunction } from 'express';
import { i18n } from '../../shared/localization';

export interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  timestamp: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(7);

  // Add request ID to request for use in other middleware
  req.headers['x-request-id'] = requestId;

  const logData: RequestLog = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp: i18n.formatDateTime(new Date())
  };

  // Log incoming request
  console.log(`[${requestId}] ${req.method} ${req.originalUrl} - ${logData.ip}`);

  // Capture response details
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    const responseSize = Buffer.isBuffer(data) ? data.length : 
                        typeof data === 'string' ? Buffer.byteLength(data) : 
                        JSON.stringify(data).length;

    // Complete log entry
    const completedLog: RequestLog = {
      ...logData,
      duration,
      statusCode: res.statusCode,
      responseSize
    };

    // Log response
    const statusEmoji = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅';
    console.log(
      `[${requestId}] ${statusEmoji} ${res.statusCode} - ${duration}ms - ${responseSize} bytes`
    );

    // Log errors in Spanish for operational monitoring
    if (res.statusCode >= 400) {
      console.error(`[${requestId}] Error en solicitud:`, {
        metodo: req.method,
        ruta: req.originalUrl,
        codigo: res.statusCode,
        duracion: `${duration}ms`,
        ip: logData.ip
      });
    }

    return originalSend.call(this, data);
  };

  next();
}

// Re-export audit logger from audit service
export { auditLogger } from '../services/audit/audit.service';