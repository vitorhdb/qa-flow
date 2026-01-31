import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, FileCode, AlertTriangle, GitBranch, Database } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RiskHeatmap } from '@/components/dashboard/RiskHeatmap';
import { buildFileRiskMatrixItems, type FileRiskMatrixItem } from '@/lib/risk-matrix';
import { db, type GitRepository } from '@/lib/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function HeatmapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterImpact, setFilterImpact] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [filterProbability, setFilterProbability] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [filterRepository, setFilterRepository] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [repositories, setRepositories] = useState<GitRepository[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState<FileRiskMatrixItem[]>([]);

  useEffect(() => {
    loadRepositories();
    loadAnalyses();
    
    // Verifica se há filtros na navegação
    if (location.state?.repositoryId) {
      setFilterRepository(location.state.repositoryId);
    }
    if (location.state?.branch) {
      setFilterBranch(location.state.branch);
    }
  }, []);

  const loadRepositories = async () => {
    const repos = await db.getAllGitRepositories();
    setRepositories(repos);
    
    // Extrai branches únicas das análises
    const analyses = await db.getAllAnalyses();
    const uniqueBranches = new Set<string>();
    analyses.forEach(analysis => {
      if (analysis.branch) {
        uniqueBranches.add(analysis.branch);
      }
    });
    setBranches(Array.from(uniqueBranches).sort());
  };

  const loadAnalyses = async () => {
    try {
      setIsLoading(true);
      let analyses = await db.getAllAnalyses();
      
      // Filtra por repositório se selecionado
      if (filterRepository !== 'all') {
        analyses = analyses.filter(analysis => 
          analysis.metadata?.repositoryId === filterRepository
        );
      }
      
      // Filtra por branch se selecionado
      if (filterBranch !== 'all') {
        analyses = analyses.filter(analysis => 
          analysis.branch === filterBranch
        );
      }
      
      if (!analyses || analyses.length === 0) {
        setAllItems([]);
        return;
      }
      
      // Converte AnalysisRecord para AnalysisResult com validação
      const analysisResults = analyses
        .filter(record => {
          // Valida que o record tem os dados mínimos necessários
          if (!record || !record.id) return false;
          if (!record.scores || typeof record.scores !== 'object') return false;
          if (!record.findings || !Array.isArray(record.findings)) return false;
          if (!record.language || typeof record.language !== 'string') return false;
          return true;
        })
        .map(record => {
          try {
            // Garante que timestamp é uma Date válida
            let timestamp: Date;
            if (record.timestamp instanceof Date) {
              timestamp = record.timestamp;
            } else if (typeof record.timestamp === 'string') {
              timestamp = new Date(record.timestamp);
            } else {
              timestamp = new Date();
            }
            
            // Valida scores
            const scores = {
              risk: typeof record.scores.risk === 'number' ? record.scores.risk : 0,
              quality: typeof record.scores.quality === 'number' ? record.scores.quality : 0,
              security: typeof record.scores.security === 'number' ? record.scores.security : 0,
              improvements: typeof record.scores.improvements === 'number' ? record.scores.improvements : 0,
            };
            
            return {
              id: record.id,
              timestamp,
              filename: record.filename || undefined,
              code: '', // Código não é armazenado no banco para economizar espaço
              language: record.language || 'unknown',
              scores,
              findings: Array.isArray(record.findings) ? record.findings : [],
              passed: typeof record.passed === 'boolean' ? record.passed : false,
            };
          } catch (err) {
            console.warn('Erro ao processar análise:', record.id, err);
            return null;
          }
        })
        .filter((result): result is NonNullable<typeof result> => result !== null);
      
      if (analysisResults.length === 0) {
        setAllItems([]);
        return;
      }
      
      const items = buildFileRiskMatrixItems(analysisResults);
      setAllItems(items);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      toast.error('Erro ao carregar análises para o heatmap. Verifique o console para mais detalhes.');
      setAllItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, [filterRepository, filterBranch]);

  const filteredItems = useMemo(() => {
    let filtered = allItems;

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.filename.toLowerCase().includes(term) ||
        item.analysisResult.language.toLowerCase().includes(term)
      );
    }

    // Filtro por impacto
    if (filterImpact !== 'all') {
      filtered = filtered.filter(item => item.impact === parseInt(filterImpact));
    }

    // Filtro por probabilidade
    if (filterProbability !== 'all') {
      filtered = filtered.filter(item => item.probability === parseInt(filterProbability));
    }

    return filtered;
  }, [allItems, searchTerm, filterImpact, filterProbability]);

  const handleOpenFile = (item: FileRiskMatrixItem) => {
    navigate('/arquivo', { state: { item } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Mapa de Calor de Riscos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Visualize e analise riscos por impacto e probabilidade
          </p>
        </div>

        {/* Filtros */}
        <div className="glass-panel p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por arquivo ou linguagem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {repositories.length > 0 && (
                <Select value={filterRepository} onValueChange={setFilterRepository}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <Database className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Repositório" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Repositórios</SelectItem>
                    {repositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id}>
                        {repo.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {branches.length > 0 && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <GitBranch className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterImpact} onValueChange={(v: any) => setFilterImpact(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Impacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Impactos</SelectItem>
                  <SelectItem value="5">Impacto 5 (Crítico)</SelectItem>
                  <SelectItem value="4">Impacto 4 (Alto)</SelectItem>
                  <SelectItem value="3">Impacto 3 (Médio)</SelectItem>
                  <SelectItem value="2">Impacto 2 (Baixo)</SelectItem>
                  <SelectItem value="1">Impacto 1 (Muito Baixo)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProbability} onValueChange={(v: any) => setFilterProbability(v)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Probabilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Probabilidades</SelectItem>
                  <SelectItem value="5">Prob. 5 (Muito Alta)</SelectItem>
                  <SelectItem value="4">Prob. 4 (Alta)</SelectItem>
                  <SelectItem value="3">Prob. 3 (Média)</SelectItem>
                  <SelectItem value="2">Prob. 2 (Baixa)</SelectItem>
                  <SelectItem value="1">Prob. 1 (Muito Baixa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filteredItems.length} de {allItems.length} arquivos
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Nova Análise
              </Button>
            </div>
          </div>
        </div>

        {/* Heatmap */}
        {isLoading ? (
          <div className="glass-panel p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando mapa de calor...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum arquivo encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {allItems.length === 0
                ? 'Realize análises para visualizar o mapa de calor'
                : 'Nenhum arquivo corresponde aos filtros selecionados'}
            </p>
            <Button onClick={() => navigate('/')}>Iniciar Análise</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <RiskHeatmap items={filteredItems} onOpenFile={handleOpenFile} />
            
            {/* Lista de arquivos filtrados — cards informativos */}
            <div className="glass-panel p-6 sm:p-8">
              <h3 className="text-lg font-semibold mb-1">Arquivos analisados</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filteredItems.length} arquivo(s). Clique em um card ou na célula do mapa para ver detalhes do risco.
              </p>
              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {filteredItems
                  .filter(item => item && item.filename && item.analysisResult)
                  .sort((a, b) => {
                    try {
                      const scoreA = (a.impact || 1) * (a.probability || 1);
                      const scoreB = (b.impact || 1) * (b.probability || 1);
                      if (scoreB !== scoreA) return scoreB - scoreA;
                      const aLen = Array.isArray(a.analysisResult.findings) ? a.analysisResult.findings.length : 0;
                      const bLen = Array.isArray(b.analysisResult.findings) ? b.analysisResult.findings.length : 0;
                      return bLen - aLen;
                    } catch {
                      return 0;
                    }
                  })
                  .map((item) => {
                    try {
                      if (!item || !item.filename || !item.analysisResult) return null;
                      const findingsLength = Array.isArray(item.analysisResult.findings) 
                        ? item.analysisResult.findings.length 
                        : 0;
                      const impact = item.impact || 1;
                      const probability = item.probability || 1;
                      const securityScore = item.advancedMetrics?.security?.score ?? item.analysisResult.scores?.security ?? 0;
                      const qualityScore = item.advancedMetrics?.quality?.score ?? item.analysisResult.scores?.quality ?? 0;
                      const compositeScore = item.advancedMetrics?.compositeScore ?? 0;
                      const riskScore = impact * probability;
                      const isCritical = impact >= 4 && probability >= 4;
                      const isHigh = impact >= 3 && probability >= 3 && !isCritical;
                      
                      return (
                        <div
                          key={item.filename}
                          className={cn(
                            'rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md',
                            isCritical && 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10',
                            isHigh && !isCritical && 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10',
                            !isCritical && !isHigh && 'border-border bg-card/50 hover:bg-muted/40'
                          )}
                          onClick={() => handleOpenFile(item)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-sm font-medium text-foreground truncate flex items-center gap-2">
                                <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                                {item.filename}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                <span>{findingsLength} achados</span>
                                <span>Impacto {impact}</span>
                                <span>Prob. {probability}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-3">
                                <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                  Segurança {securityScore}
                                </span>
                                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  Qualidade {qualityScore}
                                </span>
                                {compositeScore > 0 && (
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Score {compositeScore}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={cn(
                                'rounded-lg px-2.5 py-1 text-xs font-semibold',
                                isCritical && 'bg-destructive/20 text-destructive',
                                isHigh && 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
                                !isCritical && !isHigh && 'bg-primary/10 text-primary'
                              )}>
                                Risco {riskScore}
                              </span>
                              <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); handleOpenFile(item); }}>
                                Ver detalhes
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })
                  .filter(Boolean)}
              </div>
            </div>

            {/* Estatísticas — cards visuais */}
            {allItems.length > 0 && (
              <div className="glass-panel p-6 sm:p-8">
                <h3 className="text-lg font-semibold mb-1">Resumo do risco</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Distribuição dos arquivos por nível de risco (Impacto × Probabilidade).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-border bg-card/50 p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-foreground">{allItems.length}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">Total de arquivos</div>
                  </div>
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-destructive">
                      {allItems.filter(i => i.impact >= 4 && i.probability >= 4).length}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">Alto risco (16–25)</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {allItems.filter(i => i.impact >= 3 && i.probability >= 3 && !(i.impact >= 4 && i.probability >= 4)).length}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">Risco médio (9–15)</div>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-primary">
                      {allItems.filter(i => i.impact <= 2 && i.probability <= 2).length}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">Baixo risco (1–4)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
