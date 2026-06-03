import React, { useState } from 'react';
import { Search, X, Inbox, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export default function DemandTable({ demands, onSelectDemand }) {
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('All');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [sortBy, setSortBy] = useState('updated-desc');

  // Extrai todas as tags únicas
  const allTags = Array.from(new Set(demands.flatMap(d => d.tags)));
  // Extrai todos os status únicos
  const allStatuses = Array.from(new Set(demands.map(d => d.externalStatus).filter(Boolean)));

  const handleSort = (field) => {
    if (field === 'id') {
      setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc');
    } else if (field === 'title') {
      setSortBy(sortBy === 'title-asc' ? 'title-desc' : 'title-asc');
    } else if (field === 'status') {
      setSortBy(sortBy === 'status-asc' ? 'status-desc' : 'status-asc');
    }
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
    return matchesSearch && matchesOrigin && matchesTag && matchesStatus;
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

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/20 p-4 border border-slate-800/60 rounded-2xl backdrop-blur-sm">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por título ou ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro por Origem */}
          <select
            value={originFilter}
            onChange={e => setOriginFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="All">Origem</option>
            <option value="Jira">Jira Only</option>
            <option value="Azure">Azure DevOps</option>
          </select>

          {/* Filtro por Tags */}
          <select
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="">Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* Filtro por Status (Pills) */}
          <div className="flex flex-wrap items-center gap-1.5 border border-slate-800/60 bg-slate-950/40 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status:</span>
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
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-400 border-brand-500/40 hover:bg-brand-500/30'
                      : 'bg-slate-900/40 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
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
          {(search || originFilter !== 'All' || selectedTag || selectedStatus.length > 0 || sortBy !== 'updated-desc') && (
            <button
              onClick={() => { setSearch(''); setOriginFilter('All'); setSelectedTag(''); setSelectedStatus([]); setSortBy('updated-desc'); }}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-xl transition-colors"
              title="Limpar filtros"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900/20 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/30 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none">
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors group"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center">
                    ID / Origem
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors group"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center">
                    Demanda
                    {renderSortIcon('title')}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-800/40 transition-colors group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status Externo
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="px-6 py-4">Tags Locais</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
              {sortedDemands.length > 0 ? (
                sortedDemands.map(demand => (
                  <tr
                    key={demand.externalId}
                    onClick={() => onSelectDemand(demand.externalId)}
                    className="hover:bg-slate-900/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          demand.origin === 'Jira' ? 'bg-sky-400' : 'bg-emerald-400'
                        }`} />
                        <div>
                          <span className="font-semibold text-white block">{demand.externalId}</span>
                          <span className="text-xs text-slate-500 block">{demand.origin}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="truncate font-medium text-slate-200 group-hover:text-white transition-colors">
                        {demand.title}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        demand.externalStatus === 'Concluído' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Done'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {demand.externalStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {demand.tags.length > 0 ? (
                          demand.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-md">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button className="text-slate-400 group-hover:text-brand-400 group-hover:translate-x-1 transition-all p-1">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-slate-500">
                    <Inbox className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                    Nenhuma demanda encontrada para os critérios selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
