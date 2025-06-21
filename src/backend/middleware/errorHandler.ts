import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { i18n } from '../../shared/localization';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  context?: Record<string, any>;
}

export class BusinessLogicError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public context?: Record<string, any>;

  constructor(message: string, code: string, statusCode: number = 400, context?: Record<string, any>) {
    super(message);
    this.name = 'BusinessLogicError';
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
  }
}

export class HardwareError extends Error implements ApiError {
  public statusCode: number = 503;
  public code: string;
  public context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = 'HardwareError';
    this.code = code;
    this.context = context;
  }
}

export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(7);

  console.error(`[${requestId}] Error:`, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: i18n.t('validation.field_invalid', { 
        field: err.path.join('.'),
        value: err.message 
      })
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: i18n.t('validation.request_invalid'),
        details: validationErrors,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
    return;
  }

  // Business logic errors
  if (error instanceof BusinessLogicError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        context: error.context,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
    return;
  }

  // Hardware errors
  if (error instanceof HardwareError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: i18n.t('hardware.contact_support'),
        context: error.context,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
    return;
  }

  // Prisma database errors
  if (error instanceof PrismaClientKnownRequestError) {
    let message = i18n.t('database.operation_failed');
    let statusCode = 500;

    switch (error.code) {
      case 'P2002':
        message = i18n.t('database.duplicate_entry');
        statusCode = 409;
        break;
      case 'P2025':
        message = i18n.t('database.record_not_found');
        statusCode = 404;
        break;
      case 'P2003':
        message = i18n.t('database.foreign_key_constraint');
        statusCode = 400;
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
    return;
  }

  // Generic server errors
  const statusCode = (error as ApiError).statusCode || 500;
  const errorCode = (error as ApiError).code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: statusCode === 500 
        ? i18n.t('errors.internal_server_error')
        : error.message,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
}