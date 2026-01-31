/**
 * Serviço de Integração com OpenAI
 * Centraliza todas as interações com a API da OpenAI
 * Regra: a IA nunca descobre problemas — ela age sobre problemas já detectados.
 */

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Tipo de sistema para contextualizar a IA (menos genérico = melhor resposta) */
export type SystemType =
  | 'sistema-legado'
  | 'backend-critico'
  | 'sql-heavy'
  | 'delphi-monolitico'
  | 'api-publica'
  | 'generico';

/** Metadados da análise para a IA (contexto = resposta menos genérica) */
export interface AnalysisMetadata {
  language: string;
  riskScore: number;
  qualityScore?: number;
  securityScore?: number;
  systemType?: SystemType;
  isLegacy?: boolean;
}

/** Mapa fixo severidade → o que a IA deve recomendar (evita "tudo é importante") */
export const SEVERITY_ACTION_MAP: Record<string, string> = {
  critical: 'Ação imediata',
  high: 'Corrigir no próximo ciclo',
  medium: 'Planejar',
  low: 'Monitorar',
};

export interface CodeAnalysisRequest {
  code: string;
  language: string;
  filename?: string;
  context?: string;
  /** Achados já detectados pelo sistema — a IA só orienta, não descobre */
  qaFindings?: Array<{ severity: string; title: string; description?: string; line?: number }>;
  metadata?: AnalysisMetadata;
}

export interface CodeImprovement {
  type: 'security' | 'quality' | 'performance' | 'maintainability' | 'best-practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentCode?: string;
  suggestedCode?: string;
  line?: number;
  explanation: string;
  impact: string;
}

/** Resposta estruturada acionável (anti-enrolação) */
export interface ActionableResponse {
  resumoRapido: string;
  top3Problemas: Array<{
    problema: string;
    impactoReal: string;
    acaoRecomendada: string;
    severity?: string;
  }>;
  oQueFazerAgora: string[];
  oQuePodeEsperar: string[];
}

export interface AIAnalysisResult {
  improvements: CodeImprovement[];
  summary: string;
  riskScore: number;
  qualityScore: number;
  recommendations: string[];
  consolidatedFindings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Resposta no formato fixo para QA (resumo, top 3, ações, o que pode esperar) */
  actionable?: ActionableResponse;
}

/**
 * Obtém configuração da OpenAI do localStorage ou env
 */
export function getOpenAIConfig(): OpenAIConfig | null {
  const saved = localStorage.getItem('openai_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 4000,
    };
  }
  
  return null;
}

/**
 * Salva configuração da OpenAI
 */
export function saveOpenAIConfig(config: OpenAIConfig): void {
  localStorage.setItem('openai_config', JSON.stringify(config));
}

/** Limite máximo de linhas na resposta da IA (prolixo = ruim para QA) */
const MAX_RESPONSE_LINES = 20;
const MAX_TOKENS_ORIENTATION = 1800;

/**
 * Analisa código usando OpenAI: a IA NUNCA descobre problemas, só orienta sobre achados já detectados.
 * Resposta acionável: o que está errado, por que importa, o que fazer agora, o que pode esperar.
 */
