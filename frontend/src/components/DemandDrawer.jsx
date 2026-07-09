import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Clock, Tag, Pencil, Plus, History, ExternalLink, Calendar, MessageSquare, ChevronDown, ChevronUp, Search, Check, Sparkles } from 'lucide-react';

export default function DemandDrawer({ demandId, isOpen, onClose, onRefreshDemands }) {
  const [demand, setDemand] = useState(null);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [showExternalComments, setShowExternalComments] = useState(false);
  const [allDemands, setAllDemands] = useState([]);
  const [projects, setProjects] = useState([]);
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [isParentSearchOpen, setIsParentSearchOpen] = useState(false);
  const [blockerSearchQuery, setBlockerSearchQuery] = useState('');
  const [isBlockerSearchOpen, setIsBlockerSearchOpen] = useState(false);
  const [currentStatusNotes, setCurrentStatusNotes] = useState('');
  const [blockerNotes, setBlockerNotes] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  const getExternalUrl = () => {
    if (!demand) return null;
    if (demand.origin === 'Jira') {
      const jiraUrl = localStorage.getItem('jira_url');
      if (jiraUrl) {
        const cleanUrl = jiraUrl.replace(/\/$/, '');
        return `${cleanUrl}/browse/${demand.externalId}`;
      }
    } else if (demand.origin === 'Azure') {
      const azureOrg = localStorage.getItem('azure_org');
      const azureProject = localStorage.getItem('azure_project');
      if (azureOrg && azureProject) {
        return `https://dev.azure.com/${azureOrg}/${azureProject}/_workitems/edit/${demand.externalId}`;
      }
    }
    return demand.externalUrl;
  };
  const externalUrl = getExternalUrl();

  useEffect(() => {
    if (isOpen && demandId) {
      loadDemandDetail();
      loadAllDemands();
      loadProjects();
      setShowExternalComments(false);
    } else {
      setDemand(null);
      setAllDemands([]);
      setProjects([]);
      setShowExternalComments(false);
      setIsParentSearchOpen(false);
      setIsBlockerSearchOpen(false);
      setParentSearchQuery('');
      setBlockerSearchQuery('');
      setCurrentStatusNotes('');
      setBlockerNotes('');
      setPromisedDate('');
      setFollowUpDate('');
    }
  }, [demandId, isOpen]);

  const loadDemandDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/demands/${demandId}`);
      if (res.ok) {
        const data = await res.json();
        setDemand(data);
        setCurrentStatusNotes(data.current_status_notes || '');
        setBlockerNotes(data.blocker_notes || '');
        setPromisedDate(data.promisedDate || '');
        setFollowUpDate(data.followUpDate || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllDemands = async () => {
    try {
      const res = await fetch('/api/demands');
      if (res.ok) {
        const data = await res.json();
        setAllDemands(data);
      }
    } catch (e) {
      console.error("Erro ao buscar todas as demandas:", e);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Erro ao buscar projetos:", e);
    }
  };

  const handleSummarize = async () => {
    if (!demandId) return;
    setSummarizing(true);
    try {
      const res = await fetch(`/api/demands/${demandId}/summarize`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setDemand(prev => ({
          ...prev,
          ai_summary: data.ai_summary,
          summary_updated_at: data.summary_updated_at
        }));
        if (onRefreshDemands) {
          onRefreshDemands();
        }
      } else {
        const errData = await res.json();
        alert(errData.detail || "Erro ao gerar resumo inteligênte.");
      }
    } catch (e) {
      console.error("Erro ao resumir demanda:", e);
      alert("Erro ao conectar ao servidor para gerar o resumo.");
    } finally {
      setSummarizing(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;

    try {
      const res = await fetch(`/api/demands/${demandId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note })
      });
      if (res.ok) {
        setNote('');
        loadDemandDetail();
        onRefreshDemands();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    const tag = tagInput.trim().toLowerCase();
    if (!tag || demand.tags.includes(tag)) return;

    try {
      const res = await fetch(`/api/demands/${demandId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
      });
      if (res.ok) {
        setTagInput('');
        loadDemandDetail();
        onRefreshDemands();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveTag = async (tag) => {
    try {
      const res = await fetch(`/api/demands/${demandId}/tags/${tag}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadDemandDetail();
        onRefreshDemands();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateManagementField = async (field, value) => {
    setDemand(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'promisedDate') setPromisedDate(value || '');
    if (field === 'followUpDate') setFollowUpDate(value || '');
    try {
      await fetch(`/api/demands/${demandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null })
      });
      onRefreshDemands();
    } catch (e) {
      console.error("Erro ao atualizar campo de gestão:", e);
    }
  };

  const handleSelectParent = async (val) => {
    await handleUpdateManagementField('localParentId', val);
    setIsParentSearchOpen(false);
    setParentSearchQuery('');
    loadDemandDetail();
    loadAllDemands();
  };

  const handleSelectBlocker = async (blockerId) => {
    try {
      const res = await fetch(`/api/demands/${demandId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker_id: blockerId })
      });
      if (res.ok) {
        setIsBlockerSearchOpen(false);
        setBlockerSearchQuery('');
        loadDemandDetail();
        onRefreshDemands();
        loadAllDemands();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveBlocker = async (blockerId) => {
    try {
      const res = await fetch(`/api/demands/${demandId}/dependencies/${blockerId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadDemandDetail();
        onRefreshDemands();
        loadAllDemands();
      }
    } catch (e) {
      console.error(e);
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
      console.error("Erro ao formatar data:", e);
      return isoString;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 transition-all duration-300 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-300"
      />
      
      {/* Modal Container */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] md:h-[90vh] flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              demand?.origin === 'Jira' ? 'bg-sky-400' : 'bg-emerald-400'
            }`} />
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold font-mono">
              {demand?.origin} / {demand?.externalId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/80 rounded-xl transition-all"
                title={`Ver no ${demand.origin}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver no {demand.origin}
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-2" />
            Carregando detalhes...
          </div>
        ) : demand ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
            
            {/* Left Column: Description, Status Report, AI Summary, Annotations */}
            <div className="flex-1 space-y-6 lg:pr-6 lg:border-r lg:border-slate-800/60 min-w-0">
              {/* Title & Status */}
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white leading-snug break-words">{demand.title}</h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Status: <strong className="text-slate-200">{demand.externalStatus}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Última Atualização: <strong className="text-slate-200">{formatDate(demand.updatedAt)}</strong>
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/60" />

              {/* Status Report Semanal */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Status Report Semanal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Evolução / Situação Atual (Para o Report Semanal)</label>
                    <textarea
                      placeholder="Situação atual e evolução da demanda..."
                      rows="4"
                      value={currentStatusNotes}
                      onChange={e => setCurrentStatusNotes(e.target.value)}
                      onBlur={() => handleUpdateManagementField('current_status_notes', currentStatusNotes)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Impedimentos / Pontos de Atenção (Para o Report Semanal)</label>
                    <textarea
                      placeholder="Impedimentos, riscos ou pontos de atenção..."
                      rows="4"
                      value={blockerNotes}
                      onChange={e => setBlockerNotes(e.target.value)}
                      onBlur={() => handleUpdateManagementField('blocker_notes', blockerNotes)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/60" />

              {/* AI Summary */}
              {demand.ai_summary && (
                <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                      Resumo Executivo Inteligente
                    </span>
                    {demand.summary_updated_at && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Atualizado em {formatDate(demand.summary_updated_at)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {demand.ai_summary}
                  </div>
                </div>
              )}

              {/* Histórico de Comentários Externos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={!demand.comments_history}
                    onClick={() => setShowExternalComments(!showExternalComments)}
                    className={`flex items-center gap-2 text-sm font-semibold transition-colors text-left ${
                      demand.comments_history
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">Histórico de Comentários Externos ({demand.origin})</span>
                    {demand.comments_history ? (
                      showExternalComments ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
                      )
                    ) : (
                      <span className="text-[10px] bg-slate-900 text-slate-600 px-2 py-0.5 rounded-full font-medium ml-1">Sem comentários</span>
                    )}
                  </button>
                  
                  {demand.comments_history && (
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={summarizing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                      title="Gerar ou atualizar resumo inteligente com Gemini"
                    >
                      {summarizing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Resumo IA
                    </button>
                  )}
                </div>
                
                {demand.comments_history && showExternalComments && (
                  <div className="bg-slate-950/45 p-4 border border-slate-800/80 rounded-xl max-h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {demand.comments_history}
                    </p>
                  </div>
                )}
              </div>

              <hr className="border-slate-800/60" />

              {/* Add Annotation Form */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-400" /> Novo Apontamento Local
                </h3>
                <form onSubmit={handleAddNote} className="space-y-3">
                  <textarea
                    placeholder="Adicione anotações ricas sobre o andamento, discussões de refinamento ou priorizações..."
                    rows="3"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!note.trim()}
                      className="bg-slate-100 hover:bg-white text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Plus className="w-3.5 h-3.5" /> Salvar Apontamento
                    </button>
                  </div>
                </form>
              </div>

              <hr className="border-slate-800/60" />

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" /> Histórico Local (Timeline)
                </h3>
                
                {demand.annotations.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-slate-800/60 space-y-5 ml-2.5">
                    {demand.annotations.map((ann) => (
                      <div key={ann.id} className="relative fade-enter">
                        <span className="absolute -left-[31px] top-1.5 bg-slate-900 border-2 border-brand-500 w-4 h-4 rounded-full flex items-center justify-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        </span>
                        
                        <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-bold text-indigo-400 block font-mono">
                            {formatDate(ann.createdAt)}
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {ann.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                    Nenhum apontamento feito nesta demanda ainda.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Metadata, Dates, Project, Dependencies */}
            <div className="w-full lg:w-80 shrink-0 space-y-6 lg:pl-2">
              {/* Tags */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-500" /> Tags Customizadas
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {demand.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 pl-2.5 pr-1 py-1 rounded-lg group"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  
                  {/* Add Tag */}
                  <form onSubmit={handleAddTag} className="inline-flex items-center ml-1">
                    <input
                      type="text"
                      placeholder="+ Nova tag"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 placeholder-slate-650 rounded-lg px-2.5 py-1 focus:outline-none focus:border-brand-500 w-24 transition-colors"
                    />
                  </form>
                </div>
              </div>

              <hr className="border-slate-800/60" />

              {/* Dates & Project */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" /> Prazos e Vínculo
                </h3>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Promessa de Entrega</label>
                    <input
                      type="date"
                      value={promisedDate}
                      onChange={e => setPromisedDate(e.target.value)}
                      onBlur={() => handleUpdateManagementField('promisedDate', promisedDate)}
                      onClick={e => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Agendar Próxima Cobrança</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      onBlur={() => handleUpdateManagementField('followUpDate', followUpDate)}
                      onClick={e => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-medium">Projeto Vinculado</label>
                    <select
                      value={demand.project || ''}
                      onChange={e => handleUpdateManagementField('project', e.target.value || null)}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="">Sem projeto</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-slate-800/60" />

              {/* Resumo para a Gestora */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" /> Resumo One-on-One
                </label>
                <textarea
                  placeholder="Pontos críticos, alinhamentos informais ou notas para a reunião de status..."
                  rows="3"
                  value={demand.managerNotes || ''}
                  onChange={e => handleUpdateManagementField('managerNotes', e.target.value)}
                  className="w-full bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/30 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-yellow-500/50 transition-colors resize-none"
                />
              </div>

              <hr className="border-slate-800/60" />

              {/* Atribuição de Dependências */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-slate-500" /> Dependências Manuais
                </h3>
                
                {/* Item Pai Manual */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs text-slate-450 font-medium">Demanda Pai (Hierarquia)</label>
                  
                  {isParentSearchOpen && (
                    <div className="fixed inset-0 z-10" onClick={() => setIsParentSearchOpen(false)} />
                  )}
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsParentSearchOpen(!isParentSearchOpen)}
                      className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-left text-slate-300 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <span className="truncate">
                        {demand.parentId ? (
                          <>
                            <strong className="text-indigo-400 font-mono">[{demand.parentId}]</strong>{' '}
                            {allDemands.find(d => d.externalId === demand.parentId)?.title || ''}
                            {demand.localParentId && demand.localParentId !== 'NONE' ? (
                              <span className="ml-2 text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">Manual</span>
                            ) : demand.localParentId === 'NONE' ? (
                              <span className="ml-2 text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20">Removido</span>
                            ) : (
                              <span className="ml-2 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">Auto</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500">Nenhum (Sem pai)</span>
                        )}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    </button>

                    {isParentSearchOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-20 p-2 space-y-2 max-h-60 flex flex-col">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
                          <Search className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
                          <input
                            type="text"
                            placeholder="Filtrar por ID ou Título..."
                            value={parentSearchQuery}
                            onChange={e => setParentSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-slate-300 focus:outline-none placeholder-slate-650"
                            autoFocus
                          />
                          {parentSearchQuery && (
                            <button type="button" onClick={() => setParentSearchQuery('')}>
                              <X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                            </button>
                          )}
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-40">
                          {demand.localParentId && (
                            <button
                              type="button"
                              onClick={() => handleSelectParent(null)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-900 text-slate-400 flex items-center justify-between"
                            >
                              <span>Restaurar vínculo automático</span>
                              <RefreshCw className="w-3 h-3 text-slate-500" />
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => handleSelectParent('NONE')}
                            className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-900 text-slate-300 flex items-center justify-between"
                          >
                            <span>Sem pai (Nenhum)</span>
                            {demand.localParentId === 'NONE' && <Check className="w-3.5 h-3.5 text-brand-500" />}
                          </button>

                          {allDemands
                            .filter(d => d.externalId !== demandId)
                            .filter(d => 
                              !parentSearchQuery ||
                              d.externalId.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
                              d.title.toLowerCase().includes(parentSearchQuery.toLowerCase())
                            )
                            .map(d => (
                              <button
                                key={d.externalId}
                                type="button"
                                onClick={() => handleSelectParent(d.externalId)}
                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-900 text-slate-300 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">
                                  <strong className="text-slate-400 font-mono">[{d.externalId}]</strong> {d.title}
                                </span>
                                {demand.localParentId === d.externalId && <Check className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloqueadores Manuais */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/40 relative">
                  <label className="text-xs text-slate-450 font-medium block">Bloqueadores (Blockers)</label>
                  
                  {demand.blockers && demand.blockers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {demand.blockers.map(blockerId => (
                        <span
                          key={blockerId}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-500/10 text-rose-455 border border-rose-500/20 pl-2.5 pr-1 py-1 rounded-lg"
                        >
                          {blockerId}
                          <button
                            type="button"
                            onClick={() => handleRemoveBlocker(blockerId)}
                            className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 block mb-1">Nenhum bloqueador manual associado.</span>
                  )}

                  <div className="relative">
                    {isBlockerSearchOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setIsBlockerSearchOpen(false)} />
                    )}
                    
                    <button
                      type="button"
                      onClick={() => setIsBlockerSearchOpen(!isBlockerSearchOpen)}
                      className="w-full bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl px-3 py-2 text-xs text-left text-slate-500 flex items-center justify-between transition-colors"
                    >
                      <span>Vincular bloqueadora...</span>
                      <Search className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    {isBlockerSearchOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-20 p-2 space-y-2 max-h-60 flex flex-col">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5">
                          <Search className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
                          <input
                            type="text"
                            placeholder="Buscar por ID ou Título..."
                            value={blockerSearchQuery}
                            onChange={e => setBlockerSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-slate-300 focus:outline-none placeholder-slate-650"
                            autoFocus
                          />
                          {blockerSearchQuery && (
                            <button type="button" onClick={() => setBlockerSearchQuery('')}>
                              <X className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                            </button>
                          )}
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-40">
                          {allDemands
                            .filter(d => d.externalId !== demandId)
                            .filter(d => !demand.blockers.includes(d.externalId))
                            .filter(d => 
                              !blockerSearchQuery ||
                              d.externalId.toLowerCase().includes(blockerSearchQuery.toLowerCase()) ||
                              d.title.toLowerCase().includes(blockerSearchQuery.toLowerCase())
                            )
                            .map(d => (
                              <button
                                key={d.externalId}
                                type="button"
                                onClick={() => handleSelectBlocker(d.externalId)}
                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-900 text-slate-300 flex items-center gap-2"
                              >
                                <span className="truncate">
                                  <strong className="text-slate-400 font-mono">[{d.externalId}]</strong> {d.title}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
