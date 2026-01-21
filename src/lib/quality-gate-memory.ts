/**
 * Quality Gate com Memória
 * Avalia não apenas o score atual, mas também tendências e regressões
 */

import type { Analysis, QualityGateStatus } from '@/types/history';
import { db } from './database';
import { compareWithPreviousAnalysis } from './history-comparison';

export interface QualityGateRule {
  name: string;
  description: string;
  check: (analysis: Analysis, previousAnalysis?: Analysis, comparison?: any) => boolean;
  reason?: string;
}

export interface QualityGateResult {
  status: QualityGateStatus;
  passed: boolean;
  reasons: string[];
  rules: {
    name: string;
    passed: boolean;
    reason?: string;
  }[];
  scores: {
    risk: number;
    quality: number;
    security: number;
  };
  trends: {
    riskTrend: 'improving' | 'stable' | 'degrading';
    qualityTrend: 'improving' | 'stable' | 'degrading';
    securityTrend: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * Configuração padrão do Quality Gate
 */
export interface QualityGateConfig {
  // Limites absolutos
  maxRiskScore: number;
  minQualityScore: number;
  minSecurityScore: number;
  
  // Limites de findings
  maxCriticalFindings: number;
  maxHighFindings: number;
  
  // Regras de regressão
  failOnRiskIncrease: boolean;
  riskIncreaseThreshold: number; // % de aumento que causa falha
  failOnNewCriticalFindings: boolean;
  failOnSecurityRegression: boolean;
  securityRegressionThreshold: number; // % de queda que causa falha
}

const DEFAULT_CONFIG: QualityGateConfig = {
  maxRiskScore: 70,
  minQualityScore: 60,
  minSecurityScore: 70,
  maxCriticalFindings: 0,
  maxHighFindings: 5,
  failOnRiskIncrease: true,
  riskIncreaseThreshold: 10, // 10% de aumento causa falha
  failOnNewCriticalFindings: true,
  securityRegressionThreshold: 5, // 5% de queda causa falha
  failOnSecurityRegression: true,
};

/**
 * Avalia Quality Gate com memória histórica
 */
export async function evaluateQualityGateWithMemory(
  analysis: Analysis,
  config: Partial<QualityGateConfig> = {}
): Promise<QualityGateResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Busca análise anterior para comparação
  const previousAnalyses = await db.getAnalysesHistory({
    projectId: analysis.projectId,
    branch: analysis.branch,
    limit: 2,
  });
  
  const previousAnalysis = previousAnalyses.length > 1 ? previousAnalyses[1] : undefined;
  const comparison = previousAnalysis 
    ? await compareWithPreviousAnalysis(analysis.id).catch(() => null)
    : null;
  
  const rules: QualityGateResult['rules'] = [];
  const reasons: string[] = [];
  let passed = true;
  
  // Regra 1: Score de risco máximo
  const riskRule = {
    name: 'Risco máximo',
    passed: analysis.riskScore <= finalConfig.maxRiskScore,
    reason: analysis.riskScore > finalConfig.maxRiskScore 
      ? `Risco muito alto: ${analysis.riskScore}% (máximo: ${finalConfig.maxRiskScore}%)`
      : undefined,
  };
  rules.push(riskRule);
  if (!riskRule.passed) {
    passed = false;
    reasons.push(riskRule.reason!);
  }
  
  // Regra 2: Score de qualidade mínimo
  const qualityRule = {
    name: 'Qualidade mínima',
    passed: analysis.qualityScore >= finalConfig.minQualityScore,
    reason: analysis.qualityScore < finalConfig.minQualityScore
      ? `Qualidade muito baixa: ${analysis.qualityScore}% (mínimo: ${finalConfig.minQualityScore}%)`
      : undefined,
  };
  rules.push(qualityRule);
  if (!qualityRule.passed) {
    passed = false;
    reasons.push(qualityRule.reason!);
  }
  
  // Regra 3: Score de segurança mínimo
  const securityRule = {
    name: 'Segurança mínima',
    passed: analysis.securityScore >= finalConfig.minSecurityScore,
    reason: analysis.securityScore < finalConfig.minSecurityScore
      ? `Segurança muito baixa: ${analysis.securityScore}% (mínimo: ${finalConfig.minSecurityScore}%)`
      : undefined,
  };
  rules.push(securityRule);
  if (!securityRule.passed) {
    passed = false;
    reasons.push(securityRule.reason!);
  }
  
  // Regra 4: Findings críticos
  const criticalRule = {
    name: 'Findings críticos',
    passed: (analysis.criticalFindings || 0) <= finalConfig.maxCriticalFindings,
    reason: (analysis.criticalFindings || 0) > finalConfig.maxCriticalFindings
      ? `${analysis.criticalFindings} findings críticos encontrados (máximo: ${finalConfig.maxCriticalFindings})`
      : undefined,
  };
  rules.push(criticalRule);
  if (!criticalRule.passed) {
    passed = false;
    reasons.push(criticalRule.reason!);
  }
  
  // Regra 5: Findings altos
  const highRule = {
    name: 'Findings altos',
    passed: (analysis.highFindings || 0) <= finalConfig.maxHighFindings,
    reason: (analysis.highFindings || 0) > finalConfig.maxHighFindings
      ? `${analysis.highFindings} findings altos encontrados (máximo: ${finalConfig.maxHighFindings})`
      : undefined,
  };
  rules.push(highRule);
  if (!highRule.passed) {
    passed = false;
    reasons.push(highRule.reason!);
  }
  
  // Regras de regressão (só se houver análise anterior)
  if (previousAnalysis && comparison) {
    // Regra 6: Aumento de risco
    if (finalConfig.failOnRiskIncrease) {
      const riskIncrease = comparison.riskScoreDelta;
      const riskIncreasePercent = previousAnalysis.riskScore > 0
        ? (riskIncrease / previousAnalysis.riskScore) * 100
        : 0;
      
      const riskIncreaseRule = {
        name: 'Regressão de risco',
        passed: riskIncreasePercent <= finalConfig.riskIncreaseThreshold,
        reason: riskIncreasePercent > finalConfig.riskIncreaseThreshold
          ? `Risco aumentou ${riskIncreasePercent.toFixed(1)}% em relação à análise anterior (limite: ${finalConfig.riskIncreaseThreshold}%)`
          : undefined,
      };
      rules.push(riskIncreaseRule);
      if (!riskIncreaseRule.passed) {
        passed = false;
        reasons.push(riskIncreaseRule.reason!);
      }
    }
    
    // Regra 7: Novos findings críticos
    if (finalConfig.failOnNewCriticalFindings) {
      const newCritical = comparison.newFindings.filter(f => f.severity === 'critical').length;
      const newCriticalRule = {
        name: 'Novos findings críticos',
        passed: newCritical === 0,
        reason: newCritical > 0
          ? `${newCritical} novos findings críticos introduzidos`
          : undefined,
      };
      rules.push(newCriticalRule);
      if (!newCriticalRule.passed) {
        passed = false;
        reasons.push(newCriticalRule.reason!);
      }
    }
    
    // Regra 8: Regressão de segurança
    if (finalConfig.failOnSecurityRegression) {
      const securityDecrease = -comparison.securityScoreDelta; // Negativo = queda
      const securityDecreasePercent = previousAnalysis.securityScore > 0
        ? (securityDecrease / previousAnalysis.securityScore) * 100
        : 0;
      
      const securityRegressionRule = {
        name: 'Regressão de segurança',
        passed: securityDecreasePercent <= finalConfig.securityRegressionThreshold,
        reason: securityDecreasePercent > finalConfig.securityRegressionThreshold
          ? `Segurança caiu ${securityDecreasePercent.toFixed(1)}% em relação à análise anterior (limite: ${finalConfig.securityRegressionThreshold}%)`
          : undefined,
      };
      rules.push(securityRegressionRule);
      if (!securityRegressionRule.passed) {
        passed = false;
        reasons.push(securityRegressionRule.reason!);
      }
    }
  }
  
  // Calcula tendências
  const calculateTrend = (current: number, previous?: number): 'improving' | 'stable' | 'degrading' => {
    if (!previous) return 'stable';
    const diff = current - previous;
    if (diff < -3) return 'improving';
    if (diff > 3) return 'degrading';
    return 'stable';
  };
  
  const trends = {
    riskTrend: calculateTrend(analysis.riskScore, previousAnalysis?.riskScore),
    qualityTrend: calculateTrend(analysis.qualityScore, previousAnalysis?.qualityScore),
    securityTrend: calculateTrend(analysis.securityScore, previousAnalysis?.securityScore),
  };
  
  return {
    status: passed ? 'PASS' : 'FAIL',
    passed,
    reasons,
    rules,
    scores: {
      risk: analysis.riskScore,
      quality: analysis.qualityScore,
      security: analysis.securityScore,
    },
    trends,
  };
}

/**
 * Converte AnalysisRecord antigo para nova estrutura Analysis
 */
export function convertToAnalysisHistory(
  record: any,
  projectId: string,
  mode: 'manual' | 'folder' | 'repo' | 'ci' = 'manual'
): Analysis {
  const findings = Array.isArray(record.findings) ? record.findings : [];
  const criticalCount = findings.filter((f: any) => f.severity === 'critical').length;
  const highCount = findings.filter((f: any) => f.severity === 'high').length;
  const mediumCount = findings.filter((f: any) => f.severity === 'medium').length;
  const lowCount = findings.filter((f: any) => f.severity === 'low').length;
  
  // Avalia Quality Gate básico
  const qualityGate: QualityGateStatus = 
    record.scores.risk <= 70 && 
    record.scores.security >= 70 && 
    criticalCount === 0 &&
    highCount <= 5
      ? 'PASS'
      : 'FAIL';
  
  return {
    id: record.id,
    projectId,
    timestamp: record.timestamp instanceof Date ? record.timestamp : new Date(record.timestamp),
    branch: record.branch,
    commitHash: record.commitHash,
    mode,
    riskScore: record.scores.risk,
    qualityScore: record.scores.quality,
    securityScore: record.scores.security,
    improvementScore: record.scores.improvements,
    qualityGate,
    fileCount: record.filename ? 1 : undefined,
    totalFindings: findings.length,
    criticalFindings: criticalCount,
    highFindings: highCount,
    mediumFindings: mediumCount,
    lowFindings: lowCount,
    metadata: record.metadata,
  };
}
