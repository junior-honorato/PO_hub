# PO Hub - Consolidador de Backlogs Local & PPM (Rebranded Sicoob)

O **PO Hub** é uma aplicação web local focada em consolidar demandas provenientes de duas ferramentas externas de gestão de projetos (**Jira** e **Azure DevOps**) e integrá-las com um módulo de **PPM (Project Portfolio Management)** e **Planejamento Tático**.

A interface foi totalmente reconfigurada seguindo a identidade corporativa do **Sicoob**, focada 100% no Modo Claro (Light Mode) de alto contraste e design executivo limpo. O sistema permite visualizar esses backlogs de forma unificada, gerenciar iniciativas estratégicas de portfólio (com faróis de saúde e progresso) e possibilitar a inserção de anotações, histórico temporal, tags customizadas, dependências manuais e parametrização de IA de forma persistente em um banco de dados local **SQLite**.

---

## 🚀 Destaques e Novas Funcionalidades (Atualizado)

1. **⚡ Inicialização Automática em 1 Clique (`iniciar_hub.bat`)**:
   - Script batch nativo para Windows que localiza automaticamente o Python no sistema (PATH, Microsoft Store ou AppData).
   - Cria e valida o ambiente virtual (`venv`), instala/atualiza dependências do `requirements.txt`.
   - Inicia o servidor FastAPI na porta `8080` e abre o navegador automaticamente em `http://localhost:8080`.

2. **📁 Armazenamento Personalizado do Banco de Dados (OneDrive / Rede)**:
   - Configuração dinâmica da pasta do banco de dados SQLite (`database_ativo.db` e `database_historico.db`).
   - Gerenciamento acessível pela aba **Configurações > Banco de Dados** na interface web ou pelo arquivo `backend/config.json`.
   - Permite vincular pastas locais sincronizadas pelo OneDrive para espelhamento automático na nuvem entre notebooks.

3. **🤖 Inteligência Artificial Multi-Provedor (Gemini & OpenAI)**:
   - Resumo Inteligente de Projetos e Status Reports semanais via LLM.
   - Alternância dinâmica entre **Google Gemini** e **OpenAI (GPT)** diretamente nas configurações do painel.
   - Parametrização de modelos (`gemini-2.5-flash`, `gpt-4o-mini`), chaves de API e prompts do sistema persistidos em `backend/llm_config.json`.

4. **📊 Planejamento Tático com Stack Ranking & Cronograma Gantt**:
   - **Stack Ranking Side-by-Side:** Priorização paralela entre demandas **Sicoob TI (Jira)** e **MAG (Azure)** com reordenação por Drag & Drop.
   - **Cronograma Gantt de Alta Precisão:** Linha do tempo interativa baseada nas datas planejadas de início e fim.

5. **💼 Portfólio Executivo (PPM) & Report Semanal**:
   - Gestão de iniciativas estratégicas com cálculo automático de progresso baseado no status unificado das demandas.
   - Visão Geral por Projeto com Kanban de Trilhas, Resumos IA e Exportação de slides executivos em **PowerPoint (.pptx)** e **Excel (.xls)**.

6. **🔒 Segurança e Isolamento de Credenciais**:
   - Arquivos `.env`, `credentials.json`, `llm_config.json` e bancos SQLite `.db` devidamente protegidos no `.gitignore` contra vazamento em repositórios.

---

## 🛠️ Stack Tecnológica

- **Backend:** Python 3.10+ (FastAPI, Uvicorn, Pydantic, Requests, Python-Dotenv, Google Generative AI).
- **Banco de Dados:** SQLite3 (Arquitetura de Dois Bancos: `database_ativo.db` e `database_historico.db`).
- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons + React Flow + Dagre (para auto-layout do mapa de dependências).
  - *Versão Integrada Servida pelo Backend:* Arquivo bundle consolidado em `/backend/static` pronto para execução sem dependência do Node.js/npm.
  - *Versão Modular para Dev:* Código fonte desacoplado em `/frontend`.

---

## 📁 Estrutura do Projeto

