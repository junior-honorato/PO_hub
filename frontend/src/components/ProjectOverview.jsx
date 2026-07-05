import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Briefcase, Calendar, Target, Activity, FileText, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export default function ProjectOverview({ projectId, onBack, onSelectDemand }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/overview`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
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
            <p className="text-xs text-slate-500">Consolidado estratégico de entregáveis e saúde semanal</p>
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

      {/* Relatório de Status Semanal */}
      <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-500" /> Resumo Executivo & Impedimentos
        </h3>
        <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {project.executive_summary || 'Nenhum status report registrado para esta iniciativa ainda.'}
        </div>
      </div>

      {/* Board de Trilhas */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" /> Board de Trilhas (Entregáveis Vinculados)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna 1: Jira */}
          <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[350px] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                TI - Jira
              </span>
              <span className="bg-sky-500/10 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {jiraDemands.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
              {jiraDemands.length > 0 ? (
                jiraDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem entregas no Jira" />
              )}
            </div>
          </div>

          {/* Coluna 2: Azure */}
          <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[350px] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                TI - Azure DevOps
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {azureDemands.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
              {azureDemands.length > 0 ? (
                azureDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem entregas no Azure" />
              )}
            </div>
          </div>

          {/* Coluna 3: Negócios */}
          <div className="bg-slate-900/10 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[350px] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                Negócios / GTM
              </span>
              <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {businessDemands.length}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
              {businessDemands.length > 0 ? (
                businessDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))
              ) : (
                <EmptyColumnPlaceholder text="Sem demandas de Negócio" />
              )}
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
  
  return (
    <div
      onClick={() => onSelect(demand.externalId)}
      className={`bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-700 p-4 rounded-xl cursor-pointer transition-all space-y-3 ${
        isStale ? 'border-amber-500/30 bg-amber-500/[0.02]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          {demand.externalId}
          {isStale && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
              Desatualizado
            </span>
          )}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
          demand.externalStatus === 'Concluído' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
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
