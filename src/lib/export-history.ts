/**
 * Sistema de Exportação de Histórico
 * Exporta análises em PDF, HTML, Markdown e TXT
 */

import type { Analysis, Finding } from '@/types/history';
import { db } from './database';

export interface ExportOptions {
  format: 'pdf' | 'html' | 'markdown' | 'txt';
  analyses: Analysis[];
  includeFindings?: boolean;
  includeTrends?: boolean;
}

/**
 * Exporta análises em formato TXT
 */
export function exportToTXT(analyses: Analysis[], includeFindings: boolean = true): string {
  let content = '═══════════════════════════════════════════════════════════\n';
  content += '                    QA FLOW! - RELATÓRIO DE ANÁLISES                    \n';
  content += '═══════════════════════════════════════════════════════════\n\n';
  content += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  content += `Total de análises: ${analyses.length}\n\n`;

  for (const [index, analysis] of analyses.entries()) {
    content += `\n${'─'.repeat(60)}\n`;
    content += `ANÁLISE #${index + 1}\n`;
    content += `${'─'.repeat(60)}\n\n`;
    content += `ID: ${analysis.id}\n`;
    content += `Data/Hora: ${new Date(analysis.timestamp).toLocaleString('pt-BR')}\n`;
    content += `Modo: ${analysis.mode}\n`;
    if (analysis.branch) {
      content += `Branch: ${analysis.branch}\n`;
    }
    if (analysis.commitHash) {
      content += `Commit: ${analysis.commitHash}\n`;
    }
    content += `Quality Gate: ${analysis.qualityGate}\n\n`;
    
    content += 'SCORES:\n';
    content += `  Risco: ${analysis.riskScore}%\n`;
    content += `  Qualidade: ${analysis.qualityScore}%\n`;
    content += `  Segurança: ${analysis.securityScore}%\n`;
    content += `  Melhorias: ${analysis.improvementScore}%\n\n`;
    
    content += 'FINDINGS:\n';
    content += `  Total: ${analysis.totalFindings || 0}\n`;
    content += `  Críticos: ${analysis.criticalFindings || 0}\n`;
    content += `  Altos: ${analysis.highFindings || 0}\n`;
    content += `  Médios: ${analysis.mediumFindings || 0}\n`;
    content += `  Baixos: ${analysis.lowFindings || 0}\n\n`;
    
    if (includeFindings && analysis.totalFindings && analysis.totalFindings > 0) {
      // Busca findings detalhados
      const findings = await db.getFindingsByAnalysis(analysis.id);
      if (findings.length > 0) {
        content += 'DETALHES DOS FINDINGS:\n';
        findings.forEach((finding, idx) => {
          content += `\n  ${idx + 1}. [${finding.severity.toUpperCase()}] ${finding.type}\n`;
          content += `     Arquivo: ${finding.file}`;
          if (finding.line) {
            content += `:${finding.line}`;
          }
          content += `\n     ${finding.description}\n`;
        });
      }
    }
  }
  
  content += `\n${'═'.repeat(60)}\n`;
  content += 'Fim do Relatório\n';
  content += `${'═'.repeat(60)}\n`;
  
  return content;
}

/**
 * Exporta análises em formato Markdown
 */
export async function exportToMarkdown(analyses: Analysis[], includeFindings: boolean = true): Promise<string> {
  let content = '# QA FLOW! - Relatório de Análises\n\n';
  content += `**Gerado em:** ${new Date().toLocaleString('pt-BR')}\n`;
  content += `**Total de análises:** ${analyses.length}\n\n`;
  content += '---\n\n';

  for (const [index, analysis] of analyses.entries()) {
    content += `## Análise #${index + 1}\n\n`;
    content += `**ID:** \`${analysis.id}\`\n`;
    content += `**Data/Hora:** ${new Date(analysis.timestamp).toLocaleString('pt-BR')}\n`;
    content += `**Modo:** ${analysis.mode}\n`;
    if (analysis.branch) {
      content += `**Branch:** \`${analysis.branch}\`\n`;
    }
    if (analysis.commitHash) {
      content += `**Commit:** \`${analysis.commitHash}\`\n`;
    }
    content += `**Quality Gate:** ${analysis.qualityGate === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    content += '### Scores\n\n';
    content += `| Métrica | Valor |\n`;
    content += `|---------|-------|\n`;
    content += `| Risco | ${analysis.riskScore}% |\n`;
    content += `| Qualidade | ${analysis.qualityScore}% |\n`;
    content += `| Segurança | ${analysis.securityScore}% |\n`;
    content += `| Melhorias | ${analysis.improvementScore}% |\n\n`;
    
    content += '### Findings\n\n';
    content += `| Severidade | Quantidade |\n`;
    content += `|------------|------------|\n`;
    content += `| 🔴 Críticos | ${analysis.criticalFindings || 0} |\n`;
    content += `| 🟠 Altos | ${analysis.highFindings || 0} |\n`;
    content += `| 🟡 Médios | ${analysis.mediumFindings || 0} |\n`;
    content += `| 🟢 Baixos | ${analysis.lowFindings || 0} |\n`;
    content += `| **Total** | **${analysis.totalFindings || 0}** |\n\n`;
    
    if (includeFindings && analysis.totalFindings && analysis.totalFindings > 0) {
      content += '### Detalhes dos Findings\n\n';
      const findings = await db.getFindingsByAnalysis(analysis.id);
      findings.forEach((finding, idx) => {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[finding.severity];
        
        content += `#### ${severityEmoji} ${finding.severity.toUpperCase()} - ${finding.type}\n\n`;
        content += `**Arquivo:** \`${finding.file}${finding.line ? `:${finding.line}` : ''}\`\n\n`;
        content += `${finding.description}\n\n`;
      });
    }
    
    content += '---\n\n';
  }
  
  return content;
}

