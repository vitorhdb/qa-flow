/**
 * Componente de Rota Protegida
 * Redireciona para login se usuário não estiver autenticado
 */

import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({ children, requireAuth = true }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