export async function analyzeCodeWithAI(
  request: CodeAnalysisRequest,
  qaFindings?: any[]
): Promise<AIAnalysisResult> {
  const config = getOpenAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('OpenAI API key não configurada. Configure em Configurações.');
  }

  const findings = request.qaFindings ?? qaFindings ?? [];
  const hasFindings = Array.isArray(findings) && findings.length > 0;
  const meta = request.metadata;

  const languageContext = getLanguageContext(request.language);
  const systemTypeContext = meta ? getSystemTypeContext(meta.systemType, meta.isLegacy) : '';
  const severityMapText = Object.entries(SEVERITY_ACTION_MAP)
    .map(([s, a]) => `${s}: ${a}`)
    .join('; ');

  const systemPrompt = `Você é um QA sênior. Regras obrigatórias:
- NUNCA descubra ou invente problemas. Você só age sobre os achados que já foram listados.
- Para cada problema: diga o que está errado, por que importa, o que fazer agora (ação concreta).
- Respeite o mapa de severidade: ${severityMapText}.
- Use linguagem simples e direta. Sem enrolação. Resposta em no máximo ${MAX_RESPONSE_LINES} linhas de conteúdo.
- Responda APENAS em JSON válido, no formato exato solicitado.`;

  let userPrompt: string;

  if (hasFindings) {
    const findingsText = findings
      .slice(0, 30)
      .map((f: any) => `- [${f.severity}] ${f.title}${f.description ? `: ${String(f.description).slice(0, 200)}` : ''}`)
      .join('\n');
    const codeSnippet = request.code.length > 2500 ? request.code.slice(0, 2500) + '\n// ... (truncado)' : request.code;

    userPrompt = `Com base no relatório abaixo, NÃO repita o relatório. Foque apenas nos 3 problemas mais críticos.
Para cada um: impacto real (por que isso importa) e ação concreta (o que fazer agora).
${meta ? `Contexto: linguagem ${request.language}, score de risco ${meta.riskScore}${meta.systemType ? `, tipo ${meta.systemType}` : ''}${meta.isLegacy ? ', sistema legado' : ''}.` : ''}

Achados já detectados pelo sistema:
${findingsText}

${languageContext}
${systemTypeContext}

Código (referência):
\`\`\`
${codeSnippet}
\`\`\`

Retorne JSON válido neste formato exato:
{
  "summary": "Resumo em no máximo 2 frases. Situação geral.",
  "actionable": {
    "resumoRapido": "Mesmo resumo em 2 frases.",
    "top3Problemas": [
      { "problema": "título do problema", "impactoReal": "por que importa", "acaoRecomendada": "ação concreta", "severity": "critical" },
      { "problema": "...", "impactoReal": "...", "acaoRecomendada": "...", "severity": "high" },
      { "problema": "...", "impactoReal": "...", "acaoRecomendada": "...", "severity": "..." }
    ],
    "oQueFazerAgora": ["Passo 1 concretico", "Passo 2"],
    "oQuePodeEsperar": ["Item de baixa urgência 1", "Item 2"]
  },
  "improvements": [
    { "type": "security ou quality", "severity": "critical", "title": "título", "description": "breve", "explanation": "impacto real", "impact": "ação recomendada", "line": null }
  ],
  "riskScore": ${meta?.riskScore ?? 50},
  "qualityScore": ${meta?.qualityScore ?? 50},
  "recommendations": ["Máximo 3 recomendações curtas"],
  "consolidatedFindings": { "critical": 0, "high": 0, "medium": 0, "low": 0 }
}
Preencha consolidatedFindings com a contagem real por severidade dos achados listados. improvements: apenas os 3 mais críticos, com explanation = impacto real e impact = ação recomendada.`;
  } else {
    // Sem achados: só síntese em 2 frases, sem inventar problemas
    userPrompt = `Código ${request.language}${request.filename ? ` (${request.filename})` : ''}. Nenhum achado crítico foi detectado pelo sistema.
Gere apenas um resumo em 2 frases sobre o estado geral do código. Não invente problemas.
Retorne JSON: { "summary": "2 frases", "improvements": [], "riskScore": ${meta?.riskScore ?? 50}, "qualityScore": ${meta?.qualityScore ?? 50}, "recommendations": [], "consolidatedFindings": { "critical": 0, "high": 0, "medium": 0, "low": 0 } }`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature ?? 0.2,
        max_tokens: hasFindings ? Math.min(MAX_TOKENS_ORIENTATION, config.maxTokens || 4000) : 400,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da OpenAI');
    }

    let result: AIAnalysisResult;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      else throw new Error('Resposta da OpenAI não contém JSON válido');
    }

    return normalizeAIAnalysisResult(result, meta);
  } catch (error: any) {
    console.error('Erro ao analisar código com OpenAI:', error);
    throw new Error(`Erro na análise por IA: ${error.message}`);
  }
}

