/**
 * Authentication Routes
 * Handles login and token verification
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { i18n } from '../../shared/localization';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

// Login validation schema
const loginSchema = z.object({
  username: z.string().min(1, 'Nombre de usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida')
});

// Simple in-memory user for development
const developmentUsers = [
  {
    id: 'admin-001',
    username: 'admin',
    password: '$2b$10$Xtt30aGVjhyCRw8MLF4lbuihdzrHz6BSAJ09zSBqfgJOw0.d7bh0K', // admin123
    name: 'Administrator',
    role: 'admin' as const
  }
];

// POST /api/auth/login
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user (in production, this would query the database)
    const user = developmentUsers.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: i18n.t('auth.invalid_credentials'),
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS', 
          message: i18n.t('auth.invalid_credentials'),
          timestamp: new Date().toISOString()
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        },
        expiresIn: '24h'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: i18n.t('system.internal_error'),
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET /api/auth/verify - Verify token validity
router.get('/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: i18n.t('auth.token_required'),
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    res.json({
      success: true,
      data: {
        user: {
          id: decoded.id,
          name: decoded.name,
          role: decoded.role
        },
        valid: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: i18n.t('auth.invalid_token'),
        timestamp: new Date().toISOString()
      }
    });
  }
});

export { router as authRoutes };