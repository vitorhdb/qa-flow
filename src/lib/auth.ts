/**
 * Sistema de Autenticação
 * Suporta login tradicional, GitHub OAuth e Google OAuth
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'email' | 'github' | 'google';
  createdAt: Date;
  lastLoginAt?: Date;
  // Informações de perfil
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  bio?: string;
  company?: string;
  website?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
}

/**
 * Registra um novo usuário
 */
export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<AuthSession> {
  // Validação básica
  if (!email || !password || !name) {
    throw new Error('Todos os campos são obrigatórios');
  }

  if (password.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email inválido');
  }

  // Verifica se usuário já existe
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email já cadastrado');
  }

  // Cria hash da senha (simulado - em produção usar bcrypt)
  const passwordHash = await hashPassword(password);

  // Cria usuário
  const user: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email,
    name,
    provider: 'email',
    createdAt: new Date(),
  };

  // Salva usuário
  await saveUser(user, passwordHash);

  // Cria sessão
  const session = await createSession(user);

  return session;
}

/**
 * Autentica usuário com email e senha
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthSession> {
  if (!email || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Email ou senha incorretos');
  }

  // Verifica senha
  const isValid = await verifyPassword(password, user.id);
  if (!isValid) {
    throw new Error('Email ou senha incorretos');
  }

  // Atualiza último login
  user.lastLoginAt = new Date();
  await updateUser(user);

  // Cria sessão
  const session = await createSession(user);

  return session;
}

/**
 * Autentica com GitHub OAuth
 */
export async function loginWithGitHub(code: string): Promise<AuthSession> {
  try {
    // Troca código por token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: import.meta.env.VITE_GITHUB_CLIENT_ID,
        client_secret: import.meta.env.VITE_GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Erro ao autenticar com GitHub');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Token de acesso não recebido');
    }

    // Busca dados do usuário
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new Error('Erro ao buscar dados do usuário');
    }

    const githubUser = await userResponse.json();

    // Busca ou cria usuário
    let user = await getUserByProvider('github', githubUser.id.toString());
    
    if (!user) {
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email: githubUser.email || `${githubUser.login}@github.com`,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
        provider: 'github',
        createdAt: new Date(),
      };
      await saveUser(user, undefined, githubUser.id.toString());
    } else {
      // Atualiza dados
      user.name = githubUser.name || githubUser.login;
      user.avatar = githubUser.avatar_url;
      user.lastLoginAt = new Date();
      await updateUser(user);
    }

    // Cria sessão
    const session = await createSession(user);

    return session;
  } catch (error: any) {
    console.error('Erro ao autenticar com GitHub:', error);
    throw new Error(`Erro ao autenticar com GitHub: ${error.message}`);
  }
}

/**
 * Autentica com Google OAuth
 */
export async function loginWithGoogle(code: string): Promise<AuthSession> {
  try {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
    const redirectUri = `${window.location.origin}/auth/google/callback`;

    // Troca código por token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Erro ao obter token do Google');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Token de acesso não recebido');
    }

    // Busca dados do usuário
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Erro ao buscar dados do usuário');
    }

    const googleUser = await userResponse.json();

    // Busca ou cria usuário
    let user = await getUserByProvider('google', googleUser.id);
    
    if (!user) {
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        provider: 'google',
        createdAt: new Date(),
      };
      await saveUser(user, undefined, googleUser.id);
    } else {
      // Atualiza dados
      user.name = googleUser.name;
      user.avatar = googleUser.picture;
      user.lastLoginAt = new Date();
      await updateUser(user);
    }

    // Cria sessão
    const session = await createSession(user);

    return session;
  } catch (error: any) {
    console.error('Erro ao autenticar com Google:', error);
    throw new Error(`Erro ao autenticar com Google: ${error.message}`);
  }
}

/**
 * Gera URL de autenticação GitHub
 */
export function getGitHubAuthUrl(): string {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GitHub Client ID não configurado');
  }

  const redirectUri = `${window.location.origin}/auth/github/callback`;
  const state = generateState();
  localStorage.setItem('github_oauth_state', state);

  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
}