```
po-hub/
├── iniciar_hub.bat       # Script de inicialização automática de 1-clique para Windows
├── backend/
│   ├── database.py       # Gerenciador de conexão SQLite, esquema de tabelas e migrações
│   ├── main.py           # Servidor FastAPI com rotas REST, middlewares de segurança e arquivos estáticos
│   ├── config.json       # Configuração do caminho personalizado da pasta do banco SQLite
│   ├── llm_config.json   # Configurações locais de IA (Gemini/OpenAI) - [Ignorado no Git]
│   ├── credentials.json  # Credenciais de APIs de integradores - [Ignorado no Git]
│   ├── static/           # Aplicação frontend consolidada servida pelo backend FastAPI
│   │   └── index.html    # Dashboard React consolidado
│   ├── requirements.txt  # Dependências Python do backend
│   └── database_ativo.db # Banco de dados SQLite de demandas ativas
├── frontend/             # Código fonte modular React/Vite para desenvolvimento
│   ├── src/
│   │   ├── components/   # Componentes (DemandTable, PlanningView, PortfolioView, SettingsModal, etc.)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .env.example          # Modelo de variáveis de ambiente
├── .gitignore            # Regras de exclusão de arquivos sensíveis e locais
└── README.md             # Documentação do projeto
```

---

## 🚀 Como Rodar a Aplicação

### Método 1: Execução Automática (Recomendado)

Basta dar um **duplo clique** no arquivo `iniciar_hub.bat` na raiz do projeto.

O script cuidará de:
1. Detectar o Python no seu sistema.
2. Criar e atualizar o ambiente virtual `venv`.
3. Instalar/verificar as dependências do `requirements.txt`.
4. Iniciar o servidor FastAPI na porta `8080`.
5. Abrir automaticamente a aplicação no seu navegador padrão em **`http://localhost:8080`**.

---

### Método 2: Execução Manual do Backend

```powershell
# Navigate to the backend directory
cd backend

# Create and activate virtual environment (if not created)
python -m venv venv
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run the FastAPI server
python main.py
```
Acesse no navegador: 👉 **`http://localhost:8080`**

---

### Método 3: Modo de Desenvolvimento Frontend (Vite Reloading)

Para alterar componentes React em tempo real:
```powershell
# Terminal 1: Backend
cd backend
venv\Scripts\python main.py

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```
Acesse no navegador: 👉 **`http://localhost:5173`**

---

## 🛢️ Gerenciamento do Banco de Dados SQLite

O PO Hub utiliza uma estrutura de **Dois Bancos** (`database_ativo.db` e `database_historico.db`) para garantir alto desempenho na navegação:

- **Demandas Ativas (`database_ativo.db`)**: Mantém demandas em andamento, backlog e planejamento tático.
- **Histórico (`database_historico.db`)**: Armazena demandas entregues, concluídas ou canceladas.

### 🌐 Configuração do Caminho do Banco (OneDrive / Rede)

Você pode alterar a localização do banco SQLite para sincronizar entre notebooks:
- **Pela Interface Web:** Vá em **Configurações > Banco de Dados**, informe o caminho da pasta local (ex: `C:\Users\seu_usuario\OneDrive - Empresa\PO_HUB`) e clique em **Salvar e Migrar Banco**.
- **Pelo Arquivo:** Altere a propriedade `"db_path"` em `backend/config.json`. Deixar em branco (`""`) faz o sistema utilizar a pasta padrão `backend/`.

---

## 🔒 Variáveis de Ambiente & Segurança

O PO Hub possui isolamento de segredos para garantir que credenciais corporativas nunca sejam commitadas:
1. **`credentials.json`**: Guarda URLs e Tokens do Jira/Azure DevOps configurados pelo painel.
2. **`llm_config.json`**: Guarda Chaves de API do Gemini/OpenAI e parametrização do Prompt.
3. **`backend/.env`**: Fallback para variáveis de ambiente padrão.

Todos esses arquivos estão incluídos no `.gitignore`.

---

## 📄 Licença e Uso Corporativo

Desenvolvido para consolidação e gestão executiva de backlogs de produtos, integrando ecossistemas de TI e Negócios com suporte a Inteligência Artificial e Governança Local.
