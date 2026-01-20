/**
 * CI/CD Gate - Sistema de qualidade para builds
 * Integra com GitHub Actions, GitLab CI, Jenkins
 */

import { AnalysisResult } from '@/types/qa';

export interface CICDGateConfig {
  minRiskScore: number; // Score mínimo de risco (padrão: 70)
  minSecurityScore: number; // Score mínimo de segurança (padrão: 70)
  maxCriticalFindings: number; // Máximo de findings críticos permitidos (padrão: 0)
  maxHighFindings: number; // Máximo de findings altos permitidos (padrão: 5)
  blockOnFailure: boolean; // Bloquear merge/build se falhar (padrão: true)
}

export interface CICDGateResult {
  passed: boolean;
  reason?: string;
  scores: {
    risk: number;
    security: number;
    quality: number;
  };
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

const DEFAULT_CONFIG: CICDGateConfig = {
  minRiskScore: 70,
  minSecurityScore: 70,
  maxCriticalFindings: 0,
  maxHighFindings: 5,
  blockOnFailure: true,
};

export function evaluateCICDGate(
  result: AnalysisResult,
  config: Partial<CICDGateConfig> = {}
): CICDGateResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const recommendations: string[] = [];
  let passed = true;
  let reason: string | undefined;

  // Conta findings por severidade
  const findings = {
    critical: result.findings.filter(f => f.severity === 'critical').length,
    high: result.findings.filter(f => f.severity === 'high').length,
    medium: result.findings.filter(f => f.severity === 'medium').length,
    low: result.findings.filter(f => f.severity === 'low').length,
  };

  // Verifica scores
  if (result.scores.risk < finalConfig.minRiskScore) {
    passed = false;
    reason = `Risco muito alto: ${result.scores.risk}% (mínimo: ${finalConfig.minRiskScore}%)`;
    recommendations.push(`Reduza o risco do código para pelo menos ${finalConfig.minRiskScore}%`);
  }

  if (result.scores.security < finalConfig.minSecurityScore) {
    passed = false;
    reason = `Segurança muito baixa: ${result.scores.security}% (mínimo: ${finalConfig.minSecurityScore}%)`;
    recommendations.push(`Corrija vulnerabilidades de segurança para atingir ${finalConfig.minSecurityScore}%`);
  }

  // Verifica findings críticos
  if (findings.critical > finalConfig.maxCriticalFindings) {
    passed = false;
    reason = `${findings.critical} findings críticos encontrados (máximo: ${finalConfig.maxCriticalFindings})`;
    recommendations.push('Corrija todos os findings críticos antes de fazer merge');
  }

  // Verifica findings altos
  if (findings.high > finalConfig.maxHighFindings) {
    passed = false;
    reason = `${findings.high} findings altos encontrados (máximo: ${finalConfig.maxHighFindings})`;
    recommendations.push(`Reduza findings altos para no máximo ${finalConfig.maxHighFindings}`);
  }

  // Recomendações adicionais
  if (result.scores.quality < 60) {
    recommendations.push('Considere melhorar a qualidade do código (refatoração, code smells)');
  }

  if (findings.medium + findings.low > 20) {
    recommendations.push('Muitos findings de média/baixa severidade. Considere uma limpeza geral');
  }

  return {
    passed,
    reason,
    scores: {
      risk: result.scores.risk,
      security: result.scores.security,
      quality: result.scores.quality,
    },
    findings,
    recommendations,
  };
}

/**
 * Gera saída no formato para CI/CD
 */
export function formatCICDOutput(result: CICDGateResult): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    CI/CD QUALITY GATE                      ');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (result.reason) {
    lines.push(`Motivo: ${result.reason}`);
  }
  
  lines.push('');
  lines.push('Scores:');
  lines.push(`  Risco: ${result.scores.risk}%`);
  lines.push(`  Segurança: ${result.scores.security}%`);
  lines.push(`  Qualidade: ${result.scores.quality}%`);
  
  lines.push('');
  lines.push('Findings:');
  lines.push(`  Críticos: ${result.findings.critical}`);
  lines.push(`  Altos: ${result.findings.high}`);
  lines.push(`  Médios: ${result.findings.medium}`);
  lines.push(`  Baixos: ${result.findings.low}`);
  
  if (result.recommendations.length > 0) {
    lines.push('');
    lines.push('Recomendações:');
    result.recommendations.forEach(rec => lines.push(`  - ${rec}`));
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Gera JSON para integração com CI/CD
 */
export function formatCICDJSON(result: CICDGateResult): string {
  return JSON.stringify({
    passed: result.passed,
    reason: result.reason,
    scores: result.scores,
    findings: result.findings,
    recommendations: result.recommendations,
    timestamp: new Date().toISOString(),
  }, null, 2);
}
