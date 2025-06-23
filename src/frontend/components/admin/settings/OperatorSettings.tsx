import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, CheckCircle, XCircle } from 'lucide-react';

interface Operator {
  id: string;
  username: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export default function OperatorSettings() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const response = await fetch('/api/admin/operators', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOperators(data);
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Operadores</h3>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Operador
        </button>
      </div>

      {/* Operators List */}
      <div className="space-y-3">
        {operators.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-500">No hay operadores configurados</p>
          </div>
        ) : (
          operators.map((operator) => (
            <div key={operator.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{operator.username}</div>
                    <div className="text-sm text-gray-500">
                      Creado: {new Date(operator.createdAt).toLocaleDateString('es-MX')}
                      {operator.lastLogin && (
                        <span> • Último acceso: {new Date(operator.lastLogin).toLocaleDateString('es-MX')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    operator.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {operator.isActive ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inactivo
                      </>
                    )}
                  </div>

                  <button className="btn-secondary p-2">
                    <Key className="w-4 h-4" />
                  </button>

                  <button className="btn-secondary p-2">
                    <Edit className="w-4 h-4" />
                  </button>

                  <button className="btn-danger p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Note */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <div className="text-sm text-yellow-800">
          <strong>Nota:</strong> La gestión completa de operadores estará disponible en la próxima versión.
          Actualmente los operadores pueden acceder con credenciales predeterminadas del sistema.
        </div>
      </div>
    </div>
  );
}