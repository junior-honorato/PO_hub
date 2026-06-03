import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, AlertOctagon, Layers, ArrowRight, ExternalLink } from 'lucide-react';

export default function ProjectView({ demands, onSelectDemand }) {
  const [expandedProjects, setExpandedProjects] = useState({});

  // Helper to extract project name from tag (e.g. "projeto: portal" or "projeto-portal")
  const getProjectName = (tag) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag.startsWith('projeto:')) {
      return cleanTag.substring(8).trim();
    }
    if (cleanTag.startsWith('projeto-')) {
      return cleanTag.substring(8).trim();
    }
    return null;
  };

  const capitalize = (str) => {
    if (!str) return '';
    return str.split(/[\s-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Group demands by project tag
  const projectsMap = {};
  demands.forEach(d => {
    if (d.tags && d.tags.length > 0) {
      d.tags.forEach(tag => {
        const projName = getProjectName(tag);
        if (projName) {
          const capitalizedProjName = capitalize(projName);
          if (!projectsMap[capitalizedProjName]) {
            projectsMap[capitalizedProjName] = [];
          }
          if (!projectsMap[capitalizedProjName].some(existing => existing.externalId === d.externalId)) {
            projectsMap[capitalizedProjName].push(d);
          }
        }
      });
    }
  });

  const toggleProject = (projectName) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const projectNames = Object.keys(projectsMap).sort();

  return (
    <div className="space-y-6 flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-indigo-400" />
          Visão de Projetos
        </h2>
        <p className="text-sm text-slate-400">Agrupamento cruzado por iniciativa/projeto com mapeamento visual de dependências</p>
      </div>

      {projectNames.length > 0 ? (
        <div className="space-y-4">
          {projectNames.map(projName => {
            const projDemands = projectsMap[projName];
            const isExpanded = expandedProjects[projName] !== false; // Default to expanded
            const azureDemands = projDemands.filter(d => d.origin === 'Azure');
            const jiraDemands = projDemands.filter(d => d.origin === 'Jira');

            return (
              <div 
                key={projName}
                className="bg-slate-900/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-300"
              >
                {/* Header expansível */}
                <button
                  onClick={() => toggleProject(projName)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-900/40 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-400" />
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{projName}</h3>
                      <span className="text-xs text-slate-500 font-medium">
                        {projDemands.length} {projDemands.length === 1 ? 'demanda associada' : 'demandas associadas'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">
                      Azure: {azureDemands.length} | Jira: {jiraDemands.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Conteúdo do Projeto */}
                {isExpanded && (
                  <div className="border-t border-slate-800/60 p-6 bg-slate-950/20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Coluna Azure DevOps */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Azure DevOps
                          </h4>
                          <span className="text-[10px] text-slate-500 font-bold">{azureDemands.length} itens</span>
                        </div>

                        <div className="space-y-3">
                          {azureDemands.length > 0 ? (
                            azureDemands.map(demand => (
                              <DemandProjectCard
                                key={demand.externalId}
                                demand={demand}
                                onSelect={onSelectDemand}
                              />
                            ))
                          ) : (
                            <div className="text-center py-8 border border-dashed border-slate-800/60 rounded-xl text-slate-600 text-xs">
                              Nenhuma demanda do Azure DevOps neste projeto.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Coluna Jira */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <h4 className="text-xs font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            Jira Backlog
                          </h4>
                          <span className="text-[10px] text-slate-500 font-bold">{jiraDemands.length} itens</span>
                        </div>

                        <div className="space-y-3">
                          {jiraDemands.length > 0 ? (
                            jiraDemands.map(demand => (
                              <DemandProjectCard
                                key={demand.externalId}
                                demand={demand}
                                onSelect={onSelectDemand}
                              />
                            ))
                          ) : (
                            <div className="text-center py-8 border border-dashed border-slate-800/60 rounded-xl text-slate-600 text-xs">
                              Nenhuma demanda do Jira neste projeto.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-slate-800/80 rounded-3xl text-slate-500 flex flex-col items-center justify-center gap-3">
          <Layers className="w-12 h-12 text-slate-700" />
          <div>
            <p className="text-sm font-semibold text-slate-400">Nenhum projeto encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Adicione tags no formato <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-400">projeto: nome</code> ou <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-400">projeto-nome</code> nas demandas para criar grupos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DemandProjectCard({ demand, onSelect }) {
  const isBlocker = demand.blocked_by && demand.blocked_by.length > 0;
  const isBlocked = demand.blockers && demand.blockers.length > 0;

  return (
    <div
      onClick={() => onSelect(demand.externalId)}
      className={`bg-slate-900/40 border rounded-xl p-4 space-y-3 hover:bg-slate-900/60 cursor-pointer transition-all hover:scale-[1.01] hover:border-slate-700 flex flex-col justify-between group ${
        isBlocked 
          ? 'border-rose-500/20 shadow-sm shadow-rose-950/10' 
          : isBlocker 
          ? 'border-amber-500/20 shadow-sm shadow-amber-950/10' 
          : 'border-slate-800/80'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{demand.externalId}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
            demand.externalStatus === 'Concluído' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Done'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-slate-800 text-slate-400 border border-slate-700/50'
          }`}>
            {demand.externalStatus}
          </span>
        </div>

        <h5 className="font-semibold text-xs text-slate-200 group-hover:text-white transition-colors leading-relaxed line-clamp-2">
          {demand.title}
        </h5>
      </div>

      {/* Badges de Dependência */}
      {(isBlocked || isBlocker) && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800/40">
          {isBlocked && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Bloqueado por: {demand.blockers.join(', ')}
            </span>
          )}
          {isBlocker && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
              <AlertOctagon className="w-3 h-3 flex-shrink-0" />
              Bloqueia outros ({demand.blocked_by.length})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
