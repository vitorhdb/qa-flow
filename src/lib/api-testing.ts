/**
 * Sistema de API Testing
 * Análise de cobertura de testes e detecção de testes ausentes
 */

import { AnalysisResult } from '@/types/qa';

export interface TestCoverage {
  unit: number;
  integration: number;
  e2e: number;
  total: number;
}

export interface TestAnalysis {
  hasTests: boolean;
  testFiles: string[];
  coverage: TestCoverage;
  missingTests: string[];
  recommendations: string[];
}

export function analyzeTestCoverage(
  result: AnalysisResult,
  code: string,
  allFiles?: { path: string; content: string }[]
): TestAnalysis {
  // Detecta arquivos de teste
  const testFiles = allFiles?.filter(f => 
    f.path.includes('test') || 
    f.path.includes('spec') ||
    f.path.endsWith('.test.js') ||
    f.path.endsWith('.test.ts') ||
    f.path.endsWith('.spec.js') ||
    f.path.endsWith('.spec.ts')
  ).map(f => f.path) || [];

  const hasTests = testFiles.length > 0 || /test|spec|describe|it\(/i.test(code);

  // Estima cobertura baseado em padrões encontrados
  let unit = 0;
  let integration = 0;
  let e2e = 0;

  if (hasTests) {
    // Detecta tipos de testes
    const unitPatterns = [/test\(|it\(|describe\(/gi];
    const integrationPatterns = [/integration|api.*test|e2e/gi];
    const e2ePatterns = [/cypress|playwright|puppeteer|selenium/gi];

    const allCode = allFiles?.map(f => f.content).join('\n') || code;
    
    unitPatterns.forEach(p => {
      const matches = allCode.match(p);
      if (matches) unit += matches.length * 5; // Estimativa
    });

    integrationPatterns.forEach(p => {
      const matches = allCode.match(p);
      if (matches) integration += matches.length * 10;
    });

    e2ePatterns.forEach(p => {
      const matches = allCode.match(p);
      if (matches) e2e += matches.length * 15;
    });

    // Normaliza para 0-100
    unit = Math.min(100, unit);
    integration = Math.min(100, integration);
    e2e = Math.min(100, e2e);
  }

  const total = hasTests ? Math.round((unit + integration + e2e) / 3) : 0;

  // Detecta funções/classes sem testes
  const missingTests: string[] = [];
  if (allFiles) {
    const sourceFiles = allFiles.filter(f => 
      !f.path.includes('test') && 
      !f.path.includes('spec') &&
      (f.path.endsWith('.js') || f.path.endsWith('.ts'))
    );

    sourceFiles.forEach(file => {
      const functions = file.content.match(/(?:function|const|export)\s+(\w+)/g) || [];
      if (functions.length > 0 && !hasTests) {
        missingTests.push(`${file.path}: ${functions.length} funções sem testes`);
      }
    });
  }

  const recommendations: string[] = [];
  if (total < 50) {
    recommendations.push('Cobertura de testes abaixo de 50%. Considere adicionar mais testes.');
  }
  if (unit === 0 && hasTests) {
    recommendations.push('Adicione testes unitários para funções críticas');
  }
  if (integration === 0 && hasTests) {
    recommendations.push('Considere adicionar testes de integração');
  }
  if (missingTests.length > 0) {
    recommendations.push(`${missingTests.length} arquivos sem testes correspondentes`);
  }

  return {
    hasTests,
    testFiles,
    coverage: { unit, integration, e2e, total },
    missingTests: missingTests.slice(0, 10), // Limita a 10
    recommendations,
  };
}
