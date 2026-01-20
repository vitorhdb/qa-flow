/**
 * Comparador de versões de sistemas
 * Compara análises entre diferentes commits/branches
 */

import { AnalysisResult } from '@/types/qa';
import { calculateAdvancedMetrics, type AdvancedMetrics } from './advanced-metrics';

export interface VersionComparison {
  baseVersion: AnalysisResult;
  targetVersion: AnalysisResult;
  baseMetrics: AdvancedMetrics;
  targetMetrics: AdvancedMetrics;
  diff: ComparisonDiff;
}

export interface ComparisonDiff {
  scores: {
    risk: number;
    quality: number;
    security: number;
    improvements: number;
  };
  findings: {
    added: number;
    removed: number;
    changed: number;
  };
  metrics: {
    security: {
      vulnerabilityDensity: number;
      weightedSeverity: number;
    };
    quality: {
      cyclomaticComplexity: number;
      maintainabilityIndex: number;
    };
    robustness: {
      testCoverage: number;
      exceptionHandling: number;
    };
    evolution: {
      technicalDebt: number;
      performanceIssues: number;
    };
  };
  trend: 'improved' | 'degraded' | 'stable';
}

export function compareVersions(
  base: AnalysisResult,
  target: AnalysisResult
): VersionComparison {
  const baseMetrics = calculateAdvancedMetrics(base, base.code);
  const targetMetrics = calculateAdvancedMetrics(target, target.code);

  // Diff de scores
  const scoreDiff = {
    risk: target.scores.risk - base.scores.risk,
    quality: target.scores.quality - base.scores.quality,
    security: target.scores.security - base.scores.security,
    improvements: target.scores.improvements - base.scores.improvements,
  };

  // Diff de findings
  const baseFindingIds = new Set(base.findings.map(f => f.id));
  const targetFindingIds = new Set(target.findings.map(f => f.id));
  
  const added = target.findings.filter(f => !baseFindingIds.has(f.id)).length;
  const removed = base.findings.filter(f => !targetFindingIds.has(f.id)).length;
  const changed = base.findings.filter(f => {
    const targetFinding = target.findings.find(tf => tf.id === f.id);
    return targetFinding && (
      targetFinding.severity !== f.severity ||
      targetFinding.title !== f.title
    );
  }).length;

  // Diff de métricas
  const metricsDiff = {
    security: {
      vulnerabilityDensity: targetMetrics.security.vulnerabilityDensity - baseMetrics.security.vulnerabilityDensity,
      weightedSeverity: targetMetrics.security.weightedSeverity - baseMetrics.security.weightedSeverity,
    },
    quality: {
      cyclomaticComplexity: targetMetrics.quality.cyclomaticComplexity - baseMetrics.quality.cyclomaticComplexity,
      maintainabilityIndex: targetMetrics.quality.maintainabilityIndex - baseMetrics.quality.maintainabilityIndex,
    },
    robustness: {
      testCoverage: targetMetrics.robustness.testCoverage - baseMetrics.robustness.testCoverage,
      exceptionHandling: targetMetrics.robustness.exceptionHandling - baseMetrics.robustness.exceptionHandling,
    },
    evolution: {
      technicalDebt: targetMetrics.evolution.technicalDebt - baseMetrics.evolution.technicalDebt,
      performanceIssues: targetMetrics.evolution.performanceIssues - baseMetrics.evolution.performanceIssues,
    },
  };

  // Determina tendência geral
  const improvements = 
    (scoreDiff.risk > 0 ? 1 : 0) +
    (scoreDiff.quality > 0 ? 1 : 0) +
    (scoreDiff.security > 0 ? 1 : 0) +
    (added < removed ? 1 : 0);
  
  const degradations = 
    (scoreDiff.risk < 0 ? 1 : 0) +
    (scoreDiff.quality < 0 ? 1 : 0) +
    (scoreDiff.security < 0 ? 1 : 0) +
    (added > removed ? 1 : 0);

  let trend: 'improved' | 'degraded' | 'stable' = 'stable';
  if (improvements > degradations) trend = 'improved';
  else if (degradations > improvements) trend = 'degraded';

  const diff: ComparisonDiff = {
    scores: scoreDiff,
    findings: { added, removed, changed },
    metrics: metricsDiff,
    trend,
  };

  return {
    baseVersion: base,
    targetVersion: target,
    baseMetrics,
    targetMetrics,
    diff,
  };
}

export function formatComparisonDiff(diff: ComparisonDiff): string {
  const lines: string[] = [];
  
  lines.push('=== Comparação de Versões ===\n');
  
  lines.push('📊 Scores:');
  lines.push(`  Risco: ${diff.scores.risk >= 0 ? '+' : ''}${diff.scores.risk.toFixed(1)}%`);
  lines.push(`  Qualidade: ${diff.scores.quality >= 0 ? '+' : ''}${diff.scores.quality.toFixed(1)}%`);
  lines.push(`  Segurança: ${diff.scores.security >= 0 ? '+' : ''}${diff.scores.security.toFixed(1)}%`);
  lines.push(`  Melhorias: ${diff.scores.improvements >= 0 ? '+' : ''}${diff.scores.improvements}`);
  
  lines.push('\n🔍 Findings:');
  lines.push(`  Adicionados: ${diff.findings.added}`);
  lines.push(`  Removidos: ${diff.findings.removed}`);
  lines.push(`  Modificados: ${diff.findings.changed}`);
  
  lines.push('\n📈 Métricas:');
  lines.push(`  Densidade de Vulnerabilidades: ${diff.metrics.security.vulnerabilityDensity >= 0 ? '+' : ''}${diff.metrics.security.vulnerabilityDensity.toFixed(2)}`);
  lines.push(`  Complexidade Ciclomática: ${diff.metrics.quality.cyclomaticComplexity >= 0 ? '+' : ''}${diff.metrics.quality.cyclomaticComplexity.toFixed(1)}`);
  lines.push(`  Cobertura de Testes: ${diff.metrics.robustness.testCoverage >= 0 ? '+' : ''}${diff.metrics.robustness.testCoverage.toFixed(1)}%`);
  
  lines.push(`\n🎯 Tendência: ${diff.trend === 'improved' ? '✅ Melhorou' : diff.trend === 'degraded' ? '❌ Degradou' : '➡️ Estável'}`);
  
  return lines.join('\n');
}
