/**
 * Operator Routes - No Authentication Required
 * 
 * For locked-down ThinkPad workstations running only this application.
 * Operators don't need login - the workstation itself is the security boundary.
 */

import { Router } from 'express';
import adminController from '../controllers/adminController';

const router = Router();

/**
 * GET /api/operator/dashboard/stats
 * Basic dashboard stats for operator interface (no auth required)
 */
router.get('/dashboard/stats', (req, res) => adminController.getDashboardMetrics(req, res));

/**
 * GET /api/operator/status
 * System status for operator monitoring (no auth required)
 */
router.get('/status', (req, res) => adminController.getSystemHealth(req, res));

export { router as operatorRoutes };