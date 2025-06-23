import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logging';
import { authMiddleware } from './middleware/auth';
import { parkingRoutes } from './routes/parking';
import { adminRoutes } from './routes/admin';
import { hardwareRoutes } from './routes/hardware';
import cashRoutes from './routes/cashRoutes';
import { authRoutes } from './routes/auth';
import { operatorRoutes } from './routes/operator';
import { pensionRoutes } from './routes/pension';
import { i18n } from '../shared/localization';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - very lenient in development for testing
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Very high limit for development
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: i18n.t('systemErrors.rate_limit_exceeded') + ' (Desarrollo: límite muy alto para pruebas)',
      timestamp: new Date().toISOString()
    }
  },
  skip: (req) => {
    // Skip rate limiting entirely for development auth endpoints
    if (process.env.NODE_ENV !== 'production') {
      if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin')) {
        return true;
      }
    }
    return false;
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Development endpoint to clear rate limits
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/clear-rate-limits', (req, res) => {
    // Clear any existing rate limit stores
    res.json({
      success: true,
      message: 'Rate limits cleared for development',
      timestamp: new Date().toISOString()
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: i18n.t('system.health_check_ok'),
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      localization: 'active'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/operator', operatorRoutes); // No auth required - for locked-down operator workstations
app.use('/api/parking', parkingRoutes); // No auth required - operator functionality
app.use('/api/pension', pensionRoutes); // No auth required - pension customer management
app.use('/api/admin', authMiddleware, adminRoutes); // All admin routes require authentication
app.use('/api/hardware', hardwareRoutes); // No auth required - operator workstations need printer access
app.use('/api/cash', cashRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: i18n.t('systemErrors.endpoint_not_found', { 
        path: req.originalUrl 
      }),
      timestamp: new Date().toISOString()
    }
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;