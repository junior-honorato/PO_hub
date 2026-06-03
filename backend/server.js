import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { initDatabase, dbRun, dbAll, dbGet } from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Inicializa o banco de dados
await initDatabase();

// Dados Mockados para fallback caso as credenciais não estejam configuradas
const MOCK_JIRA_DEMANDS = [
  { origin: 'Jira', externalId: 'JIRA-101', title: 'Migração da infraestrutura local para GCP', externalStatus: 'Em Progresso' },
  { origin: 'Jira', externalId: 'JIRA-102', title: 'Fluxo de Checkout Simplificado (One-Click Buy)', externalStatus: 'A Fazer' },
  { origin: 'Jira', externalId: 'JIRA-103', title: 'Integração de pagamento instantâneo via Pix', externalStatus: 'Concluído' },
  { origin: 'Jira', externalId: 'JIRA-104', title: 'Painel Analytics corporativo pós-venda', externalStatus: 'Backlog' }
];

const MOCK_AZURE_DEMANDS = [
  { origin: 'Azure', externalId: 'AZURE-501', title: 'Bug: Vazamento de memória ao alternar abas de produtos', externalStatus: 'Desenvolvimento' },
  { origin: 'Azure', externalId: 'AZURE-502', title: 'US: Componente reutilizável de Upload Drag-and-Drop', externalStatus: 'Aprovado' },
  { origin: 'Azure', externalId: 'AZURE-503', title: 'US: Refatoração do fluxo de autenticação JWT e Refresh Token', externalStatus: 'Novo' },
  { origin: 'Azure', externalId: 'AZURE-504', title: 'Bug: Erro 500 intermitente ao salvar preferências de notificação', externalStatus: 'Impedido' },
  { origin: 'Azure', externalId: 'AZURE-505', title: 'US: Implementação de WebSockets para notificações push na tela', externalStatus: 'Em Teste' }
];

// Helper para verificar se credenciais estão configuradas
const hasJiraCredentials = () => {
  return process.env.JIRA_API_URL && process.env.JIRA_USER_EMAIL && process.env.JIRA_PAT;
};

const hasAzureCredentials = () => {
  return process.env.AZURE_API_URL && process.env.AZURE_PAT;
};

// Helper para montar a URL externa
const getExternalUrl = (origin, externalId) => {
  if (origin === 'Jira') {
    const jiraUrlRaw = process.env.JIRA_API_URL;
    if (jiraUrlRaw) {
      let jiraUrlBase = jiraUrlRaw.replace(/\/$/, '');
      if (jiraUrlBase.toLowerCase().includes('.atlassian.net/jira')) {
        jiraUrlBase = jiraUrlBase.toLowerCase().replace('/jira', '');
      }
      return `${jiraUrlBase}/browse/${externalId}`;
    }
    return `https://sisbr.atlassian.net/browse/${externalId}`;
  } else if (origin === 'Azure') {
    const azureUrlRaw = process.env.AZURE_API_URL;
    const numericId = externalId.replace(/\D/g, '');
    if (azureUrlRaw) {
      const azureUrlBase = azureUrlRaw.replace(/\/$/, '');
      return `${azureUrlBase}/_workitems/edit/${numericId}`;
    }
    return `https://dev.azure.com/mongeral/_workitems/edit/${numericId}`;
  }
  return '#';
};

