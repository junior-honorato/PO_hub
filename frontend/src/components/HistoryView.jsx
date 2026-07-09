import React, { useEffect, useState } from 'react';
import { History, Inbox, RefreshCw } from 'lucide-react';
import DemandTable from './DemandTable';

export default function HistoryView({ onSelectDemand }) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/demands/history');
      if (res.ok) {
        const data = await res.json();
        setDemands(data);
      }
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" /> Histórico de Demandas
          </h2>
          <p className="text-sm text-slate-400">Arquivo de demandas concluídas, resolvidas ou canceladas</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <span>Carregando histórico...</span>
        </div>
      ) : demands.length > 0 ? (
        <DemandTable demands={demands} onSelectDemand={onSelectDemand} />
      ) : (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 max-w-lg mx-auto">
          <Inbox className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="font-medium text-slate-400 text-sm">Histórico vazio</p>
          <p className="text-xs mt-1">Nenhuma demanda finalizada arquivada no banco de histórico ainda.</p>
        </div>
      )}
    </div>
  );
}
