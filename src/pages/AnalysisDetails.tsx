import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { QualityGate } from "@/components/dashboard/QualityGate";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Zap, TrendingUp, FileDown, Sparkles, CheckCircle2, Clock } from "lucide-react";
import type { AnalysisResult, Finding } from "@/types/qa";
import { useMemo, useState } from "react";
import { exportSingleAnalysis } from "@/lib/export-history";
import { toast } from "sonner";

interface LocationState {
  analysisResult?: AnalysisResult | null;
  initialTab?: "risk" | "quality" | "security" | "improvements";
}

export default function AnalysisDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { analysisResult, initialTab = "risk" } = (state || {}) as LocationState;

  const [aiEnabled, setAiEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "risk" | "quality" | "security" | "improvements"
  >(initialTab);

  const handleExport = async (format: 'pdf' | 'html' | 'markdown' | 'txt') => {
    if (!analysisResult) return;
    
    try {
      setIsExporting(true);
      await exportSingleAnalysis(analysisResult, format, true);
      toast.success(`Análise exportada em ${format.toUpperCase()} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao exportar:', error);
      toast.error(`Erro ao exportar: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const scores = analysisResult?.scores ?? {
    risk: 0,
    quality: 0,
    security: 0,
    improvements: 0,
  };

  const groupedFindings = useMemo(() => {
    if (!analysisResult) return { risk: [], quality: [], security: [], improvements: [] } as Record<
      string,
      Finding[]
    >;

    const all = analysisResult.findings;

    return {
      risk: all, // riscos consideram todos os achados, priorizados por severidade
      quality: all.filter((f) => f.type === "quality"),
      security: all.filter((f) => f.type === "security"),
      improvements: all.filter((f) => f.type === "improvement"),
    } as Record<string, Finding[]>;
  }, [analysisResult]);

  if (!analysisResult) {
    return (
      <div className="min-h-screen bg-background">
        <Header aiEnabled={aiEnabled} onAiToggle={setAiEnabled} />
        <main className="container px-4 py-8">
          <div className="glass-panel p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">
              Nenhuma análise encontrada
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Para visualizar os detalhes, volte à tela inicial, cole um código
              e execute uma nova análise.
            </p>
            <Button onClick={() => navigate("/")}>Voltar para a análise</Button>
          </div>
        </main>
      </div>
    );
  }

  const totalFindings = analysisResult.findings.length;
  const actionable = (analysisResult as { actionable?: {
    resumoRapido: string;
    top3Problemas: Array<{ problema: string; impactoReal: string; acaoRecomendada: string; severity?: string }>;
    oQueFazerAgora: string[];
    oQuePodeEsperar: string[];
  } }).actionable;

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={aiEnabled} onAiToggle={setAiEnabled} />

      <main className="container px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Detalhes da análise
            </h2>
            <p className="text-sm text-muted-foreground">
              Arquivo:{" "}
              <span className="font-mono">
                {analysisResult.filename || "Análise manual"}
              </span>
              {" • "}
              Linguagem:{" "}
              <span className="font-mono">{analysisResult.language}</span>
              {" • "}
              {totalFindings} achados
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
                title="Exportar PDF"
              >
                <FileDown className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('html')}
                disabled={isExporting}
                title="Exportar HTML"
              >
                <FileDown className="h-4 w-4 mr-1" />
                HTML
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('markdown')}
                disabled={isExporting}
                title="Exportar Markdown"
              >
                <FileDown className="h-4 w-4 mr-1" />
                MD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('txt')}
                disabled={isExporting}
                title="Exportar TXT"
              >
                <FileDown className="h-4 w-4 mr-1" />
                TXT
              </Button>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar
            </Button>
          </div>
        </div>

        {/* Orientações da IA (formato acionável: resumo, top 3, o que fazer agora, o que pode esperar) */}
        {actionable && (
          <div className="glass-panel p-5 border-primary/20 border space-y-4">
            <h3 className="flex items-center gap-2 font-semibold text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Orientações da IA
            </h3>
            <p className="text-sm text-muted-foreground">{actionable.resumoRapido}</p>
            {actionable.top3Problemas && actionable.top3Problemas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Top 3 problemas</h4>
                <ul className="space-y-3">
                  {actionable.top3Problemas.map((p, i) => (
                    <li key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
                      <span className="font-medium">{p.problema}</span>
                      <p className="mt-1 text-muted-foreground"><span className="text-foreground">Impacto real:</span> {p.impactoReal}</p>
                      <p className="mt-1 text-muted-foreground"><span className="text-foreground">Ação recomendada:</span> {p.acaoRecomendada}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {actionable.oQueFazerAgora && actionable.oQueFazerAgora.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1">O que fazer agora</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                    {actionable.oQueFazerAgora.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {actionable.oQuePodeEsperar && actionable.oQuePodeEsperar.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1">O que pode esperar</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                    {actionable.oQuePodeEsperar.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resumo / Quality Gate */}
        <div className="glass-panel p-4">
          <div className="mb-4">
            <QualityGate
              passed={analysisResult.passed}
              riskScore={scores.risk}
              securityScore={scores.security}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Pontuação de Risco"
              value={scores.risk}
              subtitle="Nível geral de risco do código"
              icon={AlertTriangle}
              variant="risk"
              onClick={() => setActiveTab('risk')}
              isSelected={activeTab === 'risk'}
            />
            <MetricCard
              title="Pontuação de Qualidade"
              value={scores.quality}
              subtitle="Avaliação da qualidade do código"
              icon={TrendingUp}
              variant="quality"
              onClick={() => setActiveTab('quality')}
              isSelected={activeTab === 'quality'}
            />
            <MetricCard
              title="Pontuação de Segurança"
              value={scores.security}
              subtitle="Vulnerabilidades de segurança"
              icon={Shield}
              variant="security"
              onClick={() => setActiveTab('security')}
              isSelected={activeTab === 'security'}
            />
            <MetricCard
              title="Melhorias"
              value={scores.improvements}
              subtitle="Sugestões de melhoria"
              icon={Zap}
              variant="improvements"
              onClick={() => setActiveTab('improvements')}
              isSelected={activeTab === 'improvements'}
            />
          </div>
        </div>

        {/* Abas de detalhes */}
        <div className="glass-panel p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="risk">Riscos (tudo)</TabsTrigger>
                <TabsTrigger value="quality">
                  Qualidade ({groupedFindings.quality.length})
                </TabsTrigger>
                <TabsTrigger value="security">
                  Segurança ({groupedFindings.security.length})
                </TabsTrigger>
                <TabsTrigger value="improvements">
                  Melhorias ({groupedFindings.improvements.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="risk" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Lista completa de achados, priorizados por severidade, para
                você validar os riscos gerais do código.
              </p>
              <FindingsList findings={groupedFindings.risk} />
            </TabsContent>

            <TabsContent value="quality" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Problemas que afetam a legibilidade, manutenção e boas práticas
                de código.
              </p>
              <FindingsList findings={groupedFindings.quality} />
            </TabsContent>

            <TabsContent value="security" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Vulnerabilidades de segurança identificadas no código analisado.
              </p>
              <FindingsList findings={groupedFindings.security} />
            </TabsContent>

            <TabsContent value="improvements" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Sugestões de melhoria para evoluir a qualidade e a segurança do
                código.
              </p>
              <FindingsList findings={groupedFindings.improvements} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

