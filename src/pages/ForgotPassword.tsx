/**
 * Página de Recuperação de Senha
 * Permite solicitar redefinição de senha por email
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requestPasswordReset } from '@/lib/auth';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Por favor, informe seu email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestPasswordReset(email);
      setSuccess(true);
      toast.success('Email de recuperação enviado!');
    } catch (error: any) {
      setError(error.message || 'Erro ao solicitar recuperação de senha');
      toast.error(error.message || 'Erro ao solicitar recuperação de senha');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Esqueci minha senha</CardTitle>
          <CardDescription className="text-center">
            Digite seu email para receber instruções de recuperação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Email enviado com sucesso!</p>
                <p className="text-sm">
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
              </Button>
            </form>
          )}

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
