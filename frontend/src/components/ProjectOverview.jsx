import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Briefcase, Calendar, Target, Activity, FileText, CheckCircle2, Clock, Sparkles, Edit3, AlertCircle } from 'lucide-react';

export default function ProjectOverview({ projectId, onBack, onSelectDemand }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (projectId) {
      fetchOverview();
    }
  }, [projectId]);

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

  // Filtragem das demandas por origem
  const jiraDemands = demands.filter(d => d.origin === 'Jira');
  const azureDemands = demands.filter(d => d.origin === 'Azure');
  const businessDemands = demands.filter(d => d.origin === 'Negocio');

  const isDemandBlocked = (d) => (d.externalStatus && d.externalStatus.toLowerCase() === 'blocked') || (d.blockers && d.blockers.length > 0);
  const jiraBlockedCount = jiraDemands.filter(isDemandBlocked).length;
  const azureBlockedCount = azureDemands.filter(isDemandBlocked).length;
  const businessBlockedCount = businessDemands.filter(isDemandBlocked).length;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Navigation & Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold select-none"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Portfólio
        </button>
        
        <button
          onClick={fetchOverview}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
          title="Atualizar dados"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Header Executivo Card */}
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

          {/* Sponsor & Lançamento Info */}
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

        {/* Progress Bar Row */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resumo Executivo (Status Report) */}
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" /> Resumo Executivo (Status Report)
            </h3>
            {!editSummary && (
              <button
                onClick={() => setEditSummary(true)}
                className="text-[11px] font-bold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3 h-3" /> Editar
              </button>
            )}
          </div>
          {editSummary ? (
            <div className="space-y-3">
              <textarea
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500 min-h-[120px] resize-y leading-relaxed"
                value={summaryValue}
                onChange={e => setSummaryValue(e.target.value)}
                placeholder="Escreva o resumo executivo para a diretoria..."
                disabled={saving}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setEditSummary(false); setSummaryValue(project.executive_summary || ''); }}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSummary}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-550 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {project.executive_summary || 'Nenhum status report registrado para esta iniciativa ainda.'}
            </div>
          )}
        </div>

        {/* Alinhamento Estratégico e Cobranças */}
        <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" /> Alinhamento Estratégico e Cobranças
            </h3>
            {!editNotes && (
              <button
                onClick={() => setEditNotes(true)}
                className="text-[11px] font-bold text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg"
              >
                <Edit3 className="w-3 h-3" /> Editar
              </button>
            )}
          </div>
          {editNotes ? (
            <div className="space-y-3">
              <textarea
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-yellow-500 min-h-[120px] resize-y leading-relaxed"
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                placeholder="Escreva pontos de alinhamento com outros times (ex: Cobrar infra, Validar com o jurídico)..."
                disabled={saving}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setEditNotes(false); setNotesValue(project.strategic_notes || ''); }}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNotes}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-550 rounded-lg text-[10px] font-bold text-white flex items-center gap-1"
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[120px]">
              {project.strategic_notes || 'Nenhuma nota de cobrança registrada para esta iniciativa ainda.'}
            </div>
          )}
        </div>
      </div>

      {/* Board de Trilhas */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" /> Board de Trilhas (Entregáveis Vinculados)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna 1: Jira */}
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

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-1 custom-scrollbar">
              {jiraDemands.length > 0 ? (
                jiraDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem entregas no Jira" />
              )}
            </div>

            <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs text-slate-400 mt-auto">
              <span>Impedimentos Ativos:</span>
              <span className={`font-bold ${jiraBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                {jiraBlockedCount}
              </span>
            </div>
          </div>

          {/* Coluna 2: Azure */}
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

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-1 custom-scrollbar">
              {azureDemands.length > 0 ? (
                azureDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem entregas no Azure" />
              )}
            </div>

            <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between text-xs text-slate-400 mt-auto">
              <span>Impedimentos Ativos:</span>
              <span className={`font-bold ${azureBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                {azureBlockedCount}
              </span>
            </div>
          </div>

          {/* Coluna 3: Negócios */}
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

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-1 custom-scrollbar">
              {businessDemands.length > 0 ? (
                businessDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem demandas de Negócio" />
              )}
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
  );
}

// Subcomponente Card de Demanda
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
          demand.externalStatus === 'Concluído' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          isBlocked || demand.externalStatus === 'Blocked' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
          'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          {demand.externalStatus}
        </span>
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
