import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/admin/AdminLayout';
import PricingSettings from '@/components/admin/settings/PricingSettings';
import OperatorSettings from '@/components/admin/settings/OperatorSettings';
import SystemSettings from '@/components/admin/settings/SystemSettings';
import { Settings, DollarSign, Users, Cog } from 'lucide-react';

type SettingsTab = 'pricing' | 'operators' | 'system';

export default function AdminSettings() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('pricing');

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
      id: 'pricing' as SettingsTab,
      name: 'Configuración de Precios',
      icon: DollarSign,
      description: 'Tarifas y reglas de cobro',
    },
    {
      id: 'operators' as SettingsTab,
      name: 'Gestión de Operadores',
      icon: Users,
      description: 'Cuentas y permisos de usuario',
    },
    {
      id: 'system' as SettingsTab,
      name: 'Configuración del Sistema',
      icon: Cog,
      description: 'Ajustes generales y hardware',
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
          <h1 className="text-3xl font-bold text-gray-900">Configuración del Sistema</h1>
          <p className="text-gray-600 mt-2">
            Administrar precios, operadores y configuraciones generales
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
          {activeTab === 'pricing' && <PricingSettings />}
          {activeTab === 'operators' && <OperatorSettings />}
          {activeTab === 'system' && <SystemSettings />}
        </div>
      </div>
    </AdminLayout>
  );
}