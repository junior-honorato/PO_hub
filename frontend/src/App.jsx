import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MetricCards from './components/MetricCards';
import DemandTable from './components/DemandTable';
import DemandDrawer from './components/DemandDrawer';
import ManagerSyncView from './components/ManagerSyncView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6 flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Painel Executivo</h2>
                <p className="text-sm text-slate-400">Consolidação local inteligente de backlogs externos</p>
              </div>
              <div className="bg-slate-900/30 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Conectado ao SQLite local
              </div>
            </div>

            {/* Cards de Métricas */}
            <MetricCards demands={demands} />

            {/* Grid de Resumo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tabela Resumida */}
              <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">Demandas Atualizadas Recentemente</h3>
                  <ArrowUpRight className="w-5 h-5 text-slate-500" />
                </div>
                
                <div className="divide-y divide-slate-800/60">
                  {recentDemands.length > 0 ? (
                    recentDemands.map(demand => (
                      <div
                        key={demand.externalId}
                        onClick={() => handleSelectDemand(demand.externalId)}
                        className="py-3.5 flex items-center justify-between hover:bg-slate-900/30 px-2 rounded-lg cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${
                            demand.origin === 'Jira' ? 'bg-sky-400' : 'bg-emerald-400'
                          }`} />
                          <div>
                            <p className="font-semibold text-xs text-white group-hover:text-brand-400 transition-colors">
                              {demand.externalId}
                            </p>
                            <p className="text-sm text-slate-300 max-w-sm truncate mt-0.5">
                              {demand.title}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full">
                            {demand.externalStatus}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-slate-500 text-sm">
                      Nenhuma demanda sincronizada. Clique em "Sincronizar APIs" para começar.
                    </div>
                  )}
                </div>
              </div>

              {/* Quadro de Distribuição */}
              <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 space-y-4 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">Distribuição por Canal</h3>
                  <p className="text-xs text-slate-500 mt-1">Comparativo de volumetria sincronizada</p>
                </div>

                <div className="space-y-4 my-6">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>Jira (Epics/Opportunities)</span>
                      <span>{demands.filter(d => d.origin === 'Jira').length}</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2">
                      <div
                        className="bg-sky-400 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${total ? (demands.filter(d => d.origin === 'Jira').length / total) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
                      <span>Azure DevOps (Stories/Bugs)</span>
                      <span>{demands.filter(d => d.origin === 'Azure').length}</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2">
                      <div
                        className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${total ? (demands.filter(d => d.origin === 'Azure').length / total) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/50 p-4 border border-slate-800/80 rounded-xl text-center">
                  <span className="text-xs text-slate-400">Banco de dados:</span>
                  <span className="block font-bold text-sm text-indigo-400 mt-1">SQLite Local (database.db)</span>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'one-on-one' ? (
          <ManagerSyncView demands={demands} onSelectDemand={handleSelectDemand} />
        ) : (
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Demandas Sincronizadas</h2>
              <p className="text-sm text-slate-400">Consolidado geral de itens de backlog com tags e filtros rápidos</p>
            </div>
            <DemandTable demands={demands} onSelectDemand={handleSelectDemand} />
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
