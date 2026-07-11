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
      fetchDbPath();
    }
  }, [isOpen]);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('jira_url', jiraUrl.trim());
    localStorage.setItem('jira_email', jiraEmail.trim());
    localStorage.setItem('jira_token', jiraToken.trim());
    localStorage.setItem('azure_org', azureOrg.trim());
    localStorage.setItem('azure_project', azureProject.trim());
    localStorage.setItem('azure_token', azureToken.trim());
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Configurações do Painel</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seleção de Abas */}
        <div className="flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'credentials'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
          >
            Credenciais de APIs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mappings')}
            className={`flex-1 pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'mappings'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
          >
            Mapeamento de Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`flex-1 pb-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'database'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-450 hover:text-slate-200'
            }`}
          >
            Banco de Dados
          </button>
        </div>

        {activeTab === 'credentials' ? (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Seção Jira */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Jira Cloud
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-450 font-medium">Jira URL</label>
                  <input
                    type="url"
                    placeholder="https://sua-empresa.atlassian.net"
                    value={jiraUrl}
                    onChange={e => setJiraUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-450 font-medium">E-mail do Usuário</label>
                    <input
                      type="email"
                      placeholder="nome@empresa.com"
                      value={jiraEmail}
                      onChange={e => setJiraEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-450 font-medium">Token de Acesso (PAT)</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••"
                      value={jiraToken}
                      onChange={e => setJiraToken(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção Azure */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> Azure DevOps
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-450 font-medium">Organização</label>
                    <input
                      type="text"
                      placeholder="sua-organizacao"
                      value={azureOrg}
                      onChange={e => setAzureOrg(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-450 font-medium">Projeto</label>
                    <input
                      type="text"
                      placeholder="seu-projeto"
                      value={azureProject}
                      onChange={e => setAzureProject(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-450 font-medium">Token de Acesso (PAT)</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••"
                    value={azureToken}
                    onChange={e => setAzureToken(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-550 rounded-xl text-xs font-bold text-white transition-colors"
              >
                Salvar Credenciais
              </button>
            </div>
          </form>
        ) : activeTab === 'mappings' ? (
          <StatusMapperTab />
        ) : (
          <form onSubmit={handleSaveDbPath} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Armazenamento do Banco de Dados
              </h3>
              
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-455 space-y-2.5 leading-relaxed">
                <p>
                  <strong>Como sincronizar com o OneDrive ou Rede:</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>O banco de dados do PO Hub utiliza SQLite (arquivo local). Não é possível conectar diretamente a links HTTP/HTTPS do OneDrive.</li>
                  <li>Para hospedar o banco na nuvem, você deve especificar abaixo o <strong>caminho físico absoluto da pasta local</strong> sincronizada no seu computador pelo aplicativo do OneDrive (ex: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-400">C:\Users\usuario\OneDrive - Empresa\PO_Hub</code>).</li>
                  <li>O aplicativo desktop do OneDrive se encarregará de sincronizar os arquivos automaticamente para a nuvem.</li>
                  <li><strong>Nota:</strong> Ao salvar, os dados existentes serão copiados para a nova pasta e a página será recarregada. Se deixar em branco, o sistema usará a pasta padrão do projeto.</li>
                </ul>
              </div>

              {dbSaveError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-xl">
                  {dbSaveError}
                </div>
              )}

              {dbSaveSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl">
                  Caminho do banco de dados atualizado com sucesso! Recarregando aplicação...
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-450 font-medium flex items-center justify-between">
                  <span>Caminho da Pasta do Banco de Dados (OneDrive / Rede)</span>
                  <span className="text-[10px] text-slate-500">Padrão: {defaultDbPath || 'Carregando...'}</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: C:\Users\nome\OneDrive - Empresa\PO_Hub"
                  value={dbPath}
                  onChange={e => setDbPath(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingDb}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-550 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSavingDb ? 'Salvando e Migrando...' : 'Salvar e Migrar Banco'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
