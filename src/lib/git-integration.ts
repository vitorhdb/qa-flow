/**
 * Integração com GitHub e Gitea
 * Suporta autenticação OAuth e leitura de repositórios
 */

export interface GitRepository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  language?: string;
  private: boolean;
  provider: 'github' | 'gitea';
}

export interface GitBranch {
  name: string;
  commit: {
    sha: string;
    message: string;
    author: string;
    date: Date;
  };
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: Date;
  files: GitFile[];
}

export interface GitFile {
  path: string;
  content: string;
  language?: string;
}

export interface GitProvider {
  authenticate(): Promise<string>; // Retorna token
  getRepositories(): Promise<GitRepository[]>;
  getBranches(repo: string): Promise<GitBranch[]>;
  getCommits(repo: string, branch?: string): Promise<GitCommit[]>;
  getFileContent(repo: string, path: string, ref?: string): Promise<string>;
  getFilesInDirectory(repo: string, path: string, ref?: string): Promise<GitFile[]>;
}

class GitHubProvider implements GitProvider {
  private token: string | null = null;
  private baseUrl = 'https://api.github.com';

  async authenticate(): Promise<string> {
    // OAuth flow - redireciona para GitHub
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    
    if (!clientId) {
      throw new Error(
        'GitHub Client ID não configurado. Configure VITE_GITHUB_CLIENT_ID no arquivo .env ou use um Personal Access Token.'
      );
    }
    
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const scope = 'repo read:org';
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    
    window.location.href = authUrl;
    
    // O token será recebido via callback
    return new Promise((resolve) => {
      // Será resolvido quando o callback processar o código
      const checkToken = setInterval(() => {
        const token = localStorage.getItem('github_token');
        if (token) {
          clearInterval(checkToken);
          this.token = token;
          resolve(token);
        }
      }, 100);
    });
  }
  
  /**
   * Autentica usando Personal Access Token diretamente
   * Útil quando OAuth não está configurado
   */
  authenticateWithToken(token: string): void {
    this.setToken(token);
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('github_token', token);
  }

  private async apiRequest(endpoint: string): Promise<any> {
    if (!this.token) {
      throw new Error('Não autenticado. Chame authenticate() primeiro.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      let errorMessage = `GitHub API error: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Se não conseguir parsear, usa o texto original
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getRepositories(): Promise<GitRepository[]> {
    const repos = await this.apiRequest('/user/repos?per_page=100&sort=updated');
    return repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      language: repo.language,
      private: repo.private,
      provider: 'github' as const,
    }));
  }

  async getBranches(repo: string): Promise<GitBranch[]> {
    const branches = await this.apiRequest(`/repos/${repo}/branches`);
    return branches.map((branch: any) => {
      const commit = branch.commit || {};
      const commitDetails = commit.commit || {};
      const author = commitDetails.author || {};
      
      return {
        name: branch.name,
        commit: {
          sha: commit.sha || '',
          message: commitDetails.message || 'Sem mensagem',
          author: author.name || 'Desconhecido',
          date: author.date ? new Date(author.date) : new Date(),
        },
      };
    });
  }

  async getCommits(repo: string, branch: string = 'main'): Promise<GitCommit[]> {
    const commits = await this.apiRequest(`/repos/${repo}/commits?sha=${branch}&per_page=50`);
    return commits.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: new Date(commit.commit.author.date),
      files: [], // Será preenchido se necessário
    }));
  }

  async getFileContent(repo: string, path: string, ref: string = 'main'): Promise<string> {
    const file = await this.apiRequest(`/repos/${repo}/contents/${path}?ref=${ref}`);
    if (file.encoding === 'base64') {
      return atob(file.content);
    }
    return file.content;
  }

  async getFilesInDirectory(repo: string, path: string = '', ref: string = 'main'): Promise<GitFile[]> {
    const contents = await this.apiRequest(`/repos/${repo}/contents/${path}?ref=${ref}`);
    const files: GitFile[] = [];

    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const content = await this.getFileContent(repo, item.path, ref);
          files.push({
            path: item.path,
            content,
            language: item.name.split('.').pop(),
          });
        } catch (error) {
          console.warn(`Erro ao ler arquivo ${item.path}:`, error);
        }
      } else if (item.type === 'dir') {
        // Recursivo para subdiretórios
        const subFiles = await this.getFilesInDirectory(repo, item.path, ref);
        files.push(...subFiles);
      }
    }

    return files;
  }
}

class GiteaProvider implements GitProvider {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async authenticate(): Promise<string> {
    // Similar ao GitHub, mas adaptado para Gitea
    const clientId = import.meta.env.VITE_GITEA_CLIENT_ID || '';
    
