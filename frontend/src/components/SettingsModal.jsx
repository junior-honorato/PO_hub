import React, { useState, useEffect } from 'react';
import { X, Settings, Globe } from 'lucide-react';
import StatusMapperTab from './StatusMapperTab';

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('credentials');
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [azureOrg, setAzureOrg] = useState('');
  const [azureProject, setAzureProject] = useState('');
  const [azureToken, setAzureToken] = useState('');

  const [dbPath, setDbPath] = useState('');
  const [defaultDbPath, setDefaultDbPath] = useState('');
  const [dbSaveError, setDbSaveError] = useState('');
  const [dbSaveSuccess, setDbSaveSuccess] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModelName, setGeminiModelName] = useState('gemini-1.5-flash');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [llmSaveError, setLlmSaveError] = useState('');
  const [llmSaveSuccess, setLlmSaveSuccess] = useState(false);
  const [isSavingLlm, setIsSavingLlm] = useState(false);

  const fetchDbPath = async () => {
    try {
      const res = await fetch('/api/settings/db-path');
      if (res.ok) {
        const data = await res.json();
        setDbPath(data.current_path || '');
        setDefaultDbPath(data.default_path || '');
      }
    } catch (err) {
      console.error("Erro ao carregar caminho do banco:", err);
    }
  };

  const fetchCredentials = async () => {
    try {
      const res = await fetch('/api/settings/credentials');
      if (res.ok) {
        const data = await res.json();
        if (data.jiraUrl) setJiraUrl(data.jiraUrl);
        if (data.jiraEmail) setJiraEmail(data.jiraEmail);
        if (data.jiraToken) setJiraToken(data.jiraToken);
        if (data.azureOrg) setAzureOrg(data.azureOrg);
        if (data.azureProject) setAzureProject(data.azureProject);
        if (data.azureToken) setAzureToken(data.azureToken);
      }
    } catch (err) {
      console.error("Erro ao obter credenciais do servidor:", err);
    }
  };

  const fetchLlmConfig = async () => {
    try {
      const res = await fetch('/api/settings/llm');
      if (res.ok) {
        const data = await res.json();
        if (data.geminiApiKey) setGeminiApiKey(data.geminiApiKey);
        if (data.geminiModelName) setGeminiModelName(data.geminiModelName);
        if (data.systemInstruction) setSystemInstruction(data.systemInstruction);
      }
    } catch (err) {
      console.error("Erro ao obter configurações da LLM do servidor:", err);
    }
  };

  const handleSaveLlm = async (e) => {
    e.preventDefault();
    setLlmSaveError('');
    setLlmSaveSuccess(false);
    setIsSavingLlm(true);
    try {
      const res = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: geminiApiKey.trim(),
          geminiModelName: geminiModelName.trim(),
          systemInstruction: systemInstruction
        })
      });
      if (res.ok) {
        setLlmSaveSuccess(true);
      } else {
        const errData = await res.json();
        setLlmSaveError(errData.detail || 'Erro ao salvar configurações da LLM.');
      }
    } catch (err) {
      setLlmSaveError('Erro de conexão ao tentar salvar configurações da LLM.');
    } finally {
      setIsSavingLlm(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setJiraUrl(localStorage.getItem('jira_url') || '');
      setJiraEmail(localStorage.getItem('jira_email') || '');
      setJiraToken(localStorage.getItem('jira_token') || '');
      setAzureOrg(localStorage.getItem('azure_org') || '');
      setAzureProject(localStorage.getItem('azure_project') || '');
      setAzureToken(localStorage.getItem('azure_token') || '');
      setActiveTab('credentials');
      setDbSaveError('');
      setDbSaveSuccess(false);
      setLlmSaveError('');
      setLlmSaveSuccess(false);
      fetchDbPath();
      fetchCredentials();
      fetchLlmConfig();
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    localStorage.setItem('jira_url', jiraUrl.trim());
    localStorage.setItem('jira_email', jiraEmail.trim());
    localStorage.setItem('jira_token', jiraToken.trim());
    localStorage.setItem('azure_org', azureOrg.trim());
    localStorage.setItem('azure_project', azureProject.trim());
    localStorage.setItem('azure_token', azureToken.trim());
    
    try {
      await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jiraUrl: jiraUrl.trim(),
          jiraEmail: jiraEmail.trim(),
          jiraToken: jiraToken.trim(),
          azureOrg: azureOrg.trim(),
          azureProject: azureProject.trim(),
          azureToken: azureToken.trim()
        })
      });
    } catch (err) {
      console.error("Erro ao salvar credenciais no servidor:", err);
    }
    
    onClose();
  };

  const handleSaveDbPath = async (e) => {
    e.preventDefault();
    setDbSaveError('');
    setDbSaveSuccess(false);
    setIsSavingDb(true);
    try {
      const res = await fetch('/api/settings/db-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_path: dbPath.trim() })
      });
      if (res.ok) {
        setDbSaveSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const data = await res.json();
        setDbSaveError(data.detail || 'Erro ao salvar caminho do banco de dados.');
      }
    } catch (err) {
      setDbSaveError('Erro de conexão ao tentar atualizar o banco de dados.');
    } finally {
      setIsSavingDb(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col h-[680px] max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sicoob-primary" />
            <h2 className="text-lg font-bold text-sicoob-text">Configurações do Painel</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-655 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seleção de Abas */}
        <div className="grid grid-cols-4 border-b border-slate-200 w-full">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`w-full pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'credentials'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Credenciais de APIs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mappings')}
            className={`w-full pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'mappings'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Mapeamento de Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`w-full pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'database'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Banco de Dados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('llm')}
            className={`w-full pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'llm'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Inteligência Artificial
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 mt-4">
          {activeTab === 'credentials' ? (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Seção Jira */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Sicoob TI (Jira)
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">URL do Jira (Sicoob)</label>
                  <input
                    type="url"
                    placeholder="https://sua-empresa.atlassian.net"
                    value={jiraUrl}
                    onChange={e => setJiraUrl(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium">E-mail do Usuário (Sicoob)</label>
                    <input
                      type="email"
                      placeholder="nome@empresa.com"
                      value={jiraEmail}
                      onChange={e => setJiraEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium">Token de Acesso (Sicoob)</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••"
                      value={jiraToken}
                      onChange={e => setJiraToken(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção Azure */}
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" /> MAG TI (Azure DevOps)
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium">Organização (MAG TI)</label>
                    <input
                      type="text"
                      placeholder="sua-organizacao"
                      value={azureOrg}
                      onChange={e => setAzureOrg(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium">Projeto (MAG TI)</label>
                    <input
                      type="text"
                      placeholder="seu-projeto"
                      value={azureProject}
                      onChange={e => setAzureProject(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Token de Acesso (MAG TI)</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••"
                    value={azureToken}
                    onChange={e => setAzureToken(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary rounded-xl text-xs font-bold text-white transition-colors shadow-sm"
              >
                Salvar Credenciais
              </button>
            </div>
          </form>
        ) : activeTab === 'mappings' ? (
          <StatusMapperTab />
        ) : activeTab === 'database' ? (
          <form onSubmit={handleSaveDbPath} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Armazenamento do Banco de Dados
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2.5 leading-relaxed">
                <p>
                  <strong>Como sincronizar com o OneDrive ou Rede:</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>O banco de dados do PO Hub utiliza SQLite (arquivo local). Não é possível conectar diretamente a links HTTP/HTTPS do OneDrive.</li>
                  <li>Para hospedar o banco na nuvem, você deve especificar abaixo o <strong>caminho físico absoluto da pasta local</strong> sincronizada no seu computador pelo aplicativo do OneDrive (ex: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sicoob-primary">C:\Users\usuario\OneDrive - Empresa\PO_Hub</code>).</li>
                  <li>O aplicativo desktop do OneDrive se encarregará de sincronizar os arquivos automaticamente para a nuvem.</li>
                  <li><strong>Nota:</strong> Ao salvar, os dados existentes serão copiados para a nova pasta e a página será recarregada. Se deixar em branco, o sistema usará a pasta padrão do projeto.</li>
                </ul>
              </div>

              {dbSaveError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-xl">
                  {dbSaveError}
                </div>
              )}

              {dbSaveSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-4 py-3 rounded-xl">
                  Caminho do banco de dados atualizado com sucesso! Recarregando aplicação...
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Caminho da Pasta do Banco de Dados (OneDrive / Rede)</span>
                  <span className="text-[10px] text-slate-400">Padrão: {defaultDbPath || 'Carregando...'}</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: C:\Users\nome\OneDrive - Empresa\PO_Hub"
                  value={dbPath}
                  onChange={e => setDbPath(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingDb}
                className="px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              >
                {isSavingDb ? 'Salvando e Migrando...' : 'Salvar e Migrar Banco'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveLlm} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-650" /> Parametrização da LLM (Gemini)
              </h3>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  <strong>Ajuste de Comportamento do Resumo:</strong>
                </p>
                <p>
                  Defina a chave de API do Gemini e personalize as instruções do sistema. O prompt customizado controlará como o relatório semanal gerará os blocos, o tom de voz e as prioridades do seu Status Report Executivo.
                </p>
              </div>

              {llmSaveError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-xl">
                  {llmSaveError}
                </div>
              )}

              {llmSaveSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-4 py-3 rounded-xl">
                  Configurações do Gemini salvas com sucesso!
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Chave de API do Gemini</label>
                  <input
                    type="password"
                    placeholder="Cole a chave de API do Gemini (AIzaSy...)"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Modelo do Gemini</label>
                  <input
                    type="text"
                    placeholder="gemini-1.5-flash ou gemini-1.5-pro"
                    value={geminiModelName}
                    onChange={e => setGeminiModelName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">Instrução do Sistema (Prompt Principal)</label>
                <textarea
                  rows="10"
                  placeholder="Escreva as instruções detalhadas de como a IA deve analisar as demandas e formatar o relatório..."
                  value={systemInstruction}
                  onChange={e => setSystemInstruction(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors resize-none custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={isSavingLlm}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
              >
                {isSavingLlm ? 'Salvando...' : 'Salvar Parametrização'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
