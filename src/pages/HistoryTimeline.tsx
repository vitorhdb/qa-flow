/**
 * Página de Histórico Temporal - Estilo SonarQube
 * Timeline de análises com gráficos de tendência e comparação
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  XCircle,
  GitBranch,
  FileCode,
  AlertTriangle,
  BarChart3,
  Calendar,
  Filter
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/database';
import { compareAnalyses } from '@/lib/history-comparison';
import { getProjectTrend } from '@/lib/history-trends';
import type { Analysis, AnalysisComparison, ProjectTrend, AnalysisFilter } from '@/types/history';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function HistoryTimeline() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [comparison, setComparison] = useState<AnalysisComparison | null>(null);
  const [trend, setTrend] = useState<ProjectTrend | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<AnalysisFilter>({});

  useEffect(() => {
    loadProjects();
    loadAnalyses();
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [selectedProject, selectedBranch]);

  useEffect(() => {
    if (selectedAnalysis) {
      loadComparison();
    }
  }, [selectedAnalysis]);

  useEffect(() => {
    if (selectedProject && selectedProject !== 'all') {
      loadTrend();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const projs = await db.getAllProjects();
    setProjects(projs);
  };

  const loadAnalyses = async () => {
    try {
      setIsLoading(true);
      const filter: AnalysisFilter = {
        limit: 50,
      };
      
      if (selectedProject !== 'all') {
        filter.projectId = selectedProject;
      }
      
      if (selectedBranch !== 'all') {
        filter.branch = selectedBranch;
      }
      
      const results = await db.getAnalysesHistory(filter);
      setAnalyses(results);
      
      if (results.length > 0 && !selectedAnalysis) {
        setSelectedAnalysis(results[0]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar análises:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  };

  const loadComparison = async () => {
    if (!selectedAnalysis) return;
    
    try {
      const prevAnalyses = await db.getAnalysesHistory({
        projectId: selectedAnalysis.projectId,
        branch: selectedAnalysis.branch,
        limit: 2,
      });
      
      if (prevAnalyses.length >= 2) {
        const comp = await compareAnalyses(prevAnalyses[1].id, selectedAnalysis.id);
        setComparison(comp);
      }
    } catch (error) {
      console.error('Erro ao comparar análises:', error);
    }
  };

  const loadTrend = async () => {
    if (!selectedProject || selectedProject === 'all') return;
    
    try {
      const projectTrend = await getProjectTrend(selectedProject, 30);
      setTrend(projectTrend);
    } catch (error) {
      console.error('Erro ao carregar tendência:', error);
    }
  };

  const branches = useMemo(() => {
    const branchSet = new Set<string>();
    analyses.forEach(a => {
      if (a.branch) branchSet.add(a.branch);
    });
    return Array.from(branchSet).sort();
  }, [analyses]);

  const getTrendIcon = (trend: 'improving' | 'stable' | 'degrading') => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'degrading':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: 'improving' | 'stable' | 'degrading') => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'degrading':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Histórico de Análises</h1>
          <p className="text-muted-foreground">
            Timeline temporal com evolução de qualidade e segurança
          </p>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Projeto</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {branches.length > 0 && (
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Branch</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as branches</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline de Análises */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeline de Execuções
                </CardTitle>
                <CardDescription>
                  {analyses.length} análise{analyses.length !== 1 ? 's' : ''} encontrada{analyses.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Carregando histórico...</p>
                  </div>
                ) : analyses.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma análise encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analyses.map((analysis, index) => (
                      <div
                        key={analysis.id}
                        className={cn(
                          "p-4 border rounded-lg cursor-pointer transition-colors",
                          selectedAnalysis?.id === analysis.id && "border-primary bg-primary/5"
                        )}
                        onClick={() => setSelectedAnalysis(analysis)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {new Date(analysis.timestamp).toLocaleString('pt-BR')}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {analysis.mode}
                              </Badge>
                            </div>
                            {analysis.branch && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <GitBranch className="h-3 w-3" />
                                {analysis.branch}
                                {analysis.commitHash && (
                                  <span className="font-mono text-xs">
                                    ({analysis.commitHash.substring(0, 7)})
                                  </span>
                                )}
                              </div>
                            )}
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
                        
                        <div className="grid grid-cols-4 gap-4 mt-4">
                          <div>
                            <div className="text-xs text-muted-foreground">Risco</div>
                            <div className="text-lg font-semibold">{analysis.riskScore}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Qualidade</div>
                            <div className="text-lg font-semibold">{analysis.qualityScore}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Segurança</div>
                            <div className="text-lg font-semibold">{analysis.securityScore}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Findings</div>
                            <div className="text-lg font-semibold">{analysis.totalFindings || 0}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comparação com Análise Anterior */}
            {selectedAnalysis && comparison && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparação com Análise Anterior</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Risco</div>
                        <div className={cn(
                          "text-lg font-semibold",
                          comparison.riskScoreDelta > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {comparison.riskScoreDelta > 0 ? '+' : ''}{comparison.riskScoreDelta.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Qualidade</div>
                        <div className={cn(
                          "text-lg font-semibold",
                          comparison.qualityScoreDelta > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {comparison.qualityScoreDelta > 0 ? '+' : ''}{comparison.qualityScoreDelta.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Segurança</div>
                        <div className={cn(
                          "text-lg font-semibold",
                          comparison.securityScoreDelta > 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {comparison.securityScoreDelta > 0 ? '+' : ''}{comparison.securityScoreDelta.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div>
                        <div className="text-sm font-medium text-red-600 mb-1">
                          Novos: {comparison.totalNewFindings}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {comparison.newFindings.filter(f => f.severity === 'critical').length} críticos
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-green-600 mb-1">
                          Resolvidos: {comparison.totalResolvedFindings}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-yellow-600 mb-1">
                          Persistentes: {comparison.totalPersistentFindings}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tendências e Estatísticas */}
          <div className="space-y-6">
            {trend && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Tendências (30 dias)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Risco</span>
                      {getTrendIcon(trend.riskTrend)}
                    </div>
                    <div className="text-2xl font-bold">{trend.averageRiskScore.toFixed(1)}%</div>
                    <div className={cn("text-xs", getTrendColor(trend.riskTrend))}>
                      {trend.riskTrend === 'improving' ? 'Melhorando' : 
                       trend.riskTrend === 'degrading' ? 'Piorando' : 'Estável'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Qualidade</span>
                      {getTrendIcon(trend.qualityTrend)}
                    </div>
                    <div className="text-2xl font-bold">{trend.averageQualityScore.toFixed(1)}%</div>
                    <div className={cn("text-xs", getTrendColor(trend.qualityTrend))}>
                      {trend.qualityTrend === 'improving' ? 'Melhorando' : 
                       trend.qualityTrend === 'degrading' ? 'Piorando' : 'Estável'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Segurança</span>
                      {getTrendIcon(trend.securityTrend)}
                    </div>
                    <div className="text-2xl font-bold">{trend.averageSecurityScore.toFixed(1)}%</div>
                    <div className={cn("text-xs", getTrendColor(trend.securityTrend))}>
                      {trend.securityTrend === 'improving' ? 'Melhorando' : 
                       trend.securityTrend === 'degrading' ? 'Piorando' : 'Estável'}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground mb-2">Quality Gate</div>
                    <div className="text-lg font-semibold">
                      {trend.qualityGatePassRate.toFixed(1)}% passou
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {trend.qualityGateFailures} falha{trend.qualityGateFailures !== 1 ? 's' : ''}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
