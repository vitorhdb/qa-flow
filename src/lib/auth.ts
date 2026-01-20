/**
 * Sistema de Autenticação
 * Suporta múltiplos provedores (Google, GitHub, Email/Password)
 */

export type AuthProvider = 'google' | 'github' | 'email' | 'oauth';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
  organizationId?: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
}

class AuthManager {
  private currentUser: User | null = null;
  private session: AuthSession | null = null;

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    const sessionData = localStorage.getItem('auth_session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (new Date(session.expiresAt) > new Date()) {
          this.session = {
            ...session,
            expiresAt: new Date(session.expiresAt),
            user: {
              ...session.user,
              createdAt: new Date(session.user.createdAt),
            },
          };
          this.currentUser = this.session.user;
        } else {
          this.logout();
        }
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        this.logout();
      }
    }
  }

  private saveSession(session: AuthSession) {
    localStorage.setItem('auth_session', JSON.stringify(session));
    this.session = session;
    this.currentUser = session.user;
  }

  async signInWithGoogle(): Promise<User> {
    // Implementação OAuth Google
    // Por enquanto, simula autenticação
    const user: User = {
      id: `user-${Date.now()}`,
      email: 'user@example.com',
      name: 'Usuário Google',
      provider: 'google',
      role: 'user',
      createdAt: new Date(),
    };

    const session: AuthSession = {
      user,
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
    };

    this.saveSession(session);
    return user;
  }

  async signInWithGitHub(): Promise<User> {
    // Implementação OAuth GitHub
    const user: User = {
      id: `user-${Date.now()}`,
      email: 'user@example.com',
      name: 'Usuário GitHub',
      provider: 'github',
      role: 'user',
      createdAt: new Date(),
    };

    const session: AuthSession = {
      user,
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    this.saveSession(session);
    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    // Implementação com backend
    // Por enquanto, simula
    const user: User = {
      id: `user-${Date.now()}`,
      email,
      name: email.split('@')[0],
      provider: 'email',
      role: 'user',
      createdAt: new Date(),
    };

    const session: AuthSession = {
      user,
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    this.saveSession(session);
    return user;
  }

  async signUp(email: string, password: string, name: string): Promise<User> {
    // Implementação com backend
    const user: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      provider: 'email',
      role: 'user',
      createdAt: new Date(),
    };

    const session: AuthSession = {
      user,
      token: `token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    this.saveSession(session);
    return user;
  }

  logout() {
    localStorage.removeItem('auth_session');
    this.session = null;
    this.currentUser = null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.session !== null;
  }

  getToken(): string | null {
    return this.session?.token || null;
  }

  hasRole(role: User['role']): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    return this.currentUser.role === role;
  }
}

export const authManager = new AuthManager();
