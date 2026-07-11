import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Briefcase, Calendar, Target, Activity, FileText, CheckCircle2, Clock, Sparkles, Edit3, AlertCircle, Play, X } from 'lucide-react';
import RoadmapGraphView from './RoadmapGraphView';

export default function ProjectOverview({ projectId, onBack, onSelectDemand }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('operational'); // 'operational', 'report_tech', or 'report_biz'
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [editSummary, setEditSummary] = useState(false);
  const [summaryValue, setSummaryValue] = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/overview`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setSummaryValue(result.project.executive_summary || '');
        setNotesValue(result.project.strategic_notes || '');
      } else {
        const err = await res.json();
        setError(err.detail || 'Erro ao carregar a visão geral do projeto.');
      }
    } catch (e) {
      console.error(e);
      setError('Erro de conexão ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchOverview();
    }
  }, [projectId]);

  // Handle ESC key to exit Presentation Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle DOM side effects for Presentation Mode
  useEffect(() => {
    if (isPresentationMode) {
      document.body.classList.add('presentation-mode');
    } else {
      document.body.classList.remove('presentation-mode');
    }
    return () => {
      document.body.classList.remove('presentation-mode');
    };
  }, [isPresentationMode]);

  const handleSaveSummary = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executive_summary: summaryValue })
      });
      if (res.ok) {
        const updated = await res.json();
        setData(prev => ({ ...prev, project: { ...prev.project, executive_summary: updated.executive_summary } }));
        setEditSummary(false);
      }
    } catch (e) {
      console.error("Erro ao salvar resumo:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategic_notes: notesValue })
      });
      if (res.ok) {
        const updated = await res.json();
        setData(prev => ({ ...prev, project: { ...prev.project, strategic_notes: updated.strategic_notes } }));
        setEditNotes(false);
      }
    } catch (e) {
      console.error("Erro ao salvar notas:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        <span>Carregando visão geral do projeto...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-4 max-w-md mx-auto text-center">
        <p className="text-sm text-red-400 font-medium">{error}</p>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Portfólio
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { project, demands } = data;

  // Filtragem das demandas por origem (para Gestão Operacional)
  const jiraDemands = demands.filter(d => d.origin === 'Jira');
  const azureDemands = demands.filter(d => d.origin === 'Azure');
  const businessDemands = demands.filter(d => d.origin === 'Negocio');

  const isDemandBlocked = (d) => (d.externalStatus && d.externalStatus.toLowerCase() === 'blocked') || (d.blockers && d.blockers.length > 0);
  const jiraBlockedCount = jiraDemands.filter(isDemandBlocked).length;
  const azureBlockedCount = azureDemands.filter(isDemandBlocked).length;
  const businessBlockedCount = businessDemands.filter(isDemandBlocked).length;

  const CATEGORIES = ['Backlog', 'Em Refinamento', 'Desenvolvimento', 'Homologação', 'Entregue'];

  const renderColumnDemands = (columnDemands, emptyText) => {
    if (columnDemands.length === 0) {
      return <EmptyColumnPlaceholder text={emptyText} />;
    }
    return (
      <div className="space-y-4">
        {CATEGORIES.map(category => {
          const catDemands = columnDemands.filter(d => (d.mappedStatus || 'Backlog') === category);
          if (catDemands.length === 0) return null;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/45 rounded-lg border border-slate-850/50 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 select-none">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  category === 'Backlog' ? 'bg-slate-500' :
                  category === 'Em Refinamento' ? 'bg-purple-400' :
                  category === 'Desenvolvimento' ? 'bg-amber-400' :
                  category === 'Homologação' ? 'bg-blue-400' :
                  'bg-emerald-400'
                }`} />
                {category} ({catDemands.length})
              </div>
              <div className="space-y-2">
                {catDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helpers para o Report Executivo
  const isInProgress = (status) => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    // Resolved é considerado ainda em andamento. Closed é que a demanda foi efetivamente concluída.
    const inactive = [
      'concluído', 'concluido', 'done', 'closed', 'fechado',
      'backlog', 'a fazer', 'to do', 'removed', 'removido', 'cancelado', 'canceled'
    ];
    return !inactive.includes(s);
  };

  const shouldShowInExecutiveReport = (d) => {
    if (!d) return false;
    if (d.itemType?.toLowerCase() === 'legend') return false;

    const hasBlockerReport = !!(d.blocker_notes && d.blocker_notes.trim() !== '');
    const mapped = d.mappedStatus || 'Backlog';

    // Se tiver impedimento preenchido, sempre aparece
    if (hasBlockerReport) return true;

    // Jamais deve aparecer demandas que são "Backlog", "Em Refinamento" e "Entregue" (se não tiverem impedimento)
    if (mapped === 'Backlog' || mapped === 'Em Refinamento' || mapped === 'Entregue') {
      return false;
    }

    // Entende como status "ATIVO" as CATEGORIAS UNIFICADAS: "Desenvolvimento" e "Homologação"
    if (mapped === 'Desenvolvimento' || mapped === 'Homologação') {
      return true;
    }

    return false;
  };

  const formatPromisedDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0].substring(2); // e.g. "2026" -> "26"
        const monthIndex = parseInt(parts[1], 10) - 1;
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[monthIndex]}/${year}`;
      }
    } catch (e) {
      console.error('Erro ao formatar data:', e);
    }
    return dateStr;
  };

  // Lógica de agrupamento por Epic/Eixo para Tecnologia e Negócios
  const techEpics = [];
  const techEpicMap = {};
  const bizEpicMap = {};
  const standaloneDemands = [];
  const standaloneBizDemands = [];

  const parentIds = new Set(demands.map(d => d.parentId || d.localParentId).filter(Boolean));
  const demandsMap = {};
  demands.forEach(d => {
    demandsMap[d.externalId] = d;
  });

  demands.forEach(d => {
    if (d.itemType?.toLowerCase() === 'legend') {
      return;
    }
    const isEpicType = (d.itemType === 'Epic' || d.itemType === 'Oportunidade');
    const isParentOfSomeone = parentIds.has(d.externalId);
    
    // Determine if it should be a top-level Epic row:
    let isTopLevelEpic = false;
    if (d.itemType === 'Epic') {
      isTopLevelEpic = true;
    } else if (d.itemType === 'Oportunidade') {
      // Opportunities are top-level only if they don't have an Epic as a parent
      const parentId = d.parentId || d.localParentId;
      const parentDemand = parentId ? demandsMap[parentId] : null;
      const parentIsEpic = parentDemand && parentDemand.itemType === 'Epic';
      isTopLevelEpic = !parentIsEpic;
    } else if (isParentOfSomeone) {
      // Non-Epic, non-Opportunity parents (like Legend or others)
      // are top-level if they don't have a parent that is also in the project (excluding Legend parents)
      const parentId = d.parentId || d.localParentId;
      const parentDemand = parentId ? demandsMap[parentId] : null;
      const hasParentInProject = parentDemand && parentDemand.itemType?.toLowerCase() !== 'legend';
      isTopLevelEpic = !hasParentInProject;
    }

    if (isTopLevelEpic) {
      techEpics.push(d);
      techEpicMap[d.externalId] = [];
      bizEpicMap[d.externalId] = [];
    }
  });

  demands.forEach(d => {
    if (d.itemType?.toLowerCase() === 'legend') {
      return;
    }
    if (techEpicMap[d.externalId] !== undefined) {
      return;
    }
    if (d.origin === 'Negocio') {
      const lpId = d.localParentId;
      if (lpId && lpId !== 'NONE' && bizEpicMap[lpId] !== undefined) {
        bizEpicMap[lpId].push(d);
      } else {
        standaloneBizDemands.push(d);
      }
    } else {
      const pId = d.parentId || d.localParentId;
      if (pId && techEpicMap[pId] !== undefined) {
        techEpicMap[pId].push(d);
      } else {
        standaloneDemands.push(d);
      }
    }
  });

  // Aliases para compatibilidade com o relatório de Tecnologia existente
  const epics = techEpics;
  const epicMap = techEpicMap;

  return (
    <div className={`flex-1 ${isPresentationMode ? 'fixed inset-0 z-[100] bg-slate-900 w-screen h-screen overflow-y-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center justify-start' : 'overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6'}`}>
      {isPresentationMode && (
        <style dangerouslySetInnerHTML={{ __html: `
          aside { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; height: 100vh !important; }
        `}} />
      )}

      {/* Top Navigation (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold select-none w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Portfólio
          </button>

          <div className="flex items-center gap-2">
            {(activeTab === 'report_tech' || activeTab === 'report_biz') && (
              <button
                onClick={() => setIsPresentationMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95 select-none"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Modo Apresentação
              </button>
            )}

            <button
              onClick={fetchOverview}
              className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Close Presentation Mode Button */}
      {isPresentationMode && (
        <button
          onClick={() => setIsPresentationMode(false)}
          className="fixed top-6 right-6 z-50 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md transition-all opacity-30 hover:opacity-100 flex items-center gap-1.5 select-none"
          title="Pressione ESC para sair"
        >
          <X className="w-4 h-4" /> Sair da Apresentação
        </button>
      )}

      {/* Header Executivo Card (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">{project.name}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  project.health_status === 'Verde' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  project.health_status === 'Amarelo' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    project.health_status === 'Verde' ? 'bg-emerald-500' :
                    project.health_status === 'Amarelo' ? 'bg-amber-500' :
                    'bg-rose-500'
                  }`} />
                  {project.health_status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Consolidado estratégico de entregáveis e saúde semanal
                <span className="text-[10px] text-slate-400 ml-2 italic">
                  (Farol automático baseado em blockers e prazos)
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-400" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Patrocinador / Sponsor</span>
                  <span className="font-bold text-slate-200">{project.sponsor || 'Não definido'}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Previsão de Lançamento</span>
                  <span className="font-bold text-slate-200">{project.target_go_live || 'Sem previsão'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 pt-2 border-t border-slate-800/40">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Progresso Realizado</span>
              <span className="text-brand-400">{project.progress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800/60 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="flex border-b border-slate-800 select-none">
          <button
            onClick={() => setActiveTab('operational')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'operational'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Gestão Operacional
          </button>
          <button
            onClick={() => setActiveTab('report_tech')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'report_tech'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Report Executivo Tecnologia
          </button>
          <button
            onClick={() => setActiveTab('report_biz')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'report_biz'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Report Executivo Negócios
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'roadmap'
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Mapa do Roadmap
          </button>
        </div>
      )}

      {/* Conditional Tabs Content */}
      {activeTab === 'operational' && !isPresentationMode ? (
        <div className="space-y-6">


          {/* Kanban Board of Tracks */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Board de Trilhas (Entregáveis Vinculados)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Jira */}
              <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    TI - Jira
                  </span>
                  <span className="bg-sky-500/10 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {jiraDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(jiraDemands, "Sem entregas no Jira")}
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs text-slate-400 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${jiraBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {jiraBlockedCount}
                  </span>
                </div>
              </div>

              {/* Azure */}
              <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    TI - Azure DevOps
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {azureDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(azureDemands, "Sem entregas no Azure")}
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs text-slate-400 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${azureBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {azureBlockedCount}
                  </span>
                </div>
              </div>

              {/* Negócios */}
              <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    Negócios / GTM
                  </span>
                  <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {businessDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(businessDemands, "Sem demandas de Negócio")}
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs text-slate-400 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${businessBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {businessBlockedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (activeTab === 'report_tech' || (isPresentationMode && activeTab === 'report_tech')) ? (
        /* Report Executivo Slide view */
        <div className={`bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-2xl p-8 shadow-2xl w-full ${isPresentationMode ? 'animate-in zoom-in-95 duration-300' : ''}`}>
          {/* Slide Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
            <div>
              <span className="text-[10px] text-emerald-450 font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                PO STATUS REPORT
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-3">
                Status Report Semanal
              </h2>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-400 space-y-1">
              <div>Data: <strong className="text-slate-200">{new Date().toLocaleDateString('pt-BR')}</strong></div>
              {project.sponsor && <div>Sponsor: <strong className="text-slate-200">{project.sponsor}</strong></div>}
            </div>
          </div>

          {/* Desktop view (lg and up): fluid fixed table with no horizontal scroll */}
          <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-slate-800/85 bg-slate-950/40">
            <table className="w-full min-w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold select-none">
                  <th className="px-6 py-4 w-[20%]">EIXO / EPIC</th>
                  <th className="px-6 py-4 w-[25%]">DEMANDAS EM ANDAMENTO</th>
                  <th className="px-6 py-4 w-[27.5%]">SITUAÇÃO ATUAL</th>
                  <th className="px-6 py-4 w-[27.5%]">IMPEDIMENTOS / PONTOS DE ATENÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {/* Epics / Eixos rows */}
                {epics.map(epic => {
                  const children = epicMap[epic.externalId] || [];
                  const visibleChildren = children.filter(shouldShowInExecutiveReport);
                  
                  // Collect status notes
                  const statusNotesList = [];
                  if (epic.current_status_notes && epic.current_status_notes.trim()) {
                    statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
                  }
                  visibleChildren.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  // Collect impediments
                  const impedimentsList = [];
                  if (shouldShowInExecutiveReport(epic)) {
                    if (epic.blocker_notes && epic.blocker_notes.trim()) {
                      impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                    } else if (isDemandBlocked(epic)) {
                      impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.externalStatus})` });
                    }
                  }
                  // Check Children
                  visibleChildren.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    } else if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  // Only render row if Epic is visible, or if it has visible child demands or impediments
                  if (visibleChildren.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0 && !shouldShowInExecutiveReport(epic)) {
                    return null;
                  }

                  return (
                    <tr key={epic.externalId} className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo (Epic Name) */}
                      <td className="px-6 py-5 font-bold text-xs text-white break-words">
                        <div 
                          onClick={() => onSelectDemand(epic.externalId)}
                          className="border-l-4 border-emerald-500 pl-3 py-1 space-y-1.5 cursor-pointer hover:bg-slate-900/40 hover:border-emerald-400 p-1.5 rounded transition-all"
                        >
                          <span className="text-slate-100 text-sm font-semibold tracking-tight leading-snug block hover:underline">{epic.title}</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                          {epic.externalStatus && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2">
                              {epic.externalStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words">
                        {visibleChildren.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleChildren.map(c => (
                              <div
                                key={c.externalId}
                                onClick={() => onSelectDemand(c.externalId)}
                                className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 hover:border-emerald-500/30 hover:bg-slate-900/80 p-2 rounded-lg cursor-pointer transition-all"
                              >
                                <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                                  <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                  {c.title}
                                  {c.externalStatus && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                      {c.externalStatus}
                                    </span>
                                  )}
                                </span>
                                {c.promisedDate && (
                                  <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                    {formatPromisedDate(c.promisedDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic py-1 block">Nenhuma demanda ativa vinculada.</span>
                        )}
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-450 mr-1">[{item.id}]:</strong>
                                <span className="text-slate-300">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-base font-semibold pl-2 block">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Standalone demands row */}
                {(() => {
                  const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
                  const statusNotesList = [];
                  const impedimentsList = [];

                  visibleStandalone.forEach(d => {
                    if (d.current_status_notes && d.current_status_notes.trim()) {
                      statusNotesList.push({ id: d.externalId, text: d.current_status_notes.trim() });
                    }
                    if (d.blocker_notes && d.blocker_notes.trim()) {
                      impedimentsList.push({ id: d.externalId, text: d.blocker_notes.trim() });
                    } else if (isDemandBlocked(d)) {
                      let bList = d.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: d.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  if (visibleStandalone.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0) {
                    return null;
                  }

                  return (
                    <tr className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo */}
                      <td className="px-6 py-5 font-bold text-xs text-white break-words">
                        <div className="border-l-4 border-slate-600 pl-3 py-0.5 space-y-1">
                          <span className="text-slate-300 text-sm font-semibold block leading-snug">Demandas Independentes</span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Sem Epic/Eixo Vinculado</span>
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words">
                        {visibleStandalone.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleStandalone.map(d => (
                              <div
                                key={d.externalId}
                                onClick={() => onSelectDemand(d.externalId)}
                                className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 hover:border-slate-700/85 hover:bg-slate-900/80 p-2 rounded-lg cursor-pointer transition-all"
                              >
                                <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                                  <span className="text-slate-500 font-bold mr-1">[{d.externalId}]</span>
                                  {d.title}
                                  {d.externalStatus && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                      {d.externalStatus}
                                    </span>
                                  )}
                                </span>
                                {d.promisedDate && (
                                  <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                    {formatPromisedDate(d.promisedDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic py-1 block">Nenhuma demanda ativa independente.</span>
                        )}
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1">[{item.id}]:</strong>
                                <span className="text-slate-300">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-base font-semibold pl-2 block">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet view (below lg): stacked cards to prevent horizontal scroll */}
          <div className="lg:hidden space-y-5">
            {epics.map(epic => {
              const children = epicMap[epic.externalId] || [];
              const visibleChildren = children.filter(shouldShowInExecutiveReport);
              
              const statusNotesList = [];
              if (epic.current_status_notes && epic.current_status_notes.trim()) {
                statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
              }
              visibleChildren.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              if (shouldShowInExecutiveReport(epic)) {
                if (epic.blocker_notes && epic.blocker_notes.trim()) {
                  impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                } else if (isDemandBlocked(epic)) {
                  impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.externalStatus})` });
                }
              }
              visibleChildren.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                } else if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                }
              });

              if (visibleChildren.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0 && !shouldShowInExecutiveReport(epic)) {
                return null;
              }

              return (
                <div key={epic.externalId} className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  {/* Header Eixo */}
                  <div 
                    onClick={() => onSelectDemand(epic.externalId)}
                    className="border-l-4 border-emerald-500 pl-3 cursor-pointer hover:bg-slate-900/40 hover:border-emerald-450 p-1 rounded transition-all"
                  >
                    <h4 className="text-white font-bold text-sm leading-snug hover:underline">{epic.title}</h4>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                  </div>

                  {/* Demandas em Andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Demandas em Andamento</span>
                    {visibleChildren.length > 0 ? (
                      <div className="space-y-1.5">
                        {visibleChildren.map(c => (
                          <div
                            key={c.externalId}
                            onClick={() => onSelectDemand(c.externalId)}
                            className="flex items-start justify-between gap-2.5 bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg cursor-pointer hover:border-emerald-500/30 transition-all"
                          >
                            <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                              <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                              {c.title}
                              {c.externalStatus && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                  {c.externalStatus}
                                </span>
                              )}
                            </span>
                            {c.promisedDate && (
                              <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                {formatPromisedDate(c.promisedDate)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs italic">Nenhuma demanda ativa vinculada.</span>
                    )}
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Standalone demands card */}
            {(() => {
              const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
              const statusNotesList = [];
              const impedimentsList = [];

              visibleStandalone.forEach(d => {
                if (d.current_status_notes && d.current_status_notes.trim()) {
                  statusNotesList.push({ id: d.externalId, text: d.current_status_notes.trim() });
                }
                if (d.blocker_notes && d.blocker_notes.trim()) {
                  impedimentsList.push({ id: d.externalId, text: d.blocker_notes.trim() });
                } else if (isDemandBlocked(d)) {
                  let bList = d.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: d.externalId, text: `Impedida${bStr}` });
                }
              });

              if (visibleStandalone.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0) {
                return null;
              }

              return (
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  {/* Header */}
                  <div className="border-l-4 border-slate-600 pl-3">
                    <h4 className="text-white font-bold text-sm leading-snug">Demandas Independentes</h4>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Sem Epic/Eixo Vinculado</span>
                  </div>

                  {/* Demandas em Andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Demandas em Andamento</span>
                    {visibleStandalone.length > 0 ? (
                      <div className="space-y-1.5">
                        {visibleStandalone.map(d => (
                          <div
                            key={d.externalId}
                            onClick={() => onSelectDemand(d.externalId)}
                            className="flex items-start justify-between gap-2.5 bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg cursor-pointer hover:border-slate-700/85 transition-all"
                          >
                            <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                              <span className="text-slate-500 font-bold mr-1">[{d.externalId}]</span>
                              {d.title}
                            </span>
                            {d.promisedDate && (
                              <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-455 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                {formatPromisedDate(d.promisedDate)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs italic">Nenhuma demanda ativa independente.</span>
                    )}
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
            })()}
          </div>
        </div>
      ) : (activeTab === 'report_biz' || (isPresentationMode && activeTab === 'report_biz')) ? (
        /* Report Executivo Negócios Slide view */
        <div className={`bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-2xl p-8 shadow-2xl w-full ${isPresentationMode ? 'animate-in zoom-in-95 duration-300' : ''}`}>
          {/* Slide Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5 mb-6">
            <div>
              <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest bg-purple-500/10 border border-purple-500/25 px-2.5 py-1 rounded-lg">
                PO STATUS REPORT - NEGÓCIOS
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-3">
                Status Report Semanal (Negócios / GTM)
              </h2>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-400 space-y-1">
              <div>Data: <strong className="text-slate-200">{new Date().toLocaleDateString('pt-BR')}</strong></div>
              {project.sponsor && <div>Sponsor: <strong className="text-slate-200">{project.sponsor}</strong></div>}
            </div>
          </div>

          {/* Desktop view (lg and up): fluid fixed table with no horizontal scroll */}
          <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-slate-800/85 bg-slate-950/40">
            <table className="w-full min-w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-extrabold select-none">
                  <th className="px-6 py-4 w-[20%]">EIXO / EPIC</th>
                  <th className="px-6 py-4 w-[25%]">DEMANDAS EM ANDAMENTO</th>
                  <th className="px-6 py-4 w-[27.5%]">SITUAÇÃO ATUAL</th>
                  <th className="px-6 py-4 w-[27.5%]">IMPEDIMENTOS / PONTOS DE ATENÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {/* Epics / Eixos rows */}
                {techEpics.map(epic => {
                  const children = bizEpicMap[epic.externalId] || [];
                  if (children.length === 0) return null;
                  
                  // Collect status notes
                  const statusNotesList = [];
                  if (epic.current_status_notes && epic.current_status_notes.trim()) {
                    statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
                  }
                  children.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  // Collect impediments
                  const impedimentsList = [];
                  if (epic.blocker_notes && epic.blocker_notes.trim()) {
                    impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                  } else if (isDemandBlocked(epic)) {
                    impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.externalStatus})` });
                  }
                  children.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    } else if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  return (
                    <tr key={epic.externalId} className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo (Epic Name) */}
                      <td className="px-6 py-5 font-bold text-xs text-white break-words">
                        <div 
                          onClick={() => onSelectDemand(epic.externalId)}
                          className="border-l-4 border-purple-500 pl-3 py-1 space-y-1.5 cursor-pointer hover:bg-slate-900/40 hover:border-purple-400 p-1.5 rounded transition-all"
                        >
                          <span className="text-slate-100 text-sm font-semibold tracking-tight leading-snug block hover:underline">{epic.title}</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                          {epic.externalStatus && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2">
                              {epic.externalStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words">
                        <div className="space-y-1.5">
                          {children.map(c => (
                            <div
                              key={c.externalId}
                              onClick={() => onSelectDemand(c.externalId)}
                              className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 hover:border-purple-500/30 hover:bg-slate-900/80 p-2 rounded-lg cursor-pointer transition-all"
                            >
                              <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                                <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                {c.title}
                                {c.externalStatus && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                    {c.externalStatus}
                                  </span>
                                )}
                              </span>
                              {c.promisedDate && (
                                <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                  {formatPromisedDate(c.promisedDate)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-355 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Standalone Business Demands Row */}
                {standaloneBizDemands.length > 0 && (() => {
                  const statusNotesList = [];
                  standaloneBizDemands.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  const impedimentsList = [];
                  standaloneBizDemands.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    } else if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  return (
                    <tr className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo */}
                      <td className="px-6 py-5 font-bold text-xs text-white break-words">
                        <div className="border-l-4 border-purple-500 pl-3 py-0.5 space-y-1.5">
                          <span className="text-slate-100 text-sm font-semibold tracking-tight leading-snug block">Demandas de Negócio Avulsas</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[SEM EIXO VINCULADO]</span>
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words">
                        <div className="space-y-1.5">
                          {standaloneBizDemands.map(c => (
                            <div
                              key={c.externalId}
                              onClick={() => onSelectDemand(c.externalId)}
                              className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 hover:border-purple-500/30 hover:bg-slate-900/80 p-2 rounded-lg cursor-pointer transition-all"
                            >
                              <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                                <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                {c.title}
                                {c.externalStatus && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                    {c.externalStatus}
                                  </span>
                                )}
                              </span>
                              {c.promisedDate && (
                                <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                  {formatPromisedDate(c.promisedDate)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-850 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-355 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet view (below lg): stacked cards to prevent horizontal scroll */}
          <div className="lg:hidden space-y-5">
            {techEpics.map(epic => {
              const children = bizEpicMap[epic.externalId] || [];
              if (children.length === 0) return null;
              
              const statusNotesList = [];
              if (epic.current_status_notes && epic.current_status_notes.trim()) {
                statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
              }
              children.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              if (epic.blocker_notes && epic.blocker_notes.trim()) {
                impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
              } else if (isDemandBlocked(epic)) {
                impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.externalStatus})` });
              }
              children.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                } else if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                }
              });

              return (
                <div key={epic.externalId} className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 space-y-4">
                  {/* Eixo info */}
                  <div 
                    onClick={() => onSelectDemand(epic.externalId)}
                    className="border-l-4 border-purple-500 pl-3 py-0.5 space-y-1 cursor-pointer hover:bg-slate-900/40 hover:border-purple-400 p-1 rounded transition-all"
                  >
                    <span className="text-slate-100 text-sm font-semibold block hover:underline">{epic.title}</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                  </div>

                  {/* Demandas em andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Demandas de Negócio</span>
                    <div className="space-y-1.5">
                      {children.map(c => (
                        <div
                          key={c.externalId}
                          onClick={() => onSelectDemand(c.externalId)}
                          className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 p-2 rounded-lg cursor-pointer"
                        >
                          <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                            <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                            {c.title}
                            {c.externalStatus && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2 select-none">
                                {c.externalStatus}
                              </span>
                            )}
                          </span>
                          {c.promisedDate && (
                            <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                              {formatPromisedDate(c.promisedDate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-300 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-355 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Standalone Biz Demands Card (Mobile) */}
            {standaloneBizDemands.length > 0 && (() => {
              const statusNotesList = [];
              standaloneBizDemands.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              standaloneBizDemands.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                } else if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                }
              });

              return (
                <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-5 space-y-4">
                  {/* Standalone Epic info */}
                  <div className="border-l-4 border-purple-500 pl-3 py-0.5 space-y-1">
                    <span className="text-slate-100 text-sm font-semibold block">Demandas de Negócio Avulsas</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[SEM EIXO VINCULADO]</span>
                  </div>

                  {/* Demandas em andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Demandas de Negócio</span>
                    <div className="space-y-1.5">
                      {standaloneBizDemands.map(c => (
                        <div
                          key={c.externalId}
                          onClick={() => onSelectDemand(c.externalId)}
                          className="flex items-start justify-between gap-2.5 bg-slate-900/30 border border-slate-800/40 p-2 rounded-lg cursor-pointer"
                        >
                          <span className="text-xs text-slate-200 font-medium hover:underline flex-1 leading-relaxed">
                            <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                            {c.title}
                          </span>
                          {c.promisedDate && (
                            <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                              {formatPromisedDate(c.promisedDate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-300 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-355 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeTab === 'roadmap' ? (
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md h-[750px] flex flex-col">
          <h3 className="text-base font-bold text-slate-100 mb-4 shrink-0">Mapa de Dependências e Roadmap</h3>
          <RoadmapGraphView demands={data.demands} onSelectDemand={onSelectDemand} />
        </div>
      ) : null}
    </div>
  );
}

// Subcomponente Card de Demanda (utilizado no Kanban)
function DemandCard({ demand, onSelect }) {
  const isStale = demand.isStale;
  const isBlocked = (demand.externalStatus && demand.externalStatus.toLowerCase() === 'blocked') || (demand.blockers && demand.blockers.length > 0);
  
  return (
    <div
      onClick={() => onSelect(demand.externalId)}
      className={`bg-slate-950/40 hover:bg-slate-950/80 border p-4 rounded-xl cursor-pointer transition-all space-y-3 ${
        isBlocked ? 'border-rose-500/50 bg-rose-500/[0.03]' :
        isStale ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-850 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 flex-wrap">
          {demand.externalId}
          {isBlocked && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
              Bloqueado
            </span>
          )}
          {isStale && !isBlocked && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
              Desatualizado
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {demand.mappedStatus && (
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold rounded ${
              demand.mappedStatus === 'Backlog' ? 'bg-slate-800 text-slate-400 border border-slate-700/60' :
              demand.mappedStatus === 'Em Refinamento' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
              demand.mappedStatus === 'Desenvolvimento' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
              demand.mappedStatus === 'Homologação' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {demand.mappedStatus}
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
            demand.externalStatus === 'Concluído' || demand.externalStatus === 'Concluido' || demand.externalStatus === 'Done' || demand.externalStatus === 'Closed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Active' || demand.externalStatus === 'Em andamento' ? 'bg-amber-500/10 text-amber-400 border border-emerald-500/20' :
            isBlocked || demand.externalStatus === 'Blocked' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
            'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {demand.externalStatus}
          </span>
        </div>
      </div>
      
      <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
        {demand.title}
      </h4>
      
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900/60">
        <span>Tipo: <strong className="text-slate-400">{demand.itemType}</strong></span>
        <span>Canal: <strong className="text-slate-400">{demand.origin}</strong></span>
      </div>
    </div>
  );
}

// Subcomponente Placeholder para Colunas Vazias
function EmptyColumnPlaceholder({ text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-800 rounded-xl text-slate-600 space-y-2 w-full">
      <CheckCircle2 className="w-8 h-8 opacity-45" />
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}
