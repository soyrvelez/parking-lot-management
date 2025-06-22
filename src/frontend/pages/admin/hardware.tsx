import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import HardwareControlPanel from '@/components/admin/hardware/HardwareControlPanel';
import PrinterControls from '@/components/admin/hardware/PrinterControls';
import ScannerControls from '@/components/admin/hardware/ScannerControls';
import SystemDiagnostics from '@/components/admin/hardware/SystemDiagnostics';
import { Monitor, Printer, Scan, Settings } from 'lucide-react';

type HardwareTab = 'overview' | 'printer' | 'scanner' | 'diagnostics';

export default function AdminHardware() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<HardwareTab>('overview');

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

  const tabs = [
    {
      id: 'overview' as HardwareTab,
      name: 'Panel de Control',
      icon: Monitor,
      description: 'Estado general del hardware',
    },
    {
      id: 'printer' as HardwareTab,
      name: 'Impresora Térmica',
      icon: Printer,
      description: 'Control de impresión',
    },
    {
      id: 'scanner' as HardwareTab,
      name: 'Escáner de Códigos',
      icon: Scan,
      description: 'Configuración del escáner',
    },
    {
      id: 'diagnostics' as HardwareTab,
      name: 'Diagnósticos',
      icon: Settings,
      description: 'Análisis del sistema',
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
            <Monitor className="w-8 h-8 text-blue-600" />
            Control de Hardware
          </h1>
          <p className="text-gray-600 mt-2">
            Monitoreo y control avanzado de impresora, escáner y sistemas
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
          {activeTab === 'overview' && <HardwareControlPanel />}
          {activeTab === 'printer' && <PrinterControls />}
          {activeTab === 'scanner' && <ScannerControls />}
          {activeTab === 'diagnostics' && <SystemDiagnostics />}
        </div>
      </div>
    </AdminLayout>
  );
}