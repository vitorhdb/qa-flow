export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  type: 'security' | 'quality' | 'improvement';
  severity: Severity;
  title: string;
  description: string;
  line?: number;
  code?: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  filename?: string;
  code: string;
  language: string;
  scores: {
    risk: number;
    quality: number;
    security: number;
    improvements: number;
  };
  findings: Finding[];
  passed: boolean;
}

export interface FileAnalysis {
  filename: string;
  risk: number;
  findings: Finding[];
}

export interface DashboardMetrics {
  totalAnalyses: number;
  averageRisk: number;
  averageQuality: number;
  passRate: number;
  recentAnalyses: AnalysisResult[];
}
