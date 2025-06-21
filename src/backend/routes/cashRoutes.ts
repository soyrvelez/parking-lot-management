/**
 * Cash Register Management Routes
 * Handles cash drawer operations, balance validation, and audit logging
 */

import { Router } from 'express';
import cashController from '../controllers/cashController';
import { authMiddleware, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// All cash operations require authentication
router.use(authMiddleware);

// Validation schemas
const openRegisterSchema = z.object({
  openingBalance: z.string().min(1, 'Monto inicial requerido'),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const closeRegisterSchema = z.object({
  closingBalance: z.string().min(1, 'Monto final requerido'),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const adjustmentSchema = z.object({
  amount: z.string().min(1, 'Monto requerido'),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL'], {
    errorMap: () => ({ message: 'Tipo debe ser DEPOSIT o WITHDRAWAL' })
  }),
  description: z.string().min(1, 'Descripción requerida'),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

const countSchema = z.object({
  denominations: z.record(z.string(), z.number().min(0, 'Cantidad debe ser positiva')),
  operatorId: z.string().min(1, 'ID del operador requerido')
});

/**
 * POST /api/cash/open
 * Open cash register for shift
 * Requires: operator role
 */
router.post('/open', 
  requireRole('operator'),
  validateRequest(openRegisterSchema),
  cashController.openRegister
);

/**
 * POST /api/cash/close
 * Close cash register for shift
 * Requires: operator role
 */
router.post('/close',
  requireRole('operator'), 
  validateRequest(closeRegisterSchema),
  cashController.closeRegister
);

/**
 * POST /api/cash/adjustment
 * Make cash deposit or withdrawal
 * Requires: admin role
 */
router.post('/adjustment',
  requireRole('admin'),
  validateRequest(adjustmentSchema),
  cashController.makeAdjustment
);

/**
 * GET /api/cash/status
 * Get current register status
 * Query params: operatorId (required)
 * Requires: operator role
 */
router.get('/status',
  requireRole('operator'),
  cashController.getStatus
);

/**
 * POST /api/cash/count
 * Count cash denominations
 * Requires: operator role
 */
router.post('/count',
  requireRole('operator'),
  validateRequest(countSchema),
  cashController.countCash
);

/**
 * GET /api/cash/history
 * Get cash register history
 * Query params: operatorId, startDate, endDate, limit
 * Requires: admin role for all records, operator role for own records only
 */
router.get('/history', (req, res, next) => {
  // Allow operators to view their own records, admins to view all
  const userRole = (req as any).user?.role;
  const requestedOperatorId = req.query.operatorId;
  const userOperatorId = (req as any).user?.id;

  if (userRole === 'admin') {
    // Admins can view all records
    next();
  } else if (userRole === 'operator' && requestedOperatorId === userOperatorId) {
    // Operators can only view their own records
    next();
  } else {
    res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Solo puede ver su propio historial de caja',
        timestamp: new Date().toISOString()
      }
    });
  }
}, cashController.getHistory);

export default router;