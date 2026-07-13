import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, Edit, Trash2, X, RefreshCw, AlertTriangle } from 'lucide-react';

export default function PortfolioView({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [targetGoLive, setTargetGoLive] = useState('');
  const [healthStatus, setHealthStatus] = useState('Verde');
  const [progress, setProgress] = useState(0);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error("Erro ao carregar projetos:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (project = null) => {
    setErrorMsg('');
    if (project) {
      setEditingProject(project);
      setName(project.name);
      setSponsor(project.sponsor || '');
      setTargetGoLive(project.target_go_live || '');
      setHealthStatus(project.health_status || 'Verde');
      setProgress(project.progress || 0);
      setExecutiveSummary(project.executive_summary || '');
    } else {
      setEditingProject(null);
      setName('');
      setSponsor('');
      setTargetGoLive('');
      setHealthStatus('Verde');
      setProgress(0);
      setExecutiveSummary('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('O nome do projeto é obrigatório.');
      return;
    }

    const payload = {
      name: name.trim(),
      sponsor: sponsor.trim() || null,
      target_go_live: targetGoLive.trim() || null,
      health_status: healthStatus,
      progress: parseInt(progress, 10),
      executive_summary: executiveSummary.trim() || null
    };

    try {
      let url = '/api/projects';
      let method = 'POST';

      if (editingProject) {
        url = `/api/projects/${editingProject.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchProjects();
        handleCloseModal();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || 'Ocorreu um erro ao salvar o projeto.');
      }
    } catch (e) {
      console.error("Erro ao salvar projeto:", e);
      setErrorMsg('Erro de conexão com o servidor.');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta iniciativa do portfólio?')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchProjects();
      } else {
        alert('Erro ao excluir projeto.');
      }
    } catch (e) {
      console.error("Erro ao excluir projeto:", e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-sicoob-text tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-sicoob-primary" /> Portfólio Executivo (PPM)
          </h2>
          <p className="text-sm text-slate-500">Acompanhamento e status report executivo das iniciativas estratégicas</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-sicoob-primary hover:bg-sicoob-secondary active:scale-95 transition-all shadow-sm w-fit"
        >
          <Plus className="w-4 h-4" /> Nova Iniciativa
        </button>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-sicoob-primary" />
          <span>Carregando portfólio de projetos...</span>
        </div>
      ) : projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-sicoob-primary/50 transition-all duration-300 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              {/* Left Column: Project Name & Sponsor */}
              <div className="flex-1 min-w-[200px]">
                <h3 className="text-lg font-bold text-sicoob-text tracking-tight">{proj.name}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <span>Sponsor:</span>
                  <span className="text-sicoob-text font-bold">{proj.sponsor || 'Não definido'}</span>
                </p>
              </div>

              {/* Center Column: Progress & Go-live */}
              <div className="flex-1 min-w-[250px] space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Progresso da Iniciativa</span>
                  <span className="text-sicoob-primary font-bold">{proj.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                  <div
                    className="bg-sicoob-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>Previsão de Lançamento:</span>
                  <span className="text-slate-700 font-bold">{proj.target_go_live || 'Sem previsão'}</span>
                </p>
              </div>

              {/* Right Column: Health Status & Executive Summary */}
              <div className="flex-[1.5] min-w-[280px] flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Health Badge */}
                <div className="shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    proj.health_status === 'Verde' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    proj.health_status === 'Amarelo' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      proj.health_status === 'Verde' ? 'bg-emerald-500' :
                      proj.health_status === 'Amarelo' ? 'bg-amber-500' :
                      'bg-rose-500'
                    }`} />
                    {proj.health_status}
                  </span>
                </div>

                {/* Summary Text */}
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-[85px] overflow-y-auto text-xs text-slate-600 leading-relaxed custom-scrollbar">
                  {proj.executive_summary || 'Nenhum resumo ou impedimento registrado para esta semana.'}
                </div>
              </div>

              {/* Actions Column */}
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => onSelectProject(proj.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sicoob-primary hover:bg-sicoob-secondary text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                  title="Ver Visão Geral"
                >
                  Ver Visão Geral
                </button>
                <button
                  onClick={() => handleOpenModal(proj)}
                  className="flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-550 hover:text-sicoob-primary hover:border-slate-350 transition-all active:scale-95 shadow-xs"
                  title="Editar Iniciativa"
                >
                  <Edit className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => handleDeleteProject(proj.id)}
                  className="flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-250 hover:bg-rose-50 text-slate-550 hover:text-rose-600 transition-all active:scale-95 shadow-xs"
                  title="Excluir Iniciativa"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 max-w-lg mx-auto shadow-sm">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-sicoob-text text-sm">Nenhuma iniciativa no portfólio</p>
          <p className="text-xs mt-1 mb-6 text-slate-500">Cadastre projetos estratégicos para acompanhar o progresso e o status semanal de saúde.</p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sicoob-primary hover:bg-sicoob-secondary text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Cadastrar Primeiro Projeto
          </button>
        </div>
      )}

      {/* Creation / Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-bold text-lg text-sicoob-text">
                {editingProject ? 'Editar Iniciativa' : 'Nova Iniciativa'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-700">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Project Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Nome da Iniciativa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Novo Seguro de Vida"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-350 rounded-xl py-2.5 px-3.5 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sponsor */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Sponsor / Área</label>
                    <input
                      type="text"
                      placeholder="Ex: Diretoria MAG"
                      value={sponsor}
                      onChange={(e) => setSponsor(e.target.value)}
                      className="w-full bg-white border border-slate-350 rounded-xl py-2.5 px-3.5 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>

                  {/* Target Go-live */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Previsão Lançamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Dez/2026 ou 15/12/2026"
                      value={targetGoLive}
                      onChange={(e) => setTargetGoLive(e.target.value)}
                      className="w-full bg-white border border-slate-350 rounded-xl py-2.5 px-3.5 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Health Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Status de Saúde</label>
                    <select
                      value={healthStatus}
                      onChange={(e) => setHealthStatus(e.target.value)}
                      className="w-full bg-white border border-slate-350 rounded-xl py-2.5 px-3.5 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors appearance-none"
                    >
                      <option value="Verde">🟢 Verde (Em dia)</option>
                      <option value="Amarelo">🟡 Amarelo (Atenção / Risco)</option>
                      <option value="Vermelho">🔴 Vermelho (Impedido / Atrasado)</option>
                    </select>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Progresso</label>
                      <span className="text-xs font-bold text-sicoob-primary">{progress}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={progress}
                        onChange={(e) => setProgress(parseInt(e.target.value, 10))}
                        className="flex-1 accent-sicoob-primary h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer border border-slate-250"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={progress}
                        onChange={(e) => {
                          const val = Math.min(Math.max(parseInt(e.target.value, 10) || 0, 0), 100);
                          setProgress(val);
                        }}
                        className="w-16 bg-white border border-slate-350 rounded-xl py-1.5 text-center text-sm text-sicoob-text"
                      />
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Resumo Executivo & Impedimentos</label>
                  <textarea
                    rows="3"
                    placeholder="Descreva o andamento semanal, principais marcos ou impedimentos críticos..."
                    value={executiveSummary}
                    onChange={(e) => setExecutiveSummary(e.target.value)}
                    className="w-full bg-white border border-slate-350 rounded-xl py-2.5 px-3.5 text-sm text-sicoob-text focus:outline-none focus:border-sicoob-primary focus:ring-1 focus:ring-sicoob-primary transition-colors resize-none custom-scrollbar"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-655 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-sicoob-primary hover:bg-sicoob-secondary text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                >
                  {editingProject ? 'Salvar Alterações' : 'Criar Iniciativa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
