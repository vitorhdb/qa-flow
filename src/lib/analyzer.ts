import { Finding, AnalysisResult, Severity } from '@/types/qa';

// Padrões de segurança universais
const universalSecurityPatterns = [
  { pattern: /password\s*=\s*['"][^'"]+['"]/gi, title: 'Senha hardcoded', description: 'Senha fixa detectada. Use variáveis de ambiente ou armazenamento seguro.', severity: 'critical' as Severity },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, title: 'API key hardcoded', description: 'Chave de API fixa detectada. Use variáveis de ambiente.', severity: 'high' as Severity },
  { pattern: /secret\s*=\s*['"][^'"]+['"]/gi, title: 'Secret hardcoded', description: 'Secret fixo detectado. Use variáveis de ambiente.', severity: 'critical' as Severity },
  { pattern: /token\s*=\s*['"][^'"]+['"]/gi, title: 'Token hardcoded', description: 'Token fixo detectado. Use variáveis de ambiente.', severity: 'high' as Severity },
];

// Padrões específicos por linguagem
const languageSecurityPatterns: Record<string, Array<{ pattern: RegExp; title: string; description: string; severity: Severity }>> = {
  sql: [
    { pattern: /SELECT\s+.*\+\s*['"]|['"].*\+\s*SELECT/gi, title: 'Risco de SQL Injection', description: 'Concatenação de strings em consulta SQL detectada. Prefira queries parametrizadas.', severity: 'critical' as Severity },
    { pattern: /DELETE\s+FROM\s+\w+\s*(?:;|$)/gi, title: 'DELETE sem WHERE', description: 'Comando DELETE sem cláusula WHERE pode apagar todos os registros.', severity: 'critical' as Severity },
    { pattern: /DROP\s+TABLE/gi, title: 'DROP TABLE detectado', description: 'Comando DROP TABLE encontrado. Garanta que seja intencional e protegido.', severity: 'critical' as Severity },
    { pattern: /TRUNCATE\s+TABLE/gi, title: 'TRUNCATE TABLE detectado', description: 'Comando TRUNCATE TABLE encontrado. Ele remove todos os dados.', severity: 'high' as Severity },
    { pattern: /EXEC\s*\(|EXECUTE\s*\(/gi, title: 'EXEC dinâmico', description: 'Execução dinâmica de SQL detectada. Risco de SQL Injection.', severity: 'critical' as Severity },
  ],
  javascript: [
    { pattern: /eval\s*\(/gi, title: 'Uso de eval detectado', description: 'eval() é perigoso e pode executar código arbitrário. Evite utilizá-lo.', severity: 'critical' as Severity },
    { pattern: /innerHTML\s*=/gi, title: 'Atribuição a innerHTML', description: 'Atribuição direta a innerHTML pode gerar vulnerabilidades de XSS.', severity: 'high' as Severity },
    { pattern: /dangerouslySetInnerHTML/gi, title: 'dangerouslySetInnerHTML', description: 'Uso de dangerouslySetInnerHTML pode causar XSS. Valide e sanitize dados.', severity: 'high' as Severity },
    { pattern: /document\.write\s*\(/gi, title: 'document.write', description: 'document.write() pode causar XSS. Use métodos seguros de manipulação do DOM.', severity: 'medium' as Severity },
    { pattern: /new\s+Function\s*\(/gi, title: 'new Function()', description: 'new Function() pode executar código arbitrário. Evite uso dinâmico.', severity: 'high' as Severity },
  ],
  java: [
    { pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/gi, title: 'Execução de comando do sistema', description: 'Execução de comandos do sistema detectada. Valide e sanitize entrada.', severity: 'critical' as Severity },
    { pattern: /ProcessBuilder\s*\(/gi, title: 'ProcessBuilder', description: 'ProcessBuilder pode executar comandos. Valide entrada cuidadosamente.', severity: 'high' as Severity },
    { pattern: /Statement\s+\w+\s*=\s*\w+\.createStatement\s*\(/gi, title: 'Statement sem PreparedStatement', description: 'Use PreparedStatement em vez de Statement para prevenir SQL Injection.', severity: 'critical' as Severity },
    { pattern: /\.getParameter\s*\(/gi, title: 'Parâmetro HTTP sem validação', description: 'Parâmetros HTTP devem ser validados antes do uso.', severity: 'high' as Severity },
  ],
  delphi: [
    { pattern: /ShellExecute|WinExec|CreateProcess/gi, title: 'Execução de processo externo', description: 'Execução de processos externos detectada. Valide entrada.', severity: 'high' as Severity },
    { pattern: /Format\s*\(.*%.*\)/gi, title: 'Format com formato dinâmico', description: 'Format com formato dinâmico pode causar problemas. Valide formato.', severity: 'medium' as Severity },
    { pattern: /StrToInt\s*\(|StrToFloat\s*\(/gi, title: 'Conversão sem tratamento de erro', description: 'Conversão de string sem tratamento de erro pode causar exceções.', severity: 'medium' as Severity },
  ],
  firemonkey: [
    { pattern: /ShellExecute|WinExec|CreateProcess/gi, title: 'Execução de processo externo', description: 'Execução de processos externos detectada. Valide entrada.', severity: 'high' as Severity },
  ],
  ruby: [
    { pattern: /eval\s*\(|instance_eval|class_eval/gi, title: 'Uso de eval', description: 'eval() pode executar código arbitrário. Evite uso dinâmico.', severity: 'critical' as Severity },
    { pattern: /system\s*\(|`.*`|%x\[/gi, title: 'Execução de comando do sistema', description: 'Execução de comandos do sistema detectada. Valide entrada.', severity: 'critical' as Severity },
    { pattern: /\.where\s*\(.*\+.*\)/gi, title: 'SQL Injection potencial', description: 'Concatenação em query ActiveRecord pode causar SQL Injection.', severity: 'critical' as Severity },
  ],
  json: [
    { pattern: /"password"\s*:\s*"[^"]+"/gi, title: 'Senha em JSON', description: 'Senha encontrada em JSON. Não armazene senhas em JSON.', severity: 'critical' as Severity },
    { pattern: /"token"\s*:\s*"[^"]+"/gi, title: 'Token em JSON', description: 'Token encontrado em JSON. Use variáveis de ambiente.', severity: 'high' as Severity },
  ],
  api: [
    { pattern: /\/\*.*\*\/|\/\/.*password|\/\/.*secret/gi, title: 'Credenciais em comentários', description: 'Credenciais não devem estar em comentários.', severity: 'high' as Severity },
  ],
  supabase: [
    { pattern: /\.rpc\s*\([^,]+,\s*\{[^}]*\}/gi, title: 'RPC sem validação', description: 'Chamadas RPC devem validar entrada.', severity: 'high' as Severity },
  ],
};

const securityPatterns = [...universalSecurityPatterns];

const qualityPatterns = [
  { pattern: /console\.(log|debug|info)\s*\(/gi, title: 'Uso de console', description: 'Comandos de console devem ser removidos em código de produção.', severity: 'low' as Severity },
  { pattern: /TODO|FIXME|HACK|XXX/gi, title: 'Comentário TODO encontrado', description: 'Comentário TODO/FIXME não resolvido no código.', severity: 'low' as Severity },
  { pattern: /function\s+\w+\s*\([^)]{100,}\)/gi, title: 'Parâmetros em excesso', description: 'Função com parâmetros demais. Considere usar um objeto de opções.', severity: 'medium' as Severity },
  { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/gi, title: 'Bloco catch vazio', description: 'Bloco catch vazio engole erros silenciosamente.', severity: 'medium' as Severity },
  { pattern: /var\s+\w+/gi, title: 'Uso de var', description: 'Prefira const ou let em vez de var para melhor escopo.', severity: 'low' as Severity },
  { pattern: /==(?!=)/gi, title: 'Igualdade frouxa', description: 'Use igualdade estrita (===) em vez de igualdade frouxa (==).', severity: 'low' as Severity },
];

const improvementPatterns = [
  { pattern: /\.then\s*\([^)]*\)\s*\.catch/gi, title: 'Cadeia de Promises', description: 'Considere usar async/await para melhor legibilidade.', severity: 'low' as Severity },
  { pattern: /for\s*\(\s*(?:var|let)\s+\w+\s*=\s*0\s*;[^;]+<[^;]+\.length/gi, title: 'Loop for tradicional', description: 'Considere usar forEach, map ou for...of para iteração mais limpa.', severity: 'low' as Severity },
  { pattern: /if\s*\([^)]+\)\s*\{\s*return\s+true\s*;?\s*\}\s*(?:else\s*)?\{?\s*return\s+false/gi, title: 'Retorno booleano redundante', description: 'Retorne a condição diretamente em vez de if/else com true/false.', severity: 'low' as Severity },
  { pattern: /function\s*\([^)]*\)\s*\{[^}]{500,}\}/gi, title: 'Função longa', description: 'A função está extensa. Considere dividi-la em funções menores.', severity: 'medium' as Severity },
];

function detectLanguage(code: string, filename?: string): string {
  // Detecta por extensão do arquivo primeiro
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const extMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'javascript',
      'tsx': 'javascript',
      'java': 'java',
      'sql': 'sql',
      'pas': 'delphi',
      'dpr': 'delphi',
      'dfm': 'delphi',
      'fmx': 'firemonkey',
      'rb': 'ruby',
      'rake': 'ruby',
      'json': 'json',
      'py': 'python',
      'api': 'api',
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  // Detecta por padrões no código
  if (/procedure|function|begin|end;|TForm|TButton|TComponent|uses\s+\w+/i.test(code)) {
    if (/TForm|TButton|TComponent|VCL/i.test(code)) return 'delphi';
    if (/TForm|TButton|TComponent|FMX|FireMonkey/i.test(code)) return 'firemonkey';
    return 'delphi';
  }
  if (/SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|DROP TABLE|TRUNCATE/i.test(code)) return 'sql';
  if (/import\s+.*from|export\s+(default|const|function)|const\s+\w+\s*=|=>|require\(|module\.exports/i.test(code)) return 'javascript';
  if (/public\s+class|private\s+\w+|@Override|@Entity|@Service|import\s+java\./i.test(code)) return 'java';
  if (/def\s+\w+|import\s+\w+|print\s*\(|class\s+\w+\(|@app\.route/i.test(code)) return 'python';
  if (/class\s+\w+|def\s+\w+|require\s+['"]|module\s+\w+|ActiveRecord/i.test(code)) return 'ruby';
  if (/^\s*\{|^\s*\[|"[\w]+"\s*:\s*|true|false|null/i.test(code) && /^[\s\n]*[\{\[]/.test(code.trim())) return 'json';
    if (/GET|POST|PUT|DELETE|@RequestMapping|@GetMapping|@PostMapping|endpoint|\/api\//i.test(code)) return 'api';
  if (/supabase\.|createClient|from\(|\.select\(|\.insert\(|\.update\(/i.test(code)) return 'supabase';
  
  return 'unknown';
}

function findPatternMatches(code: string, patterns: typeof securityPatterns, type: Finding['type']): Finding[] {
  const findings: Finding[] = [];
  const lines = code.split('\n');

  patterns.forEach(({ pattern, title, description, severity }) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      const beforeMatch = code.substring(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
      
      findings.push({
        id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity,
        title,
        description,
        line: lineNumber,
        code: lines[lineNumber - 1]?.trim(),
      });
    }
  });

  return findings;
}

function calculateScores(findings: Finding[]): AnalysisResult['scores'] {
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

  const improvementsCount = findings.filter(f => f.type === 'improvement').length;
  
  return {
    risk: Math.max(0, Math.min(100, riskScore)),
    quality: Math.max(0, Math.min(100, qualityScore)),
    security: Math.max(0, Math.min(100, securityScore)),
    improvements: improvementsCount,
  };
}

export function analyzeCode(code: string, filename?: string): AnalysisResult {
  const language = detectLanguage(code, filename);
  
  // Obtém padrões específicos da linguagem
  const langSecurityPatterns = languageSecurityPatterns[language] || [];
  const allSecurityPatterns = [...securityPatterns, ...langSecurityPatterns];
  
  const securityFindings = findPatternMatches(code, allSecurityPatterns, 'security');
  const qualityFindings = findPatternMatches(code, qualityPatterns, 'quality');
  const improvementFindings = findPatternMatches(code, improvementPatterns, 'improvement');
  
  const allFindings = [...securityFindings, ...qualityFindings, ...improvementFindings];
  const scores = calculateScores(allFindings);
  
  // Quality Gate: fails if risk > 30 or security < 70
  const passed = scores.risk >= 70 && scores.security >= 70;
  
  return {
    id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    filename,
    code,
    language,
    scores,
    findings: allFindings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    passed,
  };
}

export function generateMockHeatmapData(): { filename: string; risk: number }[] {
  const files = [
    'auth/login.js', 'auth/register.js', 'auth/session.js',
    'api/users.js', 'api/products.js', 'api/orders.js',
    'db/queries.sql', 'db/migrations.sql',
    'utils/helpers.js', 'utils/validators.js',
    'components/Form.js', 'components/Table.js',
  ];
  
  return files.map(filename => ({
    filename,
    risk: Math.floor(Math.random() * 100),
  }));
}