/**
 * Exporta análises em formato HTML
 */
export async function exportToHTML(analyses: Analysis[], includeFindings: boolean = true): Promise<string> {
  let content = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA FLOW! - Relatório de Análises</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #1e40af; margin-top: 30px; }
    .analysis { border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 20px; }
    .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0; }
    .score-card { background: #f9fafb; padding: 15px; border-radius: 6px; text-align: center; }
    .score-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .score-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
    .findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 15px 0; }
    .finding-card { padding: 10px; border-radius: 4px; text-align: center; }
    .critical { background: #fee2e2; color: #991b1b; }
    .high { background: #fed7aa; color: #92400e; }
    .medium { background: #fef3c7; color: #78350f; }
    .low { background: #d1fae5; color: #065f46; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-pass { background: #d1fae5; color: #065f46; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .meta { color: #6b7280; font-size: 14px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 QA FLOW! - Relatório de Análises</h1>
    <div class="meta">
      <strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}<br>
      <strong>Total de análises:</strong> ${analyses.length}
    </div>`;

  for (const [index, analysis] of analyses.entries()) {
    content += `
    <div class="analysis">
      <h2>Análise #${index + 1}</h2>
      <div class="meta">
        <strong>ID:</strong> <code>${analysis.id}</code><br>
        <strong>Data/Hora:</strong> ${new Date(analysis.timestamp).toLocaleString('pt-BR')}<br>
        <strong>Modo:</strong> ${analysis.mode}`;
    
    if (analysis.branch) {
      content += `<br><strong>Branch:</strong> <code>${analysis.branch}</code>`;
    }
    if (analysis.commitHash) {
      content += `<br><strong>Commit:</strong> <code>${analysis.commitHash}</code>`;
    }
    
    content += `<br><strong>Quality Gate:</strong> <span class="badge ${analysis.qualityGate === 'PASS' ? 'badge-pass' : 'badge-fail'}">${analysis.qualityGate}</span>
      </div>
      
      <h3>Scores</h3>
      <div class="scores">
        <div class="score-card">
          <div class="score-value">${analysis.riskScore}%</div>
          <div class="score-label">Risco</div>
        </div>
        <div class="score-card">
          <div class="score-value">${analysis.qualityScore}%</div>
          <div class="score-label">Qualidade</div>
        </div>
        <div class="score-card">
          <div class="score-value">${analysis.securityScore}%</div>
          <div class="score-label">Segurança</div>
        </div>
        <div class="score-card">
          <div class="score-value">${analysis.improvementScore}%</div>
          <div class="score-label">Melhorias</div>
        </div>
      </div>
      
      <h3>Findings</h3>
      <div class="findings-grid">
        <div class="finding-card critical">
          <div style="font-size: 20px; font-weight: bold;">${analysis.criticalFindings || 0}</div>
          <div>Críticos</div>
        </div>
        <div class="finding-card high">
          <div style="font-size: 20px; font-weight: bold;">${analysis.highFindings || 0}</div>
          <div>Altos</div>
        </div>
        <div class="finding-card medium">
          <div style="font-size: 20px; font-weight: bold;">${analysis.mediumFindings || 0}</div>
          <div>Médios</div>
        </div>
        <div class="finding-card low">
          <div style="font-size: 20px; font-weight: bold;">${analysis.lowFindings || 0}</div>
          <div>Baixos</div>
        </div>
      </div>
    </div>`;
  });

  content += `
  </div>
</body>
</html>`;
  
  return content;
}

/**
 * Exporta análises em formato PDF (usa html2pdf)
 */
export async function exportToPDF(analyses: Analysis[], includeFindings: boolean = true): Promise<void> {
  const html = await exportToHTML(analyses, includeFindings);
  
  // Cria um blob e abre em nova janela para impressão
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        URL.revokeObjectURL(url);
      }, 500);
    };
  }
}

/**
 * Função principal de exportação
 */
export async function exportAnalyses(
  analyses: Analysis[],
  format: 'pdf' | 'html' | 'markdown' | 'txt',
  includeFindings: boolean = true
): Promise<void> {
  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case 'txt':
      content = await exportToTXT(analyses, includeFindings);
      filename = `qa-flow-analises-${Date.now()}.txt`;
      mimeType = 'text/plain';
      break;
    case 'markdown':
      content = await exportToMarkdown(analyses, includeFindings);
      filename = `qa-flow-analises-${Date.now()}.md`;
      mimeType = 'text/markdown';
      break;
    case 'html':
      content = await exportToHTML(analyses, includeFindings);
      filename = `qa-flow-analises-${Date.now()}.html`;
      mimeType = 'text/html';
      break;
    case 'pdf':
      await exportToPDF(analyses, includeFindings);
      return;
    default:
      throw new Error(`Formato não suportado: ${format}`);
  }

  // Cria e baixa o arquivo
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
