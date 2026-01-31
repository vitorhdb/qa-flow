/**
 * Sistema de banco de dados
 * Suporta SQLite (desenvolvimento) e preparado para Supabase/PostgreSQL (produção)
 */

// Importa tipos do sistema de histórico
import type {
  Analysis,
  Finding,
  AnalysisComparison,
  FileRiskHistory,
  ProjectTrend,
  AnalysisFilter,
  HeatmapHistoricalData,
  AnalysisMode,
  QualityGateStatus,
} from '@/types/history';

// Resposta acionável da IA (resumo, top 3, o que fazer agora, o que pode esperar)
export interface ActionableRecord {
  resumoRapido: string;
  top3Problemas: Array<{ problema: string; impactoReal: string; acaoRecomendada: string; severity?: string }>;
  oQueFazerAgora: string[];
  oQuePodeEsperar: string[];
}

// Mantido para compatibilidade com código existente
export interface AnalysisRecord {
  id: string;
  timestamp: Date | string;
  filename?: string;
  language: string;
  scores: {
    risk: number;
    quality: number;
    security: number;
    improvements: number;
  };
  findings: any[]; // Finding[]
  passed: boolean;
  projectId?: string;
  userId?: string;
  commitHash?: string;
  branch?: string;
  metadata?: Record<string, any>;
  code?: string;
  actionable?: ActionableRecord;
}

// Nova interface de Project conforme especificação
export interface Project {
  id: string;
  name: string;
  provider: 'manual' | 'github' | 'gitea';
  repositoryUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  organizationId?: string;
}

export interface GitAccount {
  id: string;
  provider: 'github' | 'gitea';
  username: string;
  email?: string;
  token: string; // Criptografado em produção
  giteaUrl?: string; // Para Gitea
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
}

export interface GitRepository {
  id: string;
  accountId: string;
  repositoryId: string; // ID do repositório no provider
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  language?: string;
  private: boolean;
  provider: 'github' | 'gitea';
  lastSyncAt?: Date;
  syncStatus: 'pending' | 'syncing' | 'success' | 'error';
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitSyncJob {
  id: string;
  repositoryId: string;
  branch: string;
  commitHash?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  analysisCount?: number;
}

class Database {
  private db: IDBDatabase | null = null;
  private dbName = 'qa-flow';
  private version = 3; // Incrementado para adicionar stores de histórico

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB não suportado, usando localStorage como fallback');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // ObjectStore para análises
        if (!db.objectStoreNames.contains('analyses')) {
          const analysesStore = db.createObjectStore('analyses', { keyPath: 'id' });
          analysesStore.createIndex('timestamp', 'timestamp', { unique: false });
          analysesStore.createIndex('projectId', 'projectId', { unique: false });
          analysesStore.createIndex('filename', 'filename', { unique: false });
        }

        // ObjectStore para projetos
        if (!db.objectStoreNames.contains('projects')) {
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectsStore.createIndex('userId', 'userId', { unique: false });
          projectsStore.createIndex('organizationId', 'organizationId', { unique: false });
        }

        // ObjectStore para contas Git
        if (!db.objectStoreNames.contains('gitAccounts')) {
          const gitAccountsStore = db.createObjectStore('gitAccounts', { keyPath: 'id' });
          gitAccountsStore.createIndex('userId', 'userId', { unique: false });
          gitAccountsStore.createIndex('provider', 'provider', { unique: false });
        }

        // ObjectStore para repositórios Git
        if (!db.objectStoreNames.contains('gitRepositories')) {
          const gitReposStore = db.createObjectStore('gitRepositories', { keyPath: 'id' });
          gitReposStore.createIndex('accountId', 'accountId', { unique: false });
          gitReposStore.createIndex('provider', 'provider', { unique: false });
          gitReposStore.createIndex('fullName', 'fullName', { unique: false });
        }

