import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileCode, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db, type AnalysisRecord } from '@/lib/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function History() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<AnalysisRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalyses();
  }, []);

  useEffect(() => {
    filterAnalyses();
  }, [analyses, searchTerm, filterStatus]);

  const loadAnalyses = async () => {
    try {
      setIsLoading(true);
      const data = await db.getAllAnalyses();
      setAnalyses(data);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAnalyses = () => {
    let filtered = analyses;

    // Filtro por status
    if (filterStatus === 'passed') {
      filtered = filtered.filter(a => a.passed);
    } else if (filterStatus === 'failed') {
      filtered = filtered.filter(a => !a.passed);
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.filename?.toLowerCase().includes(term) ||
        a.language.toLowerCase().includes(term) ||
        a.id.toLowerCase().includes(term)
      );
    }

    setFilteredAnalyses(filtered);
  };

  const handleViewDetails = (analysis: AnalysisRecord) => {
    navigate('/analise', {
      state: {
        analysisResult: {
          id: analysis.id,
          timestamp: new Date(analysis.timestamp),
          filename: analysis.filename,
          code: analysis.code ?? '',
          language: analysis.language,
          scores: analysis.scores,
          findings: analysis.findings,
          passed: analysis.passed,
          ...(analysis.actionable && { actionable: analysis.actionable }),
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Histórico de Análises</h1>
          <p className="text-muted-foreground">
            Visualize e consulte todas as análises realizadas
          </p>
        </div>

        {/* Filtros */}
        <div className="glass-panel p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por arquivo, linguagem ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="passed">Aprovados</SelectItem>
                <SelectItem value="failed">Reprovados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate('/')}>
              Nova Análise
            </Button>
          </div>
        </div>

        {/* Lista de análises */}
        {isLoading ? (
          <div className="glass-panel p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando histórico...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma análise encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {analyses.length === 0
                ? 'Realize sua primeira análise para começar'
                : 'Nenhuma análise corresponde aos filtros selecionados'}
            </p>
            <Button onClick={() => navigate('/')}>Iniciar Análise</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                className={cn(
                  'glass-panel p-6 hover:shadow-lg transition-shadow cursor-pointer',
                  analysis.passed ? 'border-l-4 border-status-passed' : 'border-l-4 border-risk-critical'
                )}
                onClick={() => handleViewDetails(analysis)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {analysis.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-status-passed" />
                      ) : (
                        <XCircle className="h-5 w-5 text-risk-critical" />
                      )}
                      <h3 className="text-lg font-semibold">
                        {analysis.filename || 'Análise Manual'}
                      </h3>
                      <span className="px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground">
                        {analysis.language}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(analysis.timestamp), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <span>•</span>
                      <span>{analysis.findings.length} achados</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Risco</div>
                        <div className={cn(
                          'text-2xl font-bold',
                          analysis.scores.risk >= 70 ? 'text-status-passed' : 'text-risk-critical'
                        )}>
                          {analysis.scores.risk}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Qualidade</div>
                        <div className="text-2xl font-bold text-primary">
                          {analysis.scores.quality}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Segurança</div>
                        <div className={cn(
                          'text-2xl font-bold',
                          analysis.scores.security >= 70 ? 'text-status-passed' : 'text-status-warning'
                        )}>
                          {analysis.scores.security}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Melhorias</div>
                        <div className="text-2xl font-bold text-primary">
                          {analysis.scores.improvements}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" className="ml-4">
                    Ver Detalhes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        {analyses.length > 0 && (
          <div className="mt-8 glass-panel p-6">
            <h3 className="text-lg font-semibold mb-4">Estatísticas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold">{analyses.length}</div>
                <div className="text-sm text-muted-foreground">Total de análises</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-status-passed">
                  {analyses.filter(a => a.passed).length}
                </div>
                <div className="text-sm text-muted-foreground">Aprovadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-risk-critical">
                  {analyses.filter(a => !a.passed).length}
                </div>
                <div className="text-sm text-muted-foreground">Reprovadas</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round(analyses.reduce((sum, a) => sum + a.scores.risk, 0) / analyses.length)}%
                </div>
                <div className="text-sm text-muted-foreground">Risco médio</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
