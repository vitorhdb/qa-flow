import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { QualityGate } from "@/components/dashboard/QualityGate";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Zap, TrendingUp } from "lucide-react";
import type { AnalysisResult, Finding } from "@/types/qa";
import { useMemo, useState } from "react";

interface LocationState {
  analysisResult?: AnalysisResult | null;
  initialTab?: "risk" | "quality" | "security" | "improvements";
}

export default function AnalysisDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { analysisResult, initialTab = "risk" } = (state || {}) as LocationState;

  const [aiEnabled, setAiEnabled] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "risk" | "quality" | "security" | "improvements"
  >(initialTab);

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

          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar
          </Button>
        </div>

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