        // ObjectStore para jobs de sync
        if (!db.objectStoreNames.contains('gitSyncJobs')) {
          const syncJobsStore = db.createObjectStore('gitSyncJobs', { keyPath: 'id' });
          syncJobsStore.createIndex('repositoryId', 'repositoryId', { unique: false });
          syncJobsStore.createIndex('status', 'status', { unique: false });
        }

        // ObjectStore para análises históricas (nova estrutura)
        if (!db.objectStoreNames.contains('analyses_history')) {
          const analysesStore = db.createObjectStore('analyses_history', { keyPath: 'id' });
          analysesStore.createIndex('projectId', 'projectId', { unique: false });
          analysesStore.createIndex('timestamp', 'timestamp', { unique: false });
          analysesStore.createIndex('branch', 'branch', { unique: false });
          analysesStore.createIndex('mode', 'mode', { unique: false });
          analysesStore.createIndex('qualityGate', 'qualityGate', { unique: false });
        }

        // ObjectStore para findings históricos
        if (!db.objectStoreNames.contains('findings_history')) {
          const findingsStore = db.createObjectStore('findings_history', { keyPath: 'id' });
          findingsStore.createIndex('analysisId', 'analysisId', { unique: false });
          findingsStore.createIndex('fingerprint', 'fingerprint', { unique: false });
          findingsStore.createIndex('file', 'file', { unique: false });
          findingsStore.createIndex('severity', 'severity', { unique: false });
        }
      };
    });
  }

  async saveAnalysis(analysis: AnalysisRecord): Promise<void> {
    // Normaliza timestamp para string
    const normalized: AnalysisRecord = {
      ...analysis,
      timestamp: analysis.timestamp instanceof Date 
        ? analysis.timestamp.toISOString() 
        : analysis.timestamp,
    };

    if (!this.db) {
      // Fallback para localStorage
      const key = `analysis_${analysis.id}`;
      localStorage.setItem(key, JSON.stringify(normalized));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses'], 'readwrite');
      const store = transaction.objectStore('analyses');
      const request = store.put(normalized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAnalysis(id: string): Promise<AnalysisRecord | null> {
    if (!this.db) {
      // Fallback para localStorage
      const key = `analysis_${id}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      const record = JSON.parse(data);
      // Converte timestamp de string para Date se necessário
      if (typeof record.timestamp === 'string') {
        record.timestamp = new Date(record.timestamp);
      }
      return record;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses'], 'readonly');
      const store = transaction.objectStore('analyses');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && typeof result.timestamp === 'string') {
          result.timestamp = new Date(result.timestamp);
        }
        resolve(result || null);
      };
    });
  }

  async getAllAnalyses(projectId?: string, limit?: number): Promise<AnalysisRecord[]> {
    if (!this.db) {
      // Fallback para localStorage
      const analyses: AnalysisRecord[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('analysis_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const analysis = JSON.parse(data);
            if (!projectId || analysis.projectId === projectId) {
              analyses.push(analysis);
            }
          }
        }
      }
      return analyses.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, limit || 100);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses'], 'readonly');
      const store = transaction.objectStore('analyses');
      const index = projectId 
        ? store.index('projectId')
        : store.index('timestamp');
      
      const request = projectId
        ? index.getAll(projectId)
        : index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = (request.result as AnalysisRecord[]).map(r => ({
          ...r,
          timestamp: typeof r.timestamp === 'string' ? new Date(r.timestamp) : r.timestamp,
        }));
        const sorted = results.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(limit ? sorted.slice(0, limit) : sorted);
      };
    });
  }

  async saveProject(project: Project): Promise<void> {
    if (!this.db) {
      const key = `project_${project.id}`;
      localStorage.setItem(key, JSON.stringify(project));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(project);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getProject(id: string): Promise<Project | null> {
    if (!this.db) {
      const key = `project_${id}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllProjects(userId?: string): Promise<Project[]> {
    if (!this.db) {
      const projects: Project[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('project_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const project = JSON.parse(data);
            if (!userId || project.userId === userId) {
              projects.push(project);
            }
          }
        }
      }
      return projects;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const index = userId 
        ? store.index('userId')
        : store;
      
      const request = userId
        ? index.getAll(userId)
        : store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as Project[]);
    });
  }

  // GitAccount methods
  async saveGitAccount(account: GitAccount): Promise<void> {
    const normalized: GitAccount = {
      ...account,
      createdAt: account.createdAt instanceof Date ? account.createdAt : new Date(account.createdAt),
      updatedAt: account.updatedAt instanceof Date ? account.updatedAt : new Date(account.updatedAt),
    };

    if (!this.db) {
      const key = `gitAccount_${account.id}`;
      localStorage.setItem(key, JSON.stringify(normalized));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitAccounts'], 'readwrite');
      const store = transaction.objectStore('gitAccounts');
      const request = store.put(normalized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getGitAccount(id: string): Promise<GitAccount | null> {
    if (!this.db) {
      const key = `gitAccount_${id}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitAccounts'], 'readonly');
      const store = transaction.objectStore('gitAccounts');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllGitAccounts(userId?: string): Promise<GitAccount[]> {
    if (!this.db) {
      const accounts: GitAccount[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gitAccount_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const account = JSON.parse(data);
            if (!userId || account.userId === userId) {
              accounts.push(account);
            }
          }
        }
      }
      return accounts;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitAccounts'], 'readonly');
      const store = transaction.objectStore('gitAccounts');
      const index = userId ? store.index('userId') : store;
      const request = userId ? index.getAll(userId) : store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as GitAccount[]);
    });
  }

  async deleteGitAccount(id: string): Promise<void> {
    if (!this.db) {
      const key = `gitAccount_${id}`;
      localStorage.removeItem(key);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitAccounts'], 'readwrite');
      const store = transaction.objectStore('gitAccounts');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteAllGitRepositoriesByAccount(accountId: string): Promise<void> {
    const repos = await this.getAllGitRepositories(accountId);
    await Promise.all(repos.map(repo => this.deleteGitRepository(repo.id)));
  }

  // GitRepository methods
  async saveGitRepository(repo: GitRepository): Promise<void> {
    const normalized: GitRepository = {
      ...repo,
      createdAt: repo.createdAt instanceof Date ? repo.createdAt : new Date(repo.createdAt),
      updatedAt: repo.updatedAt instanceof Date ? repo.updatedAt : new Date(repo.updatedAt),
      lastSyncAt: repo.lastSyncAt ? (repo.lastSyncAt instanceof Date ? repo.lastSyncAt : new Date(repo.lastSyncAt)) : undefined,
    };

    if (!this.db) {
      const key = `gitRepo_${repo.id}`;
      localStorage.setItem(key, JSON.stringify(normalized));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitRepositories'], 'readwrite');
      const store = transaction.objectStore('gitRepositories');
      const request = store.put(normalized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getGitRepository(id: string): Promise<GitRepository | null> {
    if (!this.db) {
      const key = `gitRepo_${id}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitRepositories'], 'readonly');
      const store = transaction.objectStore('gitRepositories');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllGitRepositories(accountId?: string): Promise<GitRepository[]> {
    if (!this.db) {
      const repos: GitRepository[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gitRepo_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const repo = JSON.parse(data);
            if (!accountId || repo.accountId === accountId) {
              repos.push(repo);
            }
          }
        }
      }
      return repos;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitRepositories'], 'readonly');
      const store = transaction.objectStore('gitRepositories');
      const index = accountId ? store.index('accountId') : store;
      const request = accountId ? index.getAll(accountId) : store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as GitRepository[]);
    });
  }

  async deleteGitRepository(id: string): Promise<void> {
    if (!this.db) {
      const key = `gitRepo_${id}`;
      localStorage.removeItem(key);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitRepositories'], 'readwrite');
      const store = transaction.objectStore('gitRepositories');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // GitSyncJob methods
  async saveGitSyncJob(job: GitSyncJob): Promise<void> {
    const normalized: GitSyncJob = {
      ...job,
      startedAt: job.startedAt ? (job.startedAt instanceof Date ? job.startedAt : new Date(job.startedAt)) : undefined,
      completedAt: job.completedAt ? (job.completedAt instanceof Date ? job.completedAt : new Date(job.completedAt)) : undefined,
    };

    if (!this.db) {
      const key = `gitSyncJob_${job.id}`;
      localStorage.setItem(key, JSON.stringify(normalized));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitSyncJobs'], 'readwrite');
      const store = transaction.objectStore('gitSyncJobs');
      const request = store.put(normalized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getGitSyncJob(id: string): Promise<GitSyncJob | null> {
    if (!this.db) {
      const key = `gitSyncJob_${id}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitSyncJobs'], 'readonly');
      const store = transaction.objectStore('gitSyncJobs');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllGitSyncJobs(repositoryId?: string, status?: GitSyncJob['status']): Promise<GitSyncJob[]> {
    if (!this.db) {
      const jobs: GitSyncJob[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gitSyncJob_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const job = JSON.parse(data);
            if ((!repositoryId || job.repositoryId === repositoryId) && (!status || job.status === status)) {
              jobs.push(job);
            }
          }
        }
      }
      return jobs.sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitSyncJobs'], 'readonly');
      const store = transaction.objectStore('gitSyncJobs');
      const index = repositoryId ? store.index('repositoryId') : store;
      const request = repositoryId ? index.getAll(repositoryId) : store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let results = request.result as GitSyncJob[];
        if (status) {
          results = results.filter(j => j.status === status);
        }
        results.sort((a, b) => {
          const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return bTime - aTime;
        });
        resolve(results);
      };
    });
  }

  async deleteAllGitSyncJobsByRepository(repositoryId: string): Promise<void> {
    const jobs = await this.getAllGitSyncJobs(repositoryId);
    if (!this.db) {
      // localStorage fallback
      jobs.forEach(job => {
        const key = `gitSyncJob_${job.id}`;
        localStorage.removeItem(key);
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gitSyncJobs'], 'readwrite');
      const store = transaction.objectStore('gitSyncJobs');
      
      const deletePromises = jobs.map(job => {
        return new Promise<void>((res, rej) => {
          const request = store.delete(job.id);
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });
      });

      Promise.all(deletePromises)
        .then(() => resolve())
        .catch(reject);
    });
  }

  // ============================================
  // SISTEMA DE HISTÓRICO DE ANÁLISES
  // ============================================

  /**
   * Salva uma análise histórica (imutável)
   */
  async saveAnalysisHistory(analysis: Analysis): Promise<void> {
    const normalized: Analysis = {
      ...analysis,
      timestamp: analysis.timestamp instanceof Date ? analysis.timestamp : new Date(analysis.timestamp),
    };

    if (!this.db) {
      const key = `analysis_history_${analysis.id}`;
      localStorage.setItem(key, JSON.stringify(normalized));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses_history'], 'readwrite');
      const store = transaction.objectStore('analyses_history');
      const request = store.put(normalized);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Salva findings de uma análise
   */
  async saveFindings(findings: Finding[]): Promise<void> {
    if (findings.length === 0) return;

    if (!this.db) {
      findings.forEach(finding => {
        const key = `finding_${finding.id}`;
        localStorage.setItem(key, JSON.stringify(finding));
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['findings_history'], 'readwrite');
      const store = transaction.objectStore('findings_history');
      
      const promises = findings.map(finding => {
        return new Promise<void>((res, rej) => {
          const request = store.put(finding);
          request.onerror = () => rej(request.error);
          request.onsuccess = () => res();
        });
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch(reject);
    });
  }

  /**
   * Busca análises com filtros
   */
  async getAnalysesHistory(filter: AnalysisFilter = {}): Promise<Analysis[]> {
    if (!this.db) {
      const analyses: Analysis[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('analysis_history_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const analysis = JSON.parse(data);
            if (this.matchesAnalysisFilter(analysis, filter)) {
              analyses.push({
                ...analysis,
                timestamp: new Date(analysis.timestamp),
              });
            }
          }
        }
      }
      return analyses.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(filter.offset || 0, (filter.offset || 0) + (filter.limit || 100));
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses_history'], 'readonly');
      const store = transaction.objectStore('analyses_history');
      
      let index = store.index('timestamp');
      if (filter.projectId) {
        index = store.index('projectId');
      }
      
      const request = filter.projectId 
        ? index.getAll(filter.projectId)
        : index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let results = (request.result as Analysis[])
          .map(a => ({
            ...a,
            timestamp: new Date(a.timestamp),
          }))
          .filter(a => this.matchesAnalysisFilter(a, filter))
          .sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

        if (filter.limit) {
          results = results.slice(filter.offset || 0, (filter.offset || 0) + filter.limit);
        } else if (filter.offset) {
          results = results.slice(filter.offset);
        }

        resolve(results);
      };
    });
  }

  /**
   * Verifica se uma análise corresponde aos filtros
   */
  private matchesAnalysisFilter(analysis: Analysis, filter: AnalysisFilter): boolean {
    if (filter.projectId && analysis.projectId !== filter.projectId) return false;
    if (filter.branch && analysis.branch !== filter.branch) return false;
    if (filter.mode && analysis.mode !== filter.mode) return false;
    if (filter.qualityGate && analysis.qualityGate !== filter.qualityGate) return false;
    if (filter.startDate && new Date(analysis.timestamp) < filter.startDate) return false;
    if (filter.endDate && new Date(analysis.timestamp) > filter.endDate) return false;
    if (filter.minRiskScore !== undefined && analysis.riskScore < filter.minRiskScore) return false;
    if (filter.maxRiskScore !== undefined && analysis.riskScore > filter.maxRiskScore) return false;
    return true;
  }

  /**
   * Busca findings de uma análise
   */
  async getFindingsByAnalysis(analysisId: string): Promise<Finding[]> {
    if (!this.db) {
      const findings: Finding[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('finding_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const finding = JSON.parse(data);
            if (finding.analysisId === analysisId) {
              findings.push(finding);
            }
          }
        }
      }
      return findings;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['findings_history'], 'readonly');
      const store = transaction.objectStore('findings_history');
      const index = store.index('analysisId');
      const request = index.getAll(analysisId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as Finding[]);
    });
  }

  /**
   * Busca análise por ID
   */
  async getAnalysisHistory(id: string): Promise<Analysis | null> {
    if (!this.db) {
      const key = `analysis_history_${id}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      const analysis = JSON.parse(data);
      return {
        ...analysis,
        timestamp: new Date(analysis.timestamp),
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['analyses_history'], 'readonly');
      const store = transaction.objectStore('analyses_history');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          result.timestamp = new Date(result.timestamp);
        }
        resolve(result || null);
      };
    });
  }

  /**
   * Busca findings por fingerprint (para rastreamento temporal)
   */
  async getFindingsByFingerprint(fingerprint: string, projectId?: string): Promise<Finding[]> {
    if (!this.db) {
      const findings: Finding[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('finding_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const finding = JSON.parse(data);
            if (finding.fingerprint === fingerprint) {
              if (!projectId) {
                findings.push(finding);
              } else {
                // Precisaria buscar a análise para verificar projectId
                // Por simplicidade, retorna todos
                findings.push(finding);
              }
            }
          }
        }
      }
      return findings;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['findings_history'], 'readonly');
      const store = transaction.objectStore('findings_history');
      const index = store.index('fingerprint');
      const request = index.getAll(fingerprint);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let results = request.result as Finding[];
        if (projectId) {
          // Filtra por projectId se necessário
          // Isso requer buscar as análises correspondentes
          results = results; // Simplificado por enquanto
        }
        resolve(results);
      };
    });
  }
}

export const db = new Database();

// Inicializa o banco quando o módulo é carregado
if (typeof window !== 'undefined') {
  db.init().catch(console.error);
}
