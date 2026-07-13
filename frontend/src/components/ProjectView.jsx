import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, AlertOctagon, Layers, ArrowRight, ExternalLink, Sparkles, X, Copy, Check } from 'lucide-react';

export default function ProjectView({ demands, onSelectDemand }) {
  const [expandedProjects, setExpandedProjects] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedProjectForReport, setSelectedProjectForReport] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState('');
  const [currentProjectDemands, setCurrentProjectDemands] = useState([]);

  const handleGenerateReport = async (e, projDemands, projectName, force = false) => {
    if (e) e.stopPropagation();
    setIsGenerating(true);
    setSelectedProjectForReport(projectName);
    setCurrentProjectDemands(projDemands);
    setReportModalOpen(true);
    setCopied(false);
    if (force) {
      setReportData('');
    }

    try {
      const demandIds = projDemands.map(d => d.externalId);
      const res = await fetch('/api/projects/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          demand_ids: demandIds,
          force_refresh: force
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data.report);
        setGeneratedAt(data.generated_at || '');
      } else {
        const errData = await res.json();
        setReportData(`Erro: ${errData.detail || "Não foi possível gerar o relatório de status."}`);
        setGeneratedAt('');
      }
    } catch (err) {
      console.error(err);
      setReportData("Erro de conexão ao tentar gerar o status report.");
      setGeneratedAt('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

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
    <div className="space-y-6 flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6">
      <div>
        <h2 className="text-2xl font-bold text-sicoob-text tracking-tight flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-sicoob-primary" />
          Visão de Projetos
        </h2>
        <p className="text-sm text-slate-500">Agrupamento cruzado por iniciativa/projeto com mapeamento visual de dependências</p>
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
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-sicoob-primary/30 transition-all duration-300"
              >
                {/* Header expansível */}
                <div
                  onClick={() => toggleProject(projName)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 text-left transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-sicoob-primary" />
                    <div>
                      <h3 className="text-base font-bold text-sicoob-text">{projName}</h3>
                      <span className="text-xs text-slate-400 font-medium">
                        {projDemands.length} {projDemands.length === 1 ? 'demanda associada' : 'demandas associadas'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {projDemands.length > 0 && (
                      <button
                        onClick={(e) => handleGenerateReport(e, projDemands, projName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-sicoob-primary/10 text-sicoob-secondary hover:bg-sicoob-primary/20 border border-sicoob-primary/20 rounded-xl transition-all shadow-xs"
                        title="Gerar Status Report Executivo"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Ver Status Report
                      </button>
                    )}
                    <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                      Azure: {azureDemands.length} | Jira: {jiraDemands.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Conteúdo do Projeto */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-6 bg-slate-50/30">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Coluna Azure DevOps */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
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
                            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                              Nenhuma demanda do Azure DevOps neste projeto.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Coluna Jira */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="text-xs font-bold text-sky-700 uppercase tracking-widest flex items-center gap-2">
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
                            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
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
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl text-slate-400 flex flex-col items-center justify-center gap-3 bg-white shadow-xs">
          <Layers className="w-12 h-12 text-slate-300" />
          <div>
            <p className="text-sm font-bold text-sicoob-text">Nenhum projeto encontrado</p>
            <p className="text-xs text-slate-500 mt-1">
              Adicione tags no formato <code className="bg-slate-100 px-1 py-0.5 rounded text-sicoob-primary">projeto: nome</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-sicoob-primary">projeto-nome</code> nas demandas para criar grupos.
            </p>
          </div>
        </div>
      )}

      {/* Modal de Status Report */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-250 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sicoob-primary" />
                  <h3 className="font-bold text-lg text-sicoob-text">Status Report: {selectedProjectForReport}</h3>
                </div>
                {generatedAt && (
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    Última atualização: {generatedAt}
                  </span>
                )}
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-sm text-slate-750 leading-relaxed whitespace-pre-wrap">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-sicoob-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-xs font-semibold animate-pulse">Inteligência Artificial gerando relatório executivo...</p>
                </div>
              ) : (
                reportData
              )}
            </div>
            
            {/* Footer */}
            {!isGenerating && (
              <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    disabled={!reportData || reportData.startsWith('Erro:')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Relatório
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => handleGenerateReport(e, currentProjectDemands, selectedProjectForReport, true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-655 border border-slate-200 font-bold rounded-xl text-xs transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Atualizar Resumo com IA
                  </button>
                </div>
                <button
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold rounded-xl text-xs transition-colors shadow-xs"
                >
                  Fechar
                </button>
              </div>
            )}
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
      className={`bg-white border rounded-xl p-4 space-y-3 hover:bg-slate-50 cursor-pointer transition-all hover:scale-[1.01] hover:border-sicoob-primary/50 flex flex-col justify-between group shadow-xs ${
        isBlocked 
          ? 'border-rose-300 shadow-sm shadow-rose-100' 
          : isBlocker 
          ? 'border-amber-300 shadow-sm shadow-amber-100' 
          : 'border-slate-200'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{demand.externalId}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${
            demand.externalStatus === 'Concluído' || demand.externalStatus === 'Concluido' || demand.externalStatus === 'Done' || demand.externalStatus === 'Closed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Active' || demand.externalStatus === 'Em andamento'
              ? 'bg-amber-50 text-amber-700 border-amber-100'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {demand.externalStatus}
          </span>
        </div>

        <h5 className="font-semibold text-xs text-sicoob-text group-hover:text-sicoob-primary transition-colors leading-relaxed line-clamp-2">
          {demand.title}
        </h5>
      </div>

      {/* Badges de Dependência */}
      {(isBlocked || isBlocker) && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
          {isBlocked && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Bloqueado por: {demand.blockers.join(', ')}
            </span>
          )}
          {isBlocker && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-md">
              <AlertOctagon className="w-3 h-3 flex-shrink-0" />
              Bloqueia outros ({demand.blocked_by.length})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
