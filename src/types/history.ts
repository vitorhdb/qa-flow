/**
 * Sistema de Histórico de Análises - QA FLOW!
 * 
 * Modelo de dados para governança contínua de qualidade e risco
 */

export type AnalysisMode = 'manual' | 'folder' | 'repo' | 'ci';
export type ProjectProvider = 'manual' | 'github' | 'gitea';
export type QualityGateStatus = 'PASS' | 'FAIL';
export type FindingType = 'quality' | 'security' | 'improvement';
export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Project - Representa o sistema analisado
 */
export interface Project {
  id: string;
  name: string;
  provider: ProjectProvider;
  repositoryUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  organizationId?: string;
}

/**
 * Analysis - Snapshot imutável de cada execução de análise
 * REGRA: Análises nunca são atualizadas, apenas criadas
 */
export interface Analysis {
  id: string;
  projectId: string;
  timestamp: Date;
  branch?: string;
  commitHash?: string;
  mode: AnalysisMode;
  
  // Scores agregados da análise
  riskScore: number;
  qualityScore: number;
  securityScore: number;
  improvementScore: number;
  
  // Quality Gate
  qualityGate: QualityGateStatus;
  qualityGateReason?: string;
  
  // Metadados
  fileCount?: number;
  totalFindings?: number;
  criticalFindings?: number;
  highFindings?: number;
  mediumFindings?: number;
  lowFindings?: number;
  
  // Contexto
  metadata?: Record<string, any>;
}

/**
 * Finding - Representa cada problema encontrado
 * Com fingerprint para rastreamento temporal
 */
export interface Finding {
  id: string;
  analysisId: string;
  type: FindingType;
  severity: FindingSeverity;
  file: string;
  line?: number;
  description: string;
  code?: string;
  
  /**
   * Fingerprint - Hash lógico do problema
   * Permite identificar:
   * - Problemas novos
   * - Problemas persistentes
   * - Problemas resolvidos
   * 
   * Calculado como: hash(type + severity + file + line + description)
   */
  fingerprint: string;
  
  // Metadados adicionais
  title?: string;
  rule?: string;
  category?: string;
}

/**
 * AnalysisComparison - Comparação entre duas análises
 */
export interface AnalysisComparison {
  baselineAnalysisId: string;
  currentAnalysisId: string;
  projectId: string;
  
  // Mudanças de score
  riskScoreDelta: number;
  qualityScoreDelta: number;
  securityScoreDelta: number;
  improvementScoreDelta: number;
  
  // Mudanças de findings
  newFindings: Finding[];
  resolvedFindings: Finding[];
  persistentFindings: Finding[];
  severityChanges: {
    findingId: string;
    oldSeverity: FindingSeverity;
    newSeverity: FindingSeverity;
  }[];
  
  // Estatísticas
  totalNewFindings: number;
  totalResolvedFindings: number;
  totalPersistentFindings: number;
  totalSeverityChanges: number;
  
  // Quality Gate
  baselineQualityGate: QualityGateStatus;
  currentQualityGate: QualityGateStatus;
  qualityGateChanged: boolean;
}

/**
 * FileRiskHistory - Histórico de risco por arquivo
 */
export interface FileRiskHistory {
  file: string;
  projectId: string;
  history: {
    analysisId: string;
    timestamp: Date;
    riskScore: number;
    impact: number;
    probability: number;
    findingsCount: number;
    criticalFindings: number;
  }[];
  
  // Tendências
  trend: 'improving' | 'stable' | 'degrading';
  averageRisk: number;
  maxRisk: number;
  minRisk: number;
}

/**
 * ProjectTrend - Tendência geral do projeto
 */
export interface ProjectTrend {
  projectId: string;
  period: {
    start: Date;
    end: Date;
  };
  
  // Tendências de score
  riskTrend: 'improving' | 'stable' | 'degrading';
  qualityTrend: 'improving' | 'stable' | 'degrading';
  securityTrend: 'improving' | 'stable' | 'degrading';
  
  // Métricas
  analysesCount: number;
  averageRiskScore: number;
  averageQualityScore: number;
  averageSecurityScore: number;
  
  // Quality Gate
  qualityGatePassRate: number;
  qualityGateFailures: number;
  
  // Findings
  totalFindings: number;
  newFindingsRate: number;
  resolvedFindingsRate: number;
  
  // Arquivos problemáticos
  highRiskFiles: string[];
  improvingFiles: string[];
  degradingFiles: string[];
}

/**
 * AnalysisFilter - Filtros para consulta de histórico
 */
export interface AnalysisFilter {
  projectId?: string;
  branch?: string;
  mode?: AnalysisMode;
  qualityGate?: QualityGateStatus;
  startDate?: Date;
  endDate?: Date;
  minRiskScore?: number;
  maxRiskScore?: number;
  limit?: number;
  offset?: number;
}

/**
 * HeatmapHistoricalData - Dados para heatmap histórico
 */
export interface HeatmapHistoricalData {
  file: string;
  projectId: string;
  riskEvolution: {
    timestamp: Date;
    impact: number;
    probability: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }[];
  
  // Status atual
  currentRisk: {
    impact: number;
    probability: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // Tendência
  trend: 'improving' | 'stable' | 'degrading';
  trendScore: number; // -1 a 1
}
