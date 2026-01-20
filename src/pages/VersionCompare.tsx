import { useState, useEffect } from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compareVersions, formatComparisonDiff, type VersionComparison } from '@/lib/version-comparator';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function VersionCompare() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [baseAnalysis, setBaseAnalysis] = useState<string>('');
  const [targetAnalysis, setTargetAnalysis] = useState<string>('');
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    try {
      const data = await db.getAllAnalyses();
      setAnalyses(data);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      toast.error('Erro ao carregar análises');
    }
  };

  const handleCompare = async () => {
    if (!baseAnalysis || !targetAnalysis) {
      toast.error('Selecione ambas as análises para comparar');
      return;
    }

    if (baseAnalysis === targetAnalysis) {
      toast.error('Selecione análises diferentes');
      return;
    }

    try {
      setIsLoading(true);
      const base = await db.getAnalysis(baseAnalysis);
      const target = await db.getAnalysis(targetAnalysis);

      if (!base || !target) {
        toast.error('Análises não encontradas');
        return;
      }

      // Converte para AnalysisResult
      const baseResult = {
        id: base.id,
        timestamp: new Date(base.timestamp),
        filename: base.filename,
        code: '', // Não precisamos do código para comparação
        language: base.language,
        scores: base.scores,
        findings: base.findings,
        passed: base.passed,
      };

      const targetResult = {
        id: target.id,
        timestamp: new Date(target.timestamp),
        filename: target.filename,
        code: '',
        language: target.language,
        scores: target.scores,
        findings: target.findings,
        passed: target.passed,
      };

      const comp = compareVersions(baseResult, targetResult);
      setComparison(comp);
    } catch (error: any) {
      toast.error(`Erro ao comparar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improved':
        return <TrendingUp className="h-5 w-5 text-status-passed" />;
      case 'degraded':
        return <TrendingDown className="h-5 w-5 text-risk-critical" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={false} onAiToggle={() => {}} />
      
      <main className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Comparador de Versões</h1>
          <p className="text-muted-foreground">
            Compare análises entre diferentes versões do sistema
          </p>
        </div>

        <div className="glass-panel p-6 space-y-6">
          {/* Seleção de Análises */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Versão Base</label>
              <Select value={baseAnalysis} onValueChange={setBaseAnalysis}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a análise base" />
                </SelectTrigger>
                <SelectContent>
                  {analyses.map((analysis) => (
                    <SelectItem key={analysis.id} value={analysis.id}>
                      {analysis.filename || 'Análise Manual'} - {new Date(analysis.timestamp).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Versão Alvo</label>
              <Select value={targetAnalysis} onValueChange={setTargetAnalysis}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a análise alvo" />
                </SelectTrigger>
                <SelectContent>
                  {analyses.map((analysis) => (
                    <SelectItem key={analysis.id} value={analysis.id}>
                      {analysis.filename || 'Análise Manual'} - {new Date(analysis.timestamp).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCompare}
            disabled={isLoading || !baseAnalysis || !targetAnalysis}
            className="w-full"
            size="lg"
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Comparar Versões
          </Button>

          {/* Resultado da Comparação */}
          {comparison && (
            <div className="space-y-6 mt-8 border-t pt-6">
              {/* Tendência Geral */}
              <div className={cn(
                'rounded-lg border-2 p-4',
                comparison.diff.trend === 'improved' && 'border-status-passed bg-status-passed/5',
                comparison.diff.trend === 'degraded' && 'border-risk-critical bg-risk-critical/5',
                comparison.diff.trend === 'stable' && 'border-muted bg-muted/5'
              )}>
                <div className="flex items-center gap-3 mb-2">
                  {getTrendIcon(comparison.diff.trend)}
                  <h3 className="text-lg font-semibold">
                    {comparison.diff.trend === 'improved' && '✅ Melhoria Detectada'}
                    {comparison.diff.trend === 'degraded' && '❌ Degradação Detectada'}
                    {comparison.diff.trend === 'stable' && '➡️ Estável'}
                  </h3>
                </div>
              </div>

              {/* Diff de Scores */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Diferença de Scores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Risco</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      comparison.diff.scores.risk >= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.scores.risk >= 0 ? '+' : ''}{comparison.diff.scores.risk.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Qualidade</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      comparison.diff.scores.quality >= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.scores.quality >= 0 ? '+' : ''}{comparison.diff.scores.quality.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Segurança</div>
                    <div className={cn(
                      'text-2xl font-bold',
                      comparison.diff.scores.security >= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.scores.security >= 0 ? '+' : ''}{comparison.diff.scores.security.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Melhorias</div>
                    <div className="text-2xl font-bold text-primary">
                      {comparison.diff.scores.improvements >= 0 ? '+' : ''}{comparison.diff.scores.improvements}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diff de Findings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Mudanças em Findings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg border border-status-passed/30 bg-status-passed/5">
                    <div className="text-sm text-muted-foreground mb-1">Adicionados</div>
                    <div className="text-2xl font-bold text-status-passed">
                      +{comparison.diff.findings.added}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg border border-risk-critical/30 bg-risk-critical/5">
                    <div className="text-sm text-muted-foreground mb-1">Removidos</div>
                    <div className="text-2xl font-bold text-risk-critical">
                      -{comparison.diff.findings.removed}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg border border-muted">
                    <div className="text-sm text-muted-foreground mb-1">Modificados</div>
                    <div className="text-2xl font-bold">
                      {comparison.diff.findings.changed}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diff de Métricas */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Mudanças em Métricas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Dens. Vulnerabilidades</div>
                    <div className={cn(
                      'text-lg font-bold',
                      comparison.diff.metrics.security.vulnerabilityDensity <= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.metrics.security.vulnerabilityDensity >= 0 ? '+' : ''}
                      {comparison.diff.metrics.security.vulnerabilityDensity.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Complexidade</div>
                    <div className={cn(
                      'text-lg font-bold',
                      comparison.diff.metrics.quality.cyclomaticComplexity <= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.metrics.quality.cyclomaticComplexity >= 0 ? '+' : ''}
                      {comparison.diff.metrics.quality.cyclomaticComplexity.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Cobertura Testes</div>
                    <div className={cn(
                      'text-lg font-bold',
                      comparison.diff.metrics.robustness.testCoverage >= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.metrics.robustness.testCoverage >= 0 ? '+' : ''}
                      {comparison.diff.metrics.robustness.testCoverage.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-1">Débito Técnico</div>
                    <div className={cn(
                      'text-lg font-bold',
                      comparison.diff.metrics.evolution.technicalDebt <= 0 ? 'text-status-passed' : 'text-risk-critical'
                    )}>
                      {comparison.diff.metrics.evolution.technicalDebt >= 0 ? '+' : ''}
                      {comparison.diff.metrics.evolution.technicalDebt.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