/** Limite de linhas para relatório executivo (menos é mais) */
const MAX_REPORT_LINES = 25;
const MAX_TOKENS_REPORT = 1200;

/**
 * Gera relatório consolidado usando IA em duas fases:
 * Fase 1 — Síntese: até 5 achados relevantes.
 * Fase 2 — Orientação: para os 3 mais críticos, ações práticas.
 * Formato fixo: RESUMO RÁPIDO, TOP 3 PROBLEMAS, O QUE FAZER AGORA, O QUE PODE ESPERAR.
 */
export async function generateReportWithAI(
  analyses: any[],
  projectName?: string,
  options?: { systemType?: SystemType; isLegacy?: boolean }
): Promise<string> {
  const config = getOpenAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('OpenAI API key não configurada');
  }

  const allFindings = analyses.flatMap((a) => (a.findings || []).map((f: any) => ({ ...f, file: a.filename })));
  const findingsSummary = allFindings
    .slice(0, 40)
    .map((f: any) => `- [${f.severity}] ${f.title} (${f.file || 'N/A'})`)
    .join('\n');
  const metrics = analyses.reduce(
    (acc, a) => ({
      risk: acc.risk + (a.scores?.risk ?? 0),
      quality: acc.quality + (a.scores?.quality ?? 0),
      security: acc.security + (a.scores?.security ?? 0),
      count: acc.count + 1,
    }),
    { risk: 0, quality: 0, security: 0, count: 0 }
  );
  const avgRisk = metrics.count ? Math.round(metrics.risk / metrics.count) : 0;
  const systemTypeContext = options?.systemType
    ? getSystemTypeContext(options.systemType, options.isLegacy)
    : '';

  const systemPrompt = `Você é um QA sênior. Regras:
- NÃO repita o relatório. Foque apenas nos 3 problemas mais críticos.
- Para cada problema: impacto real e ação concreta. Linguagem simples e direta.
- Resposta em no máximo ${MAX_REPORT_LINES} linhas.
- Use o formato exato: RESUMO RÁPIDO, TOP 3 PROBLEMAS, O QUE FAZER AGORA, O QUE PODE ESPERAR.`;

  const userPrompt = `Relatório de análise para ${projectName || 'o projeto'}:
Métricas médias: Risco ${avgRisk}%, ${metrics.count} arquivo(s) analisado(s).
Achados já detectados (não descubra novos, só oriente):
${findingsSummary}
${systemTypeContext}

Gere APENAS o texto no formato abaixo, sem título extra. Máximo ${MAX_REPORT_LINES} linhas.

RESUMO RÁPIDO
- Situação geral em 2 frases

TOP 3 PROBLEMAS
1. [Problema]
   - Impacto real:
   - Ação recomendada:

2. [Problema]
   - Impacto real:
   - Ação recomendada:

3. [Problema]
   - Impacto real:
   - Ação recomendada:

O QUE FAZER AGORA
- Passo 1
- Passo 2

O QUE PODE ESPERAR
- Itens de baixa urgência`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS_REPORT,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || 'Erro ao gerar relatório';
  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    throw new Error(`Erro ao gerar relatório: ${error.message}`);
  }
}

/**
 * Contexto por tipo de sistema (IA sem contexto = resposta genérica)
 */
function getSystemTypeContext(systemType?: SystemType, isLegacy?: boolean): string {
  if (!systemType && !isLegacy) return '';
  const parts: string[] = [];
  if (isLegacy) parts.push('Sistema legado: priorize estabilidade e evite refatorações amplas.');
  const ctx: Record<string, string> = {
    'sistema-legado': 'Sistema legado: foco em riscos operacionais e débito técnico.',
    'backend-critico': 'Backend crítico: foco em segurança, consistência e performance.',
    'sql-heavy': 'Projeto com muito SQL: foco em injeção, índices e transações.',
    'delphi-monolitico': 'Delphi monolítico: foco em memória, exceções e componentes.',
    'api-publica': 'API pública: foco em validação, rate limit e autenticação.',
    'generico': '',
  };
  if (systemType && ctx[systemType]) parts.push(ctx[systemType]);
  return parts.length ? `\nContexto do projeto: ${parts.join(' ')}` : '';
}

