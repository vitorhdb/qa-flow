/**
 * Sistema de banco de dados
 * Suporta SQLite (desenvolvimento) e preparado para Supabase/PostgreSQL (produção)
 */

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
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  repositoryUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  organizationId?: string;
}

class Database {
  private db: IDBDatabase | null = null;
  private dbName = 'qa-flow';
  private version = 1;

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
}

export const db = new Database();

// Inicializa o banco quando o módulo é carregado
if (typeof window !== 'undefined') {
  db.init().catch(console.error);
}
