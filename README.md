# QA FLOW!

Sistema avançado de análise de qualidade de código com métricas de segurança, qualidade estrutural, robustez e evolução.

## 🚀 Funcionalidades

- **Análise de Código**: Suporte para JavaScript, TypeScript, SQL, Delphi/Pascal, Python
- **Métricas Avançadas**: Segurança (40%), Qualidade (30%), Robustez (20%), Evolução (10%)
- **Mapa de Calor de Risco**: Matriz 5x5 Impacto x Probabilidade
- **Análise de Pasta**: Seleção e análise de múltiplos arquivos
- **Histórico de Análises**: Armazenamento e consulta de resultados
- **Exportação**: Relatórios em TXT, HTML e PDF

## 📋 Requisitos

- Node.js 18+ e npm
- (Opcional) SQLite para armazenamento local

## 🛠️ Instalação

```sh
# Clone o repositório
git clone <YOUR_GIT_URL>

# Instale as dependências
npm install

# Configure as variáveis de ambiente (opcional)
# Crie um arquivo .env na raiz do projeto:
# VITE_GITHUB_CLIENT_ID=seu_client_id_aqui

# Inicie o servidor de desenvolvimento
npm run dev
```

### 🔐 Configuração do Git Integration

Para usar a integração com GitHub/Gitea, você tem duas opções:

**Opção 1: OAuth (Recomendado)**
1. Crie um OAuth App no GitHub: https://github.com/settings/developers
2. Configure `VITE_GITHUB_CLIENT_ID` no arquivo `.env`
3. Reinicie o servidor

**Opção 2: Personal Access Token**
1. Gere um token em: https://github.com/settings/tokens
2. Na página de Git Integration, marque "Usar Personal Access Token"
3. Cole o token (escopos necessários: `repo`, `read:org`)

Veja mais detalhes em [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)

## 🏗️ Tecnologias

- **Frontend**: Vite + React + TypeScript
- **UI**: shadcn-ui + Tailwind CSS
- **Roteamento**: React Router
- **Análise**: Engine customizado de métricas avançadas

## 📦 Build

```sh
# Build para produção
npm run build

# Preview da build
npm run preview
```

## 🐳 Docker (Em breve)

Deploy simplificado com Docker será disponibilizado em breve.

## 📄 Licença

Open-source - Core engine sempre gratuito
