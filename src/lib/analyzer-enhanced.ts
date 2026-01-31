/**
 * Analisador Aprimorado com Integração de IA
 * Integra análise estática com análise por IA da OpenAI
 */

import { analyzeCode, type AnalysisResult } from './analyzer';
import {
  analyzeCodeWithAI,
  getOpenAIConfig,
  type CodeImprovement,
  type AnalysisMetadata,
  type SystemType,
} from './openai-service';
import { Finding } from '@/types/qa';

export interface EnhancedAnalysisResult extends AnalysisResult {
  aiImprovements?: CodeImprovement[];
  aiSummary?: string;
  aiRecommendations?: string[];
  consolidatedFindings: Finding[];
  /** Resposta acionável da IA (resumo, top 3, o que fazer agora, o que pode esperar) */
  actionable?: {
    resumoRapido: string;
    top3Problemas: Array<{ problema: string; impactoReal: string; acaoRecomendada: string; severity?: string }>;
    oQueFazerAgora: string[];
    oQuePodeEsperar: string[];
  };
}

/**
 * Analisa código com análise estática + IA
 */
export async function analyzeCodeWithAIEnhanced(
  code: string,
  filename?: string
): Promise<EnhancedAnalysisResult> {
  // 1. Análise estática tradicional
  const staticAnalysis = analyzeCode(code, filename);

  // 2. Verifica se IA está configurada
  const aiConfig = getOpenAIConfig();
  if (!aiConfig || !aiConfig.apiKey) {
    // Retorna apenas análise estática se IA não estiver configurada
    return {
      ...staticAnalysis,
      consolidatedFindings: staticAnalysis.findings,
    };
  }

  try {
    // 3. Metadados para contextualizar a IA (menos genérico = melhor resposta)
    const metadata: AnalysisMetadata = {
      language: staticAnalysis.language,
      riskScore: staticAnalysis.scores.risk,
      qualityScore: staticAnalysis.scores.quality,
      securityScore: staticAnalysis.scores.security,
      systemType: inferSystemType(staticAnalysis.language, filename),
      isLegacy: false,
    };

    // 4. IA age só sobre achados já detectados (nunca descobre problemas)
    const aiAnalysis = await analyzeCodeWithAI({
      code,
      language: staticAnalysis.language,
      filename,
      qaFindings: staticAnalysis.findings.map((f) => ({
        severity: f.severity,
        title: f.title,
        description: f.description,
        line: f.line,
      })),
      metadata,
    });

    // 5. Converte melhorias da IA em Findings
    const aiFindings: Finding[] = aiAnalysis.improvements.map((imp) => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: imp.type === 'security' ? 'security' : imp.type === 'performance' ? 'quality' : 'improvement',
      severity: imp.severity,
      title: imp.title,
      description: `${imp.description}\n\n${imp.explanation}\n\nImpacto: ${imp.impact}`,
      line: imp.line,
      code: imp.currentCode,
    }));

    // 5. Consolida findings estáticos com findings da IA
    // Prioriza findings críticos e remove duplicatas
    const consolidatedFindings = consolidateFindings(staticAnalysis.findings, aiFindings);

    // 6. Recalcula scores considerando findings consolidados
    const scores = recalculateScores(consolidatedFindings, aiAnalysis);

    return {
      ...staticAnalysis,
      scores,
      aiImprovements: aiAnalysis.improvements,
      aiSummary: aiAnalysis.summary,
      aiRecommendations: aiAnalysis.recommendations,
      consolidatedFindings,
      findings: consolidatedFindings,
      actionable: aiAnalysis.actionable,
    };
  } catch (error: any) {
    console.warn('Erro ao analisar com IA, usando apenas análise estática:', error);
    // Em caso de erro, retorna apenas análise estática
    return {
      ...staticAnalysis,
      consolidatedFindings: staticAnalysis.findings,
    };
  }
}

/**
 * Infere tipo de sistema a partir da linguagem/arquivo (contextualiza a IA)
 */
function inferSystemType(language: string, filename?: string): SystemType {
  const lang = language.toLowerCase();
  const path = (filename || '').toLowerCase();
  if (lang.includes('delphi') || path.includes('.pas') || path.includes('.dpr')) return 'delphi-monolitico';
  if (lang.includes('sql') || path.includes('.sql')) return 'sql-heavy';
  if (lang === 'api' || path.includes('/api/') || path.includes('api.')) return 'api-publica';
  if (lang.includes('java') && (path.includes('service') || path.includes('backend'))) return 'backend-critico';
  return 'generico';
}

/**
 * Consolida findings estáticos com findings da IA
 * Remove duplicatas e prioriza findings críticos
 */
function consolidateFindings(
  staticFindings: Finding[],
  aiFindings: Finding[]
): Finding[] {
  const consolidated: Finding[] = [...staticFindings];
  const seen = new Set<string>();

  // Marca findings estáticos como vistos
  staticFindings.forEach(f => {
    const key = `${f.type}-${f.line}-${f.title}`;
    seen.add(key);
  });

  // Adiciona findings da IA que não são duplicatas
  aiFindings.forEach(f => {
    const key = `${f.type}-${f.line}-${f.title}`;
    if (!seen.has(key)) {
      consolidated.push(f);
      seen.add(key);
    }
  });

  // Ordena por severidade
  return consolidated.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Recalcula scores considerando análise da IA
 */
function recalculateScores(
  findings: Finding[],
  aiAnalysis: { riskScore: number; qualityScore: number }
): AnalysisResult['scores'] {
  // Calcula scores baseados em findings
  let riskScore = 100;
  let qualityScore = 100;
  let securityScore = 100;

  const severityWeights = {
    critical: { risk: 25, quality: 15, security: 30 },
    high: { risk: 15, quality: 10, security: 20 },
    medium: { risk: 8, quality: 8, security: 10 },
    low: { risk: 3, quality: 5, security: 5 },
  };

  findings.forEach(finding => {
    const weight = severityWeights[finding.severity];
    riskScore -= weight.risk;

    if (finding.type === 'security') {
      securityScore -= weight.security;
    } else if (finding.type === 'quality') {
      qualityScore -= weight.quality;
    }
  });

  // Ajusta scores com base na análise da IA (média ponderada)
  const finalRiskScore = Math.round((riskScore * 0.6 + aiAnalysis.riskScore * 0.4));
  const finalQualityScore = Math.round((qualityScore * 0.6 + aiAnalysis.qualityScore * 0.4));

  const improvementsCount = findings.filter(f => f.type === 'improvement').length;

  return {
    risk: Math.max(0, Math.min(100, finalRiskScore)),
    quality: Math.max(0, Math.min(100, finalQualityScore)),
    security: Math.max(0, Math.min(100, securityScore)),
    improvements: improvementsCount,
  };
}
