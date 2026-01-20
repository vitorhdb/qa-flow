import { Finding } from '@/types/qa';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bug, Lightbulb, Shield } from 'lucide-react';

interface FindingsListProps {
  findings: Finding[];
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

export function FindingsList({ findings }: FindingsListProps) {
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
              {typeFindings.map((finding) => (
                <div key={finding.id} className="p-4 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={cn('finding-badge mt-0.5', severityStyles[finding.severity])}>
                      <AlertTriangle className="h-3 w-3" />
                      {severityLabels[finding.severity] || finding.severity}
                    </span>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{finding.title}</p>
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                      {finding.line && (
                        <p className="text-xs text-muted-foreground">
                          Linha {finding.line}
                          {finding.code && (
                            <code className="ml-2 rounded bg-secondary px-2 py-0.5 font-mono text-xs">
                              {finding.code.substring(0, 50)}...
                            </code>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
