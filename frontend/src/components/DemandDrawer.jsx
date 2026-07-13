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
  const [titleInput, setTitleInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);

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
      setTitleInput('');
      setIsEditingTitle(false);
    }
  }, [demandId, isOpen]);

  const handleDeleteDemand = async () => {
    if (!demandId) return;
    const confirmed = window.confirm("Tem certeza de que deseja excluir permanentemente esta demanda local?");
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/demands/${demandId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onClose();
        if (onRefreshDemands) {
          onRefreshDemands();
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao excluir a demanda.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar ao servidor.");
    }
  };

  const loadDemandDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/demands/${demandId}`);
      if (res.ok) {
        const data = await res.json();
        setDemand(data);
        setTitleInput(data.title || '');
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
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
      />
      
      {/* Modal Container */}
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] md:h-[90vh] flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              demand?.origin === 'Jira' ? 'bg-sky-500' : 'bg-emerald-500'
            }`} />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-bold font-mono">
              {demand?.origin} / {demand?.externalId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sicoob-primary hover:text-sicoob-secondary hover:bg-slate-50 rounded-xl transition-all"
                title={`Ver no ${demand.origin}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver no {demand.origin}
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-655 hover:bg-slate-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-sicoob-primary mb-2" />
            Carregando detalhes...
          </div>
        ) : demand ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 bg-white">
            
            {/* Left Column: Description, Status Report, AI Summary, Annotations */}
            <div className="flex-1 space-y-6 lg:pr-6 lg:border-r lg:border-slate-200 min-w-0">
              {/* Title & Status */}
              <div className="space-y-3">
                {demand.origin === 'Negocio' ? (
                  isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={titleInput}
                        onChange={e => setTitleInput(e.target.value)}
                        onBlur={() => {
                          setIsEditingTitle(false);
                          if (titleInput.trim() && titleInput.trim() !== demand.title) {
                            handleUpdateManagementField('title', titleInput.trim());
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            setIsEditingTitle(false);
                            if (titleInput.trim() && titleInput.trim() !== demand.title) {
                              handleUpdateManagementField('title', titleInput.trim());
                            }
                          } else if (e.key === 'Escape') {
                            setIsEditingTitle(false);
                            setTitleInput(demand.title);
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-white border border-slate-350 rounded-xl px-3 py-2 text-xl font-bold text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h2 
                        className="text-xl font-bold text-sicoob-text leading-snug break-words cursor-pointer hover:text-sicoob-primary flex-1"
                        onClick={() => setIsEditingTitle(true)}
                      >
                        {demand.title}
                      </h2>
                      <button 
                        type="button"
                        onClick={() => setIsEditingTitle(true)}
                        className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-sicoob-primary hover:border-slate-300 transition-all shrink-0 shadow-xs"
                        title="Editar título"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                ) : (
                  <h2 className="text-xl font-bold text-sicoob-text leading-snug break-words">{demand.title}</h2>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Status: 
                    {demand.origin === 'Negocio' ? (
                      <select
                        value={demand.externalStatus || 'Backlog'}
                        onChange={e => handleUpdateManagementField('externalStatus', e.target.value)}
                        className="bg-white border border-slate-350 rounded px-2 py-0.5 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors ml-1 cursor-pointer"
                      >
                        <option value="Backlog">Backlog</option>
                        <option value="Em Progresso">Em Progresso</option>
                        <option value="Homologação">Homologação</option>
                        <option value="Concluído">Concluído</option>
                      </select>
                    ) : (
                      <strong className="text-sicoob-text ml-1">{demand.externalStatus}</strong>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Última Atualização: <strong className="text-sicoob-text font-semibold">{formatDate(demand.updatedAt)}</strong>
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Status Report Semanal */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-sicoob-primary uppercase tracking-wider">Status Report Semanal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1.5">
                    <label className="block text-xs text-slate-500 font-medium min-h-[32px]">Evolução / Situação Atual (Para o Report Semanal)</label>
                    <textarea
                      placeholder="Situação atual e evolução da demanda..."
                      rows="4"
                      value={currentStatusNotes}
                      onChange={e => setCurrentStatusNotes(e.target.value)}
                      onBlur={() => handleUpdateManagementField('current_status_notes', currentStatusNotes)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-sicoob-text placeholder-slate-400 focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors resize-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label className="block text-xs text-slate-500 font-medium min-h-[32px]">Impedimentos / Pontos de Atenção (Para o Report Semanal)</label>
                    <textarea
                      placeholder="Impedimentos, risks ou pontos de atenção..."
                      rows="4"
                      value={blockerNotes}
                      onChange={e => setBlockerNotes(e.target.value)}
                      onBlur={() => handleUpdateManagementField('blocker_notes', blockerNotes)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-sicoob-text placeholder-slate-400 focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* AI Summary */}
              {demand.ai_summary && (
                <div className="relative overflow-hidden bg-gradient-to-r from-sicoob-primary/5 via-purple-500/5 to-pink-500/5 border border-sicoob-primary/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-sicoob-secondary">
                      <Sparkles className="w-3.5 h-3.5 text-sicoob-primary animate-pulse" />
                      Resumo Executivo Inteligente
                    </span>
                    {demand.summary_updated_at && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Atualizado em {formatDate(demand.summary_updated_at)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
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
                        ? 'text-slate-600 hover:text-sicoob-text'
                        : 'text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-sicoob-primary flex-shrink-0" />
                    <span className="truncate">Histórico de Comentários Externos ({demand.origin})</span>
                    {demand.comments_history ? (
                      showExternalComments ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
                      )
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-medium ml-1 border border-slate-200">Sem comentários</span>
                    )}
                  </button>
                  
                  {demand.comments_history && (
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={summarizing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-sicoob-primary/10 text-sicoob-secondary hover:bg-sicoob-primary/20 border border-sicoob-primary/20 rounded-xl transition-all disabled:opacity-50 flex-shrink-0 shadow-xs"
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
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl max-h-64 overflow-y-auto custom-scrollbar">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {demand.comments_history}
                    </p>
                  </div>
                )}
              </div>

              <hr className="border-slate-200" />

              {/* Add Annotation Form */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-sicoob-text flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-sicoob-primary" /> Novo Apontamento Local
                </h3>
                <form onSubmit={handleAddNote} className="space-y-3">
                  <textarea
                    placeholder="Adicione anotações ricas sobre o andamento, discussões de refinamento ou priorizações..."
                    rows="3"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full bg-white border border-slate-350 rounded-xl p-3 text-sm text-sicoob-text placeholder-slate-400 focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!note.trim()}
                      className="bg-sicoob-primary hover:bg-sicoob-secondary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Salvar Apontamento
                    </button>
                  </div>
                </form>
              </div>

              <hr className="border-slate-200" />

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-sicoob-text flex items-center gap-2">
                  <History className="w-4 h-4 text-sicoob-primary" /> Histórico Local (Timeline)
                </h3>
                
                {demand.annotations.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-5 ml-2.5">
                    {demand.annotations.map((ann) => (
                      <div key={ann.id} className="relative fade-enter">
                        <span className="absolute -left-[31px] top-1.5 bg-white border-2 border-sicoob-primary w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-sicoob-primary" />
                        </span>
                        
                        <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-1.5 shadow-xs">
                          <span className="text-[10px] font-bold text-sicoob-primary block font-mono">
                            {formatDate(ann.createdAt)}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {ann.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    Nenhum apontamento feito nesta demanda ainda.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Metadata, Dates, Project, Dependencies */}
            <div className="w-full lg:w-80 shrink-0 space-y-6 lg:pl-2 bg-white">
              {/* Tags */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" /> Tags Customizadas
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {demand.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-sicoob-primary/10 text-sicoob-secondary border border-sicoob-primary/20 pl-2.5 pr-1 py-1 rounded-lg group"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 rounded text-slate-400 hover:text-red-655 hover:bg-red-50 transition-colors"
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
                      className="bg-white border border-slate-300 hover:border-slate-400 text-xs text-sicoob-text placeholder-slate-400 rounded-lg px-2.5 py-1 focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary w-24 transition-colors"
                    />
                  </form>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Dates & Project */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> Prazos e Vínculo
                </h3>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500 font-medium">Promessa de Entrega</label>
                    <input
                      type="date"
                      value={promisedDate}
                      onChange={e => setPromisedDate(e.target.value)}
                      onBlur={() => handleUpdateManagementField('promisedDate', promisedDate)}
                      onClick={e => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
                      className="w-full bg-white border border-slate-350 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500 font-medium">Agendar Próxima Cobrança</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      onBlur={() => handleUpdateManagementField('followUpDate', followUpDate)}
                      onClick={e => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
                      className="w-full bg-white border border-slate-350 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500 font-medium">Projeto Vinculado</label>
                    <select
                      value={demand.project || ''}
                      onChange={e => handleUpdateManagementField('project', e.target.value || null)}
                      className="w-full bg-white border border-slate-350 rounded-xl px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    >
                      <option value="">Sem projeto</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Resumo para a Gestora */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-400" /> Resumo One-on-One
                </label>
                <textarea
                  placeholder="Pontos críticos, alinhamentos informais ou notas para a reunião de status..."
                  rows="3"
                  value={demand.managerNotes || ''}
                  onChange={e => handleUpdateManagementField('managerNotes', e.target.value)}
                  className="w-full bg-yellow-50 border border-yellow-150 hover:border-yellow-350 rounded-xl p-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors resize-none"
                />
              </div>

              <hr className="border-slate-200" />

              {/* Atribuição de Dependências */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-slate-400" /> Dependências Manuais
                </h3>
                
                {/* Item Pai Manual */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs text-slate-500 font-medium">Demanda Pai (Hierarquia)</label>
                  
                  {isParentSearchOpen && (
                    <div className="fixed inset-0 z-10" onClick={() => setIsParentSearchOpen(false)} />
                  )}
                  
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsParentSearchOpen(!isParentSearchOpen)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-left text-sicoob-text flex items-center justify-between hover:border-slate-400 transition-colors shadow-xs"
                    >
                      <span className="truncate">
                        {demand.parentId ? (
                          <>
                            <strong className="text-sicoob-primary font-mono">[{demand.parentId}]</strong>{' '}
                            {allDemands.find(d => d.externalId === demand.parentId)?.title || ''}
                            {demand.localParentId && demand.localParentId !== 'NONE' ? (
                              <span className="ml-2 text-[9px] bg-sicoob-primary/10 text-sicoob-secondary px-1.5 py-0.5 rounded border border-sicoob-primary/20">Manual</span>
                            ) : demand.localParentId === 'NONE' ? (
                              <span className="ml-2 text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">Removido</span>
                            ) : (
                              <span className="ml-2 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">Auto</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">Nenhum (Sem pai)</span>
                        )}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </button>

                    {isParentSearchOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 p-2 space-y-2 max-h-60 flex flex-col">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <Search className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                          <input
                            type="text"
                            placeholder="Filtrar por ID ou Título..."
                            value={parentSearchQuery}
                            onChange={e => setParentSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-sicoob-text focus:outline-none placeholder-slate-400"
                            autoFocus
                          />
                          {parentSearchQuery && (
                            <button type="button" onClick={() => setParentSearchQuery('')}>
                              <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                            </button>
                          )}
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 max-h-40">
                          {demand.localParentId && (
                            <button
                              type="button"
                              onClick={() => handleSelectParent(null)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-between"
                            >
                              <span>Restaurar vínculo automático</span>
                              <RefreshCw className="w-3 h-3 text-slate-400" />
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => handleSelectParent('NONE')}
                            className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sicoob-text flex items-center justify-between"
                          >
                            <span>Sem pai (Nenhum)</span>
                            {demand.localParentId === 'NONE' && <Check className="w-3.5 h-3.5 text-sicoob-primary" />}
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
                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sicoob-text flex items-center justify-between gap-2"
                              >
                                <span className="truncate">
                                  <strong className="text-slate-400 font-mono">[{d.externalId}]</strong> {d.title}
                                </span>
                                {demand.localParentId === d.externalId && <Check className="w-3.5 h-3.5 text-sicoob-primary flex-shrink-0" />}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloqueadores Manuais */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 relative">
                  <label className="text-xs text-slate-550 font-medium block">Bloqueadores (Blockers)</label>
                  
                  {demand.blockers && demand.blockers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {demand.blockers.map(blockerId => (
                        <span
                          key={blockerId}
                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 pl-2.5 pr-1 py-1 rounded-lg"
                        >
                          {blockerId}
                          <button
                            type="button"
                            onClick={() => handleRemoveBlocker(blockerId)}
                            className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 block mb-1">Nenhum bloqueador manual associado.</span>
                  )}

                  <div className="relative">
                    {isBlockerSearchOpen && (
                      <div className="fixed inset-0 z-10" onClick={() => setIsBlockerSearchOpen(false)} />
                    )}
                    
                    <button
                      type="button"
                      onClick={() => setIsBlockerSearchOpen(!isBlockerSearchOpen)}
                      className="w-full bg-white border border-slate-350 hover:border-slate-400 rounded-xl px-3 py-2 text-xs text-left text-slate-400 flex items-center justify-between transition-colors shadow-xs"
                    >
                      <span>Vincular bloqueadora...</span>
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {isBlockerSearchOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 p-2 space-y-2 max-h-60 flex flex-col">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <Search className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                          <input
                            type="text"
                            placeholder="Buscar por ID ou Título..."
                            value={blockerSearchQuery}
                            onChange={e => setBlockerSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-sicoob-text focus:outline-none placeholder-slate-400"
                            autoFocus
                          />
                          {blockerSearchQuery && (
                            <button type="button" onClick={() => setBlockerSearchQuery('')}>
                              <X className="w-3 h-3 text-slate-400 hover:text-slate-655" />
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
                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 text-sicoob-text flex items-center gap-2"
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

                {/* Excluir Demanda (apenas para Negocio) */}
                {demand.origin === 'Negocio' && (
                  <div className="pt-4 border-t border-slate-150">
                    <button
                      type="button"
                      onClick={handleDeleteDemand}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-350 active:scale-95 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-2 select-none"
                    >
                      <X className="w-3.5 h-3.5" />
                      Excluir Demanda
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
