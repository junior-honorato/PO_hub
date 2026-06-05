# PO Hub - Consolidador de Backlogs Local

O **PO Hub** é uma aplicação web local focada em consolidar demandas provenientes de duas ferramentas externas de gestão de projetos: **Jira** e **Azure DevOps**. O sistema permite visualizar esses backlogs de forma unificada e possibilita a inserção de anotações, histórico temporal e tags customizadas de forma persistente em um banco de dados local **SQLite**.

---

## 🛠️ Stack Tecnológica

- **Backend:** Python (FastAPI) com suporte alternativo em Node.js (Express) + SQLite para banco de dados local.
- **Frontend:** React + Tailwind CSS + Lucide Icons + React Flow + Dagre (para auto-layout do mapa de dependências).
  - *Desenvolvimento modular:* Estrutura pronta do Vite/React em `/frontend`.
  - *Execução instantânea (Zero Config):* Servida estaticamente pelo FastAPI em `/backend/static` a partir de uma compilação baseada em CDNs para rodar imediatamente sem necessidade do comando `npm`.

---

## 📁 Estrutura do Projeto

```
po-hub/
├── backend/
│   ├── database.py       # Gerenciador de conexão SQLite e tabelas locais (Python)
│   ├── database.js       # Gerenciador de conexão SQLite (Node.js)
│   ├── main.py           # Servidor FastAPI com endpoints REST e serviço estático (Python)
│   ├── server.js         # Servidor Express alternativo (Node.js)
│   ├── static/           # Aplicação frontend compilada servida pelo backend
│   │   └── index.html    # Dashboard consolidado em React
│   ├── run_e2e_test.py   # Script de testes End-to-End com Selenium WebDriver
│   └── database.db       # Banco de dados SQLite criado automaticamente no boot
├── frontend/             # Código fonte modular para desenvolvimento futuro com Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── MetricCards.jsx
│   │   │   ├── DemandTable.jsx
│   │   │   ├── DemandDrawer.jsx
│   │   │   └── RoadmapGraphView.jsx
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
   - `SSL_VERIFY` (Padrão: `False`, ideal para redes corporativas com firewalls que interceptam HTTPS).
3. **Fallback (Mock):** Se você deixar os campos de API em branco ou inacessíveis, a aplicação irá autogerar demandas mockadas de alta fidelidade ao clicar em "Sincronizar APIs" para demonstração funcional instantânea do dashboard.

---

## 🚀 Como Iniciar a Aplicação (Rodar Localmente)

Como a sua máquina já possui um ambiente virtual Python (`venv`) com todas as bibliotecas necessárias instaladas, basta rodar o servidor FastAPI do diretório do backend:

1. No terminal do Windows, navegue para o diretório `/po-hub/backend`:
   ```powershell
   cd po-hub/backend
   ```
2. Inicialize o servidor usando o interpretador do ambiente virtual da raiz:
   ```powershell
   ..\..\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
   ```
3. Abra o seu navegador e acesse a interface gráfica:
   👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🛢️ Arquitetura de Dados (SQLite Schema)

O banco de dados é gravado em `po-hub/backend/database.db` e contém três tabelas principais estruturadas com integridade referencial (`ON DELETE CASCADE`):

### 1. `demands`
Armazena as demandas mapeadas e sincronizadas das APIs externas.
- `externalId` (TEXT PRIMARY KEY) - Ex: `JIRA-101`, `AZ-501`.
- `origin` (TEXT) - `'Jira'` ou `'Azure'`.
- `title` (TEXT) - Título da demanda.
- `externalStatus` (TEXT) - Status oficial reportado pela API externa.
- `updatedAt` (TEXT) - Data da última atualização local/sincronização.
- `parentId` (TEXT) - ID da demanda pai na hierarquia (ex: Epic -> Feature -> Story).
- `blockers` (TEXT) - Lista em formato JSON array de chaves/IDs de demandas que bloqueiam o item.
- `blocked_by` (TEXT) - Lista em formato JSON array de chaves/IDs de demandas que são bloqueadas pelo item.

### 2. `annotations`
Armazena anotações ricas locais vinculadas a cada demanda.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `externalId` (TEXT) - Chave estrangeira referente a `demands(externalId)`.
- `content` (TEXT) - Comentário do PO.
- `createdAt` (TEXT) - Data/hora de gravação automática local (UTC).

### 3. `tags`
Armazena tags customizadas vinculadas a cada demanda para agrupamento/filtragem flexível.
- `externalId` (TEXT) - Chave estrangeira referente a `demands(externalId)`.
- `tag` (TEXT) - Nome da tag (salva em minúsculo e limpa).
- Chave Primária Composta por (`externalId`, `tag`).

---

## 🎯 Principais Funcionalidades da Interface UI/UX

1. **Dashboard Executivo:** Métricas agregadoras que computam em tempo real o volume de demandas consolidado, distribuição de origem e contagem de tags locais.
2. **Busca Abrangente de Itens (Azure DevOps):** A consulta WIQL traz 100% dos itens de trabalho vinculados ao usuário (independentemente do tipo, como `Epic`, `Feature`, `Bug`, `User Story`, `Incidente`, `Task` e outros).
3. **Prefixação Dinâmica de Títulos:** Para apoiar a visualização rápida na listagem, o título de cada demanda é dinamicamente prefixado no backend:
   - `User Story` -> `"US: "`
   - `Bug` -> `"Bug: "`
   - Demais tipos (ex: `Epic`, `Feature`, `Incidente`) -> `"{Tipo}: "` (ex: `"Epic: "`, `"Incidente: "`).
4. **Busca Detalhada em Lotes (Chunking):** A API do Azure DevOps limita a busca a 200 IDs por vez. O backend divide automaticamente os resultados da consulta em blocos de até 200 IDs para garantir o carregamento total sem falhas ou perda de dados.
5. **Sincronização Segura:** O sincronizador utiliza instruções SQL `ON CONFLICT` que atualizam o título e status sem excluir a demanda, **garantindo a permanência intacta de todas as suas tags e anotações locais**.
6. **Ordenação Direta por Colunas:** A listagem oferece ordenação clicável nos cabeçalhos (`ID / Origem`, `Demanda`, `Status Externo`) com indicação visual de direção de ordenação (setas ▲/▼).
7. **Links Diretos:** Ícones e botões nos detalhes da demanda direcionam o usuário com um clique diretamente ao ticket de origem correspondente no Jira ou Azure DevOps.
8. **Painel de Detalhes (Slide-over):** Clicar em qualquer linha da tabela abre um painel lateral dinâmico de detalhes (Drawer).
9. **Gerenciador de Tags e Timeline Cronológica:** Adicione/remova tags dinamicamente e visualize anotações em uma linha do tempo vertical decrescente.
10. **Mapa do Roadmap (Grafo de Dependências):** Uma visão gráfica e interativa baseada em `React Flow` que mapeia duas dimensões de relacionamentos: Hierarquias (linhas sólidas cinzas) e Bloqueios (linhas tracejadas vermelhas e animadas). Conta com layout automático inteligente pelo `Dagre` nas orientações vertical (árvore) ou horizontal, e interage com o Drawer lateral ao clicar nos cartões (nós).

---

## 🧪 Testes Automatizados End-to-End

O projeto inclui um script de testes E2E (`backend/run_e2e_test.py`) baseado em **Selenium WebDriver**. Para executá-lo:
1. Garanta que o servidor backend esteja rodando.
2. Execute o script:
   ```bash
   ..\..\venv\Scripts\python run_e2e_test.py
   ```
O script simulará o acesso ao dashboard, navegação na tabela, ordenação, clique e validação de renderização do Drawer, salvando screenshots de verificação no diretório correspondente.
