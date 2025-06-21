import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { i18n } from '../../shared/localization';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'operator' | 'admin';
    name: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: i18n.t('auth.token_required'),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        role: 'operator' | 'admin';
        name: string;
        iat: number;
        exp: number;
      };

      req.user = {
        id: decoded.id,
        role: decoded.role,
        name: decoded.name
      };

      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: i18n.t('auth.token_invalid'),
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: i18n.t('auth.authentication_failed'),
        timestamp: new Date().toISOString()
      }
    });
  }
}

export function requireRole(role: 'operator' | 'admin') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: i18n.t('auth.token_required'),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: i18n.t('auth.insufficient_permissions'),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

export function generateToken(user: { id: string; role: 'operator' | 'admin'; name: string }): string {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    {
      expiresIn: '8h' // Shift duration
    }
  );
}