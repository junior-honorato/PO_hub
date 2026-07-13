import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight, Menu, X, Settings, LayoutDashboard } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import DemandTable from './components/DemandTable';
import DemandDrawer from './components/DemandDrawer';
import ManagerSyncView from './components/ManagerSyncView';
import HistoryView from './components/HistoryView';
import PortfolioView from './components/PortfolioView';
import ProjectOverview from './components/ProjectOverview';

export default function App() {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [demands, setDemands] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    loadDemands();
    const savedSync = localStorage.getItem('po-hub-last-sync');
    if (savedSync) {
      try {
        const parsed = JSON.parse(savedSync);
        if (parsed.source === 'Sincronizado com dados Mockados') {
          parsed.source = '';
        }
        setLastSyncStatus(parsed);
      } catch (e) {}
    }
  }, []);

  const loadDemands = async () => {
    try {
      const res = await fetch('/api/demands');
      if (res.ok) {
        const data = await res.json();
        setDemands(data);
      }
    } catch (e) {
      console.error("Erro ao carregar demandas:", e);
    }
  };

  const handleSync = async (e) => {
    const jiraUrl = localStorage.getItem('jira_url');
    const jiraEmail = localStorage.getItem('jira_email');
    const jiraToken = localStorage.getItem('jira_token');
    const azureOrg = localStorage.getItem('azure_org');
    const azureProject = localStorage.getItem('azure_project');
    const azureToken = localStorage.getItem('azure_token');

    const hasJira = jiraUrl && jiraEmail && jiraToken;
    const hasAzure = azureOrg && azureProject && azureToken;

    if (!hasJira && !hasAzure) {
      alert('Por favor, preencha as credenciais do Jira ou do Azure DevOps no menu de Configurações antes de sincronizar.');
      return;
    }

    const force = e && e.shiftKey === true;
    console.log(force ? "Iniciando carga completa (force_refresh = true)..." : "Iniciando carga incremental...");

    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jiraUrl: jiraUrl || null,
          jiraEmail: jiraEmail || null,
          jiraToken: jiraToken || null,
          azureOrg: azureOrg || null,
          azureProject: azureProject || null,
          azureToken: azureToken || null,
          force_refresh: force
        })
      });
      if (res.ok) {
        const result = await res.json();
        await loadDemands();
        
        const syncSourceMsg = (result.sources.jira === 'real' || result.sources.azure === 'real')
          ? 'Conectado a APIs Reais'
          : '';

        let syncTypeDetail = '';
        if (result.sync_types && syncSourceMsg) {
          const types = [];
          if (result.sources.jira === 'real' && result.sync_types.jira) {
            types.push(`Jira: ${result.sync_types.jira === 'incremental' ? 'Delta' : 'Completa'}`);
          }
          if (result.sources.azure === 'real' && result.sync_types.azure) {
            types.push(`Azure: ${result.sync_types.azure === 'incremental' ? 'Delta' : 'Completa'}`);
          }
          if (types.length > 0) {
            syncTypeDetail = ` (${types.join(', ')})`;
          }
        }

        const syncInfo = {
          time: new Date().toLocaleString('pt-BR'),
          source: syncSourceMsg ? `${syncSourceMsg}${syncTypeDetail}` : ''
        };
        
        setLastSyncStatus(syncInfo);
        localStorage.setItem('po-hub-last-sync', JSON.stringify(syncInfo));
      }
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectDemand = (id) => {
    setSelectedDemandId(id);
    setIsDrawerOpen(true);
  };

  const total = demands.length;
  const recentDemands = demands.slice(0, 5);

  return (
    <div className="flex h-full overflow-hidden bg-sicoob-bg text-sicoob-text">
      {/* Mobile Sidebar Overlay */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${isSidebarOpen ? 'visible' : 'invisible'}`}>
        {/* Backdrop */}
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Panel */}
        <div className={`absolute left-0 top-0 h-full w-64 shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-4 right-4 z-30">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setSelectedProjectId(null);
              setActiveTab(tab);
              setIsSidebarOpen(false);
            }}
            onSync={handleSync}
            isSyncing={isSyncing}
            lastSyncStatus={lastSyncStatus}
            onOpenSettings={() => {
              setIsSettingsOpen(true);
              setIsSidebarOpen(false);
            }}
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setSelectedProjectId(null);
            setActiveTab(tab);
          }}
          onSync={handleSync}
          isSyncing={isSyncing}
          lastSyncStatus={lastSyncStatus}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-sicoob-text hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-sicoob-primary p-1.5 rounded-lg text-white shadow-sm">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight text-sicoob-text">PO Hub</span>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-sicoob-text hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </header>

        {selectedProjectId ? (
          <ProjectOverview
            projectId={selectedProjectId}
            onBack={() => setSelectedProjectId(null)}
            onSelectDemand={handleSelectDemand}
          />
        ) : activeTab === 'portfolio' ? (
          <PortfolioView onSelectProject={setSelectedProjectId} />
        ) : activeTab === 'one-on-one' ? (
          <ManagerSyncView demands={demands} onSelectDemand={handleSelectDemand} />
        ) : activeTab === 'history' ? (
          <HistoryView onSelectDemand={handleSelectDemand} />
        ) : (
          <div className="flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-sicoob-text tracking-tight">Demandas Sincronizadas</h2>
              <p className="text-sm text-slate-500">Consolidado geral de itens de backlog com tags e filtros rápidos</p>
            </div>
            <DemandTable demands={demands} onSelectDemand={handleSelectDemand} onRefreshDemands={loadDemands} />
          </div>
        )}
      </main>

      {/* Slide-over Drawer */}
      <DemandDrawer
        demandId={selectedDemandId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefreshDemands={loadDemands}
        allDemands={demands}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