    if (!clientId) {
      throw new Error(
        'Gitea Client ID não configurado. Configure VITE_GITEA_CLIENT_ID no arquivo .env ou use um Personal Access Token.'
      );
    }
    
    const redirectUri = `${window.location.origin}/auth/gitea/callback`;
    
    const authUrl = `${this.baseUrl}/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    
    window.location.href = authUrl;
    
    return new Promise((resolve) => {
      const checkToken = setInterval(() => {
        const token = localStorage.getItem('gitea_token');
        if (token) {
          clearInterval(checkToken);
          this.token = token;
          resolve(token);
        }
      }, 100);
    });
  }
  
  /**
   * Autentica usando Personal Access Token diretamente
   */
  authenticateWithToken(token: string): void {
    this.setToken(token);
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('gitea_token', token);
  }

  private async apiRequest(endpoint: string): Promise<any> {
    if (!this.token) {
      throw new Error('Não autenticado. Chame authenticate() primeiro.');
    }

    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      headers: {
        'Authorization': `token ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Gitea API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getRepositories(): Promise<GitRepository[]> {
    const repos = await this.apiRequest('/user/repos');
    return repos.map((repo: any) => ({
      id: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      language: repo.language,
      private: repo.private,
      provider: 'gitea' as const,
    }));
  }

  async getBranches(repo: string): Promise<GitBranch[]> {
    const branches = await this.apiRequest(`/repos/${repo}/branches`);
    return branches.map((branch: any) => {
      const commit = branch.commit || {};
      const author = commit.author || {};
      
      return {
        name: branch.name,
        commit: {
          sha: commit.id || commit.sha || '',
          message: commit.message || 'Sem mensagem',
          author: author.name || 'Desconhecido',
          date: commit.timestamp ? new Date(commit.timestamp) : (author.date ? new Date(author.date) : new Date()),
        },
      };
    });
  }

  async getCommits(repo: string, branch: string = 'main'): Promise<GitCommit[]> {
    const commits = await this.apiRequest(`/repos/${repo}/commits?sha=${branch}&limit=50`);
    return commits.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: new Date(commit.commit.author.date),
      files: [],
    }));
  }

  async getFileContent(repo: string, path: string, ref: string = 'main'): Promise<string> {
    const file = await this.apiRequest(`/repos/${repo}/contents/${path}?ref=${ref}`);
    if (file.encoding === 'base64') {
      return atob(file.content);
    }
    return file.content;
  }

  async getFilesInDirectory(repo: string, path: string = '', ref: string = 'main'): Promise<GitFile[]> {
    const contents = await this.apiRequest(`/repos/${repo}/contents/${path}?ref=${ref}`);
    const files: GitFile[] = [];

    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const content = await this.getFileContent(repo, item.path, ref);
          files.push({
            path: item.path,
            content,
            language: item.name.split('.').pop(),
          });
        } catch (error) {
          console.warn(`Erro ao ler arquivo ${item.path}:`, error);
        }
      } else if (item.type === 'dir') {
        const subFiles = await this.getFilesInDirectory(repo, item.path, ref);
        files.push(...subFiles);
      }
    }

    return files;
  }
}

export function createGitProvider(provider: 'github' | 'gitea', baseUrl?: string): GitProvider {
  if (provider === 'github') {
    return new GitHubProvider();
  }
  if (provider === 'gitea' && baseUrl) {
    return new GiteaProvider(baseUrl);
  }
  throw new Error('Provider inválido ou baseUrl não fornecido para Gitea');
}

/**
 * Função de sincronização de repositórios
 * Busca repositórios do provider e persiste localmente
 */
export async function syncRepositories(
  provider: GitProvider,
  accountId: string,
  onProgress?: (progress: { current: number; total: number; repo: string }) => void
): Promise<GitRepository[]> {
  const { db } = await import('./database');
  
  const repos = await provider.getRepositories();
  const syncedRepos: GitRepository[] = [];
  
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    onProgress?.({ current: i + 1, total: repos.length, repo: repo.fullName });
    
    const existingRepo = await db.getAllGitRepositories(accountId).then(repos => 
      repos.find(r => r.repositoryId === repo.id)
    );
    
    const repoRecord: import('./database').GitRepository = {
      id: existingRepo?.id || `repo-${Date.now()}-${i}`,
      accountId,
      repositoryId: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      url: repo.url,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
      private: repo.private,
      provider: repo.provider,
      syncStatus: 'success',
      lastSyncAt: new Date(),
      createdAt: existingRepo?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    await db.saveGitRepository(repoRecord);
    syncedRepos.push(repoRecord);
  }
  
  return syncedRepos;
}
