import { Router } from 'express';
import { i18n } from '../../shared/localization';

const router = Router();

// Placeholder hardware routes
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: i18n.t('hardware.status_check'),
    timestamp: new Date().toISOString()
  });
});

export { router as hardwareRoutes };