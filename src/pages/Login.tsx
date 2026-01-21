/**
 * Página de Login
 * Suporta login com email, GitHub e Google
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Github, Chrome, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginWithEmail, loginWithGitHub, getGitHubAuthUrl, getGoogleAuthUrl } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession, isAuthenticated, isLoading } = useAuth();
  
  // Redireciona se já estiver autenticado
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, searchParams]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setIsSubmitting(true);
      await loginWithEmail(email, password);
      await refreshSession();
      toast.success('Login realizado com sucesso!');
      navigate(redirectTo);
    } catch (error: any) {
      setError(error.message || 'Erro ao fazer login');
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubLogin = () => {
    try {
      const url = getGitHubAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      setError(error.message || 'Erro ao iniciar autenticação GitHub');
      toast.error(error.message || 'Erro ao iniciar autenticação GitHub');
    }
  };

  const handleGoogleLogin = () => {
    try {
      const url = getGoogleAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      setError(error.message || 'Erro ao iniciar autenticação Google');
      toast.error(error.message || 'Erro ao iniciar autenticação Google');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Bem-vindo ao QA FLOW!</CardTitle>
          <CardDescription className="text-center">
            Faça login para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting || isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isSubmitting || isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/esqueci-senha')}
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou continue com
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGitHubLogin}
              disabled={isLoading}
              className="w-full"
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full"
            >
              <Chrome className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <button
              onClick={() => navigate('/cadastro' + (redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''))}
              className="text-primary hover:underline"
            >
              Cadastre-se
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
