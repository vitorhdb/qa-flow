import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { FindingsList } from "@/components/dashboard/FindingsList";
import type { AnalysisResult, Finding } from "@/types/qa";
import type { RiskLevel } from "@/lib/risk-matrix";
import { exportSingleAnalysis } from "@/lib/export-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileCode, FileText, FileType } from "lucide-react";
import { toast } from "sonner";

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
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'html' | 'markdown' | 'txt') => {
    if (!item) return;
    try {
      setIsExporting(true);
      await exportSingleAnalysis(item.analysisResult, format, true);
      toast.success(`Relatório exportado em ${format.toUpperCase()} com sucesso!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao exportar';
      toast.error(`Erro ao exportar: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

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

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isExporting}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExport('pdf')} disabled={isExporting}>
                  <FileType className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('html')} disabled={isExporting}>
                  <FileCode className="h-4 w-4 mr-2" />
                  HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('markdown')} disabled={isExporting}>
                  <FileText className="h-4 w-4 mr-2" />
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('txt')} disabled={isExporting}>
                  <FileText className="h-4 w-4 mr-2" />
                  TXT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Voltar
            </Button>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-lg font-medium mb-3">Motivos do risco ({data.motivos.length})</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Aqui estão os achados que justificam o risco para o negócio (segurança e qualidade).
          </p>
          <FindingsList findings={data.motivos as Finding[]} showDetailTabs />
        </div>
      </main>
    </div>
  );
}

