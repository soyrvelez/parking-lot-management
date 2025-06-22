import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import ReportFilters from '@/components/admin/reports/ReportFilters';
import ReportCharts from '@/components/admin/reports/ReportCharts';
import TransactionHistory from '@/components/admin/reports/TransactionHistory';
import ReportExport from '@/components/admin/reports/ReportExport';
import ReportSummary from '@/components/admin/reports/ReportSummary';

interface ReportFilters {
  startDate: string;
  endDate: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  transactionType: 'all' | 'parking' | 'pension' | 'lost_ticket' | 'refund';
}

export default function AdminReports() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reportType: 'daily',
    transactionType: 'all',
  });

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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes Financieros</h1>
          <p className="text-gray-600 mt-2">
            Análisis detallado de ingresos y transacciones del estacionamiento
          </p>
        </div>

        {/* Filters */}
        <ReportFilters filters={filters} onFiltersChange={setFilters} />

        {/* Summary Cards */}
        <ReportSummary filters={filters} />

        {/* Charts and Analytics */}
        <ReportCharts filters={filters} />

        {/* Transaction History */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TransactionHistory filters={filters} />
          </div>
          
          <div>
            <ReportExport filters={filters} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}