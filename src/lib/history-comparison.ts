/**
 * Sistema de Comparação entre Análises
 * Identifica novos problemas, problemas resolvidos e persistentes
 */

import type { Analysis, Finding, AnalysisComparison } from '@/types/history';
import { db } from './database';

/**
 * Calcula fingerprint de um finding
 * Hash lógico: type + severity + file + line + description
 */
export function calculateFindingFingerprint(finding: Finding): string {
  const parts = [
    finding.type,
    finding.severity,
    finding.file,
    finding.line?.toString() || '',
    finding.description,
  ].join('|');
  
  // Hash simples (em produção, usar crypto.subtle)
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    const char = parts.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Compara duas análises e identifica mudanças
 */
export async function compareAnalyses(
  baselineAnalysisId: string,
  currentAnalysisId: string
): Promise<AnalysisComparison> {
  const baselineAnalysis = await db.getAnalysisHistory(baselineAnalysisId);
  const currentAnalysis = await db.getAnalysisHistory(currentAnalysisId);
  
  if (!baselineAnalysis || !currentAnalysis) {
    throw new Error('Análise não encontrada');
  }
  
  if (baselineAnalysis.projectId !== currentAnalysis.projectId) {
    throw new Error('Análises devem ser do mesmo projeto');
  }
  
  const baselineFindings = await db.getFindingsByAnalysis(baselineAnalysisId);
  const currentFindings = await db.getFindingsByAnalysis(currentAnalysisId);
  
  // Calcula fingerprints para todos os findings
  const baselineFingerprints = new Map<string, Finding>();
  const currentFingerprints = new Map<string, Finding>();
  
  baselineFindings.forEach(f => {
    const fp = f.fingerprint || calculateFindingFingerprint(f);
    baselineFingerprints.set(fp, { ...f, fingerprint: fp });
  });
  
  currentFindings.forEach(f => {
    const fp = f.fingerprint || calculateFindingFingerprint(f);
    currentFingerprints.set(fp, { ...f, fingerprint: fp });
  });
  
  // Identifica novos, resolvidos e persistentes
  const newFindings: Finding[] = [];
  const resolvedFindings: Finding[] = [];
  const persistentFindings: Finding[] = [];
  const severityChanges: AnalysisComparison['severityChanges'] = [];
  
  // Novos findings (existem apenas na análise atual)
  currentFingerprints.forEach((finding, fingerprint) => {
    if (!baselineFingerprints.has(fingerprint)) {
      newFindings.push(finding);
    } else {
      // Persistentes - verifica mudança de severidade
      const baselineFinding = baselineFingerprints.get(fingerprint)!;
      if (baselineFinding.severity !== finding.severity) {
        severityChanges.push({
          findingId: finding.id,
          oldSeverity: baselineFinding.severity,
          newSeverity: finding.severity,
        });
      }
      persistentFindings.push(finding);
    }
  });
  
  // Resolvidos (existem apenas na análise baseline)
  baselineFingerprints.forEach((finding, fingerprint) => {
    if (!currentFingerprints.has(fingerprint)) {
      resolvedFindings.push(finding);
    }
  });
  
  return {
    baselineAnalysisId,
    currentAnalysisId,
    projectId: baselineAnalysis.projectId,
    
    // Deltas de score
    riskScoreDelta: currentAnalysis.riskScore - baselineAnalysis.riskScore,
    qualityScoreDelta: currentAnalysis.qualityScore - baselineAnalysis.qualityScore,
    securityScoreDelta: currentAnalysis.securityScore - baselineAnalysis.securityScore,
    improvementScoreDelta: currentAnalysis.improvementScore - baselineAnalysis.improvementScore,
    
    // Findings
    newFindings,
    resolvedFindings,
    persistentFindings,
    severityChanges,
    
    // Estatísticas
    totalNewFindings: newFindings.length,
    totalResolvedFindings: resolvedFindings.length,
    totalPersistentFindings: persistentFindings.length,
    totalSeverityChanges: severityChanges.length,
    
    // Quality Gate
    baselineQualityGate: baselineAnalysis.qualityGate,
    currentQualityGate: currentAnalysis.qualityGate,
    qualityGateChanged: baselineAnalysis.qualityGate !== currentAnalysis.qualityGate,
  };
}

/**
 * Compara análise atual com a anterior do mesmo projeto/branch
 */
export async function compareWithPreviousAnalysis(
  currentAnalysisId: string
): Promise<AnalysisComparison | null> {
  const currentAnalysis = await db.getAnalysisHistory(currentAnalysisId);
  if (!currentAnalysis) return null;
  
  // Busca análise anterior
  const previousAnalyses = await db.getAnalysesHistory({
    projectId: currentAnalysis.projectId,
    branch: currentAnalysis.branch,
    limit: 2,
  });
  
  if (previousAnalyses.length < 2) return null;
  
  // A primeira é a atual, a segunda é a anterior
  const previousAnalysis = previousAnalyses[1];
  
  return compareAnalyses(previousAnalysis.id, currentAnalysisId);
}
