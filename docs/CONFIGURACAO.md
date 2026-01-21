# Configuração do QA FLOW!

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# GitHub OAuth Configuration
# Obtenha em: https://github.com/settings/developers
VITE_GITHUB_CLIENT_ID=seu_client_id_aqui

# Gitea OAuth Configuration (opcional)
VITE_GITEA_CLIENT_ID=seu_client_id_aqui

# Backend API URL (opcional, padrão: http://localhost:8000)
VITE_API_URL=http://localhost:8000
```

## Configuração do GitHub OAuth

### Passo 1: Criar OAuth App no GitHub

1. Acesse https://github.com/settings/developers
2. Clique em "New OAuth App"
3. Preencha:
   - **Application name**: QA FLOW!
   - **Homepage URL**: `http://localhost:5173` (desenvolvimento) ou seu domínio (produção)
   - **Authorization callback URL**: `http://localhost:5173/auth/github/callback` (desenvolvimento) ou `https://seu-dominio.com/auth/github/callback` (produção)
4. Clique em "Register application"
5. Copie o **Client ID** gerado

### Passo 2: Configurar no Projeto

1. Crie o arquivo `.env` na raiz do projeto
2. Adicione: `VITE_GITHUB_CLIENT_ID=seu_client_id_aqui`
3. Reinicie o servidor de desenvolvimento (`npm run dev`)

## Alternativa: Personal Access Token

Se você não quiser configurar OAuth, pode usar um Personal Access Token:

### GitHub Personal Access Token

1. Acesse https://github.com/settings/tokens
2. Clique em "Generate new token" → "Generate new token (classic)"
3. Configure:
   - **Note**: QA FLOW!
   - **Expiration**: Escolha uma data (ou "No expiration")
   - **Scopes**: Marque `repo` e `read:org`
4. Clique em "Generate token"
5. Copie o token gerado (começa com `ghp_`)
6. Na página de Git Integration, marque "Usar Personal Access Token" e cole o token

### Gitea Personal Access Token

1. Acesse seu servidor Gitea
2. Vá em Settings → Applications → Generate New Token
3. Configure:
   - **Token Name**: QA FLOW!
   - **Scopes**: Marque `read:repository`
4. Clique em "Generate Token"
5. Copie o token gerado
6. Na página de Git Integration, marque "Usar Personal Access Token" e cole o token

## Solução de Problemas

### Erro 404 ao autenticar

**Problema**: O `client_id` está vazio na URL de OAuth.

**Solução**: 
1. Verifique se o arquivo `.env` existe na raiz do projeto
2. Verifique se a variável `VITE_GITHUB_CLIENT_ID` está configurada
3. Reinicie o servidor de desenvolvimento após criar/modificar o `.env`
4. Use Personal Access Token como alternativa

### Token não funciona

**Problema**: O token não tem as permissões necessárias.

**Solução**:
- GitHub: Certifique-se de que o token tem os escopos `repo` e `read:org`
- Gitea: Certifique-se de que o token tem permissão de leitura de repositórios

### Erro CORS

**Problema**: Erro de CORS ao fazer requisições para a API do GitHub.

**Solução**: 
- Em desenvolvimento, isso não deve ocorrer
- Em produção, configure o CORS no backend se necessário