// Rota de Sincronização
app.post('/api/sync', async (req, res) => {
  console.log('Iniciando sincronização...');
  let jiraFetched = [];
  let azureFetched = [];
  let syncSource = { jira: 'mock', azure: 'mock' };

  // 1. Sincronizar com Jira
  if (hasJiraCredentials()) {
    try {
      console.log('Buscando dados reais do Jira...');
      const url = `${process.env.JIRA_API_URL.replace(/\/$/, '')}/rest/api/3/search`;
      const auth = Buffer.from(`${process.env.JIRA_USER_EMAIL}:${process.env.JIRA_PAT}`).toString('base64');
      
      const response = await axios.get(url, {
        params: {
          jql: 'issuetype in (Epic, Opportunity, "Epic")',
          maxResults: 50
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.issues) {
        jiraFetched = response.data.issues.map(issue => ({
          origin: 'Jira',
          externalId: issue.key,
          title: issue.fields.summary,
          externalStatus: issue.fields.status?.name || 'Sem Status'
        }));
        syncSource.jira = 'real';
      }
    } catch (err) {
      console.error('Erro ao buscar dados do Jira (usando fallback de mock):', err.message);
      jiraFetched = MOCK_JIRA_DEMANDS;
    }
  } else {
    console.log('Credenciais do Jira não configuradas. Usando mock.');
    jiraFetched = MOCK_JIRA_DEMANDS;
  }

  // 2. Sincronizar com Azure DevOps
  if (hasAzureCredentials()) {
    try {
      console.log('Buscando dados reais do Azure DevOps...');
      // Azure DevOps requer uma consulta WIQL para obter os IDs e depois obter os detalhes
      const wiqlUrl = `${process.env.AZURE_API_URL.replace(/\/$/, '')}/_apis/wit/wiql?api-version=6.0`;
      const auth = Buffer.from(`:${process.env.AZURE_PAT}`).toString('base64');

      const queryStr = "Select [System.Id] From WorkItems Where [System.State] <> 'Removed' " +
                       "AND (" +
                       "[System.CreatedBy] = @me " +
                       "OR [System.CreatedBy] = 'arlindo.junior@sicoob.com.br' " +
                       "OR [System.CreatedBy] = 'Arlindo Honorato Pereira Junior' " +
                       "OR [System.CreatedBy] = 'Arlindo Honorato Pereira Júnior' " +
                       "OR [System.AssignedTo] = @me " +
                       "OR [System.AssignedTo] = 'arlindo.junior@sicoob.com.br' " +
                       "OR [System.AssignedTo] = 'Arlindo Honorato Pereira Junior' " +
                       "OR [System.AssignedTo] = 'Arlindo Honorato Pereira Júnior'" +
                       ")";

      const wiqlRes = await axios.post(wiqlUrl, {
        query: queryStr
      }, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const workItemsRefs = wiqlRes.data?.workItems || [];
      
      if (workItemsRefs.length > 0) {
        azureFetched = [];
        const chunkSize = 200;
        for (let i = 0; i < workItemsRefs.length; i += chunkSize) {
          const chunk = workItemsRefs.slice(i, i + chunkSize);
          const ids = chunk.map(item => item.id).join(',');
          const detailUrl = `${process.env.AZURE_API_URL.replace(/\/$/, '')}/_apis/wit/workitems?ids=${ids}&api-version=6.0`;
          
          const detailsRes = await axios.get(detailUrl, {
            headers: {
              'Authorization': `Basic ${auth}`
            }
          });

          if (detailsRes.data && detailsRes.data.value) {
            const chunkFetched = detailsRes.data.value.map(item => {
              const fields = item.fields;
              const itemType = fields['System.WorkItemType'];
              let prefix = '';
              if (itemType === 'User Story') prefix = 'US: ';
              else if (itemType === 'Bug') prefix = 'Bug: ';
              else if (itemType) prefix = `${itemType}: `;
              return {
                origin: 'Azure',
                externalId: `AZ-${item.id}`,
                title: prefix + (fields['System.Title'] || 'Sem título'),
                externalStatus: fields['System.State'] || 'Sem Status'
              };
            });
            azureFetched.push(...chunkFetched);
          }
        }
        if (azureFetched.length > 0) {
          syncSource.azure = 'real';
        } else {
          azureFetched = MOCK_AZURE_DEMANDS;
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados do Azure DevOps (usando fallback de mock):', err.message);
      azureFetched = MOCK_AZURE_DEMANDS;
    }
  } else {
    console.log('Credenciais do Azure DevOps não configuradas. Usando mock.');
    azureFetched = MOCK_AZURE_DEMANDS;
  }

  // Combinar demandas obtidas
  const allDemands = [...jiraFetched, ...azureFetched];

  // Inserir ou atualizar na base SQLite
  try {
    for (const demand of allDemands) {
      await dbRun(`
        INSERT INTO demands (externalId, origin, title, externalStatus, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(externalId) DO UPDATE SET
          title = excluded.title,
          externalStatus = excluded.externalStatus,
          updatedAt = CURRENT_TIMESTAMP
      `, [demand.externalId, demand.origin, demand.title, demand.externalStatus]);
    }

    res.json({
      success: true,
      message: 'Sincronização concluída com sucesso.',
      sources: syncSource,
      count: allDemands.length
    });
  } catch (dbErr) {
    console.error('Erro ao gravar demandas no SQLite:', dbErr);
    res.status(500).json({ success: false, error: 'Erro ao gravar dados no banco de dados local.' });
  }
});

// GET /api/demands - Listar todas as demandas locais com suas tags
app.get('/api/demands', async (req, res) => {
  try {
    const query = `
      SELECT d.*, group_concat(t.tag) as tags
      FROM demands d
      LEFT JOIN tags t ON d.externalId = t.externalId
      GROUP BY d.externalId
      ORDER BY d.updatedAt DESC
    `;
    const rows = await dbAll(query);
    
    const formattedRows = rows.map(row => ({
      ...row,
      tags: row.tags ? row.tags.split(',') : [],
      externalUrl: getExternalUrl(row.origin, row.externalId)
    }));

    res.json(formattedRows);
  } catch (err) {
    console.error('Erro ao listar demandas:', err);
    res.status(500).json({ error: 'Erro interno ao buscar demandas.' });
  }
});

// GET /api/demands/:externalId - Detalhes da demanda com anotações e tags
app.get('/api/demands/:externalId', async (req, res) => {
  const { externalId } = req.params;
  try {
    const demand = await dbGet('SELECT * FROM demands WHERE externalId = ?', [externalId]);
    
    if (!demand) {
      return res.status(404).json({ error: 'Demand não encontrada no cache local.' });
    }

    const annotations = await dbAll(
      'SELECT id, content, createdAt FROM annotations WHERE externalId = ? ORDER BY createdAt DESC',
      [externalId]
    );

    const tagsRows = await dbAll('SELECT tag FROM tags WHERE externalId = ?', [externalId]);
    const tags = tagsRows.map(row => row.tag);

    res.json({
      ...demand,
      annotations,
      tags,
      externalUrl: getExternalUrl(demand.origin, demand.externalId)
    });
  } catch (err) {
    console.error('Erro ao buscar detalhes da demanda:', err);
    res.status(500).json({ error: 'Erro interno ao buscar detalhes da demanda.' });
  }
});

// POST /api/demands/:externalId/annotations - Adicionar anotação local
app.post('/api/demands/:externalId/annotations', async (req, res) => {
  const { externalId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'O conteúdo da anotação não pode ser vazio.' });
  }

  try {
    const demand = await dbGet('SELECT 1 FROM demands WHERE externalId = ?', [externalId]);
    if (!demand) {
      return res.status(404).json({ error: 'Demand não encontrada para adicionar anotação.' });
    }

    const result = await dbRun(
      'INSERT INTO annotations (externalId, content, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [externalId, content]
    );

    const newAnnotation = await dbGet('SELECT * FROM annotations WHERE id = ?', [result.id]);
    res.status(201).json(newAnnotation);
  } catch (err) {
    console.error('Erro ao criar anotação:', err);
    res.status(500).json({ error: 'Erro interno ao criar anotação.' });
  }
});

// POST /api/demands/:externalId/tags - Adicionar tag customizada
app.post('/api/demands/:externalId/tags', async (req, res) => {
  const { externalId } = req.params;
  const { tag } = req.body;

  if (!tag || tag.trim() === '') {
    return res.status(400).json({ error: 'A tag não pode ser vazia.' });
  }

  const cleanedTag = tag.trim().toLowerCase();

  try {
    const demand = await dbGet('SELECT 1 FROM demands WHERE externalId = ?', [externalId]);
    if (!demand) {
      return res.status(404).json({ error: 'Demand não encontrada para adicionar tag.' });
    }

    await dbRun(
      'INSERT OR IGNORE INTO tags (externalId, tag) VALUES (?, ?)',
      [externalId, cleanedTag]
    );

    res.json({ success: true, tag: cleanedTag });
  } catch (err) {
    console.error('Erro ao adicionar tag:', err);
    res.status(500).json({ error: 'Erro interno ao adicionar tag.' });
  }
});

// DELETE /api/demands/:externalId/tags/:tag - Remover tag customizada
app.delete('/api/demands/:externalId/tags/:tag', async (req, res) => {
  const { externalId, tag } = req.params;

  try {
    await dbRun(
      'DELETE FROM tags WHERE externalId = ? AND tag = ?',
      [externalId, tag.toLowerCase()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao remover tag:', err);
    res.status(500).json({ error: 'Erro interno ao remover tag.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend do PO Hub rodando na porta ${PORT}`);
});
