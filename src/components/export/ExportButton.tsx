import { useState } from 'react';
import { Download, FileText, FileCode, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AnalysisResult } from '@/types/qa';
import { toast } from 'sonner';

interface ExportButtonProps {
  result: AnalysisResult | null;
}

function generateTextReport(result: AnalysisResult): string {
  const lines = [
    '═══════════════════════════════════════════════════════════',
    '                RELATÓRIO DE ANÁLISE QA FLOW                ',
    '═══════════════════════════════════════════════════════════',
    '',
    `Data: ${result.timestamp.toLocaleString()}`,
    `Arquivo: ${result.filename || 'Análise manual'}`,
    `Linguagem: ${result.language}`,
    '',
    '───────────────────────────────────────────────────────────',
    '                         PONTUAÇÕES                         ',
    '───────────────────────────────────────────────────────────',
    '',
    `  Risco:          ${result.scores.risk}%`,
    `  Qualidade:      ${result.scores.quality}%`,
    `  Segurança:      ${result.scores.security}%`,
    `  Melhorias:      ${result.scores.improvements} sugestões`,
    '',
    `  Quality Gate:   ${result.passed ? '✓ APROVADO' : '✗ REPROVADO'}`,
    '',
    '───────────────────────────────────────────────────────────',
    '                        ACHADOS                             ',
    '───────────────────────────────────────────────────────────',
    '',
  ];

  if (result.findings.length === 0) {
    lines.push('  Nenhum problema encontrado. Excelente trabalho!');
  } else {
    result.findings.forEach((finding, index) => {
      lines.push(`  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
      lines.push(`     Tipo: ${finding.type}`);
      lines.push(`     ${finding.description}`);
      if (finding.line) lines.push(`     Linha: ${finding.line}`);
      lines.push('');
    });
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                   Gerado por QA Flow                       ');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function generateHtmlReport(result: AnalysisResult): string {
  const severityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório QA Flow - ${result.timestamp.toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .scores-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .score-item { text-align: center; }
    .score-value { font-size: 2rem; font-weight: 700; }
    .score-label { font-size: 0.875rem; color: #64748b; }
    .gate { padding: 1rem 1.5rem; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; }
    .gate-passed { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; }
    .gate-failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; }
    .finding { padding: 1rem; border-left: 3px solid; margin-bottom: 1rem; background: #0f172a; border-radius: 0 8px 8px 0; }
    .finding-title { font-weight: 600; margin-bottom: 0.25rem; }
    .finding-desc { font-size: 0.875rem; color: #94a3b8; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Relatório QA Flow</h1>
    <p class="subtitle">${result.timestamp.toLocaleString()} | ${result.filename || 'Análise manual'} | ${result.language}</p>
    
    <div class="card">
      <div class="scores-grid">
        <div class="score-item">
          <div class="score-value" style="color: ${result.scores.risk >= 70 ? '#22c55e' : '#ef4444'}">${result.scores.risk}%</div>
          <div class="score-label">Risco</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: ${result.scores.quality >= 70 ? '#22c55e' : '#eab308'}">${result.scores.quality}%</div>
          <div class="score-label">Qualidade</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: ${result.scores.security >= 70 ? '#22c55e' : '#ef4444'}">${result.scores.security}%</div>
          <div class="score-label">Segurança</div>
        </div>
        <div class="score-item">
          <div class="score-value" style="color: #3b82f6">${result.scores.improvements}</div>
          <div class="score-label">Melhorias</div>
        </div>
      </div>
    </div>
    
    <div class="gate ${result.passed ? 'gate-passed' : 'gate-failed'}">
      ${result.passed ? '✓' : '✗'} Quality Gate ${result.passed ? 'APROVADO' : 'REPROVADO'}
    </div>
    
    <div class="card" style="margin-top: 1.5rem;">
      <h2 style="margin-bottom: 1rem;">Achados (${result.findings.length})</h2>
      ${result.findings.length === 0 ? '<p style="color: #22c55e;">Nenhum problema encontrado. Excelente trabalho!</p>' : 
        result.findings.map(f => `
        <div class="finding" style="border-color: ${severityColors[f.severity]}">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="badge" style="background: ${severityColors[f.severity]}20; color: ${severityColors[f.severity]}">${f.severity}</span>
            <span class="badge" style="background: #334155; color: #94a3b8;">${f.type}</span>
          </div>
          <div class="finding-title">${f.title}</div>
          <div class="finding-desc">${f.description}</div>
          ${f.line ? `<div class="finding-desc" style="margin-top: 0.5rem;">Linha ${f.line}</div>` : ''}
        </div>
      `).join('')}
    </div>
    
    <p style="text-align: center; color: #64748b; margin-top: 2rem; font-size: 0.875rem;">Gerado por QA Flow</p>
  </div>
</body>
</html>`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButton({ result }: ExportButtonProps) {
  const handleExport = (format: 'txt' | 'html' | 'pdf') => {
    if (!result) {
      toast.error('Nenhuma análise para exportar');
      return;
    }

    const timestamp = result.timestamp.toISOString().split('T')[0];
    
    if (format === 'txt') {
      const content = generateTextReport(result);
      downloadFile(content, `qa-report-${timestamp}.txt`, 'text/plain');
      toast.success('Relatório exportado como TXT');
    } else if (format === 'html') {
      const content = generateHtmlReport(result);
      downloadFile(content, `qa-report-${timestamp}.html`, 'text/html');
      toast.success('Relatório exportado como HTML');
    } else if (format === 'pdf') {
      // For PDF, we'll open the HTML in a new window for printing
      const content = generateHtmlReport(result);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('Janela de impressão de PDF aberta');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!result}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('txt')}>
          <FileText className="mr-2 h-4 w-4" />
          Exportar como TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('html')}>
          <FileCode className="mr-2 h-4 w-4" />
          Exportar como HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileType className="mr-2 h-4 w-4" />
          Exportar como PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
