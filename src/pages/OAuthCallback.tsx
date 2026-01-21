/**
 * Página de Callback OAuth
 * Processa retorno de autenticação GitHub e Google
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginWithGitHub, loginWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshSession } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const provider = window.location.pathname.includes('/github') ? 'github' : 'google';
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Verifica erro
      if (error) {
        setStatus('error');
        setMessage('Autenticação cancelada ou falhou');
        toast.error('Autenticação cancelada');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Verifica código
      if (!code) {
        setStatus('error');
        setMessage('Código de autenticação não recebido');
        toast.error('Erro na autenticação');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Verifica state (CSRF protection)
      const savedState = localStorage.getItem(`${provider}_oauth_state`);
      if (state !== savedState) {
        setStatus('error');
        setMessage('Estado de autenticação inválido');
        toast.error('Erro de segurança na autenticação');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // Processa autenticação
      if (provider === 'github') {
        await loginWithGitHub(code);
      } else if (provider === 'google') {
        // Para Google, o código precisa ser trocado por token primeiro
        // Por enquanto, vamos usar a abordagem simplificada
        await loginWithGoogle(code);
      }

      await refreshSession();
      setStatus('success');
      setMessage('Autenticação realizada com sucesso!');
      toast.success('Login realizado com sucesso!');
      
      // Limpa state
      localStorage.removeItem(`${provider}_oauth_state`);
      
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error: any) {
      console.error('Erro no callback OAuth:', error);
      setStatus('error');
      setMessage(error.message || 'Erro ao processar autenticação');
      toast.error(error.message || 'Erro ao processar autenticação');
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground">Processando autenticação...</p>
            </div>
          )}

          {status === 'success' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
