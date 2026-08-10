# PO Hub - Consolidador de Backlogs & Portfolio Management (PPM)

O **PO Hub** é uma aplicação web completa focada em consolidar demandas provenientes de duas ferramentas externas de gestão de projetos (**Jira** e **Azure DevOps**) e integrá-las com um módulo de **PPM (Project Portfolio Management)** e **Planejamento Tático**.

A interface foi reconfigurada seguindo a identidade corporativa do **Sicoob**, focada no Modo Claro (Light Mode) de alto contraste e design executivo limpo. O sistema permite visualizar backlogs de forma unificada, gerenciar iniciativas estratégicas de portfólio (com faróis de saúde e progresso) e possibilita a inserção de anotações, histórico temporal, tags customizadas, dependências manuais e parametrização de IA de forma persistente.

## 🌐 URL de Produção na Nuvem

- **Aplicação Live no Render:** [https://po-hub.onrender.com/](https://po-hub.onrender.com/)

---

## 🚀 Destaques e Arquitetura Unificada (Local & Nuvem)

1. **☁️ Arquitetura Híbrida de Banco de Dados Resiliente (Supabase PostgreSQL + Fallback SQLite Local)**:
   - **Nuvem (Supabase PostgreSQL)**: Sincronização em tempo real de 100% das demandas, projetos, anotações, dependências e mapeamentos de status via `DATABASE_URL`.
   - **Fallback Resiliente de Alta Disponibilidade**: Caso o contêiner na nuvem enfrente restrições de rede IPv6 do provedor, o sistema realiza fallback automático para os bancos SQLite empacotados (`database_ativo.db` e `database_historico.db`), garantindo zero indisponibilidade (0 downtime) e acesso ininterrupto a todas as 588+ demandas.
   - **Script de Sincronização em Lote em 1-Clique (`backend/scripts/migrate_to_postgres.py`)**: Sincroniza instantaneamente todas as demandas e dados para a nuvem.

2. **🔒 Camada de Segurança Corporativa (Google SSO OAuth 2.0)**:
   - Login restrito via conta corporativa do Google.
   - Restrição estrita de acesso por e-mail autorizado (`ALLOWED_EMAILS`).
   - Cookies de sessão HTTP-Only com proteção `SameSite=Lax` e `Secure`.
   - Proteção de rotas `/api/` ativada por Middleware FastAPI.

3. **⚡ Inicialização Automática Local (`iniciar_hub.bat`)**:
   - Script batch nativo para Windows que localiza o Python no sistema, ativa/cria o ambiente virtual (`venv`), instala/atualiza dependências do `requirements.txt` e abre o navegador em `http://localhost:8080`.

4. **🤖 Inteligência Artificial Multi-Provedor (Gemini & OpenAI)**:
   - Resumo Inteligente de Projetos e Status Reports semanais via LLM.
   - Alternância dinâmica entre **Google Gemini** e **OpenAI (GPT)** diretamente nas configurações do painel.

5. **📊 Planejamento Tático com Stack Ranking & Cronograma Gantt**:
   - **Stack Ranking Side-by-Side:** Priorização paralela entre demandas **Sicoob TI (Jira)** e **MAG (Azure)** com reordenação por Drag & Drop.
   - **Cronograma Gantt de Alta Precisão:** Linha do tempo interativa baseada nas datas planejadas de início e fim.

6. **💼 Portfólio Executivo (PPM) & Report Semanal**:
   - Gestão de iniciativas estratégicas com cálculo automático de progresso baseado no status unificado das demandas.
   - Visão Geral por Projeto com Kanban de Trilhas, Resumos IA e Exportação de slides executivos em **PowerPoint (.pptx)** e **Excel (.xls)**.

---

## 🛠️ Stack Tecnológica

- **Backend:** Python 3.10+ (FastAPI, Uvicorn, Pydantic, Requests, Python-Dotenv, Psycopg2, PyJWT).
- **Banco de Dados:**
  - *Local:* SQLite3 (`database_ativo.db` e `database_historico.db`).
  - *Nuvem:* PostgreSQL (Supabase / Render).
- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons + React Flow + Dagre (para auto-layout do mapa de dependências).

---

## 📁 Estrutura do Projeto

```
po-hub/
├── iniciar_hub.bat       # Script de inicialização automática para Windows
├── backend/
│   ├── database.py       # Gerenciador de conexões (SQLite / Supabase PostgreSQL) e normalizador de queries
│   ├── auth.py           # Módulo de Autenticação Google SSO (OAuth2) e JWT Tokens
│   ├── main.py           # Servidor FastAPI com rotas REST, middlewares de segurança e arquivos estáticos
│   ├── config.json       # Configuração do caminho do banco SQLite local
│   ├── scripts/
│   │   └── migrate_to_postgres.py  # Script de migração de dados do SQLite para Supabase PostgreSQL
│   ├── static/           # Aplicação frontend consolidada servida pelo backend FastAPI
│   │   └── index.html    # Dashboard React consolidado
│   ├── requirements.txt  # Dependências Python do backend
│   ├── database_ativo.db # Banco SQLite local de demandas ativas
│   └── database_historico.db # Banco SQLite local de histórico
├── frontend/             # Código fonte modular React/Vite para desenvolvimento
│   ├── src/
│   │   ├── components/   # Componentes React (DemandTable, PlanningView, PortfolioView, etc.)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .env.example          # Modelo de variáveis de ambiente
├── .gitignore            # Regras de exclusão de arquivos sensíveis
└── README.md             # Documentação oficial do projeto
```

---

## 🔒 Variáveis de Ambiente Necessárias (.env / Render)

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `DATABASE_URL` | URI de conexão PostgreSQL (Supabase) | `postgresql://postgres.xxx:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` |
| `GOOGLE_CLIENT_ID` | Client ID do Google Cloud Console OAuth 2.0 | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google Cloud Console | `GOCSPX-xxx` |
| `ALLOWED_EMAILS` | E-mail autorizado a acessar a plataforma | `usuario@gmail.com` |
| `JWT_SECRET_KEY` | Chave secreta para assinatura dos tokens JWT | `sua-chave-jwt-segura` |
| `DEPLOY_ENV` | Ambiente de execução | `production` ou `development` |
| `JIRA_API_URL` | URL base da API do Jira | `https://sicoob.atlassian.net` |
| `JIRA_USER_EMAIL` | E-mail do usuário do Jira | `usuario@sicoob.com.br` |
| `JIRA_PAT` | Personal Access Token do Jira | `ATATT3xFfGF0...` |
| `AZURE_API_URL` | URL base do Azure DevOps | `https://dev.azure.com/mag` |
| `AZURE_PAT` | Personal Access Token do Azure DevOps | `pat_azure_xxx` |
| `GEMINI_API_KEY` | Chave de API do Google Gemini | `AIzaSy...` |

---

## 🛢️ Como Migrar o Banco de Dados Local para a Nuvem (Supabase)

Para sincronizar todas as suas demandas e projetos acumulados no notebook para o Supabase PostgreSQL na nuvem:

```powershell
# Abra o terminal no diretório backend
cd backend

# Execute o script de migração em lote
venv\Scripts\python scripts/migrate_to_postgres.py
```

O script enviará em lote todas as demandas ativas, histórico, projetos de portfólio, tags, anotações e dependências diretamente para o banco **Supabase PostgreSQL**.

---

## 🚀 Como Rodar Localmente

### Método 1: Execução Automática em 1-Clique

Duplo clique em `iniciar_hub.bat` na raiz do repositório. O servidor subirá em **`http://localhost:8080`**.

### Método 2: Execução Manual

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

---

## 📄 Licença e Governança

Desenvolvido para consolidação e gestão executiva de backlogs de produtos, integrando ecossistemas de TI e Negócios com suporte a Inteligência Artificial, Governança Híbrida e Proteção SSO.
