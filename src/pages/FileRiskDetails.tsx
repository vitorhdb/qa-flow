import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FindingsList } from "@/components/dashboard/FindingsList";
import { CodeEditor } from "@/components/dashboard/CodeEditor";
import type { AnalysisResult, Finding } from "@/types/qa";
import type { RiskLevel } from "@/lib/risk-matrix";
import { mockFileContents } from "@/components/folder/mockData";

interface LocationState {
  item?: {
    filename: string;
    analysisResult: AnalysisResult;
    impact: RiskLevel;
    probability: RiskLevel;
  };
}

function levelText(label: string, level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    1: "Muito baixo",
    2: "Baixo",
    3: "Médio",
    4: "Alto",
    5: "Crítico",
  };
  return `${label}: ${level} (${map[level]})`;
}

export default function FileRiskDetails() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { item } = (state || {}) as LocationState;

  const [aiEnabled, setAiEnabled] = useState(false);
  const [tab, setTab] = useState<"motivos" | "codigo">("motivos");

  const data = useMemo(() => {
    if (!item) return null;
    const all = item.analysisResult.findings;
    const motivos = all.filter((f) => f.type !== "improvement");
    return { all, motivos };
  }, [item]);

  if (!item || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header aiEnabled={aiEnabled} onAiToggle={setAiEnabled} />
        <main className="container px-4 py-8">
          <div className="glass-panel p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">Nenhum arquivo selecionado</h2>
            <p className="text-sm text-muted-foreground">
              Volte ao mapa de calor e selecione um arquivo para ver os detalhes do risco.
            </p>
            <Button onClick={() => navigate("/")}>Voltar</Button>
          </div>
        </main>
      </div>
    );
  }

  // Obtém o código completo do arquivo analisado
  const code = item.analysisResult.code ?? mockFileContents[item.filename] ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Header aiEnabled={aiEnabled} onAiToggle={setAiEnabled} />

      <main className="container px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight">Risco do arquivo</h2>
            <p className="mt-1 font-mono text-sm truncate">{item.filename}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-secondary/50 px-2 py-1">
                {levelText("Impacto", item.impact)}
              </span>
              <span className="rounded bg-secondary/50 px-2 py-1">
                {levelText("Probabilidade", item.probability)}
              </span>
              <span className="rounded bg-secondary/50 px-2 py-1">
                Achados: {item.analysisResult.findings.length}
              </span>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </div>

        <div className="glass-panel p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="motivos">Motivos do risco ({data.motivos.length})</TabsTrigger>
              <TabsTrigger value="codigo">Código</TabsTrigger>
            </TabsList>

            <TabsContent value="motivos" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Aqui estão os achados que justificam o risco para o negócio (segurança e qualidade).
              </p>
              <FindingsList findings={data.motivos as Finding[]} />
            </TabsContent>

            <TabsContent value="codigo" className="mt-4">
              <CodeEditor 
                value={code} 
                onChange={() => {}} 
                className="pointer-events-none opacity-95"
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

