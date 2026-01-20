/**
 * Melhorias no LLM para análises mais analíticas
 * Integração com APIs de LLM (OpenAI, Anthropic, etc.)
 */

import { Finding, AnalysisResult } from '@/types/qa';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model?: string;
  apiKey?: string;
  temperature?: number;
  enabled: boolean;
}

export interface EnhancedAnalysis {
  summary: string;
  criticalIssues: string[];
  recommendations: string[];
  riskAssessment: string;
  codeQualityInsights: string;
  securityInsights: string;
  improvementPlan: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.3,
  enabled: false,
};

/**
 * Gera análise aprimorada usando LLM
 */
export async function generateEnhancedAnalysis(
  result: AnalysisResult,
  code: string,
  config: Partial<LLMConfig> = {}
): Promise<EnhancedAnalysis> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled || !finalConfig.apiKey) {
    // Retorna análise básica sem LLM
    return generateBasicAnalysis(result);
  }

  try {
    if (finalConfig.provider === 'openai') {
      return await analyzeWithOpenAI(result, code, finalConfig);
    } else if (finalConfig.provider === 'anthropic') {
      return await analyzeWithAnthropic(result, code, finalConfig);
    }
  } catch (error) {
    console.error('Erro ao usar LLM, usando análise básica:', error);
    return generateBasicAnalysis(result);
  }

  return generateBasicAnalysis(result);
}

async function analyzeWithOpenAI(
  result: AnalysisResult,
  code: string,
  config: LLMConfig
): Promise<EnhancedAnalysis> {
  const apiKey = config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key não configurada');
  }

  const prompt = buildAnalysisPrompt(result, code);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de código e segurança. Forneça análises detalhadas e acionáveis.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature || 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  return parseLLMResponse(content, result);
}

async function analyzeWithAnthropic(
  result: AnalysisResult,
  code: string,
  config: LLMConfig
): Promise<EnhancedAnalysis> {
  const apiKey = config.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key não configurada');
  }

  const prompt = buildAnalysisPrompt(result, code);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-opus-20240229',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || '';

  return parseLLMResponse(content, result);
}

function buildAnalysisPrompt(result: AnalysisResult, code: string): string {
  return `Analise o seguinte código e os resultados da análise estática:

Código:
\`\`\`
${code.substring(0, 3000)}${code.length > 3000 ? '...' : ''}
\`\`\`

Resultados da Análise:
- Risco: ${result.scores.risk}%
- Qualidade: ${result.scores.quality}%
- Segurança: ${result.scores.security}%
- Melhorias sugeridas: ${result.scores.improvements}

Findings encontrados: ${result.findings.length}
${result.findings.slice(0, 10).map(f => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n')}

Forneça uma análise detalhada incluindo:
1. Resumo executivo
2. Problemas críticos identificados
3. Recomendações prioritárias
4. Avaliação de risco
5. Insights sobre qualidade do código
6. Insights sobre segurança
7. Plano de melhoria sugerido

Formate a resposta em JSON com as seguintes chaves:
{
  "summary": "...",
  "criticalIssues": ["...", "..."],
  "recommendations": ["...", "..."],
  "riskAssessment": "...",
  "codeQualityInsights": "...",
  "securityInsights": "...",
  "improvementPlan": "..."
}`;
}

function parseLLMResponse(content: string, result: AnalysisResult): EnhancedAnalysis {
  try {
    // Tenta extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || '',
        criticalIssues: Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        riskAssessment: parsed.riskAssessment || '',
        codeQualityInsights: parsed.codeQualityInsights || '',
        securityInsights: parsed.securityInsights || '',
        improvementPlan: parsed.improvementPlan || '',
      };
    }
  } catch (error) {
    console.warn('Erro ao parsear resposta do LLM:', error);
  }

  // Fallback para análise básica
  return generateBasicAnalysis(result);
}

function generateBasicAnalysis(result: AnalysisResult): EnhancedAnalysis {
  const criticalFindings = result.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  const securityFindings = result.findings.filter(f => f.type === 'security');

  return {
    summary: `Análise identificou ${result.findings.length} problemas. Score de risco: ${result.scores.risk}%, Segurança: ${result.scores.security}%, Qualidade: ${result.scores.quality}%.`,
    criticalIssues: criticalFindings.slice(0, 5).map(f => `${f.title}: ${f.description}`),
    recommendations: [
      result.scores.security < 70 && 'Corrija vulnerabilidades de segurança identificadas',
      result.scores.quality < 60 && 'Refatore código para melhorar qualidade',
      criticalFindings.length > 0 && 'Resolva todos os problemas críticos antes de fazer deploy',
      result.findings.filter(f => f.type === 'quality').length > 10 && 'Reduza code smells e duplicação',
    ].filter(Boolean) as string[],
    riskAssessment: result.scores.risk < 70 
      ? 'Risco elevado detectado. Recomenda-se correção antes de produção.'
      : 'Risco dentro de limites aceitáveis.',
    codeQualityInsights: `Complexidade e manutenibilidade podem ser melhoradas. ${result.scores.quality < 60 ? 'Considere refatoração.' : 'Código em bom estado.'}`,
    securityInsights: securityFindings.length > 0
      ? `${securityFindings.length} vulnerabilidades de segurança encontradas. Priorize correção.`
      : 'Nenhuma vulnerabilidade crítica detectada.',
    improvementPlan: `1. Corrigir ${criticalFindings.length} problemas críticos\n2. Melhorar segurança (score atual: ${result.scores.security}%)\n3. Refatorar para melhorar qualidade\n4. Implementar testes para aumentar cobertura`,
  };
}
