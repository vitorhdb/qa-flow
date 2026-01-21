/**
 * Sistema de Tendências e Histórico Temporal
 * Calcula evolução de qualidade ao longo do tempo
 */

import type { 
  Analysis, 
  FileRiskHistory, 
  ProjectTrend, 
  HeatmapHistoricalData,
  AnalysisFilter 
} from '@/types/history';
import { db } from './database';
import { buildFileRiskMatrixItems } from './risk-matrix';

/**
 * Calcula histórico de risco por arquivo
 */
export async function getFileRiskHistory(
  file: string,
  projectId: string,
  limit: number = 50
): Promise<FileRiskHistory> {
  // Busca todas as análises do projeto
  const analyses = await db.getAnalysesHistory({
    projectId,
    limit: limit * 10, // Busca mais análises para ter dados suficientes
  });
  
  const history: FileRiskHistory['history'] = [];
  
  for (const analysis of analyses) {
    const findings = await db.getFindingsByAnalysis(analysis.id);
    const fileFindings = findings.filter(f => f.file === file);
    
    if (fileFindings.length > 0) {
      // Calcula risco do arquivo nesta análise
      const criticalCount = fileFindings.filter(f => f.severity === 'critical').length;
      const highCount = fileFindings.filter(f => f.severity === 'high').length;
      
      // Calcula impact e probability baseado nos findings
      const impact = Math.min(5, Math.max(1, criticalCount * 2 + highCount));
      const probability = Math.min(5, Math.max(1, Math.ceil(fileFindings.length / 2)));
      
      history.push({
        analysisId: analysis.id,
        timestamp: analysis.timestamp,
        riskScore: analysis.riskScore,
        impact,
        probability,
        findingsCount: fileFindings.length,
        criticalFindings: criticalCount,
      });
    }
  }
  
  // Ordena por timestamp (mais antigo primeiro)
  history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Calcula tendência
  let trend: FileRiskHistory['trend'] = 'stable';
  if (history.length >= 2) {
    const recent = history.slice(-3);
    const older = history.slice(0, Math.min(3, history.length - 3));
    
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((sum, h) => sum + h.riskScore, 0) / recent.length;
      const olderAvg = older.reduce((sum, h) => sum + h.riskScore, 0) / older.length;
      
      const diff = recentAvg - olderAvg;
      if (diff < -5) trend = 'improving';
      else if (diff > 5) trend = 'degrading';
    }
  }
  
  const riskScores = history.map(h => h.riskScore);
  const averageRisk = riskScores.length > 0 
    ? riskScores.reduce((sum, r) => sum + r, 0) / riskScores.length 
    : 0;
  const maxRisk = riskScores.length > 0 ? Math.max(...riskScores) : 0;
  const minRisk = riskScores.length > 0 ? Math.min(...riskScores) : 0;
  
  return {
    file,
    projectId,
    history,
    trend,
    averageRisk,
    maxRisk,
    minRisk,
  };
}

/**
 * Calcula tendência geral do projeto
 */
