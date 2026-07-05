import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import DemandTable from './components/DemandTable';
import DemandDrawer from './components/DemandDrawer';
import ManagerSyncView from './components/ManagerSyncView';
import RoadmapGraphView from './components/RoadmapGraphView';
import HistoryView from './components/HistoryView';
import PortfolioView from './components/PortfolioView';

export default function App() {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [demands, setDemands] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState(null);

  useEffect(() => {
    loadDemands();
    const savedSync = localStorage.getItem('po-hub-last-sync');
    if (savedSync) {
      setLastSyncStatus(JSON.parse(savedSync));
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

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        await loadDemands();
        
        const syncSourceMsg = (result.sources.jira === 'real' || result.sources.azure === 'real')
          ? 'Conectado a APIs Reais'
          : 'Sincronizado com dados Mockados';

        const syncInfo = {
          time: new Date().toLocaleTimeString('pt-BR'),
          source: syncSourceMsg
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
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSync={handleSync}
        isSyncing={isSyncing}
        lastSyncStatus={lastSyncStatus}
      />      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'portfolio' ? (
          <PortfolioView />
        ) : activeTab === 'one-on-one' ? (
          <ManagerSyncView demands={demands} onSelectDemand={handleSelectDemand} />
        ) : activeTab === 'roadmap' ? (
          <RoadmapGraphView demands={demands} onSelectDemand={handleSelectDemand} />
        ) : activeTab === 'history' ? (
          <HistoryView onSelectDemand={handleSelectDemand} />
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Demandas Sincronizadas</h2>
              <p className="text-sm text-slate-400">Consolidado geral de itens de backlog com tags e filtros rápidos</p>
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
      />
    </div>
  );
}
