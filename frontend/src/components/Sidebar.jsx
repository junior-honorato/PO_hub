import React from 'react';
import { LayoutDashboard, Grid, ListTodo, RefreshCw, Target } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onSync, isSyncing, lastSyncStatus }) {
  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full z-20">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-gradient-to-tr from-brand-600 to-indigo-400 p-2 rounded-xl text-white shadow-md shadow-brand-500/20">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none tracking-tight">PO Hub</h1>
          <span className="text-xs text-slate-400 font-medium">Consolidador Local</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 text-white border-l-4 border-brand-500 shadow-sm'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
          }`}
        >
          <Grid className="w-5 h-5" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('demands')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'demands'
              ? 'bg-slate-900 text-white border-l-4 border-brand-500 shadow-sm'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
          }`}
        >
          <ListTodo className="w-5 h-5" />
          Demandas
        </button>
        <button
          onClick={() => setActiveTab('one-on-one')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'one-on-one'
              ? 'bg-slate-900 text-white border-l-4 border-brand-500 shadow-sm'
              : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
          }`}
        >
          <Target className="w-5 h-5" />
          Modo One-on-One
        </button>
      </nav>

      {/* Sincronização e Rodapé */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-500 hover:from-brand-500 hover:to-indigo-400 active:scale-95 transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:pointer-events-none"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar APIs'}
        </button>
        
        {lastSyncStatus && (
          <div className="mt-3 text-center">
            <span className="text-[10px] text-slate-500 block">
              Última Sync: {lastSyncStatus.time}
            </span>
            <span className="text-[10px] text-indigo-400 font-semibold mt-0.5 block">
              {lastSyncStatus.source}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