export async function getProjectTrend(
  projectId: string,
  days: number = 30
): Promise<ProjectTrend> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const analyses = await db.getAnalysesHistory({
    projectId,
    startDate,
    endDate,
    limit: 1000,
  });
  
  if (analyses.length === 0) {
    return {
      projectId,
      period: { start: startDate, end: endDate },
      riskTrend: 'stable',
      qualityTrend: 'stable',
      securityTrend: 'stable',
      analysesCount: 0,
      averageRiskScore: 0,
      averageQualityScore: 0,
      averageSecurityScore: 0,
      qualityGatePassRate: 0,
      qualityGateFailures: 0,
      totalFindings: 0,
      newFindingsRate: 0,
      resolvedFindingsRate: 0,
      highRiskFiles: [],
      improvingFiles: [],
      degradingFiles: [],
    };
  }
  
  // Calcula tendências de score
  const calculateTrend = (scores: number[]): 'improving' | 'stable' | 'degrading' => {
    if (scores.length < 2) return 'stable';
    
    const recent = scores.slice(-Math.min(5, Math.floor(scores.length / 2)));
    const older = scores.slice(0, Math.max(1, scores.length - recent.length));
    
    const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    if (diff < -3) return 'improving';
    if (diff > 3) return 'degrading';
    return 'stable';
  };
  
  const riskScores = analyses.map(a => a.riskScore);
  const qualityScores = analyses.map(a => a.qualityScore);
  const securityScores = analyses.map(a => a.securityScore);
  
  // Quality Gate
  const passed = analyses.filter(a => a.qualityGate === 'PASS').length;
  const qualityGatePassRate = analyses.length > 0 ? (passed / analyses.length) * 100 : 0;
  const qualityGateFailures = analyses.length - passed;
  
  // Findings
  let totalFindings = 0;
  const allFindings = await Promise.all(
    analyses.map(a => db.getFindingsByAnalysis(a.id))
  );
  totalFindings = allFindings.reduce((sum, findings) => sum + findings.length, 0);
  
  // Arquivos problemáticos (simplificado - em produção, calcular por arquivo)
  const fileRiskMap = new Map<string, number[]>();
  for (const findings of allFindings) {
    findings.forEach(f => {
      if (!fileRiskMap.has(f.file)) {
        fileRiskMap.set(f.file, []);
      }
      const risks = fileRiskMap.get(f.file)!;
      const riskValue = f.severity === 'critical' ? 5 : 
                       f.severity === 'high' ? 4 :
                       f.severity === 'medium' ? 3 : 2;
      risks.push(riskValue);
    });
  }
  
  const fileAverages = Array.from(fileRiskMap.entries())
    .map(([file, risks]) => ({
      file,
      average: risks.reduce((sum, r) => sum + r, 0) / risks.length,
    }))
    .sort((a, b) => b.average - a.average);
  
  const highRiskFiles = fileAverages.slice(0, 10).map(f => f.file);
  
  return {
    projectId,
    period: { start: startDate, end: endDate },
    riskTrend: calculateTrend(riskScores),
    qualityTrend: calculateTrend(qualityScores),
    securityTrend: calculateTrend(securityScores),
    analysesCount: analyses.length,
    averageRiskScore: riskScores.reduce((sum, s) => sum + s, 0) / riskScores.length,
    averageQualityScore: qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length,
    averageSecurityScore: securityScores.reduce((sum, s) => sum + s, 0) / securityScores.length,
    qualityGatePassRate,
    qualityGateFailures,
    totalFindings,
    newFindingsRate: 0, // Seria calculado comparando análises
    resolvedFindingsRate: 0, // Seria calculado comparando análises
    highRiskFiles,
    improvingFiles: [], // Seria calculado por arquivo
    degradingFiles: [], // Seria calculado por arquivo
  };
}

/**
 * Gera dados históricos para heatmap
 */
export async function getHeatmapHistoricalData(
  projectId: string,
  limit: number = 20
): Promise<HeatmapHistoricalData[]> {
  const analyses = await db.getAnalysesHistory({
    projectId,
    limit,
  });
  
  if (analyses.length === 0) return [];
  
  // Agrupa findings por arquivo
  const fileMap = new Map<string, HeatmapHistoricalData>();
  
  for (const analysis of analyses) {
    const findings = await db.getFindingsByAnalysis(analysis.id);
    
    findings.forEach(finding => {
      if (!fileMap.has(finding.file)) {
        fileMap.set(finding.file, {
          file: finding.file,
          projectId,
          riskEvolution: [],
          currentRisk: {
            impact: 1,
            probability: 1,
            riskLevel: 'low',
          },
          trend: 'stable',
          trendScore: 0,
        });
      }
      
      const data = fileMap.get(finding.file)!;
      const criticalCount = findings.filter(f => f.file === finding.file && f.severity === 'critical').length;
      const highCount = findings.filter(f => f.file === finding.file && f.severity === 'high').length;
      
      const impact = Math.min(5, Math.max(1, criticalCount * 2 + highCount));
      const probability = Math.min(5, Math.max(1, Math.ceil(findings.filter(f => f.file === finding.file).length / 2)));
      
      const riskLevel = impact >= 4 && probability >= 4 ? 'critical' :
                       impact >= 3 && probability >= 3 ? 'high' :
                       impact >= 2 && probability >= 2 ? 'medium' : 'low';
      
      data.riskEvolution.push({
        timestamp: analysis.timestamp,
        impact,
        probability,
        riskLevel,
      });
    });
  }
  
  // Calcula risco atual e tendência para cada arquivo
  const result: HeatmapHistoricalData[] = [];
  
  fileMap.forEach((data, file) => {
    if (data.riskEvolution.length === 0) return;
    
    // Risco atual (última análise)
    const latest = data.riskEvolution[data.riskEvolution.length - 1];
    data.currentRisk = {
      impact: latest.impact,
      probability: latest.probability,
      riskLevel: latest.riskLevel,
    };
    
    // Tendência
    if (data.riskEvolution.length >= 2) {
      const recent = data.riskEvolution.slice(-3);
      const older = data.riskEvolution.slice(0, Math.max(1, data.riskEvolution.length - 3));
      
      const recentAvg = recent.reduce((sum, r) => sum + r.impact * r.probability, 0) / recent.length;
      const olderAvg = older.reduce((sum, r) => sum + r.impact * r.probability, 0) / older.length;
      
      const diff = recentAvg - olderAvg;
      data.trendScore = diff / 10; // Normaliza para -1 a 1
      
      if (diff < -2) data.trend = 'improving';
      else if (diff > 2) data.trend = 'degrading';
      else data.trend = 'stable';
    }
    
    result.push(data);
  });
  
  return result;
}
