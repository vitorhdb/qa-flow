import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QualityGateProps {
  passed: boolean;
  riskScore: number;
  securityScore: number;
}

export function QualityGate({ passed, riskScore, securityScore }: QualityGateProps) {
  return (
    <div className={cn(
      'quality-gate animate-fade-in',
      passed ? 'quality-gate-passed' : 'quality-gate-failed'
    )}>
      {passed ? (
        <CheckCircle2 className="h-8 w-8 animate-pulse-glow" />
      ) : (
        <XCircle className="h-8 w-8 animate-pulse-glow" />
      )}
      <div className="flex flex-col">
        <span className="text-xl font-bold tracking-tight">
          {passed ? 'QUALITY GATE APROVADO' : 'QUALITY GATE REPROVADO'}
        </span>
        <span className="text-sm opacity-80">
          Risco: {riskScore}% | Segurança: {securityScore}%
        </span>
      </div>
    </div>
  );
}
