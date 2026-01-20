import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, GitBranch, GitCommit, FileCode, Play, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createGitProvider, type GitRepository, type GitBranch, type GitCommit } from '@/lib/git-integration';
import { analyzeCode } from '@/lib/analyzer';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function GitIntegration() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<'github' | 'gitea'>('github');
  const [giteaUrl, setGiteaUrl] = useState('');
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const githubToken = localStorage.getItem('github_token');
    const giteaToken = localStorage.getItem('gitea_token');
    setIsAuthenticated(!!(githubToken || giteaToken));
  };

  const handleAuthenticate = async () => {
    try {
      setIsLoading(true);
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      await gitProvider.authenticate();
      // O token será salvo no callback
      toast.success('Autenticação iniciada. Redirecionando...');
    } catch (error: any) {
      toast.error(`Erro na autenticação: ${error.message}`);
      setIsLoading(false);
    }
  };

  const loadRepositories = async () => {
    try {
      setIsLoading(true);
      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      if (!token) {
        toast.error('Não autenticado. Faça login primeiro.');
        return;
      }

      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token);
      
      const repos = await gitProvider.getRepositories();
      setRepositories(repos);
      toast.success(`${repos.length} repositórios carregados`);
    } catch (error: any) {
      toast.error(`Erro ao carregar repositórios: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranches = async (repo: GitRepository) => {
    try {
      setIsLoading(true);
      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token!);
      
      const branchList = await gitProvider.getBranches(repo.fullName);
      setBranches(branchList);
      setSelectedBranch(repo.defaultBranch);
    } catch (error: any) {
      toast.error(`Erro ao carregar branches: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommits = async (repo: GitRepository, branch: string) => {
    try {
      setIsLoading(true);
      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token!);
      
      const commitList = await gitProvider.getCommits(repo.fullName, branch);
      setCommits(commitList);
    } catch (error: any) {
      toast.error(`Erro ao carregar commits: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeRepository = async () => {
    if (!selectedRepo || !selectedBranch) {
      toast.error('Selecione um repositório e branch');
      return;
    }

    try {
      setIsLoading(true);
      const token = provider === 'github' 
        ? localStorage.getItem('github_token')
        : localStorage.getItem('gitea_token');
      
      const gitProvider = createGitProvider(provider, provider === 'gitea' ? giteaUrl : undefined);
      gitProvider.setToken(token!);
      
      toast.info('Carregando arquivos do repositório...');
      const files = await gitProvider.getFilesInDirectory(selectedRepo.fullName, '', selectedBranch);
      
      toast.info(`Analisando ${files.length} arquivos...`);
      const results = [];
      
      for (const file of files) {
        try {
          const result = analyzeCode(file.content, file.path);
          await db.saveAnalysis({
            ...result,
            commitHash: selectedBranch,
            branch: selectedBranch,
            metadata: {
              repository: selectedRepo.fullName,
              provider: provider,
            },
          });
          results.push({ path: file.path, result });
        } catch (error) {
          console.warn(`Erro ao analisar ${file.path}:`, error);
        }
      }
      
      toast.success(`Análise concluída: ${results.length} arquivos analisados`);
      navigate('/', { state: { gitAnalysisResults: results } });
    } catch (error: any) {
      toast.error(`Erro ao analisar repositório: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Integração Git</h1>
          <p className="text-muted-foreground">
            Conecte-se ao GitHub ou Gitea para analisar repositórios
          </p>
        </div>

        <div className="glass-panel p-6 space-y-6">
          {/* Seleção de Provider */}
          <div className="space-y-4">
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
              <Button onClick={handleAuthenticate} disabled={isLoading || (provider === 'gitea' && !giteaUrl)}>
                <Github className="mr-2 h-4 w-4" />
                Autenticar com {provider === 'github' ? 'GitHub' : 'Gitea'}
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  ✓ Autenticado
                </div>
                <Button variant="outline" onClick={loadRepositories} disabled={isLoading}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                  Carregar Repositórios
                </Button>
              </div>
            )}
          </div>

          {/* Lista de Repositórios */}
          {repositories.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Selecionar Repositório</label>
                <Select
                  value={selectedRepo?.id || ''}
                  onValueChange={(id) => {
                    const repo = repositories.find(r => r.id === id);
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
                    {repositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id}>
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          {repo.fullName}
                          {repo.private && <span className="text-xs text-muted-foreground">(privado)</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção de Branch */}
              {branches.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Selecionar Branch</label>
                  <Select
                    value={selectedBranch}
                    onValueChange={(branch) => {
                      setSelectedBranch(branch);
                      if (selectedRepo) {
                        loadCommits(selectedRepo, branch);
                      }
                    }}
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

              {/* Commits */}
              {commits.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Últimos Commits</label>
                  <div className="max-h-40 overflow-auto border rounded-md p-2 space-y-2">
                    {commits.slice(0, 5).map((commit) => (
                      <div key={commit.sha} className="text-sm flex items-center gap-2">
                        <GitCommit className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-xs">{commit.sha.substring(0, 7)}</span>
                        <span className="text-muted-foreground truncate">{commit.message.split('\n')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão de Análise */}
              {selectedRepo && selectedBranch && (
                <Button
                  onClick={handleAnalyzeRepository}
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
                      Analisar Repositório
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
