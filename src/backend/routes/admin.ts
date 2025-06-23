/**
 * Administration Routes
 * Handles dashboard metrics, reporting, system health, and user management
 * All endpoints require admin authentication and provide Spanish responses
 */

import { Router } from 'express';
import adminController from '../controllers/adminController';
import { requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Authentication middleware already applied globally in app.ts

// Validation schemas with Spanish error messages
const createOperatorSchema = z.object({
  email: z.string().email('Formato de correo electrónico inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, MANAGER o VIEWER' })
  }),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

const updateOperatorSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'], {
    errorMap: () => ({ message: 'Rol debe ser ADMIN, MANAGER o VIEWER' })
  }).optional(),
  isActive: z.boolean().optional()
});

// CRITICAL: Admin pricing configuration validation schema
const pricingConfigSchema = z.object({
  minimumHours: z.number().min(0.25, 'Las horas mínimas deben ser al menos 0.25').max(24, 'Las horas mínimas no pueden exceder 24'),
  minimumRate: z.string().refine(val => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 10000;
    } catch {
      return false;
    }
  }, 'La tarifa mínima debe ser un número válido entre 0 y 10000'),
  incrementMinutes: z.number().min(5, 'Los minutos de incremento deben ser al menos 5').max(60, 'Los minutos de incremento no pueden exceder 60'),
  incrementRate: z.string().refine(val => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 1000;
    } catch {
      return false;
    }
  }, 'La tarifa de incremento debe ser un número válido entre 0 y 1000'),
  dailySpecialHours: z.number().min(1, 'Las horas especiales diarias deben ser al menos 1').max(24, 'Las horas especiales diarias no pueden exceder 24'),
  dailySpecialRate: z.string().refine(val => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 20000;
    } catch {
      return false;
    }
  }, 'La tarifa especial diaria debe ser un número válido entre 0 y 20000'),
  monthlyRate: z.string().refine(val => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 50000;
    } catch {
      return false;
    }
  }, 'La tarifa mensual debe ser un número válido entre 0 y 50000'),
  lostTicketFee: z.string().refine(val => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num <= 5000;
    } catch {
      return false;
    }
  }, 'El cargo por boleto perdido debe ser un número válido entre 0 y 5000')
});

/**
 * GET /api/admin/dashboard
 * Full dashboard metrics with admin features
 * Requires: ADMIN role (applied at router level)
 */
router.get('/dashboard',
  requireRole('admin'),
  (req, res) => adminController.getDashboardMetrics(req, res)
);

/**
 * GET /api/admin/reports/daily
 * Daily revenue and operations report
 * Query params: date, startDate, endDate, format (csv)
 * Requires: ADMIN or MANAGER role
 */
router.get('/reports/daily',
  requireRole('admin'), // admin can access reports
  (req, res) => adminController.getDailyReport(req, res)
);

/**
 * GET /api/admin/reports/monthly
 * Monthly trend analysis with growth comparisons
 * Query params: month, year
 * Requires: ADMIN or MANAGER role
 */
router.get('/reports/monthly',
  requireRole('admin'),
  (req, res) => adminController.getMonthlyReport(req, res)
);

/**
 * GET /api/admin/audit
 * Comprehensive audit log with Spanish filtering
 * Query params: page, limit, entityType, startDate, endDate, search, action
 * Requires: ADMIN role
 */
router.get('/audit',
  requireRole('admin'),
  (req, res) => adminController.getAuditLog(req, res)
);

/**
 * GET /api/admin/health
 * System health monitoring including hardware status
 * Requires: ADMIN role
 */
router.get('/health',
  requireRole('admin'),
  (req, res) => adminController.getSystemHealth(req, res)
);

/**
 * POST /api/admin/operators
 * Create new operator account
 * Requires: ADMIN role
 */
router.post('/operators',
  requireRole('admin'),
  validateRequest(createOperatorSchema),
  (req, res) => adminController.createOperator(req, res)
);

/**
 * GET /api/admin/operators
 * List all operators with pagination
 * Query params: page, limit, role, isActive
 * Requires: ADMIN role
 */
router.get('/operators',
  requireRole('admin'),
  (req, res) => adminController.getOperators(req, res)
);

/**
 * PUT /api/admin/operators/:id
 * Update operator information
 * Requires: ADMIN role
 */
