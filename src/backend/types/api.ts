import { z } from 'zod';
import { i18n } from '../../shared/localization';

// Custom validation messages in Spanish
const createMessage = (key: string, params?: Record<string, any>) => {
  try {
    return i18n.t(key, params);
  } catch {
    return `Validation error: ${key}`;
  }
};

// Common field validators
export const PlateNumberSchema = z
  .string()
  .min(1, createMessage('validation.plate_required'))
  .max(15, createMessage('validation.plate_too_long'))
  .regex(/^[A-Z0-9\-]{3,15}$/, createMessage('validation.plate_invalid_format'));

export const BarcodeSchema = z
  .string()
  .min(3, createMessage('validation.barcode_too_short'))
  .max(43, createMessage('validation.barcode_too_long'))
  .regex(/^[A-Z0-9\-. $/+%*]+$/, createMessage('validation.barcode_invalid_chars'));

export const MoneyAmountSchema = z
  .number()
  .positive(createMessage('validation.amount_positive'))
  .max(9999.99, createMessage('validation.amount_too_large'))
  .refine((val) => Number.isFinite(val), createMessage('validation.amount_invalid'));

// Entry endpoint schemas
export const EntryRequestSchema = z.object({
  plateNumber: PlateNumberSchema,
  vehicleType: z.enum(['car', 'motorcycle', 'truck']).default('car'),
  operatorId: z.string().min(1, createMessage('validation.operator_required')),
  notes: z.string().max(500).optional()
});

export const EntryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    ticketNumber: z.string(),
    plateNumber: z.string(),
    entryTime: z.string(),
    barcode: z.string(),
    estimatedFee: z.string(),
    message: z.string()
  }),
  timestamp: z.string()
});

// Calculate fee endpoint schemas
export const CalculateRequestSchema = z.object({
  ticketNumber: z.string().min(1, createMessage('validation.ticket_required')),
  barcode: BarcodeSchema.optional(),
  exitTime: z.string().datetime().optional() // ISO string, defaults to now
});

export const CalculateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    ticketNumber: z.string(),
    plateNumber: z.string(),
    entryTime: z.string(),
    exitTime: z.string(),
    duration: z.string(),
    pricing: z.object({
      minimumCharge: z.string(),
      incrementalCharges: z.array(z.object({
        period: z.string(),
        amount: z.string()
      })),
      specialDiscount: z.string().optional(),
      subtotal: z.string(),
      total: z.string()
    }),
    paymentRequired: z.boolean(),
    message: z.string()
  }),
  timestamp: z.string()
});

// Payment endpoint schemas
export const PaymentRequestSchema = z.object({
  ticketNumber: z.string().min(1, createMessage('validation.ticket_required')),
  barcode: BarcodeSchema.optional(),
  cashReceived: MoneyAmountSchema,
  operatorId: z.string().min(1, createMessage('validation.operator_required')),
  paymentMethod: z.enum(['efectivo']).default('efectivo')
});

export const PaymentResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    ticketNumber: z.string(),
    plateNumber: z.string(),
    totalAmount: z.string(),
    cashReceived: z.string(),
    changeGiven: z.string(),
    paymentTime: z.string(),
    receiptPrinted: z.boolean(),
    denominations: z.array(z.object({
      value: z.number(),
      count: z.number()
    })).optional(),
    message: z.string()
  }),
  timestamp: z.string()
});

// Exit endpoint schemas
export const ExitRequestSchema = z.object({
  ticketNumber: z.string().min(1, createMessage('validation.ticket_required')),
  barcode: BarcodeSchema.optional(),
  operatorId: z.string().min(1, createMessage('validation.operator_required'))
});

export const ExitResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    ticketNumber: z.string(),
    plateNumber: z.string(),
    exitTime: z.string(),
    totalDuration: z.string(),
    amountPaid: z.string(),
    gateOpened: z.boolean(),
    message: z.string()
  }),
  timestamp: z.string()
});

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    context: z.record(z.any()).optional(),
    timestamp: z.string(),
    requestId: z.string().optional()
  })
});

// Type exports
export type EntryRequest = z.infer<typeof EntryRequestSchema>;
export type EntryResponse = z.infer<typeof EntryResponseSchema>;
export type CalculateRequest = z.infer<typeof CalculateRequestSchema>;
export type CalculateResponse = z.infer<typeof CalculateResponseSchema>;
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;
export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;
export type ExitRequest = z.infer<typeof ExitRequestSchema>;
export type ExitResponse = z.infer<typeof ExitResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;