import { LayoutDashboard, Grid, ListTodo, RefreshCw, Target, FolderKanban, Network, History, Briefcase, Settings } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onSync, isSyncing, lastSyncStatus, onOpenSettings }) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full z-20 shadow-sm">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <div className="bg-sicoob-primary p-2 rounded-xl text-white shadow-sm">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none tracking-tight text-sicoob-text">PO Hub</h1>
          <span className="text-xs text-slate-500 font-medium">Consolidador Local</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'portfolio'
              ? 'bg-slate-100 text-sicoob-primary border-l-4 border-sicoob-primary font-semibold shadow-xs'
              : 'text-slate-650 hover:bg-slate-50 hover:text-sicoob-primary'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          Portfólio Executivo
        </button>
        <button
          onClick={() => setActiveTab('demands')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'demands'
              ? 'bg-slate-100 text-sicoob-primary border-l-4 border-sicoob-primary font-semibold shadow-xs'
              : 'text-slate-650 hover:bg-slate-50 hover:text-sicoob-primary'
          }`}
        >
          <ListTodo className="w-5 h-5" />
          Demandas
        </button>

        <button
          onClick={() => setActiveTab('one-on-one')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'one-on-one'
              ? 'bg-slate-100 text-sicoob-primary border-l-4 border-sicoob-primary font-semibold shadow-xs'
              : 'text-slate-655 hover:bg-slate-50 hover:text-sicoob-primary'
          }`}
        >
          <Target className="w-5 h-5" />
          Manager Sync
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-slate-100 text-sicoob-primary border-l-4 border-sicoob-primary font-semibold shadow-xs'
              : 'text-slate-655 hover:bg-slate-50 hover:text-sicoob-primary'
          }`}
        >
          <History className="w-5 h-5" />
          Histórico
        </button>
      </nav>

      {/* Sincronização e Rodapé */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-sicoob-text bg-white hover:bg-slate-50 border border-slate-200 transition-all select-none shadow-sm"
        >
          <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
          Configurações
        </button>

        <button
          onClick={onSync}
          disabled={isSyncing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-sicoob-primary hover:bg-sicoob-secondary active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar APIs'}
        </button>
        
        {lastSyncStatus && (
          <div className="mt-3 text-center">
            <span className="text-[10px] text-slate-500 block">
              Última Sync: {lastSyncStatus.time}
            </span>
            {lastSyncStatus.source && (
              <span className="text-[10px] text-sicoob-primary font-semibold mt-0.5 block">
                {lastSyncStatus.source}
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
