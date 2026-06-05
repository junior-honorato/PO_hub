import React, { useEffect, useState } from 'react';
import { History, Inbox, ArrowRight, RefreshCw } from 'lucide-react';

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

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const cleanIso = isoString.replace(' ', 'T');
      const d = new Date(cleanIso.indexOf('T') !== -1 ? cleanIso : cleanIso + 'T00:00:00');
      if (isNaN(d.getTime())) {
        return isoString;
      }
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                  <th className="px-6 py-4">ID / Origem</th>
                  <th className="px-6 py-4">Demanda</th>
                  <th className="px-6 py-4">Status Externo</th>
                  <th className="px-6 py-4">Última Sincronização</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                {demands.map((demand) => (
                  <tr
                    key={demand.externalId}
                    onClick={() => onSelectDemand(demand.externalId)}
                    className="hover:bg-slate-900/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          demand.origin === 'Jira' ? 'bg-sky-400' : 'bg-emerald-400'
                        }`} />
                        <div>
                          <span className="font-semibold text-white block">{demand.externalId}</span>
                          <span className="text-xs text-slate-500 block">{demand.origin}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="truncate font-medium text-slate-200 group-hover:text-white transition-colors">
                        {demand.title}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {demand.externalStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      {formatDate(demand.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button className="text-slate-400 group-hover:text-brand-400 group-hover:translate-x-1 transition-all p-1">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
