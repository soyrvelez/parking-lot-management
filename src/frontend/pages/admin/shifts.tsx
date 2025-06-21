import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import ShiftOverview from '@/components/admin/shifts/ShiftOverview';
import ShiftSchedule from '@/components/admin/shifts/ShiftSchedule';
import OperatorPerformance from '@/components/admin/shifts/OperatorPerformance';
import ShiftAnalytics from '@/components/admin/shifts/ShiftAnalytics';
import { Clock, Users, TrendingUp, Calendar } from 'lucide-react';

type ShiftTab = 'overview' | 'schedule' | 'performance' | 'analytics';

export default function AdminShifts() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ShiftTab>('overview');

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/auth/verify', {
        credentials: 'include',
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    {
      id: 'overview' as ShiftTab,
      name: 'Vista General',
      icon: Clock,
      description: 'Estado actual de turnos',
    },
    {
      id: 'schedule' as ShiftTab,
      name: 'Programación',
      icon: Calendar,
      description: 'Gestión de horarios',
    },
    {
      id: 'performance' as ShiftTab,
      name: 'Rendimiento',
      icon: TrendingUp,
      description: 'Métricas de operadores',
    },
    {
      id: 'analytics' as ShiftTab,
      name: 'Análisis',
      icon: Users,
      description: 'Estadísticas avanzadas',
    },
  ];

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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            Gestión de Turnos
          </h1>
          <p className="text-gray-600 mt-2">
            Administración de horarios y rendimiento de operadores
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white p-1 rounded-lg shadow-sm border">
          <nav className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-left
                  ${activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <tab.icon className="w-5 h-5" />
                <div>
                  <div className="font-medium">{tab.name}</div>
                  <div className="text-xs text-gray-500">{tab.description}</div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'overview' && <ShiftOverview />}
          {activeTab === 'schedule' && <ShiftSchedule />}
          {activeTab === 'performance' && <OperatorPerformance />}
          {activeTab === 'analytics' && <ShiftAnalytics />}
        </div>
      </div>
    </AdminLayout>
  );
}