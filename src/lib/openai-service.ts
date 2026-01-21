/**
 * Serviço de Integração com OpenAI
 * Centraliza todas as interações com a API da OpenAI
 */

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CodeAnalysisRequest {
  code: string;
  language: string;
  filename?: string;
  context?: string;
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

/**
 * Analisa código usando OpenAI com foco em QA crítico
 */
export async function analyzeCodeWithAI(
  request: CodeAnalysisRequest,
  qaFindings?: any[]
): Promise<AIAnalysisResult> {
  const config = getOpenAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('OpenAI API key não configurada. Configure em Configurações.');
  }

  const languageContext = getLanguageContext(request.language);
  const qaContext = qaFindings && qaFindings.length > 0 
    ? `\n\nAnálise QA Crítica Existente:\n${qaFindings.map(f => `- [${f.severity}] ${f.title}: ${f.description}`).join('\n')}`
    : '';

  const prompt = `Você é um especialista sênior em análise de código, segurança e qualidade de software.

Analise o seguinte código ${request.language.toUpperCase()}${request.filename ? ` do arquivo ${request.filename}` : ''}:

\`\`\`${request.language}
${request.code}
\`\`\`

${languageContext}

${qaContext}

${qaFindings && qaFindings.length > 0 
  ? 'IMPORTANTE: Consolide suas análises com os findings críticos do QA acima. Priorize problemas de segurança e qualidade crítica.'
  : ''}

Forneça uma análise completa focada em:
1. Segurança: vulnerabilidades, riscos de segurança, práticas inseguras
2. Qualidade: code smells, complexidade, manutenibilidade
3. Performance: otimizações possíveis, gargalos
4. Boas práticas: padrões da linguagem, convenções

Para cada problema encontrado, forneça:
- Tipo (security/quality/performance/maintainability/best-practice)
- Severidade (critical/high/medium/low)
- Título claro
- Descrição detalhada
- Código atual (se aplicável)
- Código sugerido (se aplicável)
- Linha aproximada
- Explicação técnica
- Impacto no sistema

Responda APENAS em JSON válido no seguinte formato:
{
  "improvements": [
    {
      "type": "security",
      "severity": "critical",
      "title": "SQL Injection Vulnerability",
      "description": "Descrição detalhada",
      "currentCode": "código atual (opcional)",
      "suggestedCode": "código sugerido (opcional)",
      "line": 42,
      "explanation": "Explicação técnica",
      "impact": "Impacto no sistema"
    }
  ],
  "summary": "Resumo geral da análise",
  "riskScore": 75,
  "qualityScore": 60,
  "recommendations": ["Recomendação 1", "Recomendação 2"],
  "consolidatedFindings": {
    "critical": 2,
    "high": 5,
    "medium": 8,
    "low": 3
  }
}`;

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
          {
            role: 'system',
            content: 'Você é um especialista em análise de código, segurança e qualidade. Sempre retorne JSON válido.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: config.temperature || 0.3,
        max_tokens: config.maxTokens || 4000,
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

    // Tenta parsear JSON
    let result: AIAnalysisResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Se falhar, tenta extrair JSON do texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Resposta da OpenAI não contém JSON válido');
      }
    }

    // Valida e normaliza resultado
    return normalizeAIAnalysisResult(result);
  } catch (error: any) {
    console.error('Erro ao analisar código com OpenAI:', error);
    throw new Error(`Erro na análise por IA: ${error.message}`);
  }
}

/**
 * Gera relatório consolidado usando IA
 */
export async function generateReportWithAI(
  analyses: any[],
  projectName?: string
): Promise<string> {
  const config = getOpenAIConfig();
  if (!config || !config.apiKey) {
    throw new Error('OpenAI API key não configurada');
  }

  const prompt = `Gere um relatório executivo consolidado de análise de código para ${projectName || 'o projeto'}.

Análises realizadas:
${analyses.map((a, i) => `
Análise ${i + 1}:
- Arquivo: ${a.filename || 'N/A'}
- Linguagem: ${a.language || 'N/A'}
- Risco: ${a.scores?.risk || 0}%
- Qualidade: ${a.scores?.quality || 0}%
- Segurança: ${a.scores?.security || 0}%
- Findings: ${a.findings?.length || 0}
`).join('\n')}

Gere um relatório profissional em Markdown com:
1. Resumo Executivo
2. Métricas Gerais
3. Principais Problemas Identificados
4. Recomendações Prioritárias
5. Plano de Ação Sugerido

Formato: Markdown profissional`;

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
          {
            role: 'system',
            content: 'Você é um especialista em relatórios técnicos de qualidade de código.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Erro ao gerar relatório';
  } catch (error: any) {
    console.error('Erro ao gerar relatório:', error);
    throw new Error(`Erro ao gerar relatório: ${error.message}`);
  }
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
 * Normaliza resultado da análise da IA
 */
function normalizeAIAnalysisResult(result: any): AIAnalysisResult {
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
  };
}
