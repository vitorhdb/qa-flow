/**
 * Contexto de Autenticação
 * Gerencia estado de autenticação global
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, AuthSession } from '@/lib/auth';
import { getCurrentSession, logout as authLogout } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      setIsLoading(true);
      const currentSession = await getCurrentSession();
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setSession(null);
    setUser(null);
  };

  const refreshSession = async () => {
    await loadSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        logout: handleLogout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
