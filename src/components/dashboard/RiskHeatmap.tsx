import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FileRiskMatrixItem, RiskLevel } from "@/lib/risk-matrix";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    <div className="glass-panel p-6 animate-fade-in">
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Mapa de Calor: Impacto x Probabilidade</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Matriz 5x5 para priorização de risco por arquivo (impacto no negócio vs probabilidade)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded heatmap-low" />
            <span className="text-muted-foreground">Baixo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded heatmap-medium" />
            <span className="text-muted-foreground">Médio</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded heatmap-high" />
            <span className="text-muted-foreground">Alto</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded heatmap-critical" />
            <span className="text-muted-foreground">Crítico</span>
          </div>
        </div>
      </div>

      {/* Matriz 5x5: linhas = impacto (5 no topo), colunas = probabilidade (1..5) */}
      <div className="grid gap-1 sm:gap-2 overflow-x-auto" style={{ gridTemplateColumns: "auto repeat(5, minmax(60px, 1fr))" }}>
        <div />
        {[1, 2, 3, 4, 5].map((p) => (
          <div key={p} className="text-center text-xs text-muted-foreground">
            Prob. {p}
          </div>
        ))}

        {[5, 4, 3, 2, 1].map((impact) => (
          <div key={impact} className="contents">
            <div className="flex items-center justify-center text-xs text-muted-foreground pr-2">
              Impacto {impact}
            </div>
            {[1, 2, 3, 4, 5].map((probability) => {
              const key = `${impact}-${probability}`;
              const cellItems = byCell.get(key) || [];
              const isClickable = cellItems.length > 0;

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
                    "heatmap-cell aspect-square rounded-md border border-border/60 relative",
                    getCellClass(impact as RiskLevel, probability as RiskLevel),
                    isClickable ? "cursor-pointer hover:opacity-90" : "opacity-40 cursor-not-allowed"
                  )}
                  aria-label={`Impacto ${impact}, Probabilidade ${probability}, ${cellItems.length} arquivos`}
                >
                  {cellItems.length > 0 && (
                    <span className="absolute right-1 top-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground">
                      {cellItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Arquivos em risco — Impacto {selectedCell ? levelLabel(selectedCell.impact) : ""} • Probabilidade{" "}
              {selectedCell ? levelLabel(selectedCell.probability) : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum arquivo nesta célula.</div>
          ) : (
            <div className="space-y-2">
              {selectedItems
                .slice()
                .filter(item => item && item.filename && item.analysisResult)
                .sort((a, b) => {
                  try {
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
                    const securityScore = item.advancedMetrics?.security?.score ?? 0;
                    const qualityScore = item.advancedMetrics?.quality?.score ?? 0;
                    const robustnessScore = item.advancedMetrics?.robustness?.score ?? 0;
                    const compositeScore = item.advancedMetrics?.compositeScore ?? 0;
                    
                    return (
                      <div key={item.filename} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-sm truncate font-medium">{item.filename}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {findingsLength} achados • Impacto {item.impact} • Prob. {item.probability}
                          </div>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-red-500">Segurança: {securityScore}</span>
                            <span className="text-blue-500">Qualidade: {qualityScore}</span>
                            <span className="text-green-500">Robustez: {robustnessScore}</span>
                            <span className="text-purple-500">Score: {compositeScore}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOpen(false);
                            onOpenFile?.(item);
                          }}
                        >
                          Ver detalhes
                        </Button>
                      </div>
                    );
                  } catch (err) {
                    console.error('Erro ao renderizar item:', item, err);
                    return null;
                  }
                })
                .filter(item => item !== null)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
