# Integração Git - QA FLOW!

Este documento descreve a integração completa do QA FLOW! com sistemas Git (GitHub e Gitea).

## 📋 Índice

- [Fase 1 - Base](#fase-1---base)
- [Fase 2 - UX](#fase-2---ux)
- [Fase 3 - Análise](#fase-3---análise)
- [Fase 4 - CI/CD](#fase-4---cicd)

## Fase 1 - Base

### Modelagem de Dados

#### GitAccount
Armazena informações de autenticação com provedores Git:
- `id`: Identificador único
- `provider`: 'github' ou 'gitea'
- `username`: Nome de usuário
- `token`: Token de autenticação (criptografado em produção)
- `giteaUrl`: URL do servidor Gitea (se aplicável)

#### GitRepository
Armazena repositórios sincronizados:
- `id`: Identificador único
- `accountId`: Referência à conta Git
- `repositoryId`: ID do repositório no provider
- `fullName`: Nome completo (ex: `usuario/repo`)
- `syncStatus`: 'pending' | 'syncing' | 'success' | 'error'
- `lastSyncAt`: Data da última sincronização

#### GitSyncJob
Rastreia jobs de análise assíncronos:
- `id`: Identificador único
- `repositoryId`: Repositório sendo analisado
- `branch`: Branch sendo analisada
- `status`: 'pending' | 'running' | 'completed' | 'failed'
- `progress`: Progresso (0-100)
- `analysisCount`: Número de arquivos analisados

### Endpoints de Sync

#### Frontend (`src/lib/git-integration.ts`)
```typescript
syncRepositories(provider, accountId, onProgress?)
```
Sincroniza repositórios do provider e persiste localmente.

#### Backend (`backend/main.py`)
- `POST /git/accounts` - Criar conta Git
- `GET /git/accounts` - Listar contas
- `POST /git/repositories/sync` - Sincronizar repositórios
- `GET /git/repositories` - Listar repositórios
- `POST /git/sync` - Iniciar job de análise
- `GET /git/sync/jobs` - Listar jobs
- `GET /git/sync/jobs/{job_id}` - Detalhes do job

## Fase 2 - UX

### Tela de Repositórios

Acesse `/git` para gerenciar repositórios Git.

**Funcionalidades:**
- Autenticação com GitHub/Gitea
- Sincronização de repositórios
- Visualização de status de sync
- Seleção de repositório e branch para análise

**Status de Sync:**
- 🟢 **Success**: Sincronizado com sucesso
- 🔵 **Syncing**: Sincronização em andamento
- 🔴 **Error**: Erro na sincronização
- ⚪ **Pending**: Aguardando sincronização

## Fase 3 - Análise

### Jobs Assíncronos

Os jobs de análise são executados de forma assíncrona, permitindo:
- Análise de grandes repositórios sem travar a UI
- Rastreamento de progresso em tempo real
- Histórico completo de análises

### Histórico por Repositório

Acesse a aba "Histórico" na página de Git Integration para ver:
- Todos os jobs de análise por repositório
- Status de cada job (pendente, em execução, concluído, falhou)
- Progresso e número de arquivos analisados
- Erros, se houver

### Heatmap por Branch

O heatmap (`/heatmap`) agora suporta filtros por:
- **Repositório**: Filtra análises de um repositório específico
- **Branch**: Filtra análises de uma branch específica
- **Impacto**: Filtra por nível de impacto (1-5)
- **Probabilidade**: Filtra por probabilidade (1-5)

## Fase 4 - CI/CD

### GitHub Action

O workflow `.github/workflows/quality-gate.yml` executa automaticamente:
- Em Pull Requests para `main`, `master` ou `develop`
- Em pushes para essas branches
- Manualmente via `workflow_dispatch`

**O que faz:**
1. Faz checkout do código
2. Instala dependências
3. Executa análise QA FLOW!
4. Verifica Quality Gate
5. Comenta no PR com resultados
6. Bloqueia merge se falhar (configurável)

### Quality Gate

O Quality Gate avalia:
- **Risk Score**: Mínimo 70%
- **Security Score**: Mínimo 70%
- **Critical Findings**: Máximo 0
- **High Findings**: Máximo 5

**Endpoint:**
```
GET /quality-gate/{repository_id}/{branch}
```

**Resposta:**
```json
{
  "passed": true,
  "reason": null,
  "scores": {
    "risk": 75.0,
    "security": 80.0,
    "quality": 70.0
  },
  "findings": {
    "critical": 0,
    "high": 2,
    "medium": 5,
    "low": 10
  },
  "file_count": 42
}
```

### Badge PASS/FAIL

Adicione o badge ao seu README.md:

```markdown
![QA FLOW!](https://seu-backend.com/badge/{repository_id}/{branch})
```

**Endpoint:**
```
GET /badge/{repository_id}/{branch}
```

Retorna um SVG com:
- 🟢 **PASS**: Se o Quality Gate passou
- 🔴 **FAIL**: Se o Quality Gate falhou
- ⚪ **N/A**: Se não há análises

**Exemplo de uso:**
```markdown
[![QA FLOW!](https://api.qaflow.com/badge/my-org/my-repo/main)](https://qaflow.com/repo/my-org/my-repo)
```

## Configuração

### Variáveis de Ambiente

**Frontend:**
- `VITE_GITHUB_CLIENT_ID`: Client ID do GitHub OAuth App
- `VITE_GITEA_CLIENT_ID`: Client ID do Gitea OAuth App

**Backend:**
- `SECRET_KEY`: Chave secreta para JWT (produção)
- `DATABASE_URL`: URL do banco de dados (opcional)

### GitHub OAuth App

1. Acesse https://github.com/settings/developers
2. Crie um novo OAuth App
3. Configure:
   - **Application name**: QA FLOW!
   - **Homepage URL**: `https://seu-dominio.com`
   - **Authorization callback URL**: `https://seu-dominio.com/auth/github/callback`
4. Copie o Client ID para `VITE_GITHUB_CLIENT_ID`

## Próximos Passos

- [ ] Webhooks para análise automática em novos commits
- [ ] Integração com GitLab
- [ ] Análise incremental (apenas arquivos modificados)
- [ ] Dashboard de métricas por repositório
- [ ] Comparação entre branches
- [ ] Relatórios automatizados por email
