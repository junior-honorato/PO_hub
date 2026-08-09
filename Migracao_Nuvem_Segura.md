# Roteiro de Migração para Nuvem - PO Hub (Seguro)

Este documento é o guia tático e arquitetural para migrar a aplicação **PO Hub** de um ambiente local para a nuvem de produção (**Render.com + Supabase PostgreSQL + Google SSO**), incorporando todas as diretrizes de segurança (hardening) estabelecidas no relatório de pentest.

---

## 🏗️ Resumo da Arquitetura Alvo

* **Frontend & Backend (PaaS)**: Render.com (hospedagem do backend FastAPI servindo os arquivos estáticos do React).
* **Banco de Dados (DBaaS)**: Supabase PostgreSQL (banco relacional gerenciado, garantindo concorrência e persistência).
* **Autenticação (IdP)**: Google SSO (OAuth 2.0) integrado ao FastAPI com controle de sessão por tokens JWT salvos em cookies seguros.
* **Segurança e Isolamento**: Separação completa de dados entre usuários (Multi-tenancy) e proteção de tráfego (SSL/TLS).

---

## 📅 Fase 1: Ajustes de Banco de Dados (PostgreSQL + Multi-tenant)

### 1.1 Modificação do Schema SQL
Migração do banco de dados do SQLite para o PostgreSQL e inclusão da coluna de isolamento `owner_email` nas tabelas principais para isolamento lógico.

```sql
-- Adicionar coluna owner_email nas tabelas existentes
ALTER TABLE projects ADD COLUMN owner_email VARCHAR(255) NOT NULL;
ALTER TABLE demands ADD COLUMN owner_email VARCHAR(255) NOT NULL;
ALTER TABLE tags ADD COLUMN owner_email VARCHAR(255) NOT NULL;
ALTER TABLE dependencies ADD COLUMN owner_email VARCHAR(255) NOT NULL;
ALTER TABLE annotations ADD COLUMN owner_email VARCHAR(255) NOT NULL;

-- Criar chaves compostas ou índices para garantir consultas rápidas por dono
CREATE INDEX idx_demands_owner ON demands(owner_email, externalId);
CREATE INDEX idx_projects_owner ON projects(owner_email, id);
```

> [!IMPORTANT]
> **DIRETRIZES DE SEGURANÇA (FASE 1)**:
> 1. **Criptografia em Trânsito (SSL/TLS)**: A string de conexão `DATABASE_URL` fornecida ao contêiner do Render deve possuir o parâmetro de SSL ativado (ex: `sslmode=require` ou similar) para garantir que todas as transações de banco sejam criptografadas entre a Render e o Supabase.
> 2. **Pooler de Conexão (PgBouncer)**: Utilize o endereço do Connection Pooler do Supabase (porta `6543`) em vez da conexão direta (porta `5432`). Isto previne o esgotamento de conexões concorrentes do PostgreSQL quando contêineres reiniciam ou escalam na Render.
> 3. **Queries Parametrizadas**: Garanta o uso restrito de queries parametrizadas (bindings) ao migrar o código de banco em `database.py` para evitar vetores de SQL Injection (SQLi) no PostgreSQL.

### 1.2 Script de Migração de Dados Locais
Desenvolvimento do script `backend/scripts/migrate_to_postgres.py` para ler os dados locais do arquivo SQLite (`database_ativo.db`) e inseri-los no banco PostgreSQL do Supabase, preenchendo o campo `owner_email` com o e-mail Google do usuário correspondente.

---

## 🔐 Fase 2: Configuração de Autenticação (Google SSO)

### 2.1 Credenciais no Google Cloud Console
1. Acesse o **Google Cloud Console**.
2. Configure a **Tela de consentimento OAuth** (OAuth Consent Screen).
3. Em **Credenciais**, crie um **ID do cliente OAuth 2.0** do tipo *Aplicativo da Web*.
4. Configure as URIs autorizadas:
   - **Origens JavaScript autorizadas**: `https://sua-app.onrender.com` e `http://localhost:8080`.
   - **URIs de redirecionamento autorizadas**: `https://sua-app.onrender.com/api/auth/callback` e `http://localhost:8080/api/auth/callback`.

> [!WARNING]
> **DIRETRIZES DE SEGURANÇA (FASE 2)**:
> 1. **Controle de Consentimento Interno**: Configure a tela de consentimento OAuth como **Internal** no console da Google, restringindo a autorização de login apenas a e-mails pertencentes ao domínio da sua organização (ex: `@sicoob.com.br`).
> 2. **Whitelisting de E-mails**: Implemente uma validação no backend (`/api/auth/callback`) para negar logins de e-mails pessoais (como `@gmail.com`) ou domínios não autorizados, caso o consentimento precise estar como *External* para testes.