/**
 * Gera URL de autenticação Google
 */
export function getGoogleAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google Client ID não configurado');
  }

  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const state = generateState();
  localStorage.setItem('google_oauth_state', state);

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}`;
}

/**
 * Obtém sessão atual
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const sessionData = localStorage.getItem('auth_session');
  if (!sessionData) {
    return null;
  }

  try {
    const stored = JSON.parse(sessionData);
    
    // Converte strings de data de volta para Date
    const expiresAt = new Date(stored.expiresAt);
    
    // Verifica se expirou
    if (expiresAt < new Date()) {
      localStorage.removeItem('auth_session');
      return null;
    }

    // Verifica se usuário ainda existe
    const user = await getUserById(stored.user.id);
    if (!user) {
      localStorage.removeItem('auth_session');
      return null;
    }

    // Reconstrói sessão com datas corretas
    const session: AuthSession = {
      user: {
        ...user,
        createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
        lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt : user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
      },
      token: stored.token,
      expiresAt,
    };

    return session;
  } catch (error) {
    console.error('Erro ao carregar sessão:', error);
    localStorage.removeItem('auth_session');
    return null;
  }
}

/**
 * Faz logout
 */
export async function logout(): Promise<void> {
  localStorage.removeItem('auth_session');
  localStorage.removeItem('github_oauth_state');
  localStorage.removeItem('google_oauth_state');
}

/**
 * Solicita recuperação de senha
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) {
    throw new Error('Email é obrigatório');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email inválido');
  }

  // Verifica se usuário existe
  const user = await getUserByEmail(email);
  if (!user) {
    // Por segurança, não revelamos se o email existe ou não
    // Mas em produção, você pode querer logar isso
    return;
  }

  // Gera token de reset (em produção, usar crypto seguro)
  const resetToken = `reset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // Token válido por 1 hora

  // Salva token de reset
  localStorage.setItem(`reset_token_${resetToken}`, JSON.stringify({
    email: user.email,
    userId: user.id,
    expiresAt: expiresAt.toISOString(),
  }));

  // Em produção, enviar email com link
  // Por enquanto, apenas logamos (em desenvolvimento)
  console.log(`Token de reset para ${email}: ${resetToken}`);
  console.log(`Link: ${window.location.origin}/redefinir-senha?token=${resetToken}`);
  
  // Em produção, você faria algo como:
  // await sendEmail({
  //   to: email,
  //   subject: 'Recuperação de senha - QA FLOW!',
  //   html: `Clique no link para redefinir sua senha: ${window.location.origin}/redefinir-senha?token=${resetToken}`
  // });
}

