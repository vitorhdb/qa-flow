/**
 * Página de Configurações
 * Configuração da OpenAI e outras opções do sistema
 */

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Save, TestTube, Sparkles, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getOpenAIConfig, saveOpenAIConfig, analyzeCodeWithAI, type OpenAIConfig } from '@/lib/openai-service';
import { changePassword } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4-turbo-preview');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  
  // Estados para alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const config = getOpenAIConfig();
    if (config) {
      setApiKey(config.apiKey || '');
      setModel(config.model || 'gpt-4-turbo-preview');
      setTemperature(config.temperature || 0.3);
      setMaxTokens(config.maxTokens || 4000);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('API Key é obrigatória');
      return;
    }

    const config: OpenAIConfig = {
      apiKey: apiKey.trim(),
      model,
      temperature,
      maxTokens,
    };

    saveOpenAIConfig(config);
    toast.success('Configurações salvas com sucesso!');
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error('Configure a API Key primeiro');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      // Salva temporariamente para teste
      const tempConfig: OpenAIConfig = {
        apiKey: apiKey.trim(),
        model,
        temperature,
        maxTokens,
      };
      saveOpenAIConfig(tempConfig);

      // Testa com código simples
      const testCode = `function example() {
  const password = "123456";
  return password;
}`;

      const result = await analyzeCodeWithAI({
        code: testCode,
        language: 'javascript',
        filename: 'test.js',
      });

      setTestResult('success');
      setTestMessage(`Conexão bem-sucedida! Modelo: ${model}. Encontrados ${result.improvements.length} melhorias.`);
      toast.success('Teste de conexão bem-sucedido!');
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Erro ao testar conexão');
      toast.error(`Erro no teste: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (!user || user.provider !== 'email') {
      setPasswordError('Alteração de senha disponível apenas para contas com email');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword(user.id, currentPassword, newPassword);
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      setPasswordError(error.message || 'Erro ao alterar senha');
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const hasEnvKey = !!import.meta.env.VITE_OPENAI_API_KEY;
  const currentConfig = getOpenAIConfig();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Configurações
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure a integração com OpenAI e outras opções do sistema
          </p>
        </div>

        <div className="space-y-6">
          {/* Configuração OpenAI */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Integração OpenAI
                  </CardTitle>
                  <CardDescription>
                    Configure sua API Key da OpenAI para habilitar análises avançadas por IA
                  </CardDescription>
                </div>
                {currentConfig && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Configurado
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasEnvKey && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>API Key do Ambiente</AlertTitle>
                  <AlertDescription>
                    Uma API Key está configurada via variável de ambiente. As configurações abaixo terão prioridade.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key da OpenAI
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Sua API Key é armazenada localmente no navegador. Obtenha uma em{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature: {temperature}
                  </Label>
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Valores menores = mais focado e determinístico
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="500"
                    max="16000"
                    step="500"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
                <Button
                  onClick={handleTest}
                  disabled={isTesting || !apiKey.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? 'Testando...' : 'Testar Conexão'}
                </Button>
              </div>

              {testResult && (
                <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
                  {testResult === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {testResult === 'success' ? 'Teste Bem-sucedido' : 'Erro no Teste'}
                  </AlertTitle>
                  <AlertDescription>{testMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Informações sobre uso */}
          <Card>
            <CardHeader>
              <CardTitle>Como Funciona</CardTitle>
              <CardDescription>
                Entenda como a IA é integrada no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Análises Automáticas</h4>
                <p className="text-sm text-muted-foreground">
                  A IA está integrada em todas as análises do sistema. Quando você analisa código,
                  a IA fornece melhorias consolidadas com base na análise crítica do QA.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Linguagens Suportadas</h4>
                <div className="flex flex-wrap gap-2">
                  {['JavaScript', 'TypeScript', 'Java', 'SQL', 'Delphi/VCL', 'FireMonkey', 'Ruby', 'Rails', 'JSON', 'API'].map((lang) => (
                    <Badge key={lang} variant="secondary">{lang}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Tipos de Melhorias</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Segurança: vulnerabilidades, riscos, práticas inseguras</li>
                  <li>Qualidade: code smells, complexidade, manutenibilidade</li>
                  <li>Performance: otimizações, gargalos</li>
                  <li>Boas práticas: padrões da linguagem, convenções</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Alterar Senha */}
          {user && user.provider === 'email' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Altere sua senha de acesso ao sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isChangingPassword}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isChangingPassword}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmNewPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isChangingPassword}
                        required
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

                  <Button type="submit" disabled={isChangingPassword} className="w-full">
                    <Lock className="h-4 w-4 mr-2" />
                    {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
