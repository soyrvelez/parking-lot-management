import { z } from 'zod';

// Pension customer creation schema
export const CreatePensionCustomerSchema = z.object({
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre muy largo (máximo 100 caracteres)'),
  
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[\d\s\-\+\(\)]+$/.test(val), {
      message: 'Formato de teléfono inválido'
    }),
  
  plateNumber: z.string()
    .min(3, 'Número de placa muy corto')
    .max(15, 'Número de placa muy largo')
    .regex(/^[A-Z0-9\-]+$/, 'Placa debe contener solo letras, números y guiones')
    .transform(val => val.toUpperCase()),
  
  vehicleMake: z.string()
    .optional()
    .refine((val) => !val || val.length <= 50, {
      message: 'Marca muy larga (máximo 50 caracteres)'
    }),
  
  vehicleModel: z.string()
    .optional()
    .refine((val) => !val || val.length <= 50, {
      message: 'Modelo muy largo (máximo 50 caracteres)'
    }),
  
  monthlyRate: z.number()
    .positive('Tarifa mensual debe ser positiva')
    .max(50000, 'Tarifa mensual demasiado alta'),
  
  startDate: z.string()
    .transform(str => new Date(str))
    .refine(date => !isNaN(date.getTime()), {
      message: 'Fecha de inicio inválida'
    }),
  
  durationMonths: z.number()
    .int('Duración debe ser un número entero')
    .min(1, 'Duración mínima 1 mes')
    .max(12, 'Duración máxima 12 meses')
    .default(1),
  
  operatorId: z.string().optional()
});

// Pension payment processing schema
export const PensionPaymentSchema = z.object({
  customerId: z.string()
    .min(1, 'ID de cliente requerido'),
  
  cashReceived: z.number()
    .positive('Monto recibido debe ser positivo')
    .max(10000, 'Monto demasiado alto'),
  
  operatorId: z.string().optional(),
  
  notes: z.string().optional()
});

// Pension renewal schema
export const PensionRenewalSchema = z.object({
  durationMonths: z.number()
    .int('Duración debe ser un número entero')
    .min(1, 'Duración mínima 1 mes')
    .max(12, 'Duración máxima 12 meses')
    .default(1),
  
  cashReceived: z.number()
    .positive('Monto recibido debe ser positivo')
    .max(10000, 'Monto demasiado alto'),
  
  operatorId: z.string().optional(),
  
  notes: z.string().optional()
});

// Pension lookup schema
export const PensionLookupSchema = z.object({
  identifier: z.string()
    .min(1, 'Identificador requerido')
});

// TypeScript types
export type CreatePensionCustomerRequest = z.infer<typeof CreatePensionCustomerSchema>;
export type PensionPaymentRequest = z.infer<typeof PensionPaymentSchema>;
export type PensionRenewalRequest = z.infer<typeof PensionRenewalSchema>;
export type PensionLookupRequest = z.infer<typeof PensionLookupSchema>;

// Pension customer status enum
export enum PensionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON', // Within 7 days
  INACTIVE = 'INACTIVE'
}

// Pension customer response interface
export interface PensionCustomerResponse {
  id: string;
  name: string;
  phone?: string;
  plateNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  monthlyRate: number;
  status: PensionStatus;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
  barcode: string;
  createdAt: string;
  updatedAt: string;
}