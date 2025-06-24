/**
 * Partner Business Routes
 * Handles partner business management, partner ticket creation and payment processing
 * All endpoints require admin authentication and provide Spanish responses
 */

import { Router } from 'express';
import partnerController from '../controllers/partnerController';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas with Spanish error messages
const createPartnerBusinessSchema = z.object({
  name: z.string().min(2, 'El nombre del negocio debe tener al menos 2 caracteres'),
  businessType: z.string().min(2, 'El tipo de negocio debe tener al menos 2 caracteres'),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Formato de correo electrónico inválido').optional(),
  address: z.string().optional(),
  
  // Pricing - either flatRate OR hourlyRate (not both)
  flatRate: z.string().refine(val => {
    if (!val) return true; // Optional
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 5000;
    } catch {
      return false;
    }
  }, 'La tarifa fija debe ser un número válido entre 0 y 5000').optional(),
  
  hourlyRate: z.string().refine(val => {
    if (!val) return true; // Optional
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 500;
    } catch {
      return false;
    }
  }, 'La tarifa por hora debe ser un número válido entre 0 y 500').optional(),
  
  maxHours: z.number().min(1, 'Las horas máximas deben ser al menos 1').max(24, 'Las horas máximas no pueden exceder 24').optional(),
  validDays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).min(1, 'Debe seleccionar al menos un día válido'),
  validTimeStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)').optional(),
  validTimeEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)').optional(),
  
  description: z.string().optional(),
  specialInstructions: z.string().optional(),
  logoUrl: z.string().url('URL del logo inválido').optional()
}).refine(data => {
  // Must have either flatRate OR hourlyRate (not both, not neither)
  const hasFlatRate = data.flatRate && parseFloat(data.flatRate) > 0;
  const hasHourlyRate = data.hourlyRate && parseFloat(data.hourlyRate) > 0;
  return hasFlatRate !== hasHourlyRate; // XOR: exactly one must be true
}, {
  message: 'Debe especificar una tarifa fija O una tarifa por hora, no ambas',
  path: ['flatRate']
});

const updatePartnerBusinessSchema = z.object({
  name: z.string().min(2, 'El nombre del negocio debe tener al menos 2 caracteres').optional(),
  businessType: z.string().min(2, 'El tipo de negocio debe tener al menos 2 caracteres').optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Formato de correo electrónico inválido').optional(),
  address: z.string().optional(),
  flatRate: z.string().optional(),
  hourlyRate: z.string().optional(),
  maxHours: z.number().optional(),
  validDays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).optional(),
  validTimeStart: z.string().optional(),
  validTimeEnd: z.string().optional(),
  description: z.string().optional(),
  specialInstructions: z.string().optional(),
  logoUrl: z.string().optional(),
  isActive: z.boolean().optional()
});

const createPartnerTicketSchema = z.object({
  plateNumber: z.string().min(6, 'La placa debe tener al menos 6 caracteres').max(10, 'La placa no puede exceder 10 caracteres'),
  partnerBusinessId: z.string().min(1, 'El ID del socio comercial es requerido'),
  customerName: z.string().optional(),
  businessReference: z.string().optional(),
  specialNotes: z.string().optional(),
  operatorId: z.string().optional()
});

const processPartnerPaymentSchema = z.object({
  operatorId: z.string().optional(),
  paymentMethod: z.enum(['CASH'], {
    errorMap: () => ({ message: 'Método de pago debe ser CASH' })
  }).default('CASH'),
  hasBusinessStamp: z.boolean().default(false),
  chargeRegularRate: z.boolean().default(false)
});

// Partner Business Management Routes (Admin only)
router.get('/businesses', authMiddleware, requireRole('admin'), partnerController.getAllPartnerBusinesses);
router.get('/businesses/active', partnerController.getActivePartnerBusinesses); // For operator interface
router.get('/businesses/:id', authMiddleware, requireRole('admin'), partnerController.getPartnerBusiness);
router.post('/businesses', authMiddleware, requireRole('admin'), validateRequest(createPartnerBusinessSchema), partnerController.createPartnerBusiness);
router.put('/businesses/:id', authMiddleware, requireRole('admin'), validateRequest(updatePartnerBusinessSchema), partnerController.updatePartnerBusiness);
router.delete('/businesses/:id', authMiddleware, requireRole('admin'), partnerController.deletePartnerBusiness);

// Partner Business Analytics (Admin/Manager)
router.get('/businesses/:id/analytics', authMiddleware, requireRole('admin'), partnerController.getPartnerBusinessAnalytics);
router.get('/businesses/:id/tickets', authMiddleware, requireRole('admin'), partnerController.getPartnerTickets);

// Partner Ticket Management Routes
router.get('/tickets/active', partnerController.getActivePartnerTickets.bind(partnerController));
router.get('/tickets/lookup/:barcode', partnerController.lookupPartnerTicket.bind(partnerController));
router.get('/tickets/by-plate/:plateNumber', partnerController.getPartnerTicketsByPlate.bind(partnerController));
router.get('/tickets/:id', partnerController.getPartnerTicket.bind(partnerController));

// Partner Ticket Creation (Operator Interface)
router.post('/tickets', validateRequest(createPartnerTicketSchema), partnerController.createPartnerTicket.bind(partnerController));

// Partner Payment Processing
router.post('/tickets/:id/payment', validateRequest(processPartnerPaymentSchema), partnerController.processPartnerPayment.bind(partnerController));
router.get('/tickets/:id/calculate', partnerController.calculatePartnerTicketAmount.bind(partnerController));
router.get('/tickets/:id/calculate-both', partnerController.calculateBothRates.bind(partnerController));

// Partner Lost Ticket Processing
router.post('/lost-ticket', partnerController.processPartnerLostTicket.bind(partnerController));

// Partner Reporting
router.get('/reports/summary', authMiddleware, requireRole('admin'), partnerController.getPartnerReports);
router.get('/reports/daily', authMiddleware, requireRole('admin'), partnerController.getDailyPartnerReport);
router.get('/reports/monthly', authMiddleware, requireRole('admin'), partnerController.getMonthlyPartnerReport);

// Partner Analytics
router.get('/analytics', authMiddleware, requireRole('admin'), partnerController.getPartnerAnalytics);
router.get('/reports/export', authMiddleware, requireRole('admin'), partnerController.exportPartnerReport);

export default router;