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

// All admin routes require authentication
router.use(authMiddleware);

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
 * Real-time dashboard metrics with hardware status
 * Requires: ADMIN role
 */
router.get('/dashboard',
  requireRole('admin'),
  adminController.getDashboardMetrics
);

/**
 * GET /api/admin/reports/daily
 * Daily revenue and operations report
 * Query params: date, startDate, endDate, format (csv)
 * Requires: ADMIN or MANAGER role
 */
router.get('/reports/daily',
  requireRole('admin'), // admin can access reports
  adminController.getDailyReport
);

/**
 * GET /api/admin/reports/monthly
 * Monthly trend analysis with growth comparisons
 * Query params: month, year
 * Requires: ADMIN or MANAGER role
 */
router.get('/reports/monthly',
  requireRole('admin'),
  adminController.getMonthlyReport
);

/**
 * GET /api/admin/audit
 * Comprehensive audit log with Spanish filtering
 * Query params: page, limit, entityType, startDate, endDate, search, action
 * Requires: ADMIN role
 */
router.get('/audit',
  requireRole('admin'),
  adminController.getAuditLog
);

/**
 * GET /api/admin/health
 * System health monitoring including hardware status
 * Requires: ADMIN role
 */
router.get('/health',
  requireRole('admin'),
  adminController.getSystemHealth
);

/**
 * POST /api/admin/operators
 * Create new operator account
 * Requires: ADMIN role
 */
router.post('/operators',
  requireRole('admin'),
  validateRequest(createOperatorSchema),
  adminController.createOperator
);

/**
 * GET /api/admin/operators
 * List all operators with pagination
 * Query params: page, limit, role, isActive
 * Requires: ADMIN role
 */
router.get('/operators',
  requireRole('admin'),
  adminController.getOperators
);

/**
 * PUT /api/admin/operators/:id
 * Update operator information
 * Requires: ADMIN role
 */
router.put('/operators/:id',
  requireRole('admin'),
  validateRequest(updateOperatorSchema),
  adminController.updateOperator
);

/**
 * Legacy status endpoint for backward compatibility
 * Now redirects to dashboard
 */
router.get('/status', (req, res) => {
  res.redirect('/api/admin/dashboard');
});

export { router as adminRoutes };