/**
 * Rate Limiting Middleware
 * Protects admin endpoints from brute force attacks
 * Configurable per endpoint with Spanish error messages
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { i18n } from '../../shared/localization';

// Store for tracking rate limit violations
const rateLimitViolations = new Map<string, number>();

/**
 * Base rate limiter configuration
 */
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: (req: Request, res: Response) => {
      const ip = req.ip || 'unknown';
      const violations = rateLimitViolations.get(ip) || 0;
      rateLimitViolations.set(ip, violations + 1);

      // Log rate limit violation
      console.warn(`[RATE LIMIT] IP ${ip} exceeded limit - violations: ${violations + 1}`);

      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message || i18n.t('systemErrors.rate_limit_exceeded'),
          retryAfter: req.headers['retry-after'],
          timestamp: new Date().toISOString()
        }
      };
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => req.ip || 'unknown'),
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health' || req.path === '/api/admin/health';
    }
  });
};

/**
 * Standard rate limiter for general admin endpoints
 * 100 requests per minute
 */
export const adminRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Demasiadas solicitudes de administración. Por favor, intente más tarde.'
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 5 minutes
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: 'Límite de operaciones sensibles excedido. Espere 5 minutos.'
});

/**
 * Auth rate limiter for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Demasiados intentos de autenticación. Cuenta temporalmente bloqueada.'
});

/**
 * Report generation rate limiter
 * 20 reports per hour
 */
export const reportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Límite de generación de reportes excedido. Máximo 20 reportes por hora.'
});

/**
 * Operator creation rate limiter
 * 5 new operators per hour per admin
 */
export const operatorCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: (req: Request & { user?: any }) => {
    // Rate limit per admin user, not per IP
    return req.user?.id || req.ip || 'unknown';
  },
  message: 'Límite de creación de operadores excedido. Máximo 5 por hora.'
});

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  violations: { ip: string; count: number }[];
  totalViolations: number;
} {
  const violations = Array.from(rateLimitViolations.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count);

  const totalViolations = violations.reduce((sum, v) => sum + v.count, 0);

  return { violations, totalViolations };
}

/**
 * Clear rate limit violations (for admin use)
 */
export function clearRateLimitViolations(): void {
  rateLimitViolations.clear();
  console.log('[RATE LIMIT] Violation history cleared');
}