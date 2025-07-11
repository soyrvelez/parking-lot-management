import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth, DEFAULT_ADMIN_CREDENTIALS } from '../../hooks/useAdminAuth';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated, isLoading: authLoading } = useAdminAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: DEFAULT_ADMIN_CREDENTIALS.username,
      password: DEFAULT_ADMIN_CREDENTIALS.password
    }
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, router]);

  const onSubmit = async (data: LoginForm) => {
    setError('');

    const result = await login(data.username, data.password);
    
    if (result.success) {
      router.push('/admin');
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Panel de Administración
          </h2>
          <p className="text-gray-600">
            Sistema de Gestión de Estacionamiento
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <input
                {...register('username')}
                type="text"
                id="username"
                className="input-field"
                placeholder="admin"
                autoComplete="username"
                autoFocus
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Iniciando Sesión...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">
              Acceso restringido a administradores autorizados
            </p>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                <p><strong>Desarrollo:</strong></p>
                <p>Usuario: admin | Contraseña: admin123</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            ← Volver a Interfaz del Operador
          </button>
        </div>
      </div>
    </div>
  );
}