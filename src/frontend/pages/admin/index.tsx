import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import DashboardStats from '@/components/admin/DashboardStats';
import LiveMetrics from '@/components/admin/LiveMetrics';
import ActiveTickets from '@/components/admin/ActiveTickets';
import RecentTransactions from '@/components/admin/RecentTransactions';
import HardwareStatus from '@/components/admin/HardwareStatus';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Principal</h1>
          <p className="text-gray-600 text-sm mt-1">
            Monitoreo en tiempo real del sistema de estacionamiento
          </p>
        </div>

        {/* Key Metrics */}
        <DashboardStats />

        {/* Main Content Grid */}
        <div className="space-y-4">
          {/* Top Row - Live Metrics and Hardware Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <LiveMetrics />
            </div>
            <div className="lg:col-span-1">
              <HardwareStatus />
            </div>
          </div>

          {/* Bottom Row - Active Tickets and Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <ActiveTickets />
            </div>
            <div>
              <RecentTransactions />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}