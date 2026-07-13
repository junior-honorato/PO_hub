import React from 'react';
import { Target, AlertTriangle, Bell } from 'lucide-react';

export default function ManagerSyncView({ demands, onSelectDemand }) {
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();

  const targetDemands = demands.filter(d => {
    const matchesFollowUp = d.followUpDate && d.followUpDate <= todayStr;
    const matchesOverdue = d.promisedDate && d.promisedDate < todayStr && d.externalStatus !== 'Concluído' && d.externalStatus !== 'Done';
    return matchesFollowUp || matchesOverdue;
  });

  return (
    <div className="space-y-6 flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6">
      <div>
        <h2 className="text-2xl font-bold text-sicoob-text tracking-tight flex items-center gap-2">
          <Target className="w-6 h-6 text-yellow-500 animate-pulse" />
          Modo One-on-One
        </h2>
        <p className="text-sm text-slate-500">Rastreamento de prazos acordados, cobranças pendentes e notas executivas</p>
      </div>

      {targetDemands.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {targetDemands.map(demand => {
            const isOverdue = demand.promisedDate && demand.promisedDate < todayStr && demand.externalStatus !== 'Concluído' && demand.externalStatus !== 'Done';
            const isFollowUpDue = demand.followUpDate && demand.followUpDate <= todayStr;
            
            return (
              <div
                key={demand.externalId}
                onClick={() => onSelectDemand(demand.externalId)}
                className="bg-white border border-slate-200 hover:border-sicoob-primary/50 rounded-2xl p-5 space-y-4 hover:shadow-md shadow-sm cursor-pointer transition-all group relative flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        demand.origin === 'Jira' ? 'bg-sky-500' : 'bg-emerald-500'
                      }`} />
                      <span className="text-xs font-bold text-slate-500 uppercase">{demand.externalId}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      demand.externalStatus === 'Concluído' || demand.externalStatus === 'Done'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-sicoob-primary/10 text-sicoob-secondary border-sicoob-primary/20'
                    }`}>
                      {demand.externalStatus}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-sicoob-text group-hover:text-sicoob-primary transition-colors line-clamp-2">
                    {demand.title}
                  </h3>

                  {/* Badges de Atenção */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Prazo Estourado ({demand.promisedDate})
                      </span>
                    )}
                    {isFollowUpDue && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-md">
                        <Bell className="w-3.5 h-3.5" />
                        Cobrança Agendada ({demand.followUpDate})
                      </span>
                    )}
                  </div>

                  {/* Resumo Gestora */}
                  {demand.managerNotes ? (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mt-2">
                      <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider block mb-1">Notas para Gestora:</span>
                      <p className="text-xs text-slate-700 italic whitespace-pre-wrap">
                        "{demand.managerNotes}"
                      </p>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-xl p-3 mt-2 text-center text-xs text-slate-400">
                      Nenhuma nota de status cadastrada.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-slate-200 bg-white rounded-3xl text-slate-500 flex flex-col items-center justify-center gap-3 shadow-sm">
          <Target className="w-12 h-12 text-slate-300" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Tudo em dia!</p>
            <p className="text-xs text-slate-550 mt-1">Nenhuma cobrança agendada para hoje ou prazo estourado pendente.</p>
          </div>
        </div>
      )}
    </div>
  );
}
