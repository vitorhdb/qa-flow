import type { AnalysisResult, Finding, Severity } from "@/types/qa";
import { calculateAdvancedMetrics, type AdvancedMetrics } from "./advanced-metrics";

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface FileRiskMatrixItem {
  filename: string;
  analysisResult: AnalysisResult;
  advancedMetrics: AdvancedMetrics;
  impact: RiskLevel; // Impacto no negócio (1-5)
  probability: RiskLevel; // Probabilidade (1-5)
}

const severityImpact: Record<Severity, RiskLevel> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

const severityProbability: Record<Severity, RiskLevel> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

function clampLevel(n: number): RiskLevel {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function maxSeverity(findings: Finding[]): Severity | null {
  if (!findings.length) return null;
  const order: Severity[] = ["critical", "high", "medium", "low"];
  for (const sev of order) {
    if (findings.some((f) => f.severity === sev)) return sev;
  }
  return "low";
}

/**
 * Impacto no negócio (1-5)
 * - Baseado nas métricas avançadas: Segurança (40%) + Qualidade (30%) + Robustez (20%) + Evolução (10%)
 * - Score baixo = impacto alto (inverso)
 */
export function computeBusinessImpact(
  result: AnalysisResult,
  metrics: AdvancedMetrics
): RiskLevel {
  // Score composto: quanto menor, maior o impacto
  // 0-20 = impacto 5 (crítico)
  // 21-40 = impacto 4 (alto)
  // 41-60 = impacto 3 (médio)
  // 61-80 = impacto 2 (baixo)
  // 81-100 = impacto 1 (muito baixo)
  
  const score = metrics.compositeScore;
  
  if (score <= 20) return 5;
  if (score <= 40) return 4;
  if (score <= 60) return 3;
  if (score <= 80) return 2;
  return 1;
}

/**
 * Probabilidade (1-5)
 * - Baseado na densidade de vulnerabilidades, complexidade e débito técnico
 * - Quanto mais problemas acumulados, maior a probabilidade de falha
 */
export function computeProbability(
  result: AnalysisResult,
  metrics: AdvancedMetrics
): RiskLevel {
  // Fatores que aumentam probabilidade:
  // - Alta densidade de vulnerabilidades
  // - Alta complexidade ciclomática
  // - Baixa cobertura de testes
  // - Muitos code smells
  
  let probability = 1;
  
  // Vulnerabilidades (peso alto)
  if (metrics.security.vulnerabilityDensity > 5) probability += 2;
  else if (metrics.security.vulnerabilityDensity > 2) probability += 1;
  
  // Complexidade
  if (metrics.quality.cyclomaticComplexity > 20) probability += 1;
  else if (metrics.quality.cyclomaticComplexity > 10) probability += 0.5;
  
  // Cobertura de testes (baixa = maior probabilidade)
  if (metrics.robustness.testCoverage < 20) probability += 1;
  else if (metrics.robustness.testCoverage < 50) probability += 0.5;
  
  // Code smells
  if (metrics.quality.codeSmells > 5) probability += 1;
  else if (metrics.quality.codeSmells > 2) probability += 0.5;
  
  // Débito técnico
  if (metrics.evolution.technicalDebt > 50) probability += 0.5;
  
  return clampLevel(Math.round(probability));
}

export function buildFileRiskMatrixItems(results: AnalysisResult[]): FileRiskMatrixItem[] {
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }
  
  return results
    .filter((r) => {
      // Validação: precisa ter filename e dados básicos
      if (!r || typeof r !== 'object') {
        console.warn('Resultado inválido (não é objeto):', r);
        return false;
      }
      if (!r.filename || typeof r.filename !== 'string') {
        console.warn('Resultado sem filename válido:', r);
        return false;
      }
      if (!r.scores || typeof r.scores !== 'object') {
        console.warn('Resultado sem scores válido:', r.filename);
        return false;
      }
      if (!r.findings || !Array.isArray(r.findings)) {
        console.warn('Resultado sem findings válido:', r.filename);
        return false;
      }
      return true;
    })
    .map((r) => {
      try {
        // Garante que code existe (pode ser string vazia se não estiver disponível)
        const code = (r.code && typeof r.code === 'string') ? r.code : '';
        const metrics = calculateAdvancedMetrics(r, code);
        
        // Valida que as métricas foram calculadas corretamente
        if (!metrics || typeof metrics !== 'object') {
          throw new Error('Métricas inválidas');
        }
        
        const impact = computeBusinessImpact(r, metrics);
        const probability = computeProbability(r, metrics);
        
        // Valida que impact e probability são válidos
        if (typeof impact !== 'number' || impact < 1 || impact > 5) {
          throw new Error(`Impact inválido: ${impact}`);
        }
        if (typeof probability !== 'number' || probability < 1 || probability > 5) {
          throw new Error(`Probability inválido: ${probability}`);
        }
        
        return {
          filename: r.filename!,
          analysisResult: r,
          advancedMetrics: metrics,
          impact: impact as RiskLevel,
          probability: probability as RiskLevel,
        };
      } catch (error) {
        console.error(`Erro ao processar arquivo ${r.filename || 'desconhecido'}:`, error);
        // Retorna valores padrão em caso de erro
        const defaultMetrics = {
          security: { vulnerabilityDensity: 0, weightedSeverity: 0, insecureFunctions: 0, hardcodedCredentials: 0, inputValidation: 0, score: 100 },
          quality: { cyclomaticComplexity: 0, maintainabilityIndex: 100, codeSmells: 0, codeDuplication: 0, commentRatio: 0, score: 100 },
          robustness: { testCoverage: 0, exceptionHandling: 0, loggingPoints: 0, globalDependencies: 0, score: 100 },
          evolution: { technicalDebt: 0, changeHotspots: 0, performanceIssues: 0, patternAdherence: 100, score: 100 },
          compositeScore: 100,
          riskLevel: 'low' as const,
        };
        
        return {
          filename: r.filename || 'arquivo-desconhecido',
          analysisResult: r,
          advancedMetrics: defaultMetrics,
          impact: 1 as RiskLevel,
          probability: 1 as RiskLevel,
        };
      }
    })
    .filter((item) => {
      // Validação final do item
      if (!item || typeof item !== 'object') return false;
      if (!item.filename || typeof item.filename !== 'string') return false;
      if (!item.analysisResult || typeof item.analysisResult !== 'object') return false;
      if (!item.advancedMetrics || typeof item.advancedMetrics !== 'object') return false;
      if (typeof item.impact !== 'number' || item.impact < 1 || item.impact > 5) return false;
      if (typeof item.probability !== 'number' || item.probability < 1 || item.probability > 5) return false;
      return true;
    });
}

