import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Clock, Tag, Pencil, Plus, History, ExternalLink, Calendar, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

export default function DemandDrawer({ demandId, isOpen, onClose, onRefreshDemands }) {
  const [demand, setDemand] = useState(null);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExternalComments, setShowExternalComments] = useState(false);
  const [localParentIdInput, setLocalParentIdInput] = useState('');
  const [blockerInput, setBlockerInput] = useState('');

  useEffect(() => {
    if (isOpen && demandId) {
      loadDemandDetail();
      setShowExternalComments(false);
    } else {
      setDemand(null);
      setShowExternalComments(false);
    }
  }, [demandId, isOpen]);

  useEffect(() => {
    if (demand) {
      setLocalParentIdInput(demand.localParentId || '');
    } else {
      setLocalParentIdInput('');
    }
  }, [demand]);

  const loadDemandDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/demands/${demandId}`);
      if (res.ok) {
        const data = await res.json();
        setDemand(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  const handleUpdateParent = async (e) => {
    if (e) e.preventDefault();
    const parentVal = localParentIdInput.trim().toUpperCase();
    await handleUpdateManagementField('localParentId', parentVal || null);
    loadDemandDetail();
  };

  const handleRemoveParent = async () => {
    setLocalParentIdInput('');
    await handleUpdateManagementField('localParentId', null);
    loadDemandDetail();
  };

  const handleAddBlocker = async (e) => {
    e.preventDefault();
    const blockerId = blockerInput.trim().toUpperCase();
    if (!blockerId || demand.blockers.includes(blockerId)) return;
    try {
      const res = await fetch(`/api/demands/${demandId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker_id: blockerId })
      });
      if (res.ok) {
        setBlockerInput('');
        loadDemandDetail();
        onRefreshDemands();
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
    <div className={`fixed inset-0 z-50 pointer-events-none ${isOpen ? 'visible' : 'invisible'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      
      {/* Drawer Panel */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col pointer-events-auto drawer-transition transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              demand?.origin === 'Jira' ? 'bg-sky-400' : 'bg-emerald-400'
            }`} />
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
              {demand?.origin} / {demand?.externalId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {demand?.externalUrl && (
              <a
                href={demand.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-xl transition-all"
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Title & Status */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-white leading-snug">{demand.title}</h2>
                {demand.externalUrl && (
                  <a
                    href={demand.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white transition-colors pt-1 flex-shrink-0"
                    title={`Abrir no ${demand.origin}`}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
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

            <hr className="border-slate-800" />

            {/* Tags */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Tags Customizadas
              </h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {demand.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 pl-2.5 pr-1 py-1 rounded-lg group"
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
                    className="bg-slate-950 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 placeholder-slate-600 rounded-lg px-2.5 py-1 focus:outline-none focus:border-brand-500 w-24 transition-colors"
                  />
                </form>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Controle de Prazos e Cobrança */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Controle de Prazos e Cobrança
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Promessa de Entrega</label>
                  <input
                    type="date"
                    value={demand.promisedDate || ''}
                    onChange={e => handleUpdateManagementField('promisedDate', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Agendar Próxima Cobrança</label>
                  <input
                    type="date"
                    value={demand.followUpDate || ''}
                    onChange={e => handleUpdateManagementField('followUpDate', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Resumo para a Gestora (One-on-One)</label>
                <textarea
                  placeholder="Pontos críticos, alinhamentos informais ou notas para a reunião de status..."
                  rows="2"
                  value={demand.managerNotes || ''}
                  onChange={e => handleUpdateManagementField('managerNotes', e.target.value)}
                  className="w-full bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/30 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-yellow-500/50 transition-colors resize-none"
                />
              </div>
            </div>

             <hr className="border-slate-800" />

             {/* Atribuição Manual de Dependências */}
             <div className="space-y-4">
               <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                 <Plus className="w-4 h-4 text-indigo-400" /> Atribuição Manual de Dependências
               </h3>
               
               {/* Item Pai Manual */}
               <div className="space-y-1.5">
                 <label className="text-xs text-slate-400 font-medium">Demanda Pai (Hierarquia)</label>
                 <form onSubmit={handleUpdateParent} className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Ex: JIRA-101"
                     value={localParentIdInput}
                     onChange={e => setLocalParentIdInput(e.target.value)}
                     className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                   />
                   {demand.localParentId ? (
                     <button
                       type="button"
                       onClick={handleRemoveParent}
                       className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-colors"
                     >
                       Remover
                     </button>
                   ) : (
                     <button
                       type="submit"
                       disabled={!localParentIdInput.trim() || localParentIdInput.trim() === demand.localParentId}
                       className="px-3 py-2 bg-slate-100 hover:bg-white text-slate-950 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                     >
                       Vincular
                     </button>
                   )}
                 </form>
                 {demand.parentId && !demand.localParentId && (
                   <span className="text-[10px] text-slate-500 block">
                     Vínculo automático atual: <strong className="text-slate-400">{demand.parentId}</strong>
                   </span>
                 )}
               </div>

               {/* Bloqueadores Manuais */}
               <div className="space-y-2.5 pt-2 border-t border-slate-800/40">
                 <label className="text-xs text-slate-400 font-medium block">Bloqueadores (Blockers)</label>
                 
                 {/* Lista de Bloqueadores */}
                 {demand.blockers && demand.blockers.length > 0 ? (
                   <div className="flex flex-wrap gap-1.5 mb-2">
                     {demand.blockers.map(blockerId => (
                       <span
                         key={blockerId}
                         className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 pl-2.5 pr-1 py-1 rounded-lg"
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

                 {/* Form Adicionar Bloqueador */}
                 <form onSubmit={handleAddBlocker} className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Adicionar ID do Bloqueador (Ex: AZ-501)"
                     value={blockerInput}
                     onChange={e => setBlockerInput(e.target.value)}
                     className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors"
                   />
                   <button
                     type="submit"
                     disabled={!blockerInput.trim()}
                     className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                   >
                     Adicionar
                   </button>
                 </form>
               </div>
             </div>

             <hr className="border-slate-800" />

            {/* Add Annotation Form */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Novo Apontamento
              </h3>
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  placeholder="Adicione anotações ricas..."
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

            <hr className="border-slate-800" />

            {/* Histórico de Comentários Externos (Jira/Azure) */}
            <div className="space-y-3">
              <button
                type="button"
                disabled={!demand.comments_history}
                onClick={() => setShowExternalComments(!showExternalComments)}
                className={`w-full flex items-center justify-between text-sm font-semibold transition-colors ${
                  demand.comments_history
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  Histórico de Comentários Externos ({demand.origin})
                </span>
                {demand.comments_history ? (
                  showExternalComments ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )
                ) : (
                  <span className="text-[10px] bg-slate-900 text-slate-600 px-2 py-0.5 rounded-full font-medium">Sem comentários</span>
                )}
              </button>
              
              {demand.comments_history && showExternalComments && (
                <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl max-h-64 overflow-y-auto custom-scrollbar">
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {demand.comments_history}
                  </p>
                </div>
              )}
            </div>

            <hr className="border-slate-800" />

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <History className="w-4 h-4" /> Histórico Local (Timeline)
              </h3>
              
              {demand.annotations.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-800 space-y-5 ml-2.5">
                  {demand.annotations.map((ann) => (
                    <div key={ann.id} className="relative fade-enter">
                      <span className="absolute -left-[31px] top-1.5 bg-slate-900 border-2 border-brand-500 w-4 h-4 rounded-full flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      </span>
                      
                      <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 block">
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
        ) : null}
      </div>
    </div>
  );
}
