import React, { useState, useEffect } from 'react';
import { ListOrdered, Calendar, GripVertical, Layers, Tag, Info, Plus, Search, X, Check } from 'lucide-react';

export default function PlanningView({ demands = [], onSelectDemand, onRefreshDemands }) {
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'gantt'
  
  // Local state for demand ordering in columns
  const [jiraDemands, setJiraDemands] = useState([]);
  const [azureDemands, setAzureDemands] = useState([]);

  // Drag and drop tracking
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Inclusion Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Sync props demands (filtered by in_tactical_planning) into local state sorted by priority_rank
  useEffect(() => {
    const tacticalDemands = demands.filter(d => Boolean(d.in_tactical_planning));
    const jira = tacticalDemands.filter(d => d.origin === 'Jira');
    const azure = tacticalDemands.filter(d => d.origin === 'Azure');

    const sortFn = (a, b) => {
      const rankA = a.priority_rank !== null && a.priority_rank !== undefined ? a.priority_rank : 999999;
      const rankB = b.priority_rank !== null && b.priority_rank !== undefined ? b.priority_rank : 999999;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    };

    setJiraDemands([...jira].sort(sortFn));
    setAzureDemands([...azure].sort(sortFn));
  }, [demands]);

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e, item, columnOrigin, index) => {
    setDraggedItem(item);
    setDraggedColumn(columnOrigin);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.externalId);
  };

  const handleDragOver = (e, index, columnOrigin) => {
    e.preventDefault();
    if (draggedColumn === columnOrigin && draggedOverIndex !== index) {
      setDraggedOverIndex(index);
    }
  };

  const handleDrop = async (e, targetColumnOrigin) => {
    e.preventDefault();
    if (!draggedItem || draggedColumn !== targetColumnOrigin) {
      setDraggedItem(null);
      setDraggedOverIndex(null);
      setDraggedColumn(null);
      return;
    }

    const currentList = targetColumnOrigin === 'Jira' ? [...jiraDemands] : [...azureDemands];
    const currentIndex = currentList.findIndex(d => d.externalId === draggedItem.externalId);
    
    if (currentIndex === -1 || draggedOverIndex === null || currentIndex === draggedOverIndex) {
      setDraggedItem(null);
      setDraggedOverIndex(null);
      setDraggedColumn(null);
      return;
    }

    const newList = [...currentList];
    const [removed] = newList.splice(currentIndex, 1);
    newList.splice(draggedOverIndex, 0, removed);

    const reorderedPayload = newList.map((item, idx) => ({
      externalId: item.externalId,
      priority_rank: idx + 1
    }));

    if (targetColumnOrigin === 'Jira') {
      setJiraDemands(newList.map((item, idx) => ({ ...item, priority_rank: idx + 1 })));
    } else {
      setAzureDemands(newList.map((item, idx) => ({ ...item, priority_rank: idx + 1 })));
    }

    setDraggedItem(null);
    setDraggedOverIndex(null);
    setDraggedColumn(null);

    setIsSaving(true);
    try {
      const res = await fetch('/demands/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reorderedPayload)
      });
      if (!res.ok) {
        await fetch('/api/demands/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reorderedPayload)
        });
      }
      if (onRefreshDemands) onRefreshDemands();
    } catch (err) {
      console.error("Erro ao persistir nova ordem das demandas:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle demand tactical status
  const handleToggleTacticalStatus = async (externalId, currentStatus) => {
    const newStatus = currentStatus ? 0 : 1;
    try {
      await fetch(`/api/demands/${externalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_tactical_planning: newStatus })
      });
      if (onRefreshDemands) onRefreshDemands();
    } catch (err) {
      console.error("Erro ao alterar status no planejamento tático:", err);
    }
  };

  const getSubProjectTag = (demand) => {
    if (demand.tags && demand.tags.length > 0) return demand.tags[0];
    const match = (demand.title || '').match(/^\[(.*?)\]/);
    if (match) return match[1];
    if (demand.project) return demand.project;
    return 'Geral';
  };

  const formatTitle = (title) => {
    if (!title) return '';
    return title.replace(/^\[.*?\]\s*/, '').trim();
  };

  const getTimelineMonths = () => {
    const months = [];
    const date = new Date();
    date.setDate(1);
    for (let i = 0; i < 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
      months.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase());
    }
    return months;
  };

  const timelineMonths = getTimelineMonths();
  const tacticalDemandsList = demands.filter(d => Boolean(d.in_tactical_planning));

  const filteredModalDemands = demands.filter(d => {
    const query = modalSearch.toLowerCase().trim();
    if (!query) return true;
    return d.title.toLowerCase().includes(query) || d.externalId.toLowerCase().includes(query);
  });

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-sicoob-text tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-sicoob-primary" /> Planejamento Tático - VGBL
          </h2>
          <p className="text-sm text-slate-500">Priorização em paralelo e linha do tempo de entregas táticas selecionadas</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Incluir Demanda ({tacticalDemandsList.length})
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-fit">
            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ranking'
                  ? 'bg-white text-sicoob-primary shadow-xs'
                  : 'text-slate-600 hover:text-sicoob-text'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Stack Ranking
            </button>
            <button
              onClick={() => setActiveTab('gantt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'gantt'
                  ? 'bg-white text-sicoob-primary shadow-xs'
                  : 'text-slate-600 hover:text-sicoob-text'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Cronograma
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Stack Ranking (Priorização Paralela) */}
      {activeTab === 'ranking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="flex items-center gap-2 font-medium">
              <Info className="w-4 h-4 text-sicoob-primary shrink-0" />
              Exibindo apenas demandas selecionadas para o Planejamento Tático. Arraste verticalmente para priorizar.
            </span>
            {isSaving && (
              <span className="text-sicoob-primary font-bold animate-pulse text-[11px]">
                Salvando prioridade...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Sicoob TI (Jira) */}
            <div
              className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3 min-h-[450px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'Jira')}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-600" />
                  <h3 className="font-bold text-sicoob-text text-sm">Sicoob TI (Jira)</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {jiraDemands.length} demandas
                </span>
              </div>

              <div className="space-y-2.5 flex-1">
                {jiraDemands.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 italic space-y-2">
                    <p>Nenhuma demanda Jira inclusa no Planejamento Tático.</p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="text-sicoob-primary font-bold hover:underline"
                    >
                      + Incluir demandas do Jira
                    </button>
                  </div>
                ) : (
                  jiraDemands.map((item, index) => {
                    const isDragging = draggedItem?.externalId === item.externalId;
                    const isOver = draggedColumn === 'Jira' && draggedOverIndex === index;

                    return (
                      <div
                        key={item.externalId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item, 'Jira', index)}
                        onDragOver={(e) => handleDragOver(e, index, 'Jira')}
                        onClick={() => onSelectDemand && onSelectDemand(item.externalId)}
                        className={`bg-white border p-3.5 rounded-xl transition-all shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 ${
                          isDragging ? 'opacity-40 border-dashed border-sicoob-primary' :
                          isOver ? 'border-2 border-sicoob-primary scale-[1.01]' :
                          'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-sicoob-primary/10 text-sicoob-primary font-black text-sm border border-sicoob-primary/20">
                            {index + 1}º
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-slate-500">
                                {item.externalId}
                              </span>
                              {item.externalStatus && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {item.externalStatus}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-sicoob-text truncate leading-snug">
                              {formatTitle(item.title)}
                            </h4>
                          </div>
                        </div>
                        <GripVertical className="w-4 h-4 text-slate-300 shrink-0 hover:text-slate-500" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: MAG (Azure) */}
            <div
              className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3 min-h-[450px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'Azure')}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                  <h3 className="font-bold text-sicoob-text text-sm">MAG (Azure)</h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {azureDemands.length} demandas
                </span>
              </div>

              <div className="space-y-2.5 flex-1">
                {azureDemands.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 italic space-y-2">
                    <p>Nenhuma demanda Azure inclusa no Planejamento Tático.</p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="text-sicoob-primary font-bold hover:underline"
                    >
                      + Incluir demandas do Azure
                    </button>
                  </div>
                ) : (
                  azureDemands.map((item, index) => {
                    const isDragging = draggedItem?.externalId === item.externalId;
                    const isOver = draggedColumn === 'Azure' && draggedOverIndex === index;

                    return (
                      <div
                        key={item.externalId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item, 'Azure', index)}
                        onDragOver={(e) => handleDragOver(e, index, 'Azure')}
                        onClick={() => onSelectDemand && onSelectDemand(item.externalId)}
                        className={`bg-white border p-3.5 rounded-xl transition-all shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing flex items-center justify-between gap-3 ${
                          isDragging ? 'opacity-40 border-dashed border-blue-500' :
                          isOver ? 'border-2 border-blue-500 scale-[1.01]' :
                          'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-black text-sm border border-blue-200">
                            {index + 1}º
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono font-bold text-slate-500">
                                {item.externalId}
                              </span>
                              {item.externalStatus && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {item.externalStatus}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-sicoob-text truncate leading-snug">
                              {formatTitle(item.title)}
                            </h4>
                          </div>
                        </div>
                        <GripVertical className="w-4 h-4 text-slate-300 shrink-0 hover:text-slate-500" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Cronograma (Gantt Chart) */}
      {activeTab === 'gantt' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sicoob-text text-base">Cronograma Tático VGBL</h3>
              <p className="text-xs text-slate-500">Rastreabilidade das demandas ativas do planejamento organizadas por sub-projetos</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="inline-block w-3 h-3 rounded-full bg-sicoob-primary" /> Demanda em Andamento
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-12 gap-2 pb-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-5">Demanda & Sub-Projeto</div>
                <div className="col-span-7 grid grid-cols-6 text-center">
                  {timelineMonths.map((m, i) => (
                    <div key={i} className="border-l border-slate-100 px-1">{m}</div>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {tacticalDemandsList.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 italic">
                    Nenhuma demanda inclusa no cronograma tático.
                  </div>
                ) : (
                  tacticalDemandsList.map((demand, index) => {
                    const tag = getSubProjectTag(demand);
                    const startCol = (index % 4) + 1;
                    const colSpan = Math.min(6 - startCol + 1, (index % 3) + 2);

                    return (
                      <div
                        key={demand.externalId}
                        onClick={() => onSelectDemand && onSelectDemand(demand.externalId)}
                        className="grid grid-cols-12 gap-2 py-3.5 items-center hover:bg-slate-50/80 rounded-lg transition-colors cursor-pointer px-1"
                      >
                        <div className="col-span-5 pr-3 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Tag className="w-3 h-3 text-emerald-600" />
                              [{tag}]
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              {demand.externalId}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-sicoob-text line-clamp-1 leading-snug">
                            {formatTitle(demand.title)}
                          </h4>
                        </div>

                        <div className="col-span-7 grid grid-cols-6 items-center relative h-8">
                          <div
                            className="h-6 rounded-lg bg-gradient-to-r from-sicoob-primary to-teal-500 text-white text-[10px] font-bold px-2.5 flex items-center justify-between shadow-xs truncate"
                            style={{
                              gridColumnStart: startCol,
                              gridColumnEnd: `span ${colSpan}`
                            }}
                          >
                            <span className="truncate">[{tag}] {formatTitle(demand.title)}</span>
                            <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded text-white shrink-0 ml-1">
                              {demand.mappedStatus || demand.externalStatus || 'Ativa'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inclusão Rápida no Planejamento Tático */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sicoob-text text-base">Gerenciar Demandas do Planejamento Tático</h3>
                <p className="text-xs text-slate-500">Marque as demandas que farão parte da visão de priorização tática</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por título ou ID..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary"
                />
              </div>
            </div>

            {/* Modal Demand List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-1">
              {filteredModalDemands.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  Nenhuma demanda encontrada.
                </div>
              ) : (
                filteredModalDemands.map(demand => {
                  const isChecked = Boolean(demand.in_tactical_planning);
                  return (
                    <div
                      key={demand.externalId}
                      className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => handleToggleTacticalStatus(demand.externalId, isChecked)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-sicoob-primary focus:ring-sicoob-primary cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              [{demand.origin}] {demand.externalId}
                            </span>
                            {demand.externalStatus && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {demand.externalStatus}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-semibold text-sicoob-text truncate leading-snug">
                            {formatTitle(demand.title)}
                          </h4>
                        </div>
                      </div>

                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isChecked
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isChecked ? 'Incluso' : 'Fora do Tático'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary text-white text-xs font-bold rounded-xl"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
