/**
 * Sistema de Relatórios Automáticos
 * Geração e agendamento de relatórios
 */

import { AnalysisResult } from '@/types/qa';
import { db } from './database';

export type ReportSchedule = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule: ReportSchedule;
  recipients: string[];
  format: 'html' | 'pdf' | 'json';
  projectId?: string;
  includeMetrics: boolean;
  includeFindings: boolean;
  includeTrends: boolean;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  generatedAt: Date;
  format: string;
  content: string;
  url?: string;
}

class ReportManager {
  private configs: ReportConfig[] = [];

  constructor() {
    this.loadConfigs();
  }

  private loadConfigs() {
    const saved = localStorage.getItem('report_configs');
    if (saved) {
      this.configs = JSON.parse(saved);
    }
  }

  private saveConfigs() {
    localStorage.setItem('report_configs', JSON.stringify(this.configs));
  }

  getConfigs(): ReportConfig[] {
    return this.configs;
  }

  addConfig(config: Omit<ReportConfig, 'id'>): ReportConfig {
    const newConfig: ReportConfig = {
      ...config,
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    this.configs.push(newConfig);
    this.saveConfigs();
    return newConfig;
  }

  updateConfig(id: string, updates: Partial<ReportConfig>) {
    const index = this.configs.findIndex(c => c.id === id);
    if (index >= 0) {
      this.configs[index] = { ...this.configs[index], ...updates };
      this.saveConfigs();
    }
  }

  deleteConfig(id: string) {
    this.configs = this.configs.filter(c => c.id !== id);
    this.saveConfigs();
  }

  async generateReport(config: ReportConfig): Promise<GeneratedReport> {
    const analyses = config.projectId
      ? await db.getAllAnalyses(config.projectId)
      : await db.getAllAnalyses();

    const recentAnalyses = analyses.slice(0, 50); // Últimas 50 análises

    let content = '';

    if (config.format === 'html') {
      content = this.generateHTMLReport(config, recentAnalyses);
    } else if (config.format === 'json') {
      content = JSON.stringify({
        generatedAt: new Date().toISOString(),
        config: config.name,
        analyses: recentAnalyses,
        summary: this.calculateSummary(recentAnalyses),
      }, null, 2);
    } else {
      // PDF seria gerado no backend
      content = this.generateHTMLReport(config, recentAnalyses);
    }

    const report: GeneratedReport = {
      id: `report-${Date.now()}`,
      configId: config.id,
      generatedAt: new Date(),
      format: config.format,
      content,
    };

    return report;
  }

  private generateHTMLReport(config: ReportConfig, analyses: any[]): string {
    const summary = this.calculateSummary(analyses);
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Relatório - ${config.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    .card h3 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${config.name}</h1>
    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  </div>
  
  <div class="summary">
    <div class="card">
      <h3>Total de Análises</h3>
      <p style="font-size: 2em; font-weight: bold;">${summary.total}</p>
    </div>
    <div class="card">
      <h3>Taxa de Aprovação</h3>
      <p style="font-size: 2em; font-weight: bold;">${summary.passedRate}%</p>
    </div>
    <div class="card">
      <h3>Risco Médio</h3>
      <p style="font-size: 2em; font-weight: bold;">${summary.avgRisk}%</p>
    </div>
    <div class="card">
      <h3>Segurança Média</h3>
      <p style="font-size: 2em; font-weight: bold;">${summary.avgSecurity}%</p>
    </div>
  </div>
  
  ${config.includeFindings ? this.generateFindingsSection(analyses) : ''}
  ${config.includeTrends ? this.generateTrendsSection(analyses) : ''}
</body>
</html>`;
  }

  private calculateSummary(analyses: any[]) {
    if (analyses.length === 0) {
      return {
        total: 0,
        passedRate: 0,
        avgRisk: 0,
        avgSecurity: 0,
        avgQuality: 0,
      };
    }

    const passedCount = analyses.filter(a => a.passed).length;
    const avgRisk = analyses.reduce((sum, a) => sum + a.scores.risk, 0) / analyses.length;
    const avgSecurity = analyses.reduce((sum, a) => sum + a.scores.security, 0) / analyses.length;
    const avgQuality = analyses.reduce((sum, a) => sum + a.scores.quality, 0) / analyses.length;

    return {
      total: analyses.length,
      passedRate: Math.round((passedCount / analyses.length) * 100),
      avgRisk: Math.round(avgRisk),
      avgSecurity: Math.round(avgSecurity),
      avgQuality: Math.round(avgQuality),
    };
  }

  private generateFindingsSection(analyses: any[]): string {
    const allFindings = analyses.flatMap(a => a.findings);
    const critical = allFindings.filter((f: any) => f.severity === 'critical').length;
    const high = allFindings.filter((f: any) => f.severity === 'high').length;

    return `
    <h2>Findings</h2>
    <p>Críticos: ${critical}</p>
    <p>Altos: ${high}</p>
    <p>Total: ${allFindings.length}</p>
    `;
  }

  private generateTrendsSection(analyses: any[]): string {
    // Agrupa por data e calcula tendências
    return `
    <h2>Tendências</h2>
    <p>Análise de tendências ao longo do tempo...</p>
    `;
  }

  shouldGenerateReport(config: ReportConfig): boolean {
    if (!config.enabled) return false;

    const lastGenerated = localStorage.getItem(`report_last_${config.id}`);
    if (!lastGenerated) return true;

    const lastDate = new Date(lastGenerated);
    const now = new Date();
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    switch (config.schedule) {
      case 'daily':
        return diffDays >= 1;
      case 'weekly':
        return diffDays >= 7;
      case 'monthly':
        return diffDays >= 30;
      default:
        return false;
    }
  }
}

export const reportManager = new ReportManager();
