# Dockerfile para QA FLOW!
# Multi-stage build para otimização

# Stage 1: Build do frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./
COPY bun.lockb ./

# Instala dependências
RUN npm ci

# Copia código fonte
COPY . .

# Build do frontend
RUN npm run build

# Stage 2: Backend Python
FROM python:3.11-slim AS backend

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements e instala dependências Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código do backend
COPY backend/ ./backend/

# Stage 3: Imagem final
FROM python:3.11-slim

WORKDIR /app

# Instala nginx para servir frontend
RUN apt-get update && apt-get install -y \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copia backend do stage anterior
COPY --from=backend /app /app/backend

# Copia frontend build do stage anterior
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Configura nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cria script de inicialização
RUN echo '#!/bin/bash\n\
service nginx start\n\
cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000 &\n\
wait' > /start.sh && chmod +x /start.sh

EXPOSE 80 8000

CMD ["/start.sh"]
