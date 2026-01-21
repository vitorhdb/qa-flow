/**
 * Página de Cadastro
 * Permite criar conta com email ou OAuth
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Github, Chrome, Lock, Eye, EyeOff, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { registerUser, getGitHubAuthUrl, getGoogleAuthUrl } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Register() {
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
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setIsSubmitting(true);
      await registerUser(email, password, name);
      await refreshSession();
      toast.success('Conta criada com sucesso!');
      navigate(redirectTo);
    } catch (error: any) {
      setError(error.message || 'Erro ao criar conta');
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubRegister = () => {
    try {
      const url = getGitHubAuthUrl();
      window.location.href = url;
    } catch (error: any) {
      setError(error.message || 'Erro ao iniciar autenticação GitHub');
      toast.error(error.message || 'Erro ao iniciar autenticação GitHub');
    }
  };

  const handleGoogleRegister = () => {
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
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Cadastre-se para começar a usar o QA FLOW!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting || isLoading}
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isSubmitting || isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou cadastre-se com
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGitHubRegister}
              disabled={isLoading}
              className="w-full"
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleRegister}
              disabled={isLoading}
              className="w-full"
            >
              <Chrome className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Já tem uma conta? </span>
            <button
              onClick={() => navigate('/' + (redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''))}
              className="text-primary hover:underline"
            >
              Faça login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
