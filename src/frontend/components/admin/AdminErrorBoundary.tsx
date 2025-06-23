/**
 * CRITICAL: Admin Panel Error Boundary
 * Prevents admin panel crashes from affecting entire application
 * Provides user-friendly Spanish error messages
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId()
    };
  }

  private generateErrorId(): string {
    return `ADMIN_ERROR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `ADMIN_ERROR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ADMIN PANEL CRASH DETECTED:', {
      errorId: this.state.errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Log to audit service for admin crash tracking
    this.logAdminCrash(error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  private async logAdminCrash(error: Error, errorInfo: ErrorInfo) {
    try {
      await fetch('/api/admin/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          entityType: 'AdminPanel',
          entityId: 'admin-error-boundary',
          action: 'ADMIN_CRASH',
          description: `Panel de administración falló: ${error.message}`,
          metadata: {
            errorId: this.state.errorId,
            errorMessage: error.message,
            componentStack: errorInfo.componentStack,
            userAgent: navigator.userAgent
          }
        })
      });
    } catch (auditError) {
      console.error('Failed to log admin crash to audit:', auditError);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/admin';
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId()
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Error en el Panel de Administración
              </h2>
              
              <p className="text-gray-600 mb-6">
                Ha ocurrido un error inesperado en el panel de administración. 
                Nuestro equipo técnico ha sido notificado automáticamente.
              </p>

              <div className="bg-gray-50 rounded-md p-3 mb-6">
                <p className="text-xs text-gray-500 font-mono">
                  ID del Error: {this.state.errorId}
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer">
                      Detalles Técnicos (Solo Desarrollo)
                    </summary>
                    <pre className="text-xs text-red-500 mt-2 overflow-auto">
                      {this.state.error?.message}
                    </pre>
                  </details>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Intentar Nuevamente
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recargar Página
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <Home className="h-4 w-4" />
                  Ir al Panel Principal
                </button>
              </div>

              <div className="mt-6 text-xs text-gray-500">
                <p>Si el problema persiste, contacte al soporte técnico.</p>
                <p>Proporcione el ID del error para una resolución más rápida.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useAdminErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Admin Panel Error in ${context}:`, error);
    
    // Log to audit service
    fetch('/api/admin/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        entityType: 'AdminPanel',
        entityId: context || 'unknown-component',
        action: 'ADMIN_ERROR',
        description: `Error en ${context}: ${error.message}`,
        metadata: {
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        }
      })
    }).catch(console.error);
  };

  return { handleError };
}

export default AdminErrorBoundary;