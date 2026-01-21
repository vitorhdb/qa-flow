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
            
            {/* Lista de arquivos filtrados */}
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold mb-4">Arquivos ({filteredItems.length})</h3>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {filteredItems
                  .filter(item => item && item.filename && item.analysisResult)
                  .sort((a, b) => {
                    try {
                      // Ordena por impacto x probabilidade (maior risco primeiro)
                      const scoreA = (a.impact || 1) * (a.probability || 1);
                      const scoreB = (b.impact || 1) * (b.probability || 1);
                      if (scoreB !== scoreA) return scoreB - scoreA;
                      const aLen = Array.isArray(a.analysisResult.findings) ? a.analysisResult.findings.length : 0;
                      const bLen = Array.isArray(b.analysisResult.findings) ? b.analysisResult.findings.length : 0;
                      return bLen - aLen;
                    } catch (err) {
                      console.error('Erro ao ordenar itens:', err);
                      return 0;
                    }
                  })
                  .map((item) => {
                    try {
                      if (!item || !item.filename || !item.analysisResult) {
                        return null;
                      }
                      const findingsLength = Array.isArray(item.analysisResult.findings) 
                        ? item.analysisResult.findings.length 
                        : 0;
                      const impact = item.impact || 1;
                      const probability = item.probability || 1;
                      const securityScore = item.advancedMetrics?.security?.score ?? 0;
                      const qualityScore = item.advancedMetrics?.quality?.score ?? 0;
                      const robustnessScore = item.advancedMetrics?.robustness?.score ?? 0;
                      const compositeScore = item.advancedMetrics?.compositeScore ?? 0;
                      
                      return (
                        <div
                          key={item.filename}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors cursor-pointer',
                            impact >= 4 && probability >= 4 && 'border-risk-critical/50 bg-risk-critical/5'
                          )}
                          onClick={() => handleOpenFile(item)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-sm truncate font-medium">{item.filename}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {findingsLength} achados • Impacto {impact} • Prob. {probability}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2 text-xs">
                              <span className="text-red-500">Segurança: {securityScore}</span>
                              <span className="text-blue-500">Qualidade: {qualityScore}</span>
                              <span className="text-green-500">Robustez: {robustnessScore}</span>
                              <span className="text-purple-500">Score: {compositeScore}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'px-2 py-1 rounded text-xs font-medium',
                              impact >= 4 && probability >= 4 ? 'bg-risk-critical/20 text-risk-critical' :
                              impact >= 3 && probability >= 3 ? 'bg-status-warning/20 text-status-warning' :
                              'bg-status-passed/20 text-status-passed'
                            )}>
                              Risco {impact * probability}
                            </div>
                            <Button variant="outline" size="sm">
                              Ver detalhes
                            </Button>
                          </div>
                        </div>
                      );
                    } catch (err) {
                      console.error('Erro ao renderizar item:', item, err);
                      return null;
                    }
                  })
                  .filter(item => item !== null)}
              </div>
            </div>

            {/* Estatísticas */}
            {allItems.length > 0 && (
              <div className="glass-panel p-6">
                <h3 className="text-lg font-semibold mb-4">Estatísticas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{allItems.length}</div>
                    <div className="text-sm text-muted-foreground">Total de arquivos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-risk-critical">
                      {allItems.filter(i => i.impact >= 4 && i.probability >= 4).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Alto risco</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-status-warning">
                      {allItems.filter(i => i.impact >= 3 && i.probability >= 3 && !(i.impact >= 4 && i.probability >= 4)).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Risco médio</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-status-passed">
                      {allItems.filter(i => i.impact <= 2 && i.probability <= 2).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Baixo risco</div>
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