/**
 * Contexto específico por linguagem
 */
function getLanguageContext(language: string): string {
  const contexts: Record<string, string> = {
    javascript: `
Contexto JavaScript/TypeScript:
- Valide entrada de usuário sempre
- Use TypeScript para type safety
- Evite eval(), innerHTML direto
- Use async/await em vez de callbacks
- Valide APIs e endpoints
- Use bibliotecas seguras (npm audit)
- Implemente rate limiting em APIs`,
    
    java: `
Contexto Java:
- Valide entrada sempre
- Use PreparedStatement para SQL
- Implemente tratamento de exceções adequado
- Use anotações de validação (@NotNull, @Valid)
- Evite código legado inseguro
- Use Spring Security para segurança
- Implemente logging adequado`,
    
    sql: `
Contexto SQL:
- Use queries parametrizadas sempre
- Evite concatenação de strings em queries
- Valide entrada antes de executar queries
- Use índices apropriados
- Evite SELECT * em produção
- Implemente transações adequadas
- Valide permissões de usuário`,
    
    delphi: `
Contexto Delphi/VCL/FireMonkey:
- Valide entrada de formulários
- Use Try/Except adequadamente
- Evite vazamentos de memória
- Use tipos seguros (String em vez de PChar quando possível)
- Valide arquivos antes de abrir
- Use componentes seguros
- Implemente validação de dados`,
    
    ruby: `
Contexto Ruby/Rails:
- Use strong parameters
- Valide entrada sempre
- Evite SQL injection (use ActiveRecord)
- Implemente autenticação adequada
- Use gems seguras (bundle audit)
- Valide CSRF tokens
- Use sanitize para HTML`,
    
    json: `
Contexto JSON:
- Valide estrutura JSON
- Valide tipos de dados
- Implemente schema validation
- Trate erros de parsing
- Valide tamanho de payload
- Use bibliotecas seguras de parsing`,
    
    api: `
Contexto API:
- Valide todos os inputs
- Implemente rate limiting
- Use autenticação adequada
- Valide headers e tokens
- Implemente CORS adequadamente
- Use HTTPS sempre
- Valide payload size`,
  };

  return contexts[language.toLowerCase()] || '';
}

/**
 * Normaliza resultado da análise da IA (inclui actionable quando presente)
 */
function normalizeAIAnalysisResult(result: any, _meta?: AnalysisMetadata): AIAnalysisResult {
  const actionable = result.actionable
    ? {
        resumoRapido: result.actionable.resumoRapido || result.summary || '',
        top3Problemas: Array.isArray(result.actionable.top3Problemas)
          ? result.actionable.top3Problemas.slice(0, 3)
          : [],
        oQueFazerAgora: Array.isArray(result.actionable.oQueFazerAgora) ? result.actionable.oQueFazerAgora : [],
        oQuePodeEsperar: Array.isArray(result.actionable.oQuePodeEsperar) ? result.actionable.oQuePodeEsperar : [],
      }
    : undefined;

  return {
    improvements: Array.isArray(result.improvements)
      ? result.improvements.map((imp: any) => ({
          type: imp.type || 'quality',
          severity: imp.severity || 'low',
          title: imp.title || 'Melhoria sugerida',
          description: imp.description || '',
          currentCode: imp.currentCode,
          suggestedCode: imp.suggestedCode,
          line: imp.line,
          explanation: imp.explanation || '',
          impact: imp.impact || '',
        }))
      : [],
    summary: result.summary || 'Análise concluída',
    riskScore: typeof result.riskScore === 'number' ? result.riskScore : 0,
    qualityScore: typeof result.qualityScore === 'number' ? result.qualityScore : 0,
    recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
    consolidatedFindings: {
      critical: result.consolidatedFindings?.critical || 0,
      high: result.consolidatedFindings?.high || 0,
      medium: result.consolidatedFindings?.medium || 0,
      low: result.consolidatedFindings?.low || 0,
    },
    actionable,
  };
}
