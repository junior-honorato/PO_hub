import React from 'react';
import { Layers, Trello, GitPullRequest, Tags } from 'lucide-react';

export default function MetricCards({ demands }) {
  const total = demands.length;
  const jiraCount = demands.filter(d => d.origin === 'Jira').length;
  const azureCount = demands.filter(d => d.origin === 'Azure').length;
  const tagCount = new Set(demands.flatMap(d => d.tags)).size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Total Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-sicoob-primary/50 hover:shadow-md shadow-sm transition-all duration-300">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
          <Layers className="w-24 h-24 text-sicoob-text" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Demandas</p>
        <h3 className="text-3xl font-bold mt-2 text-sicoob-text">{total}</h3>
        <span className="text-xs text-sicoob-primary mt-2 block font-medium">Consolidado local</span>
      </div>

      {/* Jira Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-sicoob-primary/50 hover:shadow-md shadow-sm transition-all duration-300">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
          <Trello className="w-24 h-24 text-sicoob-text" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jira Epics</p>
        <h3 className="text-3xl font-bold mt-2 text-sky-600">{jiraCount}</h3>
        <span className="text-xs text-slate-500 mt-2 block">Originadas no Jira API</span>
      </div>

      {/* Azure Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-sicoob-primary/50 hover:shadow-md shadow-sm transition-all duration-300">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
          <GitPullRequest className="w-24 h-24 text-sicoob-text" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Azure DevOps Backlog</p>
        <h3 className="text-3xl font-bold mt-2 text-emerald-600">{azureCount}</h3>
        <span className="text-xs text-slate-500 mt-2 block">Histórias e bugs sincronizados</span>
      </div>

      {/* Tags Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden group hover:border-sicoob-primary/50 hover:shadow-md shadow-sm transition-all duration-300">
        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
          <Tags className="w-24 h-24 text-sicoob-text" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags Customizadas</p>
        <h3 className="text-3xl font-bold mt-2 text-purple-600">{tagCount}</h3>
        <span className="text-xs text-slate-500 mt-2 block">Criadas localmente</span>
      </div>
    </div>
  );
}
