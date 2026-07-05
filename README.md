# PO Hub - Consolidador de Backlogs Local & PPM

O **PO Hub** é uma aplicação web local focada em consolidar demandas provenientes de duas ferramentas externas de gestão de projetos (**Jira** e **Azure DevOps**) e integrá-las com um módulo de **PPM (Project Portfolio Management)**. O sistema permite visualizar esses backlogs de forma unificada, gerenciar iniciativas estratégicas de portfólio (com faróis de saúde e progresso) e possibilitar a inserção de anotações, histórico temporal, tags customizadas e dependências manuais de forma persistente em um banco de dados local **SQLite**.

---

## 🛠️ Stack Tecnológica

- **Backend:** Python (FastAPI) + SQLite para banco de dados local.
- **Frontend:** React + Tailwind CSS + Lucide Icons + React Flow + Dagre (para auto-layout do mapa de dependências).
  - *Desenvolvimento modular:* Estrutura pronta do Vite/React em `/frontend`.
  - *Execução integrada:* Servida estaticamente pelo FastAPI em `/backend/static` a partir de uma compilação baseada em CDNs para rodar imediatamente sem necessidade do comando `npm`.

---

## 📁 Estrutura do Projeto

```
po-hub/
├── backend/
│   ├── database.py       # Gerenciador de conexão SQLite e tabelas locais (Python)
│   ├── main.py           # Servidor FastAPI com endpoints REST e serviço estático (Python)
│   ├── static/           # Aplicação frontend consolidada servida pelo backend
│   │   └── index.html    # Dashboard consolidado em React (versão integrada)
│   ├── run_e2e_test.py   # Script de testes End-to-End com Selenium WebDriver
│   └── database_ativo.db # Banco de dados SQLite criado automaticamente no boot
├── frontend/             # Código fonte modular para desenvolvimento futuro com Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── DemandTable.jsx
│   │   │   ├── DemandDrawer.jsx
│   │   │   ├── RoadmapGraphView.jsx
│   │   │   ├── PortfolioView.jsx       # Nova tela de Portfólio Executivo (PPM)
│   │   │   └── ProjectOverview.jsx     # Nova Visão Geral de Iniciativa & Board de Trilhas
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── .env.example          # Modelo de variáveis de ambiente
└── README.md             # Este arquivo
```

---

## 🔒 Configuração e Segurança

O projeto utiliza um arquivo `.env` para ler as chaves de API necessárias para integração com as plataformas externas. **Nunca commite chaves de acesso no repositório.**

1. Copie o arquivo `.env.example` para `po-hub/backend/.env`:
   ```bash
   cp .env.example backend/.env
   ```
2. Abra o arquivo `backend/.env` e configure suas variáveis de ambiente:
   - `JIRA_API_URL`, `JIRA_USER_EMAIL` e `JIRA_PAT` (Personal Access Token).
   - `AZURE_API_URL` e `AZURE_PAT`.
   - `SSL_VERIFY` (Padrão: `False`).
   - `GEMINI_API_KEY` (Chave de API do Google Gemini para habilitar o resumo de demandas).
3. **Fallback (Mock):** Se as chaves de API forem omitidas, o sistema gera demandas mockadas funcionais ao sincronizar.

---

## 🚀 Como Iniciar a Aplicação (Rodar Localmente)

1. No terminal, navegue para o diretório `/po-hub/backend`:
   ```powershell
   cd po-hub/backend
   ```
2. Inicialize o servidor usando o interpretador do ambiente virtual da raiz:
   ```powershell
   ..\..\rag-ia\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload
   ```
3. Acesse no navegador:
   👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🛢️ Arquitetura de Dados (SQLite Schema - Dois Bancos)

Implementamos a arquitetura de **Dois Bancos** (`database_ativo.db` e `database_historico.db`) para manter a performance da listagem e a separação de escopos de demandas ativas e de histórico, sincronizados de forma atômica.

### 1. `projects` (Nova Tabela PPM)
Armazena as iniciativas estratégicas cadastradas pelo usuário.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `name` (TEXT UNIQUE) - Nome da iniciativa (Ex: "CRM de Vendas").
- `health_status` (TEXT) - Farol de saúde: `'Verde'`, `'Amarelo'`, ou `'Vermelho'`.
- `progress` (INTEGER) - Porcentagem de progresso real da iniciativa (0 a 100).
- `sponsor` (TEXT) - Patrocinador executivo responsável.
- `target_go_live` (TEXT) - Previsão de lançamento (Ex: "Dezembro 2026").
- `executive_summary` (TEXT) - Resumo executivo semanal e eventuais impedimentos.

### 2. `demands`
Armazena as demandas. Atualizada com suporte a projeto e canal local.
- `externalId` (TEXT PRIMARY KEY) - Ex: `JIRA-101`, `AZ-501`, `BIZ-178321`.
- `origin` (TEXT) - `'Jira'`, `'Azure'`, ou `'Negocio'`.
- `title` (TEXT) - Título da demanda.
- `externalStatus` (TEXT) - Status reportado (Ex: `'To Do'`, `'Done'`).
- `itemType` (TEXT) - Categoria do item (Ex: `Feature`, `Bug`, `User Story`).
- `updatedAt` (TEXT) - Timestamp de atualização.
- `promisedDate` (TEXT) / `followUpDate` (TEXT) - Gestão local de prazos.
- `managerNotes` (TEXT) - Notas semanais da reunião de status.
- `project` (TEXT) - Nome da iniciativa vinculada na tabela `projects`.

---

## 🎯 Principais Funcionalidades da Interface UI/UX

1. **Portfólio Executivo (PPM):** Dashboard centralizado com cards horizontais de projetos detalhados, exibindo progresso (com barra de progresso horizontal colorida), sponsor, previsão de lançamento e farol de saúde em estilo moderno dark/slate.
2. **Criação de Demandas de Negócio:** Botão "+ Nova Demanda de Negócio" na tabela de demandas que permite cadastrar novos itens locais (com ID único no formato `BIZ-{timestamp}` e origem `Negocio`) vinculados opcionalmente a projetos do portfólio.
3. **Visão Geral do Projeto (Overview Dashboard):** Visualização consolidada acessível em cada iniciativa do portfólio que exibe:
   - **Header Executivo**: Principais KPIs consolidados e saúde.
   - **Resumo Semanal**: O status report descritivo de impedimentos da iniciativa.
   - **Board de Trilhas**: Divisão de entregas em 3 colunas de cards de demandas side-by-side agrupados por origem: **TI - Jira**, **TI - Azure**, e **Go-To-Market / Negócios**.
4. **Vínculo do Drawer Centralizado:** Menus de seleção dinâmicos de projetos adicionados na gaveta (Drawer) para demandas do Jira, Azure ou manuais, salvando e atualizando instantaneamente os relacionamentos no SQLite.
5. **Autonomia de Dados Locais:** Atribuição manual de pais, bloqueios e anotações persistentes no SQLite local, imune a perdas durante as sincronizações automáticas externas do Jira e Azure DevOps.
6. **Resumo Inteligente e Relatórios com IA:** Integração com a API do Google Gemini para resumos automáticos em lote com suporte a caches locais na tabela `project_reports` para redução de custos (FinOps).
