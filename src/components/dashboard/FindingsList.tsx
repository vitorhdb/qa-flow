import { useState } from 'react';
import { Finding } from '@/types/qa';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bug, ChevronDown, ChevronRight, Lightbulb, Shield, Target, TestTube, Sparkles, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FindingsListProps {
  findings: Finding[];
  /** Quando true, cada achado exibe aba "Detalhes" com campo testado, o que foi testado, melhoria e porquê */
  showDetailTabs?: boolean;
}

const typeIcons = {
  security: Shield,
  quality: Bug,
  improvement: Lightbulb,
};

const severityStyles = {
  critical: 'finding-critical',
  high: 'finding-high',
  medium: 'finding-medium',
  low: 'finding-low',
};

const typeLabels: Record<string, string> = {
  security: 'Segurança',
  quality: 'Qualidade',
  improvement: 'Melhoria',
};

const severityLabels: Record<string, string> = {
  critical: 'crítico',
  high: 'alto',
  medium: 'médio',
  low: 'baixo',
};

const whyBySeverity: Record<string, string> = {
  critical: 'Requer ação imediata: impacta diretamente segurança ou estabilidade do sistema.',
  high: 'Deve ser corrigido no próximo ciclo: risco relevante para produção.',
  medium: 'Planejar correção: afeta qualidade ou manutenibilidade.',
  low: 'Monitorar: melhoria recomendada, baixo impacto imediato.',
};

function FindingRow({
  finding,
  severityStyles,
  severityLabels,
  typeLabels,
}: {
  finding: Finding;
  severityStyles: Record<string, string>;
  severityLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const campoTestado = `${typeLabels[finding.type] || finding.type}${finding.line != null ? ` · Linha ${finding.line}` : ' · Código'}`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="p-4 hover:bg-secondary/20 transition-colors rounded-lg">
        <div className="flex items-start gap-3">
          <span className={cn('finding-badge mt-0.5 shrink-0', severityStyles[finding.severity])}>
            <AlertTriangle className="h-3 w-3" />
            {severityLabels[finding.severity] || finding.severity}
          </span>
          <div className="flex-1 space-y-1 min-w-0">
            <p className="font-medium">{finding.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
            {finding.line != null && (
              <p className="text-xs text-muted-foreground">
                Linha {finding.line}
                {finding.code && (
                  <code className="ml-2 rounded bg-secondary px-2 py-0.5 font-mono text-xs break-all">
                    {finding.code.length > 50 ? `${finding.code.substring(0, 50)}...` : finding.code}
                  </code>
                )}
              </p>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Detalhes
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <Card className="mt-4 border-primary/20 bg-muted/30 shadow-sm">
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBlock icon={Target} label="Campo testado" value={campoTestado} />
                <DetailBlock icon={TestTube} label="O que foi testado" value={finding.title} />
                <DetailBlock icon={Sparkles} label="Melhoria sugerida" value={finding.description} className="sm:col-span-2" />
                <DetailBlock
                  icon={Info}
                  label="Por que da melhoria"
                  value={whyBySeverity[finding.severity] || 'Melhoria recomendada para qualidade ou segurança.'}
                  className="sm:col-span-2"
                />
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DetailBlock({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg bg-background/60 p-3 border border-border/50', className)}>
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </p>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  );
}

export function FindingsList({ findings, showDetailTabs = false }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="glass-panel p-8 text-center animate-fade-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-passed/10">
          <Shield className="h-8 w-8 text-status-passed" />
        </div>
        <h3 className="text-lg font-semibold">Nenhum problema encontrado</h3>
        <p className="text-sm text-muted-foreground">Seu código parece limpo!</p>
      </div>
    );
  }

  const groupedFindings = findings.reduce((acc, finding) => {
    if (!acc[finding.type]) acc[finding.type] = [];
    acc[finding.type].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  return (
    <div className="space-y-4 animate-fade-in">
      {Object.entries(groupedFindings).map(([type, typeFindings]) => {
        const Icon = typeIcons[type as keyof typeof typeIcons];
        const typeLabel = typeLabels[type] || type;
        return (
          <div key={type} className="glass-panel overflow-hidden">
            <div className="border-b border-border bg-secondary/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium capitalize">{typeLabel}</h4>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {typeFindings.length}
                </span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {typeFindings.map((finding) =>
                showDetailTabs ? (
                  <FindingRow
                    key={finding.id}
                    finding={finding}
                    severityStyles={severityStyles}
                    severityLabels={severityLabels}
                    typeLabels={typeLabels}
                  />
                ) : (
                  <div key={finding.id} className="p-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={cn('finding-badge mt-0.5', severityStyles[finding.severity])}>
                        <AlertTriangle className="h-3 w-3" />
                        {severityLabels[finding.severity] || finding.severity}
                      </span>
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{finding.title}</p>
                        <p className="text-sm text-muted-foreground">{finding.description}</p>
                        {finding.line != null && (
                          <p className="text-xs text-muted-foreground">
                            Linha {finding.line}
                            {finding.code && (
                              <code className="ml-2 rounded bg-secondary px-2 py-0.5 font-mono text-xs">
                                {finding.code.length > 50 ? `${finding.code.substring(0, 50)}...` : finding.code}
                              </code>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
