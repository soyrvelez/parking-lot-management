import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import PartnerBusinessList from '@/components/admin/partners/PartnerBusinessList';
import PartnerBusinessForm from '@/components/admin/partners/PartnerBusinessForm';
import PartnerAnalytics from '@/components/admin/partners/PartnerAnalytics';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Building2, Plus, BarChart3, FileText } from 'lucide-react';

export default function PartnersPage() {
  const { isAuthenticated } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'analytics'>('list');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!isAuthenticated) {
    return null; // Will redirect in useAdminAuth
  }

  const handlePartnerSaved = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('list');
    setSelectedPartner(null);
  };

  const handleEditPartner = (partner: any) => {
    setSelectedPartner(partner);
    setActiveTab('create');
  };

  const handleNewPartner = () => {
    setSelectedPartner(null);
    setActiveTab('create');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Socios Comerciales
            </h1>
            <p className="text-gray-600">
              Gestión de negocios asociados y tarifas especiales
            </p>
          </div>
          
          <button
            onClick={handleNewPartner}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Socio
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Listado de Socios
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {selectedPartner ? 'Editar Socio' : 'Crear Socio'}
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analíticas
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-[600px]">
          {activeTab === 'list' && (
            <PartnerBusinessList
              onEditPartner={handleEditPartner}
              refreshTrigger={refreshTrigger}
            />
          )}
          
          {activeTab === 'create' && (
            <PartnerBusinessForm
              partner={selectedPartner}
              onSave={handlePartnerSaved}
              onCancel={() => {
                setActiveTab('list');
                setSelectedPartner(null);
              }}
            />
          )}
          
          {activeTab === 'analytics' && (
            <PartnerAnalytics />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}