/**
 * CRITICAL: Admin Protected Route Component
 * Ensures only authenticated admins can access admin pages
 * Fixes authentication flow issues
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAdminAuth();

  useEffect(() => {
    // Only redirect if we're definitely not authenticated and not loading
    if (!isLoading && !isAuthenticated) {
      // Store the current path to redirect back after login
      const currentPath = router.asPath;
      if (currentPath !== '/admin/login') {
        sessionStorage.setItem('adminRedirectPath', currentPath);
      }
      router.push('/admin/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Only render content if authenticated
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}