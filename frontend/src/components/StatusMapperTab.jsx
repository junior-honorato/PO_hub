import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';

export default function StatusMapperTab() {
  const [mappings, setMappings] = useState([]);
  const [origin, setOrigin] = useState('Jira');
  const [externalStatus, setExternalStatus] = useState('');
  const [mappedStatus, setMappedStatus] = useState('Backlog');
  const [loading, setLoading] = useState(false);

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/status-mappings');
      if (res.ok) {
        const data = await res.json();
        setMappings(data);
      }
    } catch (e) {
      console.error("Erro ao buscar mapeamentos de status:", e);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleAddMapping = async (e) => {
    e.preventDefault();
    if (!externalStatus.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/status-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          external_status: externalStatus.trim(),
          mapped_status: mappedStatus
        })
      });
      if (res.ok) {
        setExternalStatus('');
        fetchMappings();
      } else {
        const err = await res.json();
        alert(err.detail || "Erro ao salvar mapeamento.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de rede ao salvar mapeamento.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMapping = async (id) => {
    if (!window.confirm("Deseja realmente excluir este mapeamento?")) return;

    try {
      const res = await fetch(`/api/status-mappings/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchMappings();
      } else {
        alert("Erro ao excluir mapeamento.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir mapeamento.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <form onSubmit={handleAddMapping} className="bg-white border border-slate-200 p-4 rounded-xl space-y-4 shadow-sm">
        <h4 className="text-xs font-bold text-sicoob-text uppercase tracking-wider">Novo Mapeamento de Status</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase">Origem</label>
            <select
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
            >
              <option value="Jira">Jira</option>
              <option value="Azure">Azure DevOps</option>
              <option value="Negocio">Negócio (Local)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase">Status Externo</label>
            <input
              type="text"
              placeholder="Ex: In Progress, Approved"
              value={externalStatus}
              onChange={e => setExternalStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase">Categoria Unificada</label>
            <select
              value={mappedStatus}
              onChange={e => setMappedStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
            >
              <option value="Backlog">Backlog</option>
              <option value="Em Refinamento">Em Refinamento</option>
              <option value="Desenvolvimento">Em Desenvolvimento</option>
              <option value="Homologação">Homologação</option>
              <option value="Entregue">Entregue</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sicoob-primary hover:bg-sicoob-secondary rounded-lg text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Regra
          </button>
        </div>
      </form>

      {/* Lista de Mapeamentos */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Mapeamentos Ativos</h4>
        {mappings.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Status Original (Filtro)</th>
                    <th className="px-4 py-3">Categoria Unificada</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mappings.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 text-slate-700 transition-all">
                      <td className="px-4 py-2.5 font-semibold text-[10px]">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-bold select-none ${
                          m.origin === 'Jira' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          m.origin === 'Azure' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}>
                          {m.origin === 'Azure' ? 'Azure DevOps' : m.origin}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium font-mono">{m.external_status}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] select-none ${
                          m.mapped_status === 'Backlog' ? 'bg-slate-100 text-slate-655 border border-slate-200' :
                          m.mapped_status === 'Em Refinamento' ? 'bg-purple-50 text-purple-755 border border-purple-100' :
                          m.mapped_status === 'Desenvolvimento' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          m.mapped_status === 'Homologação' ? 'bg-blue-50 text-blue-755 border border-blue-100' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${
                            m.mapped_status === 'Backlog' ? 'bg-slate-400' :
                            m.mapped_status === 'Em Refinamento' ? 'bg-purple-450' :
                            m.mapped_status === 'Desenvolvimento' ? 'bg-amber-450' :
                            m.mapped_status === 'Homologação' ? 'bg-blue-400' :
                            'bg-emerald-450'
                          }`} />
                          {m.mapped_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteMapping(m.id)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all cursor-pointer"
                          title="Remover regra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 border-dashed rounded-xl text-slate-500 space-y-2 shadow-xs">
            <ShieldAlert className="w-8 h-8 text-slate-350" />
            <span className="text-xs text-slate-400">Nenhum mapeamento de status cadastrado localmente.</span>
          </div>
        )}
      </div>
    </div>
  );
}
