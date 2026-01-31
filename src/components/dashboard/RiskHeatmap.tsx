import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FileRiskMatrixItem, RiskLevel } from "@/lib/risk-matrix";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileCode, Shield, TrendingUp, ChevronRight, Info, AlertTriangle, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface RiskHeatmapProps {
  items: FileRiskMatrixItem[];
  onOpenFile?: (item: FileRiskMatrixItem) => void;
}

function getCellClass(impact: RiskLevel, probability: RiskLevel): string {
  // 5x5: canto superior direito é o mais crítico
  const score = impact * probability; // 1..25
  if (score <= 6) return "heatmap-low";
  if (score <= 12) return "heatmap-medium";
  if (score <= 18) return "heatmap-high";
  return "heatmap-critical";
}

function levelLabel(level: RiskLevel): string {
  return `Nível ${level}`;
}

export function RiskHeatmap({ items, onOpenFile }: RiskHeatmapProps) {
  const [open, setOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ impact: RiskLevel; probability: RiskLevel } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Validação inicial
  if (!items) {
    return (
      <div className="glass-panel p-6 animate-fade-in">
        <div className="text-center py-8">
          <p className="text-sm text-red-500">
            Erro: dados inválidos fornecidos ao heatmap
          </p>
        </div>
      </div>
    );
  }

  const byCell = useMemo(() => {
    const map = new Map<string, FileRiskMatrixItem[]>();
    
    if (!Array.isArray(items)) {
      console.warn('RiskHeatmap: items não é um array:', items);
      return map;
    }
    
    for (const item of items) {
      try {
        // Validação do item
        if (!item || typeof item !== 'object') {
          console.warn('RiskHeatmap: item inválido:', item);
          continue;
        }
        
        // Garante que impact e probability são números válidos (1-5)
        const impactRaw = item.impact;
        const probabilityRaw = item.probability;
        
        if (typeof impactRaw !== 'number' || isNaN(impactRaw)) {
          console.warn('RiskHeatmap: impact inválido:', impactRaw, 'para item:', item.filename);
          continue;
        }
        
        if (typeof probabilityRaw !== 'number' || isNaN(probabilityRaw)) {
          console.warn('RiskHeatmap: probability inválido:', probabilityRaw, 'para item:', item.filename);
          continue;
        }
        
        const impact = Math.max(1, Math.min(5, Math.round(impactRaw))) as RiskLevel;
        const probability = Math.max(1, Math.min(5, Math.round(probabilityRaw))) as RiskLevel;
        const key = `${impact}-${probability}`;
        const arr = map.get(key) || [];
        arr.push({ ...item, impact, probability });
        map.set(key, arr);
      } catch (error) {
        console.error('RiskHeatmap: erro ao processar item:', item, error);
        continue;
      }
    }
    return map;
  }, [items]);

  // Debug: log para verificar se há dados
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="glass-panel p-6 animate-fade-in">
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Nenhum arquivo analisado. Analise uma pasta ou código para visualizar o mapa de calor.
          </p>
        </div>
      </div>
    );
  }
  
  // Se houver erro, mostra mensagem
  if (error) {
    return (
      <div className="glass-panel p-6 animate-fade-in">
        <div className="text-center py-8">
          <p className="text-sm text-red-500 mb-2">Erro ao renderizar heatmap</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const selectedItems = useMemo(() => {
    try {
      if (!selectedCell) return [];
      const key = `${selectedCell.impact}-${selectedCell.probability}`;
      const items = byCell.get(key) || [];
      return Array.isArray(items) ? items : [];
    } catch (err) {
      console.error('Erro ao obter itens selecionados:', err);
      setError('Erro ao carregar arquivos da célula selecionada');
      return [];
    }
  }, [byCell, selectedCell]);

  return (
    <div className="glass-panel p-6 sm:p-8 animate-fade-in overflow-visible">
      {/* Cabeçalho com título e legenda informativa */}
      <div className="mb-6">
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight">Mapa de Calor: Impacto × Probabilidade</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Cada célula agrupa arquivos pela combinação <strong>Impacto no negócio</strong> (eixo vertical) e <strong>Probabilidade de ocorrência</strong> (eixo horizontal). 
          Quanto mais à direita e ao topo, maior o risco. Clique em uma célula para ver os arquivos.
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Legenda do risco:
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded heatmap-low shadow-sm" />
              <span className="text-muted-foreground">Baixo (1–6)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded heatmap-medium shadow-sm" />
              <span className="text-muted-foreground">Médio (7–12)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded heatmap-high shadow-sm" />
              <span className="text-muted-foreground">Alto (13–18)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded heatmap-critical shadow-sm" />
              <span className="text-muted-foreground">Crítico (19–25)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matriz 5x5 com eixos claros — sem scroll, mais área visível */}
      <div 
        className="grid gap-3 w-full max-w-4xl mx-auto overflow-visible"
        style={{ gridTemplateColumns: "auto repeat(5, minmax(0, 1fr))" }}
      >
        <div className="row-span-1" />
        <div className="col-span-5 flex justify-around pb-1 border-b border-border/50">
          {[1, 2, 3, 4, 5].map((p) => (
            <span key={p} className="text-xs font-medium text-muted-foreground w-10 text-center">
              Prob. {p}
            </span>
          ))}
        </div>

        {[5, 4, 3, 2, 1].map((impact) => (
          <div key={impact} className="contents">
            <div className="flex items-center justify-end pr-2 text-xs font-medium text-muted-foreground border-r border-border/50">
              Imp. {impact}
            </div>
            <div className="flex gap-2 col-span-5 py-0.5">
              {[1, 2, 3, 4, 5].map((probability) => {
                const key = `${impact}-${probability}`;
                const cellItems = byCell.get(key) || [];
                const isClickable = cellItems.length > 0;
                const riskScore = impact * probability;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => {
                      try {
                        setSelectedCell({ impact: impact as RiskLevel, probability: probability as RiskLevel });
                        setOpen(true);
                        setError(null);
                      } catch (err) {
                        console.error('Erro ao selecionar célula:', err);
                        setError('Erro ao abrir detalhes da célula');
                      }
                    }}
                    className={cn(
                      "heatmap-cell flex-1 min-w-0 aspect-square rounded-lg border-2 relative flex flex-col items-center justify-center transition-all duration-200",
                      getCellClass(impact as RiskLevel, probability as RiskLevel),
                      isClickable 
                        ? "cursor-pointer hover:scale-105 hover:shadow-lg hover:z-10 border-border/80" 
                        : "opacity-35 cursor-not-allowed border-transparent"
                    )}
                    aria-label={`Impacto ${impact}, Probabilidade ${probability}: ${cellItems.length} arquivo(s)`}
                  >
                    {cellItems.length > 0 ? (
                      <>
                        <span className="text-lg font-bold text-foreground drop-shadow-sm">
                          {cellItems.length}
                        </span>
                        <span className="text-[10px] font-medium text-foreground/90 mt-0.5">
                          arquivo{cellItems.length !== 1 ? "s" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl min-w-[320px] max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden sm:rounded-xl">
          {/* Cabeçalho do diálogo */}
          <div className="px-6 pr-12 pt-6 pb-4 shrink-0 border-b border-border/60 bg-muted/20">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <FileCode className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg font-semibold tracking-tight">
                    Arquivos nesta célula
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Impacto {selectedCell?.impact ?? "—"} × Probabilidade {selectedCell?.probability ?? "—"}
                  </p>
                </div>
                {selectedCell && (
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold",
                      getCellClass(selectedCell.impact, selectedCell.probability),
                      "text-foreground"
                    )}
                  >
                    Risco {(selectedCell.impact ?? 1) * (selectedCell.probability ?? 1)}
                  </span>
                )}
              </div>
            </DialogHeader>
            {selectedItems.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {selectedItems.length} arquivo(s) com essa combinação. Clique em um arquivo para abrir o relatório.
              </p>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4">
                <FolderOpen className="h-8 w-8" />
              </div>
              <h4 className="font-medium text-foreground mb-1">Nenhum arquivo nesta célula</h4>
              <p className="text-sm text-muted-foreground max-w-xs">
                Não há arquivos analisados com essa combinação de impacto e probabilidade.
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-6 py-4" style={{ maxHeight: "calc(88vh - 180px)" }}>
              <div className="space-y-2 pr-3">
                {selectedItems
                  .slice()
                  .filter((item): item is FileRiskMatrixItem => !!item?.filename && !!item?.analysisResult)
                  .sort((a, b) => {
                    const aLen = Array.isArray(a.analysisResult.findings) ? a.analysisResult.findings.length : 0;
                    const bLen = Array.isArray(b.analysisResult.findings) ? b.analysisResult.findings.length : 0;
                    return bLen - aLen;
                  })
                  .map((item, index) => {
                    const findingsLength = Array.isArray(item.analysisResult.findings) 
                      ? item.analysisResult.findings.length 
                      : 0;
                    const securityScore = item.advancedMetrics?.security?.score ?? item.analysisResult.scores?.security ?? 0;
                    const qualityScore = item.advancedMetrics?.quality?.score ?? item.analysisResult.scores?.quality ?? 0;
                    const compositeScore = item.advancedMetrics?.compositeScore ?? 0;
                    const riskScore = (item.impact || 1) * (item.probability || 1);
                    const isCritical = riskScore >= 16;
                    const isHigh = riskScore >= 9 && riskScore < 16;

                    return (
                      <button
                        key={item.filename}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onOpenFile?.(item);
                        }}
                        className={cn(
                          "group w-full rounded-xl border bg-card transition-all hover:shadow-md text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isCritical && "border-l-4 border-l-destructive border-border bg-destructive/5",
                          isHigh && !isCritical && "border-l-4 border-l-amber-500 border-border bg-amber-500/5",
                          !isCritical && !isHigh && "border-border"
                        )}
                      >
                        <div className="flex flex-wrap items-stretch gap-4 p-4 sm:flex-nowrap">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <FileCode className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 sm:min-w-[120px]">
                            <p className="font-mono text-sm font-medium text-foreground truncate" title={item.filename}>
                              {item.filename}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                              <span>{findingsLength} achados</span>
                              <Separator orientation="vertical" className="h-3" />
                              <span>Impacto {item.impact}</span>
                              <span>Prob. {item.probability}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                <Shield className="h-3 w-3" />
                                Segurança {securityScore}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                <TrendingUp className="h-3 w-3" />
                                Qualidade {qualityScore}
                              </span>
                              {compositeScore > 0 && (
                                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                  Score {compositeScore}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center text-muted-foreground group-hover:text-primary transition-colors self-center">
                            <ChevronRight className="h-5 w-5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
