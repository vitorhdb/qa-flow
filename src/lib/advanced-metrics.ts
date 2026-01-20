/**
 * Engine de métricas avançadas para análise de código
 * Baseado em: Segurança (40%), Qualidade (30%), Robustez (20%), Evolução (10%)
 */

import { Finding, AnalysisResult, Severity } from '@/types/qa';

export interface AdvancedMetrics {
  security: SecurityMetrics;
  quality: QualityMetrics;
  robustness: RobustnessMetrics;
  evolution: EvolutionMetrics;
  compositeScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityMetrics {
  vulnerabilityDensity: number; // vulnerabilidades por KLOC
  weightedSeverity: number; // severidade ponderada (0-100)
  insecureFunctions: number; // uso de funções inseguras
  hardcodedCredentials: number; // credenciais fixas
  inputValidation: number; // falta de validação (0-100, 100 = sem validação)
  score: number; // 0-100
}

export interface QualityMetrics {
  cyclomaticComplexity: number; // complexidade média
  maintainabilityIndex: number; // 0-100 (100 = melhor)
  codeSmells: number; // quantidade de code smells
  codeDuplication: number; // % de duplicação
  commentRatio: number; // comentários vs código
  score: number; // 0-100
}

export interface RobustnessMetrics {
  testCoverage: number; // % de cobertura (estimado)
  exceptionHandling: number; // qualidade do tratamento (0-100)
  loggingPoints: number; // pontos de logging
  globalDependencies: number; // dependências de estados globais
  score: number; // 0-100
}

export interface EvolutionMetrics {
  technicalDebt: number; // horas estimadas (normalizado 0-100)
  changeHotspots: number; // arquivos que mudam muito (normalizado)
  performanceIssues: number; // problemas de performance
  patternAdherence: number; // aderência a padrões (0-100)
  score: number; // 0-100
}

/**
 * Calcula métricas avançadas a partir de um resultado de análise
 */
export function calculateAdvancedMetrics(
  result: AnalysisResult,
  code: string
): AdvancedMetrics {
  // Proteção contra código vazio ou inválido
  const safeCode = code || '';
  const lines = safeCode.split('\n').length;
  const kloc = lines / 1000; // mil linhas

  // 1. Métricas de Segurança (40%)
  const security = calculateSecurityMetrics(result, code, kloc);

  // 2. Métricas de Qualidade (30%)
  const quality = calculateQualityMetrics(result, code, lines);

  // 3. Métricas de Robustez (20%)
  const robustness = calculateRobustnessMetrics(result, code);

  // 4. Métricas de Evolução (10%)
  const evolution = calculateEvolutionMetrics(result, code);

  // Score composto
  const compositeScore =
    security.score * 0.4 +
    quality.score * 0.3 +
    robustness.score * 0.2 +
    evolution.score * 0.1;

  // Nível de risco
  const riskLevel = getRiskLevel(compositeScore);

  return {
    security,
    quality,
    robustness,
    evolution,
    compositeScore: Math.round(compositeScore),
    riskLevel,
  };
}

function calculateSecurityMetrics(
  result: AnalysisResult,
  code: string,
  kloc: number
): SecurityMetrics {
  const safeCode = code || '';
  const securityFindings = result.findings.filter(f => f.type === 'security');

  // Densidade de vulnerabilidades
  const vulnerabilityDensity = kloc > 0 ? securityFindings.length / kloc : 0;

  // Severidade ponderada (Baixa=1, Média=3, Alta=7, Crítica=10)
  const severityWeights: Record<Severity, number> = {
    low: 1,
    medium: 3,
    high: 7,
    critical: 10,
  };

  const totalWeight = securityFindings.reduce(
    (sum, f) => sum + severityWeights[f.severity],
    0
  );
  const maxPossibleWeight = securityFindings.length * 10;
  const weightedSeverity =
    maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 100 : 0;

  // Funções inseguras
  const insecurePatterns = [
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /shell_exec\s*\(/gi,
    /os\.system\s*\(/gi,
    /subprocess\.call\s*\(/gi,
    /Process\.Start\s*\(/gi, // Delphi
    /WinExec\s*\(/gi, // Delphi
  ];
  let insecureFunctions = 0;
  insecurePatterns.forEach(pattern => {
    try {
      const matches = safeCode.match(pattern);
      if (matches) insecureFunctions += matches.length;
    } catch (e) {
      // Ignora erros de regex
    }
  });

  // Credenciais hardcoded
  const credentialPatterns = [
    /password\s*=\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,
    /secret\s*=\s*['"][^'"]+['"]/gi,
    /token\s*=\s*['"][^'"]+['"]/gi,
  ];
  let hardcodedCredentials = 0;
  credentialPatterns.forEach(pattern => {
    try {
      const matches = safeCode.match(pattern);
      if (matches) hardcodedCredentials += matches.length;
    } catch (e) {
      // Ignora erros de regex
    }
  });

  // Validação de entrada (detecta falta de sanitização)
  // Usa safeCode em vez de code
  const inputPatterns = [
    /\$\{.*\}/g, // template strings sem escape
    /innerHTML\s*=/gi,
    /\.html\s*\(/gi,
    /document\.write\s*\(/gi,
  ];
  const hasInputValidation = !inputPatterns.some(p => {
    try {
      return p.test(safeCode);
    } catch (e) {
      return false;
    }
  });
  const inputValidation = hasInputValidation ? 0 : 50; // penaliza falta de validação

  // Score de segurança (0-100, onde 100 = pior)
  const securityScore = Math.min(
    100,
    weightedSeverity * 0.4 +
      Math.min(vulnerabilityDensity * 10, 30) * 0.2 +
      Math.min(insecureFunctions * 5, 20) * 0.2 +
      Math.min(hardcodedCredentials * 10, 20) * 0.1 +
      inputValidation * 0.1
  );

  return {
    vulnerabilityDensity: Math.round(vulnerabilityDensity * 100) / 100,
    weightedSeverity: Math.round(weightedSeverity),
    insecureFunctions,
    hardcodedCredentials,
    inputValidation,
    score: Math.round(securityScore),
  };
}

function calculateQualityMetrics(
  result: AnalysisResult,
  code: string,
  lines: number
): QualityMetrics {
  const safeCode = code || '';
  const qualityFindings = result.findings.filter(f => f.type === 'quality');

  // Complexidade ciclomática (estimada)
  const complexityPatterns = [
    /if\s*\(/gi,
    /else\s*if\s*\(/gi,
    /switch\s*\(/gi,
    /case\s+/gi,
    /while\s*\(/gi,
    /for\s*\(/gi,
    /catch\s*\(/gi,
    /&&/g,
    /\|\|/g,
  ];
  let cyclomaticComplexity = 1; // base
  complexityPatterns.forEach(pattern => {
    try {
      const matches = safeCode.match(pattern);
      if (matches) cyclomaticComplexity += matches.length;
    } catch (e) {
      // Ignora erros de regex
    }
  });

  // Maintainability Index (simplificado)
  // MI = 171 - 5.2 * ln(avg complexity) - 0.23 * ln(avg lines) - 16.2 * ln(avg comment ratio)
  const commentLines = (safeCode.match(/\/\/|\/\*|\*\/|#/g) || []).length;
  const commentRatio = lines > 0 ? commentLines / lines : 0;
  const avgComplexity = cyclomaticComplexity;
  const avgLines = lines;
  const maintainabilityIndex = Math.max(
    0,
    Math.min(
      100,
      171 -
        5.2 * Math.log(Math.max(1, avgComplexity)) -
        0.23 * Math.log(Math.max(1, avgLines)) -
        16.2 * Math.log(Math.max(0.01, commentRatio || 0.01))
    )
  );

  // Code smells
  const codeSmells = qualityFindings.length;

  // Duplicação (detecta padrões repetidos simples)
  const codeBlocks = safeCode.split(/\n\n+/);
  const duplicates = new Set<string>();
  codeBlocks.forEach((block, i) => {
    if (block.length > 20) {
      codeBlocks.slice(i + 1).forEach(otherBlock => {
        if (block === otherBlock) {
          duplicates.add(block.substring(0, 50));
        }
      });
    }
  });
  const codeDuplication = codeBlocks.length > 0
    ? (duplicates.size / codeBlocks.length) * 100
    : 0;

  // Comment ratio
  const commentRatioPercent = commentRatio * 100;

  // Score de qualidade (0-100, onde 100 = melhor)
  const qualityScore = Math.max(
    0,
    100 -
      (cyclomaticComplexity > 10 ? Math.min((cyclomaticComplexity - 10) * 5, 40) : 0) -
      (100 - maintainabilityIndex) * 0.3 -
      Math.min(codeSmells * 3, 20) -
      Math.min(codeDuplication * 0.5, 10)
  );

  return {
    cyclomaticComplexity,
    maintainabilityIndex: Math.round(maintainabilityIndex),
    codeSmells,
    codeDuplication: Math.round(codeDuplication * 100) / 100,
    commentRatio: Math.round(commentRatioPercent * 100) / 100,
    score: Math.round(qualityScore),
  };
}

function calculateRobustnessMetrics(
  result: AnalysisResult,
  code: string
): RobustnessMetrics {
  const safeCode = code || '';
  // Cobertura de testes (estimada - detecta presença de testes)
  const testPatterns = [
    /test\s*\(/gi,
    /describe\s*\(/gi,
    /it\s*\(/gi,
    /@Test/gi,
    /def test_/gi,
    /procedure Test/gi, // Delphi
  ];
  const hasTests = testPatterns.some(p => {
    try {
      return p.test(safeCode);
    } catch (e) {
      return false;
    }
  });
  const testCoverage = hasTests ? 30 : 0; // estimativa conservadora

  // Tratamento de exceções
  const exceptionPatterns = [
    /try\s*\{/gi,
    /try:/gi,
    /catch\s*\(/gi,
    /except/gi,
    /finally/gi,
  ];
  const exceptionHandlingCount = exceptionPatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );
  const hasExceptionHandling = exceptionHandlingCount > 0;
  
  // Detecta exceções engolidas (catch vazio)
  const emptyCatchPattern = /catch\s*\([^)]*\)\s*\{\s*\}/gi;
  const emptyCatches = (safeCode.match(emptyCatchPattern) || []).length;
  
  const exceptionHandling = hasExceptionHandling
    ? Math.max(0, 100 - emptyCatches * 20)
    : 0;

  // Pontos de logging
  const loggingPatterns = [
    /console\.(log|error|warn|info)/gi,
    /logger\.(log|error|warn|info)/gi,
    /print\s*\(/gi,
    /WriteLn/gi, // Delphi
  ];
  const loggingPoints = loggingPatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );

  // Dependências globais
  const globalPatterns = [
    /window\./gi,
    /global\s+/gi,
    /var\s+\w+\s*=\s*require\s*\(/gi,
    /Form\d+\./gi, // Delphi
  ];
  const globalDependencies = globalPatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );

  // Score de robustez (0-100, onde 100 = melhor)
  const robustnessScore = Math.max(
    0,
    testCoverage * 0.3 +
      exceptionHandling * 0.4 +
      Math.min(loggingPoints * 5, 20) * 0.2 -
      Math.min(globalDependencies * 3, 10) * 0.1
  );

  return {
    testCoverage,
    exceptionHandling: Math.round(exceptionHandling),
    loggingPoints,
    globalDependencies,
    score: Math.round(robustnessScore),
  };
}

function calculateEvolutionMetrics(
  result: AnalysisResult,
  code: string
): EvolutionMetrics {
  const safeCode = code || '';
  // Débito técnico (estimado baseado em problemas encontrados)
  const technicalDebtHours = result.findings.length * 2; // 2h por problema
  const technicalDebt = Math.min(100, technicalDebtHours / 10); // normalizado

  // Hotspots de mudança (não temos histórico de commits, então estimamos)
  // Arquivos com muitos problemas tendem a mudar mais
  const changeHotspots = Math.min(100, result.findings.length * 5);

  // Performance issues
  const performancePatterns = [
    /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/gi, // loops aninhados
    /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+[^)]*\s+AND\s+[^)]*\s+AND/gi, // queries complexas
    /\.map\s*\([^)]*\)\s*\.map\s*\(/gi, // múltiplos maps
  ];
  const performanceIssues = performancePatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );

  // Aderência a padrões
  const goodPatterns = [
    /const\s+\w+\s*=/gi, // const ao invés de var
    /async\s+function/gi, // async/await
    /\.then\s*\(/gi, // promises
    /class\s+\w+/gi, // classes
  ];
  const badPatterns = [
    /var\s+\w+/gi, // var
    /eval\s*\(/gi, // eval
    /==/g, // loose equality
  ];
  const goodCount = goodPatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );
  const badCount = badPatterns.reduce(
    (sum, p) => {
      try {
        return sum + (safeCode.match(p) || []).length;
      } catch (e) {
        return sum;
      }
    },
    0
  );
  const patternAdherence =
    goodCount + badCount > 0
      ? (goodCount / (goodCount + badCount)) * 100
      : 50; // neutro se não detectar padrões

  // Score de evolução (0-100, onde 100 = melhor)
  const evolutionScore = Math.max(
    0,
    100 -
      technicalDebt * 0.3 -
      changeHotspots * 0.2 -
      Math.min(performanceIssues * 10, 30) * 0.2 -
      (100 - patternAdherence) * 0.3
  );

  return {
    technicalDebt: Math.round(technicalDebt),
    changeHotspots: Math.round(changeHotspots),
    performanceIssues,
    patternAdherence: Math.round(patternAdherence),
    score: Math.round(evolutionScore),
  };
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

/**
 * Obtém a cor do heatmap baseado no score composto
 */
export function getHeatmapColor(score: number): string {
  if (score >= 80) return 'heatmap-low'; // Verde
  if (score >= 60) return 'heatmap-medium'; // Amarelo
  if (score >= 40) return 'heatmap-high'; // Laranja
  return 'heatmap-critical'; // Vermelho
}
