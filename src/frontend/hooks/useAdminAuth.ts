/**
 * CRITICAL: Admin Authentication Hook
 * Manages JWT token storage, retrieval, and API request authentication
 * Fixes "Token de autenticación requerido" error
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface User {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

export function useAdminAuth() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true
  });

  // Check for stored token on mount - with better persistence logic
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // Check if token is expired before making API call
      if (!isTokenExpired(token)) {
        // Set as authenticated immediately, verify in background
        setAuthState({
          isAuthenticated: true,
          user: getUserFromToken(token),
          token,
          isLoading: false
        });
        // Verify token in background without blocking UI
        verifyTokenBackground(token);
      } else {
        // Token expired, remove and set as unauthenticated
        localStorage.removeItem('adminToken');
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Verify token validity
  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.user) {
          setAuthState({
            isAuthenticated: true,
            user: result.data.user,
            token,
            isLoading: false
          });
        } else {
          handleAuthFailure();
        }
      } else {
        handleAuthFailure();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      handleAuthFailure();
    }
  };

  const handleAuthFailure = () => {
    localStorage.removeItem('adminToken');
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false
    });
  };

  // Check if JWT token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      return payload.exp < now;
    } catch (error) {
      return true; // If we can't decode, assume expired
    }
  };

  // Get user info from JWT token
  const getUserFromToken = (token: string): User | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.userId || payload.id || 'admin',
        name: payload.name || 'Administrador',
        role: payload.role || 'admin'
      };
    } catch (error) {
      return null;
    }
  };

  // Background token verification (doesn't affect UI state immediately)
  const verifyTokenBackground = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Token is invalid, handle silently
        handleAuthFailure();
      }
    } catch (error) {
      // Network error, keep current state but log
      console.warn('Background token verification failed:', error);
    }
  };

  // Login function
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const token = result.data.token;
        localStorage.setItem('adminToken', token);
        
        setAuthState({
          isAuthenticated: true,
          user: result.data.user,
          token,
          isLoading: false
        });

        // Redirect to intended page if available
        const redirectPath = sessionStorage.getItem('adminRedirectPath');
        if (redirectPath) {
          sessionStorage.removeItem('adminRedirectPath');
          router.push(redirectPath);
        } else {
          router.push('/admin');
        }

        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Credenciales inválidas' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Error de conexión. Verifique la red.' 
      };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('adminToken');
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false
    });
    router.push('/admin/login');
  };

  // Get authenticated headers for API calls
  const getAuthHeaders = (): HeadersInit => {
    const token = authState.token || localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  // Authenticated fetch wrapper
  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = authState.token || localStorage.getItem('adminToken');
    
    if (!token) {
      throw new Error('No hay token de autenticación disponible');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    // Handle auth failures
    if (response.status === 401) {
      handleAuthFailure();
      router.push('/admin/login');
      throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
    }

    return response;
  };

  // Redirect to login if not authenticated
  const requireAuth = () => {
    if (!authState.isLoading && !authState.isAuthenticated) {
      router.push('/admin/login');
      return false;
    }
    return true;
  };

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
    authenticatedFetch,
    requireAuth,
    verifyToken
  };
}

// Default admin credentials for development
export const DEFAULT_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};