/**
 * Administration Routes
 * Handles dashboard metrics, reporting, system health, and user management
 * All endpoints require admin authentication and provide Spanish responses
 */

import { Router } from 'express';
import adminController from '../controllers/adminController';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

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
 * Legacy status endpoint for backward compatibility
 * Now redirects to dashboard
 */
router.get('/status', (req, res) => {
  res.redirect('/api/admin/dashboard');
});

export { router as adminRoutes };