---

## 💻 Fase 3: Modificações no Código (Backend & Frontend)

### 3.1 Backend (FastAPI)
* **Dependências**: Adicionar ao `requirements.txt` os pacotes `authlib`, `python-jose[cryptography]` e `psycopg2-binary` (com as versões fixadas).
* **Middleware/Dependência de Autenticação**: Criar a dependência `get_current_user` em `backend/main.py` para descriptografar o cookie JWT de sessão e recuperar o e-mail do usuário autenticado.
* **Rotas de Autenticação**:
  - `GET /api/auth/login`: Redireciona o usuário para o formulário de consentimento da Google.
  - `GET /api/auth/callback`: Processa a resposta da Google, gera o token JWT de sessão e o grava no cookie.
  - `POST /api/auth/logout`: Limpa o cookie de sessão do navegador.
  - `GET /api/auth/me`: Retorna os dados básicos do usuário logado.

> [!IMPORTANT]
> **DIRETRIZES DE SEGURANÇA (FASE 3 - BACKEND)**:
> 1. **Flags de Segurança nos Cookies de Sessão**: O cookie contendo o token JWT de sessão (`access_token`) deve ser configurado na resposta HTTP com as seguintes diretivas obrigatórias:
>    - `httponly=True`: Impede o acesso ao cookie via scripts (JavaScript), neutralizando o roubo de tokens por ataques XSS.
>    - `secure=True`: Obriga o navegador a transmitir o cookie estritamente sob conexões seguras HTTPS.
>    - `samesite="lax"`: Protege a aplicação contra ataques de Cross-Site Request Forgery (CSRF).
> 2. **Validade de Sessão Curta**: Configure a validade do JWT de sessão para expirar em no máximo 8 horas (`max_age=28800` segundos) para exigir reautenticação de segurança diária.
> 3. **Isolamento de Queries (Multi-tenancy)**: Modifique todas as rotas operacionais do backend para injetar o e-mail obtido de `get_current_user` em cada busca ou alteração de dados no PostgreSQL (Ex: `WHERE owner_email = :owner_email`).

### 3.2 Frontend (React / HTML)
* **Tela de Login**: Criar o componente `Login.jsx` contendo o botão "Entrar com o Google" apontando para o endpoint `/api/auth/login`.
* **Proteção de Rotas**: Na inicialização do React (`App.jsx`), chamar `/api/auth/me`. Se retornar `401 Unauthorized`, renderizar a tela de login.
* **Envio de Credenciais**: Garantir que as chamadas de API (`fetch`) utilizem `{ credentials: 'include' }` para que o navegador transmita o cookie HTTP-Only nas requisições.

---

## 🚀 Fase 4: Configuração e Deploy na Render.com

### 4.1 Preparação do Dockerfile
Criação do Dockerfile no diretório raiz para automatizar o build do frontend React e a inicialização do FastAPI.

```dockerfile
# Estágio 1: Build do Frontend React
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Estágio 2: Configuração do Servidor FastAPI
FROM python:3.10-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# Copia o build estático gerado no estágio 1
COPY --from=frontend-builder /frontend/dist ./static

# Hardening: Executar contêiner sob usuário não-root
RUN groupadd -g 999 appuser && useradd -r -u 999 -g appuser appuser
USER appuser

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

> [!WARNING]
> **DIRETRIZES DE SEGURANÇA (FASE 4)**:
> 1. **Execução sem Root (Hardening)**: Implementar a criação de um usuário não-root (`appuser`) no Dockerfile conforme demonstrado acima. Isso mitiga riscos de escalada de privilégios caso um invasor explore uma vulnerabilidade de RCE dentro do contêiner.
> 2. **Variáveis de Ambiente**: Nunca envie chaves de API ou strings de conexão no arquivo `.env` para o Git. Configure todas as credenciais sensíveis no painel de controle da Render (aba *Environment Variables*).
> 3. **Redirecionamento HTTPS Automático**: No painel da Render, ative o redirecionamento automático de conexões HTTP para HTTPS na porta 8080.
> 4. **Cabeçalhos de Segurança (CSP/Clickjacking) & Rate Limiting**: Garanta que as variáveis de ambiente `CORS_ALLOWED_ORIGINS` e `DEPLOY_ENV=production` estejam configuradas na Render para ativar a blindagem dos middlewares implementados locais.
