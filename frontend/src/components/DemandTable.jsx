import React, { useState } from 'react';
import { Search, X, Inbox, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';

export default function DemandTable({ demands, onSelectDemand, onRefreshDemands }) {
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [newDemandTitle, setNewDemandTitle] = useState('');
  const [newDemandProject, setNewDemandProject] = useState('');
  const [projects, setProjects] = useState([]);

  const [isSyncByIdModalOpen, setIsSyncByIdModalOpen] = useState(false);
  const [syncIdInput, setSyncIdInput] = useState('');
  const [syncByIdLoading, setSyncByIdLoading] = useState(false);
  const [syncByIdFeedback, setSyncByIdFeedback] = useState({ type: null, message: '' });

  const handleOpenSyncByIdModal = () => {
    setSyncIdInput('');
    setSyncByIdFeedback({ type: null, message: '' });
    setIsSyncByIdModalOpen(true);
  };

  const handleSyncById = async (e) => {
    e.preventDefault();
    if (!syncIdInput.trim()) return;

    setSyncByIdLoading(true);
    setSyncByIdFeedback({ type: null, message: '' });

    const jiraUrl = localStorage.getItem('jira_url');
    const jiraEmail = localStorage.getItem('jira_email');
    const jiraToken = localStorage.getItem('jira_token');
    const azureOrg = localStorage.getItem('azure_org');
    const azureProject = localStorage.getItem('azure_project');
    const azureToken = localStorage.getItem('azure_token');

    try {
      const res = await fetch('/api/sync/by-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          externalId: syncIdInput.trim(),
          jiraUrl: jiraUrl || null,
          jiraEmail: jiraEmail || null,
          jiraToken: jiraToken || null,
          azureOrg: azureOrg || null,
          azureProject: azureProject || null,
          azureToken: azureToken || null
        })
      });

      if (res.ok) {
        setSyncByIdFeedback({
          type: 'success',
          message: `Demanda ${syncIdInput.trim()} importada com sucesso!`
        });
        if (onRefreshDemands) {
          await onRefreshDemands();
        }
        setTimeout(() => {
          setIsSyncByIdModalOpen(false);
        }, 1500);
      } else if (res.status === 404) {
        setSyncByIdFeedback({
          type: 'warning',
          message: "Demanda não encontrada. Verifique o ID e tente novamente."
        });
      } else {
        setSyncByIdFeedback({
          type: 'error',
          message: "Não foi possível conectar ao serviço. Tente novamente em instantes."
        });
      }
    } catch (err) {
      console.error(err);
      setSyncByIdFeedback({
        type: 'error',
        message: "Não foi possível conectar ao serviço. Tente novamente em instantes."
      });
    } finally {
      setSyncByIdLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Erro ao carregar projetos:", e);
    }
  };

  const handleOpenManualModal = () => {
    fetchProjects();
    setNewDemandTitle('');
    setNewDemandProject('');
    setIsManualModalOpen(true);
  };

  const handleCreateManualDemand = async (e) => {
    e.preventDefault();
    if (!newDemandTitle.trim()) return;
    try {
      const res = await fetch('/api/demands/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDemandTitle,
          project_name: newDemandProject || null
        })
      });
      if (res.ok) {
        setIsManualModalOpen(false);
        if (onRefreshDemands) {
          onRefreshDemands();
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao criar demanda manual.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão ao criar demanda.");
    }
  };
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('All');
  const [itemTypeFilter, setItemTypeFilter] = useState('All');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [sortBy, setSortBy] = useState('updated-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Extrai todas as tags únicas
  const allTags = Array.from(new Set(demands.flatMap(d => d.tags)));
  // Extrai todos os status únicos
  const allStatuses = Array.from(new Set(demands.map(d => d.externalStatus).filter(Boolean)));
  // Extrai todos os tipos de item únicos
  const allTypes = Array.from(new Set(demands.map(d => d.itemType).filter(Boolean)));

  const handleSort = (field) => {
    if (field === 'id') {
      setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc');
    } else if (field === 'title') {
      setSortBy(sortBy === 'title-asc' ? 'title-desc' : 'title-asc');
    } else if (field === 'status') {
      setSortBy(sortBy === 'status-asc' ? 'status-desc' : 'status-asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field) => {
    if (field === 'id') {
      if (sortBy === 'id-asc') return <ArrowUp className="w-3.5 h-3.5 ml-1.5" />;
      if (sortBy === 'id-desc') return <ArrowDown className="w-3.5 h-3.5 ml-1.5" />;
    } else if (field === 'title') {
      if (sortBy === 'title-asc') return <ArrowUp className="w-3.5 h-3.5 ml-1.5" />;
      if (sortBy === 'title-desc') return <ArrowDown className="w-3.5 h-3.5 ml-1.5" />;
    } else if (field === 'status') {
      if (sortBy === 'status-asc') return <ArrowUp className="w-3.5 h-3.5 ml-1.5" />;
      if (sortBy === 'status-desc') return <ArrowDown className="w-3.5 h-3.5 ml-1.5" />;
    }
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
  };

  const filteredDemands = demands.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) || 
                          d.externalId.toLowerCase().includes(search.toLowerCase());
    const matchesOrigin = originFilter === 'All' || d.origin === originFilter;
    const matchesTag = !selectedTag || d.tags.includes(selectedTag);
    const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(d.externalStatus);
    const matchesItemType = itemTypeFilter === 'All' || d.itemType === itemTypeFilter;
    return matchesSearch && matchesOrigin && matchesTag && matchesStatus && matchesItemType;
  });

  const sortedDemands = [...filteredDemands].sort((a, b) => {
    if (sortBy === 'updated-desc') {
      return new Date(b.updatedAt.replace(' ', 'T')) - new Date(a.updatedAt.replace(' ', 'T'));
    }
    if (sortBy === 'updated-asc') {
      return new Date(a.updatedAt.replace(' ', 'T')) - new Date(b.updatedAt.replace(' ', 'T'));
    }
    if (sortBy === 'title-asc') {
      return a.title.localeCompare(b.title, 'pt-BR');
    }
    if (sortBy === 'title-desc') {
      return b.title.localeCompare(a.title, 'pt-BR');
    }
    if (sortBy === 'id-asc') {
      return a.externalId.localeCompare(b.externalId, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (sortBy === 'id-desc') {
      return b.externalId.localeCompare(a.externalId, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (sortBy === 'status-asc') {
      return (a.externalStatus || '').localeCompare(b.externalStatus || '', 'pt-BR');
    }
    if (sortBy === 'status-desc') {
      return (b.externalStatus || '').localeCompare(a.externalStatus || '', 'pt-BR');
    }
    return 0;
  });

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleOriginFilterChange = (e) => {
    setOriginFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleTagFilterChange = (e) => {
    setSelectedTag(e.target.value);
    setCurrentPage(1);
  };

  const handleSortByChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setOriginFilter('All');
    setItemTypeFilter('All');
    setSelectedTag('');
    setSelectedStatus([]);
    setSortBy('updated-desc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedDemands.length / itemsPerPage);
  const activePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDemands = sortedDemands.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm">
        {/* Linha Principal: Pesquisa e Controles Básicos */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 w-full lg:w-auto">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Buscar por título ou ID..."
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-white border border-slate-350 rounded-xl py-2.5 pl-10 pr-4 text-sm text-sicoob-text placeholder-slate-400 focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
              />
            </div>
            <button
              onClick={handleOpenManualModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sicoob-primary hover:bg-sicoob-secondary active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Demanda de Negócio
            </button>
            <button
              onClick={handleOpenSyncByIdModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-600 hover:text-sicoob-text text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-sm whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Adicionar Manualmente Demanda Jira/Azure
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Filtro por Origem */}
            <select
              value={originFilter}
              onChange={handleOriginFilterChange}
              className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
            >
              <option value="All">Origem</option>
              <option value="Jira">Jira Only</option>
              <option value="Azure">Azure DevOps</option>
              <option value="Negocio">Negócio (Manual)</option>
            </select>

            {/* Filtro por Tipo de Item */}
            <select
              value={itemTypeFilter}
              onChange={(e) => { setItemTypeFilter(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
            >
              <option value="All">Tipo de Item</option>
              {allTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {/* Filtro por Tags */}
            <select
              value={selectedTag}
              onChange={handleTagFilterChange}
              className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
            >
              <option value="">Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {/* Ordenação */}
            <select
              value={sortBy}
              onChange={handleSortByChange}
              className="bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
            >
              <option value="updated-desc">Última Sync (Recente)</option>
              <option value="updated-asc">Última Sync (Antigo)</option>
              <option value="title-asc">Título (A-Z)</option>
              <option value="title-desc">Título (Z-A)</option>
              <option value="id-asc">ID (Crescente)</option>
              <option value="id-desc">ID (Decrescente)</option>
              <option value="status-asc">Status (A-Z)</option>
              <option value="status-desc">Status (Z-A)</option>
            </select>

            {/* Limpar Filtros */}
            {(search || originFilter !== 'All' || itemTypeFilter !== 'All' || selectedTag || selectedStatus.length > 0 || sortBy !== 'updated-desc') && (
              <button
                onClick={handleClearFilters}
                className="p-2 text-slate-500 hover:text-sicoob-text bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                title="Limpar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Linha Secundária: Filtro de Status (Pills) */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mr-1">Status:</span>
          <div className="flex flex-wrap gap-1.5">
            {allStatuses.map(status => {
              const isActive = selectedStatus.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      setSelectedStatus(selectedStatus.filter(s => s !== status));
                    } else {
                      setSelectedStatus([...selectedStatus, status]);
                    }
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-sicoob-primary/10 text-sicoob-secondary border-sicoob-primary/30 hover:bg-sicoob-primary/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center">
                    ID / Origem
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    Demanda
                    {renderSortIcon('title')}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 transition-colors group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status Externo
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-6 py-4">Tipo de Item</th>
                <th className="px-6 py-4">Tags Locais</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-655">
              {paginatedDemands.length > 0 ? (
                paginatedDemands.map(demand => (
                  <tr
                    key={demand.externalId}
                    onClick={() => onSelectDemand(demand.externalId)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          demand.origin === 'Jira' ? 'bg-sky-500' :
                          demand.origin === 'Azure' ? 'bg-emerald-500' :
                          'bg-purple-500'
                        }`} />
                        <div>
                          <span className="font-bold text-sicoob-text block">{demand.externalId}</span>
                          <span className="text-xs text-slate-500 block">{demand.origin}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="truncate font-semibold text-sicoob-text group-hover:text-sicoob-primary transition-colors">
                        {demand.title}
                      </p>
                      {demand.project && (
                        <span className="inline-flex items-center text-[10px] font-bold bg-sicoob-primary/10 text-sicoob-secondary border border-sicoob-primary/20 px-2 py-0.5 rounded mt-1">
                          Projeto: {demand.project}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        demand.externalStatus === 'Concluído' || demand.externalStatus === 'Concluido' || demand.externalStatus === 'Done' || demand.externalStatus === 'Closed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Active' || demand.externalStatus === 'Em andamento'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {demand.externalStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg">
                        {demand.itemType || 'Outro'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {demand.tags.length > 0 ? (
                           demand.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-bold bg-sicoob-primary/10 text-sicoob-secondary border border-sicoob-primary/20 px-2 py-0.5 rounded-md">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button className="text-slate-400 group-hover:text-sicoob-primary group-hover:translate-x-1 transition-all p-1">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-550">
                    <Inbox className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    Nenhuma demanda encontrada para os critérios selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {sortedDemands.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-550 select-none bg-slate-50/50">
            <div>
              Exibindo <span className="font-semibold text-sicoob-text">{Math.min(startIndex + 1, sortedDemands.length)}</span> a{' '}
              <span className="font-semibold text-sicoob-text">{Math.min(endIndex, sortedDemands.length)}</span> de{' '}
              <span className="font-semibold text-sicoob-text">{sortedDemands.length}</span> demandas
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-550 hover:text-sicoob-text hover:border-slate-350 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const isNear = Math.abs(page - activePage) <= 1;
                  const isFirstOrLast = page === 1 || page === totalPages;
                  
                  if (!isNear && !isFirstOrLast) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={`ell-${page}`} className="px-1.5 text-slate-400">...</span>;
                    }
                    return null;
                  }
                  
                  const isCurrent = page === activePage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-8 h-8 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                        isCurrent
                          ? 'bg-sicoob-primary text-white border-sicoob-primary'
                          : 'bg-white text-slate-600 border-slate-200 hover:text-sicoob-text hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              
              <button
                type="button"
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-550 hover:text-sicoob-text hover:border-slate-355 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Criar Demanda Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsManualModalOpen(false)} />
          <div className="relative bg-white border border-slate-250 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-sicoob-text">Nova Demanda de Negócio</h3>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateManualDemand} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold uppercase">Título da Demanda</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Criar Nova Regra de Repasse"
                  value={newDemandTitle}
                  onChange={e => setNewDemandTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold uppercase">Projeto Vinculado</label>
                <select
                  value={newDemandProject}
                  onChange={e => setNewDemandProject(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary"
                >
                  <option value="">Nenhum (Sem vínculo)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary text-white rounded-xl text-xs font-semibold"
                >
                  Criar Demanda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sincronização por ID */}
      {isSyncByIdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsSyncByIdModalOpen(false)} />
          <div className="relative bg-white border border-slate-250 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-sicoob-text">Adicionar por ID</h3>
              <button 
                onClick={() => setIsSyncByIdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSyncById} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 font-bold uppercase">ID do Jira ou do Azure DevOps</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SGRVDI-2262 (Jira) ou 2329 (Azure)"
                  value={syncIdInput}
                  onChange={e => setSyncIdInput(e.target.value)}
                  disabled={syncByIdLoading}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary disabled:opacity-55"
                />
              </div>

              {syncByIdFeedback.type && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed border ${
                  syncByIdFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  syncByIdFeedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {syncByIdFeedback.message}
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSyncByIdModalOpen(false)}
                  disabled={syncByIdLoading}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold disabled:opacity-50 border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={syncByIdLoading || !syncIdInput.trim()}
                  className="px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {syncByIdLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Sincronizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
