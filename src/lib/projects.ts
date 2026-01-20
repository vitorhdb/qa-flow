/**
 * Sistema de Projetos
 * Gerencia múltiplos projetos e suas análises
 */

import { db, type Project, type AnalysisRecord } from './database';

export interface ProjectWithStats extends Project {
  totalAnalyses: number;
  lastAnalysis?: Date;
  averageRisk: number;
  averageQuality: number;
  averageSecurity: number;
  passedRate: number;
}

export async function createProject(
  name: string,
  description?: string,
  repositoryUrl?: string
): Promise<Project> {
  const project: Project = {
    id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    repositoryUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.saveProject(project);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project> {
  const project = await db.getProject(id);
  if (!project) {
    throw new Error('Projeto não encontrado');
  }

  const updated: Project = {
    ...project,
    ...updates,
    updatedAt: new Date(),
  };

  await db.saveProject(updated);
  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  // Em uma implementação completa, também deletaria análises relacionadas
  // Por enquanto, apenas marca como deletado ou remove do banco
  const project = await db.getProject(id);
  if (project) {
    // Implementação de soft delete ou hard delete
    // await db.deleteProject(id);
  }
}

export async function getProjectWithStats(id: string): Promise<ProjectWithStats | null> {
  const project = await db.getProject(id);
  if (!project) return null;

  const analyses = await db.getAllAnalyses(id);
  
  if (analyses.length === 0) {
    return {
      ...project,
      totalAnalyses: 0,
      averageRisk: 0,
      averageQuality: 0,
      averageSecurity: 0,
      passedRate: 0,
    };
  }

  const totalAnalyses = analyses.length;
  const lastAnalysis = analyses[0]?.timestamp ? new Date(analyses[0].timestamp) : undefined;
  const averageRisk = analyses.reduce((sum, a) => sum + a.scores.risk, 0) / totalAnalyses;
  const averageQuality = analyses.reduce((sum, a) => sum + a.scores.quality, 0) / totalAnalyses;
  const averageSecurity = analyses.reduce((sum, a) => sum + a.scores.security, 0) / totalAnalyses;
  const passedCount = analyses.filter(a => a.passed).length;
  const passedRate = (passedCount / totalAnalyses) * 100;

  return {
    ...project,
    totalAnalyses,
    lastAnalysis,
    averageRisk: Math.round(averageRisk),
    averageQuality: Math.round(averageQuality),
    averageSecurity: Math.round(averageSecurity),
    passedRate: Math.round(passedRate * 100) / 100,
  };
}

export async function getAllProjectsWithStats(): Promise<ProjectWithStats[]> {
  const projects = await db.getAllProjects();
  const projectsWithStats = await Promise.all(
    projects.map(p => getProjectWithStats(p.id))
  );
  return projectsWithStats.filter((p): p is ProjectWithStats => p !== null);
}