router.put('/operators/:id',
  requireRole('admin'),
  validateRequest(updateOperatorSchema),
  (req, res) => adminController.updateOperator(req, res)
);

/**
 * GET /api/admin/tickets/active
 * List all active tickets in the parking lot
 * Requires: ADMIN role
 */
router.get('/tickets/active',
  requireRole('admin'),
  (req, res) => adminController.getActiveTickets(req, res)
);

/**
 * GET /api/admin/tickets/:id
 * Get detailed information for a specific ticket
 * Requires: ADMIN role
 */
router.get('/tickets/:id',
  requireRole('admin'),
  (req, res) => adminController.getTicketDetails(req, res)
);

/**
 * PUT /api/admin/tickets/:id/payment
 * Process payment for a specific ticket
 * Requires: ADMIN role
 */
router.put('/tickets/:id/payment',
  requireRole('admin'),
  (req, res) => adminController.processTicketPayment(req, res)
);

/**
 * PUT /api/admin/tickets/:id/lost
 * Mark a ticket as lost and apply lost ticket fee
 * Requires: ADMIN role
 */
router.put('/tickets/:id/lost',
  requireRole('admin'),
  (req, res) => adminController.markTicketAsLost(req, res)
);

/**
 * PUT /api/admin/tickets/:id/void
 * Void a ticket (cancel without charge)
 * Requires: ADMIN role
 */
router.put('/tickets/:id/void',
  requireRole('admin'),
  (req, res) => adminController.voidTicket(req, res)
);

/**
 * DELETE /api/admin/tickets/:id
 * Delete a ticket permanently from the system
 * Requires: ADMIN role
 */
router.delete('/tickets/:id',
  requireRole('admin'),
  (req, res) => adminController.deleteTicket(req, res)
);

/**
 * GET /api/admin/transactions/recent
 * Get recent transactions for dashboard
 * Requires: ADMIN role
 */
router.get('/transactions/recent',
  requireRole('admin'),
  (req, res) => adminController.getRecentTransactions(req, res)
);

/**
 * GET /api/admin/reports/summary
 * Get report summary data
 * Requires: ADMIN role
 */
router.get('/reports/summary',
  requireRole('admin'),
  (req, res) => adminController.getReportSummary(req, res)
);

/**
 * GET /api/admin/reports/charts
 * Get chart data for reports
 * Requires: ADMIN role
 */
router.get('/reports/charts',
  requireRole('admin'),
  (req, res) => adminController.getReportCharts(req, res)
);

/**
 * GET /api/admin/reports/transactions
 * Get transaction history for reports
 * Requires: ADMIN role
 */
router.get('/reports/transactions',
  requireRole('admin'),
  (req, res) => adminController.getReportTransactions(req, res)
);

/**
 * GET /api/admin/reports/export
 * Export reports in various formats (CSV, PDF)
 * Query params: startDate, endDate, reportType, transactionType, exportType, reportScope
 * Requires: ADMIN role
 */
router.get('/reports/export',
  requireRole('admin'),
  (req, res) => adminController.exportReport(req, res)
);

/**
 * GET /api/admin/hardware/status
 * Get hardware status information
 * Requires: ADMIN role
 */
router.get('/hardware/status',
  requireRole('admin'),
  (req, res) => adminController.getHardwareStatus(req, res)
);

/**
 * GET /api/admin/config/pricing
 * Get current pricing configuration
 * Requires: ADMIN role
 */
router.get('/config/pricing',
  requireRole('admin'),
  (req, res) => adminController.getPricingConfig(req, res)
);

/**
 * PUT /api/admin/config/pricing
 * Update pricing configuration
 * Requires: ADMIN role
 * CRITICAL: Input validation prevents crashes
 */
router.put('/config/pricing',
  requireRole('admin'),
  validateRequest(pricingConfigSchema),
  (req, res) => adminController.updatePricingConfig(req, res)
);

/**
 * GET /api/admin/metrics/hourly
 * Get hourly metrics for charts and analytics
 * Requires: ADMIN role
 */
router.get('/metrics/hourly',
  requireRole('admin'),
  (req, res) => adminController.getHourlyMetrics(req, res)
);

/**
 * Legacy status endpoint for backward compatibility
 * Now redirects to dashboard
 */
router.get('/status', (req, res) => {
  res.redirect('/api/admin/dashboard');
});

export { router as adminRoutes };