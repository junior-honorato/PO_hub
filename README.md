# PO Hub - Consolidador de Backlogs Local & PPM (Rebranded Sicoob)

O **PO Hub** é uma aplicação web local focada em consolidar demandas provenientes de duas ferramentas externas de gestão de projetos (**Jira** e **Azure DevOps**) e integrá-las com um módulo de **PPM (Project Portfolio Management)** e **Planejamento Tático (VGBL)**. A interface foi totalmente reconfigurada seguindo a identidade corporativa do **Sicoob**, focada 100% no Modo Claro (Light Mode) de alto contraste e design executivo limpo. O sistema permite visualizar esses backlogs de forma unificada, gerenciar iniciativas estratégicas de portfólio (com faróis de saúde e progresso) e possibilitar a inserção de anotações, histórico temporal, tags customizadas e dependências manuais de forma persistente em um banco de dados local **SQLite**.

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
│   │   │   ├── PortfolioView.jsx       # Tela de Portfólio Executivo (PPM)
│   │   │   ├── ProjectOverview.jsx     # Visão Geral de Iniciativa & Board de Trilhas
│   │   │   └── PlanningView.jsx        # Tela de Planejamento Tático (Stack Ranking & Gantt)
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

### 1. `projects` (Tabela PPM)
Armazena as iniciativas estratégicas cadastradas pelo usuário.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `name` (TEXT UNIQUE) - Nome da iniciativa (Ex: "CRM de Vendas").
- `health_status` (TEXT) - Farol de saúde: `'Verde'`, `'Amarelo'`, ou `'Vermelho'`.
- `progress` (INTEGER) - Porcentagem de progresso real da iniciativa (0 a 100).
- `sponsor` (TEXT) - Patrocinador executivo responsável.
- `target_go_live` (TEXT) - Previsão de lançamento (Ex: "Dezembro 2026").
- `executive_summary` (TEXT) - Resumo executivo (Status Report) semanal.
- `strategic_notes` (TEXT) - Notas de cobrança de alinhamento com times externos.

### 2. `demands`
Armazena as demandas. Atualizada com suporte a projeto, canal local, campos de Status Report e Planejamento Tático.
- `externalId` (TEXT PRIMARY KEY) - Ex: `JIRA-101`, `AZ-501`, `BIZ-178321`.
- `origin` (TEXT) - `'Jira'`, `'Azure'`, ou `'Negocio'`.
- `title` (TEXT) - Título da demanda.
- `externalStatus` (TEXT) - Status reportado (Ex: `'To Do'`, `'Done'`).
- `itemType` (TEXT) - Categoria do item (Ex: `Feature`, `Bug`, `User Story`).
- `updatedAt` (TEXT) - Timestamp de atualização.
- `promisedDate` (TEXT) / `followUpDate` (TEXT) - Gestão local de prazos.
- `managerNotes` (TEXT) - Notas semanais da reunião de status.
- `project` (TEXT) - Nome da iniciativa vinculada na tabela `projects`.
- `current_status_notes` (TEXT) - Situação atual e evolução da demanda para o Report Semanal.
- `blocker_notes` (TEXT) - Impedimentos e riscos da demanda para o Report Semanal.
- `priority_rank` (INTEGER) - Posição de prioridade absoluta no Stack Ranking tático.
- `in_tactical_planning` (INTEGER DEFAULT 0) - Flag de inclusão da demanda no Planejamento Tático (0: Oculta, 1: Visível).
- `planned_start_date` (TEXT) - Data Início Planejada para o Cronograma Tático (`YYYY-MM-DD`).
- `planned_end_date` (TEXT) - Data Fim Planejada para o Cronograma Tático (`YYYY-MM-DD`).

---

## 🎯 Principais Funcionalidades da Interface UI/UX

1. **Portfólio Executivo (PPM):** Dashboard centralizado com cards horizontais de projetos detalhados, exibindo progresso (com barra de progresso horizontal colorida), sponsor, previsão de lançamento e farol de saúde (Verde, Amarelo, Vermelho) dinâmico e inteligente.
2. **Planejamento Tático - VGBL:** Tela dedicada à priorização e acompanhamento temporal tático:
   - **Stack Ranking (Priorização Paralela):** Grid de 2 colunas verticais (**Sicoob TI (Jira)** e **MAG (Azure)**) com destaque numérico de prioridade (`1º`, `2º`, `3º`...), suporte a reordenação por Drag and Drop nativo em HTML5 e persistência instantânea no SQLite (`PUT /demands/reorder`).
   - **Cronograma Gantt de Alta Precisão:** Linha do tempo de 6 meses que posiciona e dimensiona dinamicamente a barra de cada demanda com base nas datas reais de **Início Planejado** (`planned_start_date`) e **Fim Planejado** (`planned_end_date`).
   - **Gestão Condicional de Datas:** Chave de alternância *"Exibir no Planejamento Tático"* nos detalhes da demanda (`DemandDrawer`) que exibe/oculta os inputs de datas planejadas e botão de inclusão rápida *"+ Incluir Demanda"* no Planejamento Tático.
3. **Criação de Demandas de Negócio:** Botão "+ Nova Demanda de Negócio" na tabela de demandas que permite cadastrar novos itens locais (com ID único no formato `BIZ-{timestamp}` e origem `Negocio`) vinculados opcionalmente a projetos do portfólio.
4. **Visão Geral do Projeto em Abas (Dashboard & Slide):** A visão de iniciativa do portfólio é organizada em duas abas:
   - **Gestão Operacional**: Kanban board de trilhas side-by-side agrupados por origem (**TI - Jira**, **TI - Azure**, e **Go-To-Market / Negócios**) com contadores de impedimentos e destaque visual de cards travados.
   - **Report Executivo**: Tabela executiva horizontal de status semanal que consolida automaticamente as demandas em andamento, situação atual/evolução (`current_status_notes`) e impedimentos/riscos (`blocker_notes`), agrupados por Epics (Jira/Azure) ou Eixos (Negócios) e com badges de promessa de entrega formatados (ex: "Jun/26").
5. **Modelo Híbrido de Curadoria Refinado:** Regras de negócio aprimoradas para exibição inteligente de demandas no Report Executivo:
   - *Condição de Curadoria do PO:* Qualquer demanda com o campo `blocker_notes` preenchido é exibida, independentemente do seu `State` atual.
   - *Regra de Exclusão:* Demandas inativas sem `current_status_notes` são automaticamente ocultadas.
6. **Modal Centralizado Amplo de Detalhes:** Gaveta lateral (Drawer) estruturada em duas colunas com suporte a notas, tags, histórico, chave de Planejamento Tático e campos de datas de cronograma.
7. **Modo Apresentação Premium & Fullscreen Real:** Projeção do relatório cobrindo 100% da viewport de forma absoluta (`fixed inset-0 z-[100] bg-slate-900 w-screen h-screen overflow-y-auto p-4 sm:p-8 lg:p-12`), ocultando menus com atalho `ESC`.
8. **Mapeamento e Unificação de Status (Status Mapper):** Regras locais de mapeamento de status por canal (Jira, Azure DevOps, Negócio) integradas ao banco de dados SQLite (`status_mappings`).
9. **Sincronização Incremental (Delta Sync) e Diagnóstico de Erros:** Sincronização rápida salvando banda, com tratamento e exibição explicativa de erros HTTP (ex: HTTP 401 para tokens expirados e HTTP 403 para permissões de projeto).
10. **Exportação PowerPoint (.pptx) & Excel (.xls):** Relatórios em PPTX (estilo Sicoob widescreen 16:9 via `PptxGenJS`) e planilhas em Excel formatadas.