/**
 * Redefine senha com token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new Error('Token e senha são obrigatórios');
  }

  if (newPassword.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres');
  }

  // Busca token
  const tokenData = localStorage.getItem(`reset_token_${token}`);
  if (!tokenData) {
    throw new Error('Token inválido ou expirado');
  }

  const data = JSON.parse(tokenData);
  const expiresAt = new Date(data.expiresAt);

  // Verifica se expirou
  if (expiresAt < new Date()) {
    localStorage.removeItem(`reset_token_${token}`);
    throw new Error('Token expirado. Solicite uma nova recuperação de senha.');
  }

  // Busca usuário
  const user = await getUserById(data.userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Atualiza senha
  const passwordHash = await hashPassword(newPassword);
  const userData = localStorage.getItem(`user_${user.id}`);
  if (userData) {
    const userDataParsed = JSON.parse(userData);
    userDataParsed.passwordHash = passwordHash;
    localStorage.setItem(`user_${user.id}`, JSON.stringify(userDataParsed));
  }

  // Remove token usado
  localStorage.removeItem(`reset_token_${token}`);
}

/**
 * Altera senha do usuário autenticado
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!currentPassword || !newPassword) {
    throw new Error('Senha atual e nova senha são obrigatórias');
  }

  if (newPassword.length < 6) {
    throw new Error('A nova senha deve ter pelo menos 6 caracteres');
  }

  // Verifica senha atual
  const isValid = await verifyPassword(currentPassword, userId);
  if (!isValid) {
    throw new Error('Senha atual incorreta');
  }

  // Atualiza senha
  const passwordHash = await hashPassword(newPassword);
  const userData = localStorage.getItem(`user_${userId}`);
  if (userData) {
    const userDataParsed = JSON.parse(userData);
    userDataParsed.passwordHash = passwordHash;
    localStorage.setItem(`user_${userId}`, JSON.stringify(userDataParsed));
  }
}

// ========== Funções auxiliares (persistência) ==========

async function hashPassword(password: string): Promise<string> {
  // Em produção, usar bcrypt ou similar
  // Por enquanto, simula hash
  return btoa(password + 'salt');
}

async function verifyPassword(password: string, userId: string): Promise<boolean> {
  const userData = localStorage.getItem(`user_${userId}`);
  if (!userData) return false;

  const data = JSON.parse(userData);
  const hash = await hashPassword(password);
  return hash === data.passwordHash;
}

async function saveUser(user: User, passwordHash?: string, providerId?: string): Promise<void> {
  // Serializa datas como strings para localStorage
  const userToStore = {
    ...user,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : user.lastLoginAt,
    passwordHash,
    providerId: providerId || (user.provider !== 'email' ? user.id : undefined),
  };

  // Salva usuário
  localStorage.setItem(`user_${user.id}`, JSON.stringify(userToStore));

  // Indexa por email
  const emailIndex = JSON.parse(localStorage.getItem('users_email_index') || '{}');
  emailIndex[user.email] = user.id;
  localStorage.setItem('users_email_index', JSON.stringify(emailIndex));

  // Indexa por provider
  if (user.provider !== 'email' && providerId) {
    const providerIndex = JSON.parse(localStorage.getItem('users_provider_index') || '{}');
    const key = `${user.provider}_${providerId}`;
    providerIndex[key] = user.id;
    localStorage.setItem('users_provider_index', JSON.stringify(providerIndex));
  }
}

async function getUserByEmail(email: string): Promise<User | null> {
  const emailIndex = JSON.parse(localStorage.getItem('users_email_index') || '{}');
  const userId = emailIndex[email];
  if (!userId) return null;

  return getUserById(userId);
}

async function getUserByProvider(provider: 'github' | 'google', providerId: string): Promise<User | null> {
  const providerIndex = JSON.parse(localStorage.getItem('users_provider_index') || '{}');
  const key = `${provider}_${providerId}`;
  const userId = providerIndex[key];
  if (!userId) return null;

  return getUserById(userId);
}

export async function getUserById(id: string): Promise<User | null> {
  const userData = localStorage.getItem(`user_${id}`);
  if (!userData) return null;

  try {
    const data = JSON.parse(userData);
    const { passwordHash, providerId, ...user } = data;
    
    // Converte strings de data de volta para Date
    return {
      ...user,
      createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
      lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt : user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
    } as User;
  } catch (error) {
    console.error('Erro ao parsear usuário:', error);
    return null;
  }
}

export async function updateUser(user: User): Promise<void> {
  const userData = localStorage.getItem(`user_${user.id}`);
  if (userData) {
    try {
      const data = JSON.parse(userData);
      
      // Serializa datas como strings
      const userToStore = {
        ...data,
        ...user,
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
        lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt.toISOString() : user.lastLoginAt,
      };
      
      localStorage.setItem(`user_${user.id}`, JSON.stringify(userToStore));
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw new Error('Erro ao atualizar usuário');
    }
  }

  // Atualiza índice de email se mudou
  if (user.email) {
    const emailIndex = JSON.parse(localStorage.getItem('users_email_index') || '{}');
    emailIndex[user.email] = user.id;
    localStorage.setItem('users_email_index', JSON.stringify(emailIndex));
  }
}

async function createSession(user: User): Promise<AuthSession> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

  const session: AuthSession = {
    user,
    token,
    expiresAt,
  };

  localStorage.setItem('auth_session', JSON.stringify(session));

  return session;
}

function generateToken(): string {
  return `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateState(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
