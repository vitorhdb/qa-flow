import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, GitBranch, GitCommit, FileCode, Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Database, Activity, LogOut, Download, FileDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { createGitProvider, syncRepositories, type GitRepository as GitRepoAPI } from '@/lib/git-integration';
import { analyzeCode } from '@/lib/analyzer';
import { db, type GitAccount, type GitRepository, type GitSyncJob } from '@/lib/database';
import { convertToAnalysisHistory, evaluateQualityGateWithMemory } from '@/lib/quality-gate-memory';
import { calculateFindingFingerprint } from '@/lib/history-comparison';
import { exportAnalyses } from '@/lib/export-history';
import type { Analysis, Finding } from '@/types/history';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function GitIntegration() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<'github' | 'gitea'>('github');
  const [giteaUrl, setGiteaUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<GitAccount | null>(null);
  const [savedRepositories, setSavedRepositories] = useState<GitRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null);
  const [branches, setBranches] = useState<{ name: string; commit: { sha: string; message: string; author: string; date: Date } }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [syncJobs, setSyncJobs] = useState<GitSyncJob[]>([]);
  const [historyAnalyses, setHistoryAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, repo: '' });
  const [useTokenAuth, setUseTokenAuth] = useState(false);
  const [personalToken, setPersonalToken] = useState('');

  useEffect(() => {
    checkAuthentication();
    loadSavedRepositories();
    loadSyncJobs();
  }, []);

  const checkAuthentication = async () => {
    const githubToken = localStorage.getItem('github_token');
    const giteaToken = localStorage.getItem('gitea_token');
    const isAuth = !!(githubToken || giteaToken);
    setIsAuthenticated(isAuth);

    if (isAuth) {
      // Carrega ou cria conta Git
      const accounts = await db.getAllGitAccounts();
      if (accounts.length > 0) {
        setCurrentAccount(accounts[0]);
      } else {
        // Cria conta se não existir
        const token = githubToken || giteaToken || '';
        const account: GitAccount = {
          id: `account-${Date.now()}`,
          provider: githubToken ? 'github' : 'gitea',
          username: 'user', // Seria obtido da API
          token,
          giteaUrl: giteaToken ? giteaUrl : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.saveGitAccount(account);
        setCurrentAccount(account);
      }
    }
  };

  const loadSavedRepositories = async () => {
    if (currentAccount) {
      const repos = await db.getAllGitRepositories(currentAccount.id);
      setSavedRepositories(repos);
    }
  };

  const loadSyncJobs = async () => {
    if (selectedRepo) {
      const jobs = await db.getAllGitSyncJobs(selectedRepo.id);
      setSyncJobs(jobs);
      
      // Carrega análises históricas do repositório
      const analyses = await db.getAnalysesHistory({
        projectId: selectedRepo.id,
        limit: 100,
      });
      setHistoryAnalyses(analyses);
    } else {
      // Carrega todas as análises históricas se nenhum repo selecionado
      const analyses = await db.getAnalysesHistory({
        limit: 100,
      });
      setHistoryAnalyses(analyses);
    }
  };
  
  const handleExport = async (format: 'pdf' | 'html' | 'markdown' | 'txt') => {
    if (historyAnalyses.length === 0) {
      toast.error('Nenhuma análise para exportar');
      return;
    }
    
    try {
      setIsExporting(true);
      await exportAnalyses(historyAnalyses, format, true);
      toast.success(`Exportação em ${format.toUpperCase()} concluída`);
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast.error(`Erro ao exportar: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAuthenticate = async () => {
    try {
      setIsLoading(true);
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      
      if (useTokenAuth && personalToken) {
        // Autenticação com Personal Access Token
        gitProvider.setToken(personalToken);
        const storageKey = provider === 'github' ? 'github_token' : 'gitea_token';
        localStorage.setItem(storageKey, personalToken);
        
        // Cria ou atualiza conta Git
        const accounts = await db.getAllGitAccounts();
        let account: GitAccount;
        
        if (accounts.length > 0 && accounts[0].provider === provider) {
          account = { ...accounts[0], token: personalToken, updatedAt: new Date() };
        } else {
          account = {
            id: `account-${Date.now()}`,
            provider,
            username: 'user', // Seria obtido da API
            token: personalToken,
            giteaUrl: provider === 'gitea' ? giteaUrl : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        
        await db.saveGitAccount(account);
        setCurrentAccount(account);
        setIsAuthenticated(true);
        toast.success('Autenticado com sucesso usando Personal Access Token');
      } else {
        // Autenticação OAuth
        await gitProvider.authenticate();
        toast.success('Autenticação iniciada. Redirecionando...');
      }
    } catch (error: any) {
      toast.error(`Erro na autenticação: ${error.message}`);
      if (error.message.includes('Client ID não configurado')) {
        toast.info('Configure VITE_GITHUB_CLIENT_ID no .env ou use Personal Access Token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncRepositories = async () => {
    if (!currentAccount) {
      toast.error('Não autenticado. Faça login primeiro.');
      return;
    }

    try {
      setIsSyncing(true);
      setSyncProgress({ current: 0, total: 0, repo: '' });

      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      if (!token) {
        toast.error('Token não encontrado');
        return;
      }

      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token);

      // Atualiza status dos repositórios para "syncing"
      const existingRepos = await db.getAllGitRepositories(currentAccount.id);
      for (const repo of existingRepos) {
        await db.saveGitRepository({
          ...repo,
          syncStatus: 'syncing',
          updatedAt: new Date(),
        });
      }

      const syncedRepos = await syncRepositories(
        gitProvider,
        currentAccount.id,
        (progress) => {
          setSyncProgress(progress);
        }
      );

      await loadSavedRepositories();
      setIsSyncing(false);
      toast.success(`${syncedRepos.length} repositórios sincronizados`);
    } catch (error: any) {
      setIsSyncing(false);
      toast.error(`Erro ao sincronizar: ${error.message}`);
      
      // Atualiza status para "error"
      const repos = await db.getAllGitRepositories(currentAccount.id);
      for (const repo of repos) {
        await db.saveGitRepository({
          ...repo,
          syncStatus: 'error',
          syncError: error.message,
          updatedAt: new Date(),
        });
      }
      await loadSavedRepositories();
    }
  };

  const loadBranches = async (repo: GitRepository) => {
    try {
      setIsLoading(true);
      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      if (!token) {
        toast.error('Token não encontrado. Faça login novamente.');
        return;
      }
      
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token);
      
      const branchList = await gitProvider.getBranches(repo.fullName);
      setBranches(branchList);
      setSelectedBranch(repo.defaultBranch);
    } catch (error: any) {
      console.error('Erro ao carregar branches:', error);
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido ao carregar branches';
      toast.error(`Erro ao carregar branches: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedRepo || !selectedBranch) {
      toast.error('Selecione um repositório e branch');
      return;
    }

    try {
      setIsLoading(true);

      // Cria job de sync
      const jobId = `job-${Date.now()}`;
      const job: GitSyncJob = {
        id: jobId,
        repositoryId: selectedRepo.id,
        branch: selectedBranch,
        status: 'running',
        progress: 0,
        startedAt: new Date(),
      };
      await db.saveGitSyncJob(job);
      await loadSyncJobs();

      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token!);
      
      toast.info('Carregando arquivos do repositório...');
      const files = await gitProvider.getFilesInDirectory(selectedRepo.fullName, '', selectedBranch);
      
      toast.info(`Analisando ${files.length} arquivos...`);
      let analysisCount = 0;
      
      // Agrega resultados para análise histórica
      const allResults: any[] = [];
      const allFindings: Finding[] = [];
      let totalRisk = 0;
      let totalQuality = 0;
      let totalSecurity = 0;
      let totalImprovement = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = analyzeCode(file.content, file.path);
          
          // Salva análise individual (compatibilidade)
          await db.saveAnalysis({
            ...result,
            commitHash: selectedBranch,
            branch: selectedBranch,
            metadata: {
              repository: selectedRepo.fullName,
              repositoryId: selectedRepo.id,
              provider: provider,
            },
          });
          
          // Agrega para análise histórica
          allResults.push(result);
          totalRisk += result.scores.risk;
          totalQuality += result.scores.quality;
          totalSecurity += result.scores.security;
          totalImprovement += result.scores.improvements;
          
          // Processa findings com fingerprint
          result.findings.forEach((finding: any) => {
            const fingerprint = calculateFindingFingerprint({
              id: finding.id,
              analysisId: '', // Será preenchido depois
              type: finding.type,
              severity: finding.severity,
              file: file.path,
              line: finding.line,
              description: finding.description,
              code: finding.code,
              fingerprint: '',
            });
            
            allFindings.push({
              ...finding,
              file: file.path,
              fingerprint,
            });
          });
          
          analysisCount++;

          // Atualiza progresso do job
          const progress = Math.round(((i + 1) / files.length) * 100);
          await db.saveGitSyncJob({
            ...job,
            progress,
            analysisCount,
          });
        } catch (error) {
          console.warn(`Erro ao analisar ${file.path}:`, error);
        }
      }

      // Cria análise histórica agregada
      if (analysisCount > 0) {
        const avgRisk = totalRisk / analysisCount;
        const avgQuality = totalQuality / analysisCount;
        const avgSecurity = totalSecurity / analysisCount;
        const avgImprovement = totalImprovement / analysisCount;
        
        const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
        const highCount = allFindings.filter(f => f.severity === 'high').length;
        const mediumCount = allFindings.filter(f => f.severity === 'medium').length;
        const lowCount = allFindings.filter(f => f.severity === 'low').length;
        
        // Busca ou cria projeto
        let project = await db.getProject(selectedRepo.id);
        if (!project) {
          project = {
            id: selectedRepo.id,
            name: selectedRepo.fullName,
            provider: provider === 'github' ? 'github' : 'gitea',
            repositoryUrl: selectedRepo.url,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await db.saveProject(project);
        }
        
        // Cria análise histórica
        const historyAnalysis: Analysis = {
          id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId: selectedRepo.id,
          timestamp: new Date(),
          branch: selectedBranch, // Branch completo
          commitHash: selectedBranch,
          mode: 'repo',
          riskScore: Math.round(avgRisk),
          qualityScore: Math.round(avgQuality),
          securityScore: Math.round(avgSecurity),
          improvementScore: Math.round(avgImprovement),
          qualityGate: 'PASS', // Será avaliado depois
          fileCount: analysisCount,
          totalFindings: allFindings.length,
          criticalFindings: criticalCount,
          highFindings: highCount,
          mediumFindings: mediumCount,
          lowFindings: lowCount,
          metadata: {
            repository: selectedRepo.fullName,
            repositoryId: selectedRepo.id,
            provider: provider,
            jobId: jobId,
          },
        };
        
        // Avalia Quality Gate com memória
        const gateResult = await evaluateQualityGateWithMemory(historyAnalysis);
        historyAnalysis.qualityGate = gateResult.status;
        historyAnalysis.qualityGateReason = gateResult.reasons.join('; ');
        
        // Salva análise histórica
        await db.saveAnalysisHistory(historyAnalysis);
        
        // Salva findings com analysisId correto
        const findingsWithAnalysisId = allFindings.map(f => ({
          ...f,
          analysisId: historyAnalysis.id,
        }));
        await db.saveFindings(findingsWithAnalysisId);
      }

      // Finaliza job
      await db.saveGitSyncJob({
        ...job,
        status: 'completed',
        progress: 100,
        analysisCount,
        completedAt: new Date(),
      });
      await loadSyncJobs();

      toast.success(`Análise concluída: ${analysisCount} arquivos analisados`);
      navigate('/heatmap', { state: { repositoryId: selectedRepo.id, branch: selectedBranch } });
    } catch (error: any) {
      toast.error(`Erro ao analisar repositório: ${error.message}`);
      
      // Marca job como falho
      if (selectedRepo) {
        const jobs = await db.getAllGitSyncJobs(selectedRepo.id);
        const lastJob = jobs[0];
        if (lastJob && lastJob.status === 'running') {
          await db.saveGitSyncJob({
            ...lastJob,
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          });
          await loadSyncJobs();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: GitRepository['syncStatus']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: GitRepository['syncStatus']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Sincronizado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="bg-blue-500">Sincronizando</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const handleDisconnect = async () => {
    if (!currentAccount) {
      return;
    }

    try {
      setIsLoading(true);

      // Obtém os repositórios antes de removê-los (para deletar os jobs)
      const repos = await db.getAllGitRepositories(currentAccount.id);
      
      // Remove todos os jobs de sync dos repositórios
      for (const repo of repos) {
        await db.deleteAllGitSyncJobsByRepository(repo.id);
      }

      // Remove todos os repositórios da conta
      await db.deleteAllGitRepositoriesByAccount(currentAccount.id);

      // Remove token do localStorage
      const storageKey = currentAccount.provider === 'github' ? 'github_token' : 'gitea_token';
      localStorage.removeItem(storageKey);

      // Remove a conta Git
      await db.deleteGitAccount(currentAccount.id);

      // Limpa o estado
      setCurrentAccount(null);
      setIsAuthenticated(false);
      setSavedRepositories([]);
      setSelectedRepo(null);
      setBranches([]);
      setSelectedBranch('');
      setSyncJobs([]);
      setPersonalToken('');

      toast.success('Conexão Git removida com sucesso');
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error(`Erro ao remover conexão: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Repositórios Git</h1>
          <p className="text-muted-foreground">
            Conecte-se ao GitHub ou Gitea para sincronizar e analisar repositórios
          </p>
        </div>

        <Tabs defaultValue="repositories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="repositories">
              <Database className="mr-2 h-4 w-4" />
              Repositórios
            </TabsTrigger>
            <TabsTrigger value="analysis">
              <Activity className="mr-2 h-4 w-4" />
              Análise
            </TabsTrigger>
            <TabsTrigger value="history">
              <GitCommit className="mr-2 h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Conexão Git</CardTitle>
                <CardDescription>Configure sua conexão com GitHub ou Gitea</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Provedor Git</label>
                  <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">
                        <div className="flex items-center gap-2">
                          <Github className="h-4 w-4" />
                          GitHub
                        </div>
                      </SelectItem>
                      <SelectItem value="gitea">
                        <div className="flex items-center gap-2">
                          <Github className="h-4 w-4" />
                          Gitea
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {provider === 'gitea' && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">URL do Gitea</label>
                    <input
                      type="text"
                      value={giteaUrl}
                      onChange={(e) => setGiteaUrl(e.target.value)}
                      placeholder="https://gitea.example.com"
                      className="w-full px-3 py-2 rounded-md border border-input bg-background"
                    />
                  </div>
                )}

                {!isAuthenticated ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="useTokenAuth"
                        checked={useTokenAuth}
                        onChange={(e) => setUseTokenAuth(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="useTokenAuth" className="text-sm cursor-pointer">
                        Usar Personal Access Token (alternativa ao OAuth)
                      </label>
                    </div>
                    
                    {useTokenAuth ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium block">
                          Personal Access Token
                        </label>
                        <input
                          type="password"
                          value={personalToken}
                          onChange={(e) => setPersonalToken(e.target.value)}
                          placeholder={provider === 'github' 
                            ? 'ghp_xxxxxxxxxxxxxxxxxxxx' 
                            : 'Seu token do Gitea'}
                          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          {provider === 'github' ? (
                            <>
                              Crie um token em{' '}
                              <a 
                                href="https://github.com/settings/tokens" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                GitHub Settings → Developer settings → Personal access tokens
                              </a>
                              . Escopos necessários: <code className="bg-muted px-1 rounded">repo</code>, <code className="bg-muted px-1 rounded">read:org</code>
                            </>
                          ) : (
                            'Crie um token no seu servidor Gitea com permissões de leitura de repositórios'
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
                        <p className="font-medium mb-1">⚠️ OAuth não configurado</p>
                        <p>
                          Configure <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">VITE_GITHUB_CLIENT_ID</code> no arquivo <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.env</code> ou use Personal Access Token.
                        </p>
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleAuthenticate} 
                      disabled={
                        isLoading || 
                        (provider === 'gitea' && !giteaUrl) ||
                        (useTokenAuth && !personalToken.trim())
                      }
                    >
                      <Github className="mr-2 h-4 w-4" />
                      {useTokenAuth 
                        ? 'Autenticar com Token' 
                        : `Autenticar com ${provider === 'github' ? 'GitHub' : 'Gitea'}`}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Autenticado como {currentAccount?.username} ({currentAccount?.provider})
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleDisconnect}
                        disabled={isLoading}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Desconectar
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleSyncRepositories} 
                      disabled={isSyncing || isLoading}
                      className="w-full"
                    >
                      <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar Repositórios'}
                    </Button>
                  </div>
                )}

                {isSyncing && syncProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sincronizando: {syncProgress.repo}</span>
                      <span>{syncProgress.current} / {syncProgress.total}</span>
                    </div>
                    <Progress value={(syncProgress.current / syncProgress.total) * 100} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Repositórios Sincronizados</CardTitle>
                <CardDescription>
                  {savedRepositories.length} repositório{savedRepositories.length !== 1 ? 's' : ''} encontrado{savedRepositories.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {savedRepositories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum repositório sincronizado ainda.</p>
                    <p className="text-sm mt-2">Use o botão "Sincronizar Repositórios" para começar.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedRepositories.map((repo) => (
                      <div
                        key={repo.id}
                        className={cn(
                          "p-4 border rounded-lg cursor-pointer transition-colors",
                          selectedRepo?.id === repo.id && "border-primary bg-primary/5"
                        )}
                        onClick={() => {
                          setSelectedRepo(repo);
                          loadBranches(repo);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileCode className="h-4 w-4" />
                              <span className="font-medium">{repo.fullName}</span>
                              {repo.private && (
                                <Badge variant="outline" className="text-xs">Privado</Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-sm text-muted-foreground mb-2">{repo.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                {repo.defaultBranch}
                              </span>
                              {repo.language && (
                                <span>{repo.language}</span>
                              )}
                              {repo.lastSyncAt && (
                                <span>
                                  Última sync: {new Date(repo.lastSyncAt).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(repo.syncStatus)}
                            {getStatusBadge(repo.syncStatus)}
                          </div>
                        </div>
                        {repo.syncError && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            {repo.syncError}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Repositório</CardTitle>
                <CardDescription>Selecione um repositório e branch para analisar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedRepositories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum repositório disponível. Sincronize repositórios primeiro.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Repositório</label>
                      <Select
                        value={selectedRepo?.id || ''}
                        onValueChange={(id) => {
                          const repo = savedRepositories.find(r => r.id === id);
                          setSelectedRepo(repo || null);
                          if (repo) {
                            loadBranches(repo);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um repositório" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedRepositories.map((repo) => (
                            <SelectItem key={repo.id} value={repo.id}>
                              {repo.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {branches.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Branch</label>
                        <Select
                          value={selectedBranch}
                          onValueChange={setSelectedBranch}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.name} value={branch.name}>
                                <div className="flex items-center gap-2">
                                  <GitBranch className="h-4 w-4" />
                                  {branch.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedRepo && selectedBranch && (
                      <Button
                        onClick={handleStartAnalysis}
                        disabled={isLoading}
                        className="w-full"
                        size="lg"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Analisando...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar Análise
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Histórico de Análises</CardTitle>
                    <CardDescription>
                      {historyAnalyses.length > 0 
                        ? `${historyAnalyses.length} análise${historyAnalyses.length !== 1 ? 's' : ''} encontrada${historyAnalyses.length !== 1 ? 's' : ''}`
                        : 'Jobs de sincronização e análise por repositório'}
                    </CardDescription>
                  </div>
                  {historyAnalyses.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('pdf')}
                        disabled={isExporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('html')}
                        disabled={isExporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        HTML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('markdown')}
                        disabled={isExporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        MD
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('txt')}
                        disabled={isExporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        TXT
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {historyAnalyses.length === 0 && syncJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma análise encontrada.</p>
                    <p className="text-sm mt-2">Execute uma análise de repositório para ver o histórico aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Análises Históricas */}
                    {historyAnalyses.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Análises Históricas</h3>
                        <div className="space-y-3">
                          {historyAnalyses.map((analysis) => (
                            <div key={analysis.id} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="font-medium mb-1">
                                    {new Date(analysis.timestamp).toLocaleString('pt-BR')}
                                  </div>
                                  {analysis.branch && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                      <GitBranch className="h-3 w-3" />
                                      <span className="font-mono">{analysis.branch}</span>
                                    </div>
                                  )}
                                  {analysis.commitHash && (
                                    <div className="text-xs text-muted-foreground font-mono mb-2">
                                      Commit: {analysis.commitHash}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-4 text-sm mt-2">
                                    <span>Risco: <strong>{analysis.riskScore}%</strong></span>
                                    <span>Qualidade: <strong>{analysis.qualityScore}%</strong></span>
                                    <span>Segurança: <strong>{analysis.securityScore}%</strong></span>
                                    <span>Findings: <strong>{analysis.totalFindings || 0}</strong></span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {analysis.qualityGate === 'PASS' ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  )}
                                  <Badge
                                    variant={analysis.qualityGate === 'PASS' ? 'default' : 'destructive'}
                                  >
                                    {analysis.qualityGate}
                                  </Badge>
                                </div>
                              </div>
                              {analysis.qualityGateReason && (
                                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-xs text-yellow-800 dark:text-yellow-200">
                                  {analysis.qualityGateReason}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Jobs de Sync */}
                    {syncJobs.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Jobs de Sincronização</h3>
                        <div className="space-y-3">
                          {syncJobs.map((job) => (
                            <div key={job.id} className="p-4 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-medium">Branch: {job.branch}</div>
                                  {job.commitHash && (
                                    <div className="text-sm text-muted-foreground font-mono">
                                      {job.commitHash.substring(0, 7)}
                                    </div>
                                  )}
                                </div>
                                <Badge
                                  variant={
                                    job.status === 'completed' ? 'default' :
                                    job.status === 'failed' ? 'destructive' :
                                    job.status === 'running' ? 'secondary' : 'outline'
                                  }
                                >
                                  {job.status === 'completed' ? 'Concluído' :
                                   job.status === 'failed' ? 'Falhou' :
                                   job.status === 'running' ? 'Em execução' : 'Pendente'}
                                </Badge>
                              </div>
                              {job.status === 'running' && job.progress !== undefined && (
                                <div className="space-y-1 mb-2">
                                  <Progress value={job.progress} />
                                  <div className="text-xs text-muted-foreground">
                                    {job.progress}% - {job.analysisCount || 0} arquivos analisados
                                  </div>
                                </div>
                              )}
                              {job.status === 'completed' && (
                                <div className="text-sm text-muted-foreground">
                                  {job.analysisCount || 0} arquivos analisados
                                </div>
                              )}
                              {job.error && (
                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-600 dark:text-red-400">
                                  {job.error}
                                </div>
                              )}
                              {job.startedAt && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  Iniciado: {new Date(job.startedAt).toLocaleString('pt-BR')}
                                  {job.completedAt && (
                                    <> • Concluído: {new Date(job.completedAt).toLocaleString('pt-BR')}</>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
