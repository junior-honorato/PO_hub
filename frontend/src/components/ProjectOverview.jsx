import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Briefcase, Calendar, Target, Activity, FileText, CheckCircle2, Clock, Sparkles, Edit3, AlertCircle, Play, X, Download, Lock, Tag, Link } from 'lucide-react';
import RoadmapGraphView from './RoadmapGraphView';

export default function ProjectOverview({ projectId, onBack, onSelectDemand }) {
  const cleanTitle = (title, extId) => {
    let clean = title || '';
    clean = clean.replace(/^\[[A-Za-z0-9_-]+\]\s*/i, '');
    if (extId) {
      const escapedId = extId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`^${escapedId}[:\\s-]*`, 'i');
      clean = clean.replace(regex, '');
    }
    return clean.trim();
  };

  const getStatusBadgeClass = (status) => {
    if (!status) return 'bg-slate-100 text-slate-500 border border-slate-300/60';
    const s = status.trim();
    if (s === 'Backlog') return 'bg-slate-100 text-slate-500 border border-slate-300/60';
    if (s === 'Em Refinamento') return 'bg-purple-50 text-purple-700 border border-purple-100';
    if (s === 'Desenvolvimento') return 'bg-amber-500/10 text-amber-455 border border-amber-500/20';
    if (s === 'Homologação' || s === 'Homologaǜo' || s === 'Homologacao') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    if (s === 'Entregue') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    return 'bg-amber-50 text-amber-700 border border-amber-100';
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('operational'); // 'operational', 'report_tech', or 'report_biz'
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [aiReport, setAiReport] = useState('');
  const [aiGeneratedAt, setAiGeneratedAt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copiedAi, setCopiedAi] = useState(false);

  const handleFetchAiSummary = async (force = false) => {
    if (!data?.project?.name) return;
    setIsGeneratingAi(true);
    setAiError('');
    if (force) {
      setAiReport('');
    }
    try {
      const res = await fetch('/api/projects/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: data.project.name,
          demand_ids: null,
          force_refresh: force
        })
      });
      if (res.ok) {
        const result = await res.json();
        setAiReport(result.report);
        setAiGeneratedAt(result.generated_at || '');
      } else {
        const errData = await res.json();
        setAiError(errData.detail || 'Não foi possível gerar o resumo com IA.');
      }
    } catch (err) {
      console.error(err);
      setAiError('Erro de conexão ao tentar gerar o resumo com IA.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyAiReport = async () => {
    try {
      await navigator.clipboard.writeText(aiReport);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai_summary' && !aiReport && data?.project?.name) {
      handleFetchAiSummary(false);
    }
  }, [activeTab, data]);

  const [editSummary, setEditSummary] = useState(false);
  const [summaryValue, setSummaryValue] = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [saving, setSaving] = useState(false);

  const getTimelineMonths = () => {
    const months = [];
    const date = new Date();
    date.setDate(1);
    for (let i = 0; i < 6; i++) {
      const d = new Date(date.getFullYear(), date.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }
    return months;
  };

  const getGanttPosition = (demand, months, fallbackIndex) => {
    if (!demand.planned_start_date || !demand.planned_end_date) {
      const startCol = (fallbackIndex % 4) + 1;
      const colSpan = Math.min(6 - startCol + 1, (fallbackIndex % 3) + 2);
      return { startCol, colSpan, isDefined: false };
    }
    try {
      const sDate = new Date(demand.planned_start_date + 'T00:00:00');
      const eDate = new Date(demand.planned_end_date + 'T23:59:59');
      const sYear = sDate.getFullYear();
      const sMonth = sDate.getMonth();
      const eYear = eDate.getFullYear();
      const eMonth = eDate.getMonth();
      const firstMonth = months[0];
      let startIdx = (sYear - firstMonth.year) * 12 + (sMonth - firstMonth.month);
      let endIdx = (eYear - firstMonth.year) * 12 + (eMonth - firstMonth.month);
      if (startIdx < 0) startIdx = 0;
      if (endIdx > 5) endIdx = 5;
      if (startIdx > 5) startIdx = 5;
      if (endIdx < startIdx) endIdx = startIdx;
      const startCol = startIdx + 1;
      const colSpan = endIdx - startIdx + 1;
      return { startCol, colSpan, isDefined: true };
    } catch (e) {
      const startCol = (fallbackIndex % 4) + 1;
      const colSpan = Math.min(6 - startCol + 1, (fallbackIndex % 3) + 2);
      return { startCol, colSpan, isDefined: false };
    }
  };

  const formatDateBR = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getTodayLinePosition = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return ((day / daysInMonth) * 100) / 6;
  };

  const timelineMonths = getTimelineMonths();

  const sortDemandsByDependency = (list) => {
    const visited = new Set();
    const sorted = [];
    
    // Group children by parentId for quick hierarchical lookup
    const childrenMap = {};
    list.forEach(d => {
      if (d.parentId) {
        if (!childrenMap[d.parentId]) {
          childrenMap[d.parentId] = [];
        }
        childrenMap[d.parentId].push(d);
      }
    });

    const visit = (demand) => {
      if (visited.has(demand.externalId)) return;
      visited.add(demand.externalId);
      sorted.push(demand);

      // 1. Visit children first to group them directly below the parent
      const children = childrenMap[demand.externalId] || [];
      children.forEach(child => {
        visit(child);
      });

      // 2. Visit blocker dependents
      const dependents = list.filter(d => 
        d.blockers && d.blockers.includes(demand.externalId)
      );
      for (const dep of dependents) {
        visit(dep);
      }
    };

    const idsInList = new Set(list.map(d => d.externalId));

    // First visit items that are true roots (no local parent and no local blockers)
    for (const demand of list) {
      const hasLocalParent = demand.parentId && idsInList.has(demand.parentId);
      const hasLocalBlockers = demand.blockers && demand.blockers.some(b => idsInList.has(b));
      if (!hasLocalParent && !hasLocalBlockers) {
        visit(demand);
      }
    }

    // Then visit items that are roots but might have blockers (still no local parent)
    for (const demand of list) {
      const hasLocalParent = demand.parentId && idsInList.has(demand.parentId);
      if (!hasLocalParent) {
        visit(demand);
      }
    }

    // Catch-all for any cyclic dependencies
    for (const demand of list) {
      if (!visited.has(demand.externalId)) {
        visit(demand);
      }
    }

    return sorted;
  };

  const ganttDemandsList = data?.demands
    ? sortDemandsByDependency(
        data.demands.filter(d => d.planned_start_date && d.planned_end_date)
      )
    : [];

  const idsInGantt = new Set(ganttDemandsList.map(d => d.externalId));

  const renderGanttTab = () => {
    const todayLinePos = getTodayLinePosition();
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 backdrop-blur-md flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-sicoob-text">Cronograma da Iniciativa</h3>
          <span className="text-xs text-slate-550 font-medium">Visualização Gantt com mapeamento de dependências</span>
        </div>
        
        <div className="overflow-x-auto">
          <div className="min-w-[700px] relative">
            {/* Linha indicadora do dia atual (Hoje) */}
            <div className="grid grid-cols-12 gap-2 absolute inset-0 pointer-events-none z-20">
              <div className="col-span-5" />
              <div className="col-span-7 relative h-full">
                <div 
                  className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500 pointer-events-none"
                  style={{ left: `${todayLinePos}%` }}
                >
                  <div className="absolute top-0 -translate-y-3/4 -translate-x-1/2 bg-red-500 text-[8px] text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase shadow-xs">
                    Hoje
                  </div>
                </div>
              </div>
            </div>

            {/* Cabeçalho da Timeline */}
            <div className="grid grid-cols-12 gap-2 pb-3 border-b border-slate-200 text-xs font-bold text-slate-550 uppercase tracking-wider">
              <div className="col-span-5">Demanda & Sub-Projeto</div>
              <div className="col-span-7 grid grid-cols-6 text-center">
                {timelineMonths.map((m, i) => (
                  <div key={i} className="border-l border-slate-100 px-1">{m.label}</div>
                ))}
              </div>
            </div>

            {/* Listagem de Demandas */}
            <div className="divide-y divide-slate-100">
              {ganttDemandsList.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 italic">
                  Nenhuma entrega deste projeto possui datas de início e fim preenchidas para exibição no cronograma.
                </div>
              ) : (
                ganttDemandsList.map((demand, index) => {
                  const tag = demand.itemType || demand.origin || 'Entrega';
                  const { startCol, colSpan, isDefined } = getGanttPosition(demand, timelineMonths, index);
                  const isBlocked = demand.blockers && demand.blockers.length > 0;
                  const hasLocalBlockers = demand.blockers && demand.blockers.some(b => idsInGantt.has(b));
                  const hasLocalParent = demand.parentId && idsInGantt.has(demand.parentId);

                  return (
                    <div
                      key={demand.externalId}
                      onClick={() => onSelectDemand && onSelectDemand(demand.externalId)}
                      className="grid grid-cols-12 gap-2 py-3.5 items-center hover:bg-slate-50/80 rounded-lg transition-colors cursor-pointer px-1"
                    >
                      <div className={`col-span-5 pr-3 space-y-1 relative ${(hasLocalBlockers || hasLocalParent) ? 'pl-6' : ''}`}>
                        {hasLocalBlockers ? (
                          <div className="absolute left-1 -top-3.5 bottom-1/2 w-3 border-l-2 border-b-2 border-amber-400/60 rounded-bl-md pointer-events-none" />
                        ) : hasLocalParent ? (
                          <div className="absolute left-1 -top-3.5 bottom-1/2 w-3 border-l-2 border-b-2 border-blue-400/60 rounded-bl-md pointer-events-none" />
                        ) : null}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Tag className="w-3 h-3 text-emerald-600" />
                            [{tag}]
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-500">
                            {demand.externalId}
                          </span>
                          {isDefined && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({formatDateBR(demand.planned_start_date)} a {formatDateBR(demand.planned_end_date)})
                            </span>
                          )}
                          {demand.parentId && (
                            <span 
                              className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                              title={`Sub-item do Epic/Feature: ${demand.parentId}`}
                            >
                              <Link className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              Pai: {demand.parentId}
                            </span>
                          )}
                          {isBlocked && (
                            <span 
                              className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                              title={`Esta demanda depende de: ${demand.blockers.join(', ')}`}
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              Depende de {demand.blockers.join(', ')}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-sicoob-text line-clamp-1 leading-snug">
                          {demand.title}
                        </h4>
                      </div>

                      <div className="col-span-7 grid grid-cols-6 items-center relative h-8">
                        <div
                          className={`h-6 rounded-lg text-white text-[10px] font-bold px-2.5 flex items-center justify-center shadow-xs truncate ${
                            isDefined
                              ? isBlocked
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 border border-amber-600/30'
                                : 'bg-gradient-to-r from-sicoob-primary to-teal-500'
                              : 'bg-gradient-to-r from-slate-400 to-slate-500 opacity-80 border border-dashed border-slate-300'
                          }`}
                          style={{
                            gridColumnStart: startCol,
                            gridColumnEnd: `span ${colSpan}`
                          }}
                        >
                          <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded text-white shrink-0 flex items-center gap-1">
                            {isBlocked && <Lock className="w-2.5 h-2.5" />}
                            {isDefined ? (demand.mappedStatus || demand.externalStatus || 'Ativa') : 'Datas Pendentes'}
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
    );
  };

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

  useEffect(() => {
    if (projectId) {
      fetchOverview();
    }
  }, [projectId]);

  // Handle ESC key to exit Presentation Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle DOM side effects for Presentation Mode
  useEffect(() => {
    if (isPresentationMode) {
      document.body.classList.add('presentation-mode');
    } else {
      document.body.classList.remove('presentation-mode');
    }
    return () => {
      document.body.classList.remove('presentation-mode');
    };
  }, [isPresentationMode]);

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
  
  const exportToPPTX = () => {
      if (!window.PptxGenJS) {
        alert("A biblioteca PowerPoint ainda não foi carregada. Aguarde um instante.");
        return;
      }
      const pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      // Titulo do Slide
      const baseTitle = activeTab === 'report_tech' ? "REPORT EXECUTIVO - TECNOLOGIA" : "REPORT EXECUTIVO - NEGÓCIOS";
      const reportTitle = project.name ? `${baseTitle} - ${project.name.toUpperCase()}` : baseTitle;

      // Data & Sponsor
      const todayStr = new Date().toLocaleDateString('pt-BR');
      const headerInfo = project.sponsor ? `Data: ${todayStr} | Sponsor: ${project.sponsor}` : `Data: ${todayStr}`;

      // Definir Master Slide com estilo Premium Sicoob Light
      pptx.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { fill: "F8F9FA" },
        slideNumber: { x: 12.8, y: 7.1, color: "007A71", fontSize: 9 }
      });

      const addHeaderToSlide = (slide) => {
        const rectShape = pptx.ShapeType?.rect || pptx.shapes?.RECTANGLE || 'rect';

        // 1. Retângulo de fundo escuro do cabeçalho
        slide.addShape(rectShape, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 0.8,
          fill: { color: "00AE9D" },
          line: { type: "none" }
        });

        // 2. Linha divisória
        slide.addShape(rectShape, {
          x: 0,
          y: 0.8,
          w: 13.33,
          h: 0.02,
          fill: { color: "007A71" },
          line: { type: "none" }
        });

        // 3. Título editável
        slide.addText(reportTitle, {
          x: 0.5,
          y: 0.15,
          w: 7.0,
          h: 0.5,
          fontSize: 18,
          color: "FFFFFF",
          bold: true,
          fontFace: "Calibri"
        });

        // 4. Data e Sponsor editável
        slide.addText(headerInfo, {
          x: 7.8,
          y: 0.20,
          w: 5.0,
          h: 0.4,
          fontSize: 9.5,
          color: "FFFFFF",
          align: "right",
          fontFace: "Calibri"
        });
      };

      const dataRows = [];

      if (activeTab === 'report_tech') {
        techEpics.forEach(epic => {
          const children = epicMap[epic.externalId] || [];
          const visibleChildren = children.filter(shouldShowInExecutiveReport);

          const notes = [];
          if (epic.current_status_notes?.trim()) {
            notes.push(`Status [${epic.externalId}]: ${epic.current_status_notes.trim()}`);
          }
          if (epic.blocker_notes?.trim()) {
            notes.push(`Impedimento [${epic.externalId}]: ${epic.blocker_notes.trim()}`);
          }
          if (isDemandBlocked(epic)) {
            let bList = epic.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
            const bMsg = bStr ? `Bloqueado por: ${bStr}` : `Bloqueado (Status: ${epic.mappedStatus || epic.externalStatus})`;
            notes.push(`Impedimento [${epic.externalId}]: ${bMsg}`);
          }

          visibleChildren.forEach(c => {
            if (c.current_status_notes?.trim()) {
              notes.push(`Status [${c.externalId}]: ${c.current_status_notes.trim()}`);
            }
            if (c.blocker_notes?.trim()) {
              notes.push(`Impedimento [${c.externalId}]: ${c.blocker_notes.trim()}`);
            }
            if (isDemandBlocked(c)) {
              let bList = c.blockers;
              if (typeof bList === 'string') {
                try { bList = JSON.parse(bList); } catch(e) { bList = []; }
              }
              const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
              const bMsg = bStr ? `Bloqueado por: ${bStr}` : `Bloqueado (Status: ${c.mappedStatus || c.externalStatus})`;
              notes.push(`Impedimento [${c.externalId}]: ${bMsg}`);
            }
          });

          if (visibleChildren.length === 0 && notes.length === 0 && !shouldShowInExecutiveReport(epic)) {
            return;
          }

          const col1 = cleanTitle(epic.title, epic.externalId);
          const col2 = epic.mappedStatus || epic.externalStatus || "Não Iniciada";
          const col3 = notes.map(n => `• ${n}`).join('\n') || "-";

          const maxLines = Math.max(
            col1.split('\n').length,
            col2.split('\n').length,
            col3.split('\n').length
          );

          dataRows.push({ col1, col2, col3, maxLines });
        });

        // Standalone demands
        const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
        if (visibleStandalone.length > 0) {
          const notes = [];
          visibleStandalone.forEach(c => {
            if (c.current_status_notes?.trim()) {
              notes.push(`Status [${c.externalId}]: ${c.current_status_notes.trim()}`);
            }
            if (c.blocker_notes?.trim()) {
              notes.push(`Impedimento [${c.externalId}]: ${c.blocker_notes.trim()}`);
            }
            if (isDemandBlocked(c)) {
              let bList = c.blockers;
              if (typeof bList === 'string') {
                try { bList = JSON.parse(bList); } catch(e) { bList = []; }
              }
              const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
              const bMsg = bStr ? `Bloqueado por: ${bStr}` : `Bloqueado (Status: ${c.mappedStatus || c.externalStatus})`;
              notes.push(`Impedimento [${c.externalId}]: ${bMsg}`);
            }
          });

          const col1 = "Demandas Independentes\n[Sem Eixo Associado]";
          const col2 = "-";
          const col3 = notes.map(n => `• ${n}`).join('\n') || "-";

          const maxLines = Math.max(
            col1.split('\n').length,
            col2.split('\n').length,
            col3.split('\n').length
          );

          dataRows.push({ col1, col2, col3, maxLines });
        }
      } else {
        // report_biz
        techEpics.forEach(epic => {
          const children = bizEpicMap[epic.externalId] || [];

          const notes = [];
          if (epic.current_status_notes?.trim()) {
            notes.push(`Status [${epic.externalId}]: ${epic.current_status_notes.trim()}`);
          }
          if (epic.blocker_notes?.trim()) {
            notes.push(`Impedimento [${epic.externalId}]: ${epic.blocker_notes.trim()}`);
          }
          if (isDemandBlocked(epic)) {
            notes.push(`Impedimento [${epic.externalId}]: Travada`);
          }
          children.forEach(c => {
            if (c.current_status_notes?.trim()) {
              notes.push(`Status [${c.externalId}]: ${c.current_status_notes.trim()}`);
            }
            if (c.blocker_notes?.trim()) {
              notes.push(`Impedimento [${c.externalId}]: ${c.blocker_notes.trim()}`);
            }
            if (isDemandBlocked(c)) {
              let bList = c.blockers;
              if (typeof bList === 'string') {
                try { bList = JSON.parse(bList); } catch(e) { bList = []; }
              }
              const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
              notes.push(`Impedimento [${c.externalId}]: Impedida${bStr}`);
            }
          });

          if (children.length === 0 && notes.length === 0) return;

          const col1 = cleanTitle(epic.title, epic.externalId);
          const col2 = epic.mappedStatus || epic.externalStatus || "Não Iniciada";
          const col3 = notes.map(n => `• ${n}`).join('\n') || "-";

          const maxLines = Math.max(
            col1.split('\n').length,
            col2.split('\n').length,
            col3.split('\n').length
          );

          dataRows.push({ col1, col2, col3, maxLines });
        });

        if (standaloneBizDemands.length > 0) {
          const notes = [];
          standaloneBizDemands.forEach(c => {
            if (c.current_status_notes?.trim()) {
              notes.push(`Status [${c.externalId}]: ${c.current_status_notes.trim()}`);
            }
            if (c.blocker_notes?.trim()) {
              notes.push(`Impedimento [${c.externalId}]: ${c.blocker_notes.trim()}`);
            }
            if (isDemandBlocked(c)) {
              let bList = c.blockers;
              if (typeof bList === 'string') {
                try { bList = JSON.parse(bList); } catch(e) { bList = []; }
              }
              const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
              notes.push(`Impedimento [${c.externalId}]: Impedida${bStr}`);
            }
          });

          const col1 = "Demandas de Negócio Avulsas\n[Sem Eixo Associado]";
          const col2 = "-";
          const col3 = notes.map(n => `• ${n}`).join('\n') || "-";

          const maxLines = Math.max(
            col1.split('\n').length,
            col2.split('\n').length,
            col3.split('\n').length
          );

          dataRows.push({ col1, col2, col3, maxLines });
        }
      }

      // Configuração de Paginação Manual para manter as linhas inteiras
      const headerRow = [
        { text: "EIXO / EPIC", options: { fill: { color: "00AE9D" }, color: "FFFFFF", bold: true, fontSize: 10, fontFace: "Calibri", border: { type: "solid", color: "E2E8F0", pt: 1 } } },
        { text: "SITUAÇÃO", options: { fill: { color: "00AE9D" }, color: "FFFFFF", bold: true, fontSize: 10, fontFace: "Calibri", border: { type: "solid", color: "E2E8F0", pt: 1 } } },
        { text: "OBSERVAÇÕES", options: { fill: { color: "00AE9D" }, color: "FFFFFF", bold: true, fontSize: 10, fontFace: "Calibri", border: { type: "solid", color: "E2E8F0", pt: 1 } } }
      ];

      let currentSlide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
      addHeaderToSlide(currentSlide);
      let currentSlideRows = [headerRow];
      let currentLinesCount = 0;
      const MAX_LINES_PER_SLIDE = 26; // Limite conservador para garantir que a linha inteira cabe sem quebra de página

      dataRows.forEach((row, index) => {
        const rowLines = Math.max(row.maxLines, 2); // Assume pelo menos 2 linhas de altura por questão de padding

        // Se adicionar esta linha estoura o limite do slide, salva a tabela atual e cria um novo slide
        if (currentLinesCount + rowLines > MAX_LINES_PER_SLIDE && currentSlideRows.length > 1) {
          currentSlide.addTable(currentSlideRows, {
            x: 0.5,
            y: 1.1,
            w: 12.3,
            colW: [4.3, 2.5, 5.5]
          });

          currentSlide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
          addHeaderToSlide(currentSlide);
          currentSlideRows = [headerRow];
          currentLinesCount = 0;
        }

        const bgColor = index % 2 === 0 ? "FFFFFF" : "F8F9FA";
        const cellOpts = (text) => ({
          text: text || "-",
          options: {
            fill: { color: bgColor },
            color: "333333",
            fontSize: 8.5,
            fontFace: "Calibri",
            valign: "top",
            border: { type: "solid", color: "E2E8F0", pt: 0.5 },
            margin: [4, 4, 4, 4]
          }
        });

        currentSlideRows.push([
          cellOpts(row.col1),
          cellOpts(row.col2),
          cellOpts(row.col3)
        ]);

        currentLinesCount += rowLines;
      });

      // Adiciona a última tabela acumulada ao slide final
      if (currentSlideRows.length > 1) {
        currentSlide.addTable(currentSlideRows, {
          x: 0.5,
          y: 1.1,
          w: 12.3,
          colW: [4.3, 2.5, 5.5]
        });
      }

      const cleanProjName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = activeTab === 'report_tech' ? `Report_Executivo_Tecnologia_${cleanProjName}.pptx` : `Report_Executivo_Negocios_${cleanProjName}.pptx`;
      pptx.writeFile({ fileName: fileName });
  };

  const exportToExcel = () => {
    const baseTitle = activeTab === 'report_tech' ? "REPORT EXECUTIVO - TECNOLOGIA" : "REPORT EXECUTIVO - NEGÓCIOS";
    const reportTitle = project.name ? `${baseTitle} - ${project.name.toUpperCase()}` : baseTitle;

    const todayStr = new Date().toLocaleDateString('pt-BR');
    const headerInfo = project.sponsor ? `Data: ${todayStr} | Sponsor: ${project.sponsor}` : `Data: ${todayStr}`;

    const rowsHtmlArray = [];

    const addGroupToRows = (epicName, epicStatus, childrenList, statusNotesText, impedimentsText, index) => {
      const N = childrenList.length || 1;
      const isZebra = index % 2 === 1 ? 'class="zebra"' : '';
      const escapeHtml = (text) => {
        if (!text) return '';
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Row 1
      let row1 = `<tr ${isZebra}>`;
      row1 += `<td rowspan="${N}" style="vertical-align: middle; text-align: center;">${escapeHtml(epicName)}</td>`;
      row1 += `<td rowspan="${N}" style="vertical-align: middle; text-align: center;">${escapeHtml(epicStatus)}</td>`;

      if (childrenList.length > 0) {
        row1 += `<td>${escapeHtml(`[${childrenList[0].externalId}] ${childrenList[0].title}`)}</td>`;
        row1 += `<td>${escapeHtml(childrenList[0].mappedStatus || childrenList[0].externalStatus || '-')}</td>`;
      } else {
        row1 += `<td>Nenhuma demanda ativa vinculada.</td>`;
        row1 += `<td>-</td>`;
      }

      row1 += `<td rowspan="${N}">${escapeHtml(statusNotesText).replace(/\n/g, '<br>')}</td>`;
      row1 += `<td rowspan="${N}">${escapeHtml(impedimentsText).replace(/\n/g, '<br>')}</td>`;
      row1 += `</tr>`;
      rowsHtmlArray.push(row1);

      // Rows 2 to N
      for (let i = 1; i < childrenList.length; i++) {
        let rowI = `<tr ${isZebra}>`;
        rowI += `<td>${escapeHtml(`[${childrenList[i].externalId}] ${childrenList[i].title}`)}</td>`;
        rowI += `<td>${escapeHtml(childrenList[i].mappedStatus || childrenList[i].externalStatus || '-')}</td>`;
        rowI += `</tr>`;
        rowsHtmlArray.push(rowI);
      }
    };

    if (activeTab === 'report_tech') {
      techEpics.forEach((epic, index) => {
        const children = epicMap[epic.externalId] || [];
        const visibleChildren = children.filter(shouldShowInExecutiveReport);

        const statusNotesList = [];
        if (epic.current_status_notes?.trim()) {
          statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
        }
        visibleChildren.forEach(c => {
          if (c.current_status_notes?.trim()) {
            statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
          }
        });

        const impedimentsList = [];
        if (shouldShowInExecutiveReport(epic)) {
          if (epic.blocker_notes?.trim()) {
            impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
          }
          if (isDemandBlocked(epic)) {
            let bList = epic.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
            const bMsg = bStr ? `Bloqueado por: ${bStr}` : `Bloqueado (Status: ${epic.mappedStatus || epic.externalStatus})`;
            impedimentsList.push({ id: epic.externalId, text: bMsg });
          }
        }
        visibleChildren.forEach(c => {
          if (c.blocker_notes?.trim()) {
            impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
          }
          if (isDemandBlocked(c)) {
            let bList = c.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
            const bMsg = bStr ? `Bloqueado por: ${bStr}` : `Bloqueado (Status: ${c.mappedStatus || c.externalStatus})`;
            impedimentsList.push({ id: c.externalId, text: bMsg });
          }
        });

        if (visibleChildren.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0 && !shouldShowInExecutiveReport(epic)) {
          return;
        }

        const colEpic = cleanTitle(epic.title, epic.externalId);
        const colEpicStatus = epic.mappedStatus || epic.externalStatus || "Não Iniciada";
        
        const colStatus = statusNotesList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";
        const colImpediments = impedimentsList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";

        addGroupToRows(colEpic, colEpicStatus, visibleChildren, colStatus, colImpediments, index);
      });

      // Standalone demands
      const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
      if (visibleStandalone.length > 0) {
        const statusNotesList = [];
        const impedimentsList = [];

        visibleStandalone.forEach(d => {
          if (d.current_status_notes?.trim()) {
            statusNotesList.push({ id: d.externalId, text: d.current_status_notes.trim() });
          }
          if (d.blocker_notes?.trim()) {
            impedimentsList.push({ id: d.externalId, text: d.blocker_notes.trim() });
          } else if (isDemandBlocked(d)) {
            let bList = d.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
            impedimentsList.push({ id: d.externalId, text: `Impedida${bStr}` });
          }
        });

        const colEpic = "Demandas Independentes\n[Sem Eixo Associado]";
        const colEpicStatus = "-";
        const colStatus = statusNotesList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";
        const colImpediments = impedimentsList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";

        addGroupToRows(colEpic, colEpicStatus, visibleStandalone, colStatus, colImpediments, techEpics.length);
      }
    } else {
      // report_biz
      techEpics.forEach((epic, index) => {
        const children = bizEpicMap[epic.externalId] || [];

        if (children.length === 0) return;

        const statusNotesList = [];
        if (epic.current_status_notes?.trim()) {
          statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
        }
        children.forEach(c => {
          if (c.current_status_notes?.trim()) {
            statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
          }
        });

        const impedimentsList = [];
        if (epic.blocker_notes?.trim()) {
          impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
        } else if (isDemandBlocked(epic)) {
          impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.mappedStatus || epic.externalStatus})` });
        }
        children.forEach(c => {
          if (c.blocker_notes?.trim()) {
            impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
          } else if (isDemandBlocked(c)) {
            let bList = c.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
            impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
          }
        });

        const colEpic = cleanTitle(epic.title, epic.externalId);
        const colEpicStatus = epic.mappedStatus || epic.externalStatus || "Não Iniciada";
        
        const colStatus = statusNotesList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";
        const colImpediments = impedimentsList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";

        addGroupToRows(colEpic, colEpicStatus, children, colStatus, colImpediments, index);
      });

      if (standaloneBizDemands.length > 0) {
        const statusNotesList = [];
        const impedimentsList = [];

        standaloneBizDemands.forEach(c => {
          if (c.current_status_notes?.trim()) {
            statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
          }
          if (c.blocker_notes?.trim()) {
            impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
          }
          if (isDemandBlocked(c)) {
            let bList = c.blockers;
            if (typeof bList === 'string') {
              try { bList = JSON.parse(bList); } catch(e) { bList = []; }
            }
            const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
            impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
          }
        });

        const colEpic = "Demandas de Negócio Avulsas\n[Sem Eixo Associado]";
        const colEpicStatus = "-";
        const colStatus = statusNotesList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";
        const colImpediments = impedimentsList.map(n => `• [${n.id}]: ${n.text}`).join('\n') || "-";

        addGroupToRows(colEpic, colEpicStatus, standaloneBizDemands, colStatus, colImpediments, techEpics.length);
      }
    }

    const rowsHtml = rowsHtmlArray.join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Report Executivo</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; }
          th { background-color: #00AE9D; color: #FFFFFF; font-family: Calibri, sans-serif; font-size: 11pt; font-weight: bold; border: 1px solid #E2E8F0; text-align: left; padding: 6px; }
          td { font-family: Calibri, sans-serif; font-size: 10pt; border: 1px solid #E2E8F0; vertical-align: top; padding: 6px; white-space: pre-wrap; }
          .header-title { font-size: 14pt; font-weight: bold; color: #007A71; font-family: Calibri, sans-serif; border: none; padding: 6px 0; }
          .header-info { font-size: 10pt; color: #555555; font-family: Calibri, sans-serif; border: none; padding: 0 0 10px 0; }
          .zebra { background-color: #F8F9FA; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="6" class="header-title">${reportTitle}</td>
          </tr>
          <tr>
            <td colspan="6" class="header-info">${headerInfo}</td>
          </tr>
          <thead>
            <tr>
              <th style="width: 250px;">EIXO / EPIC</th>
              <th style="width: 150px;">Status EIXO / EPIC</th>
              <th style="width: 300px;">DEMANDAS EM ANDAMENTO</th>
              <th style="width: 200px;">Status DEMANDA EM ANDAMENTO</th>
              <th style="width: 350px;">SITUAÇÃO ATUAL</th>
              <th style="width: 350px;">IMPEDIMENTOS / PONTOS DE ATENÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const cleanProjName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = activeTab === 'report_tech' 
      ? `Report_Executivo_Tecnologia_${cleanProjName}.xls` 
      : `Report_Executivo_Negocios_${cleanProjName}.xls`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-sicoob-primary" />
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
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Portfólio
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { project, demands } = data;

  // Filtragem das demandas por origem (para Gestão Operacional)
  const jiraDemands = demands.filter(d => d.origin === 'Jira');
  const azureDemands = demands.filter(d => d.origin === 'Azure');
  const businessDemands = demands.filter(d => d.origin === 'Negocio');

  const isDemandBlocked = (d) => (d.externalStatus && d.externalStatus.toLowerCase() === 'blocked') || (d.blockers && d.blockers.length > 0);
  const jiraBlockedCount = jiraDemands.filter(isDemandBlocked).length;
  const azureBlockedCount = azureDemands.filter(isDemandBlocked).length;
  const businessBlockedCount = businessDemands.filter(isDemandBlocked).length;

  const CATEGORIES = ['Backlog', 'Em Refinamento', 'Desenvolvimento', 'Homologação', 'Entregue'];

  const renderColumnDemands = (columnDemands, emptyText) => {
    if (columnDemands.length === 0) {
      return <EmptyColumnPlaceholder text={emptyText} />;
    }
    return (
      <div className="space-y-4">
        {CATEGORIES.map(category => {
          const catDemands = columnDemands.filter(d => (d.mappedStatus || 'Backlog') === category);
          if (catDemands.length === 0) return null;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/45 rounded-lg border border-slate-200/50 text-[9px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  category === 'Backlog' ? 'bg-slate-500' :
                  category === 'Em Refinamento' ? 'bg-purple-400' :
                  category === 'Desenvolvimento' ? 'bg-amber-400' :
                  category === 'Homologação' ? 'bg-blue-400' :
                  'bg-emerald-400'
                }`} />
                {category} ({catDemands.length})
              </div>
              <div className="space-y-2">
                {catDemands.map(d => (
                  <DemandCard key={d.externalId} demand={d} onSelect={onSelectDemand} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helpers para o Report Executivo
  const isInProgress = (status) => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    // Resolved é considerado ainda em andamento. Closed é que a demanda foi efetivamente concluída.
    const inactive = [
      'concluído', 'concluido', 'done', 'closed', 'fechado',
      'backlog', 'a fazer', 'to do', 'removed', 'removido', 'cancelado', 'canceled'
    ];
    return !inactive.includes(s);
  };

  const shouldShowInExecutiveReport = (d) => {
    if (!d) return false;
    if (d.itemType?.toLowerCase() === 'legend') return false;

    const hasBlockerReport = !!(d.blocker_notes && d.blocker_notes.trim() !== '');
    const isBlocked = (d.externalStatus && d.externalStatus.toLowerCase() === 'blocked') || (d.blockers && d.blockers.length > 0);
    const mapped = d.mappedStatus || 'Backlog';

    // Novo: Se tiver bloqueador cadastrado no sistema, sempre exibe independente do status
    if (isBlocked) return true;

    // Se tiver impedimento preenchido, sempre aparece
    if (hasBlockerReport) return true;

    // Jamais deve aparecer demandas que são "Backlog", "Em Refinamento" e "Entregue" (se não tiverem impedimento ou bloqueio)
    if (mapped === 'Backlog' || mapped === 'Em Refinamento' || mapped === 'Entregue') {
      return false;
    }

    // Entende como status "ATIVO" as CATEGORIAS UNIFICADAS: "Desenvolvimento" e "Homologação"
    if (mapped === 'Desenvolvimento' || mapped === 'Homologação') {
      return true;
    }

    return false;
  };

  const formatPromisedDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0].substring(2); // e.g. "2026" -> "26"
        const monthIndex = parseInt(parts[1], 10) - 1;
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[monthIndex]}/${year}`;
      }
    } catch (e) {
      console.error('Erro ao formatar data:', e);
    }
    return dateStr;
  };

  // Lógica de agrupamento por Epic/Eixo para Tecnologia e Negócios
  const techEpics = [];
  const techEpicMap = {};
  const bizEpicMap = {};
  const standaloneDemands = [];
  const standaloneBizDemands = [];

  const parentIds = new Set(demands.map(d => d.parentId || d.localParentId).filter(Boolean));
  const demandsMap = {};
  demands.forEach(d => {
    demandsMap[d.externalId] = d;
  });

  demands.forEach(d => {
    if (d.itemType?.toLowerCase() === 'legend') {
      return;
    }
    const isEpicType = (d.itemType === 'Epic' || d.itemType === 'Oportunidade');
    const isParentOfSomeone = parentIds.has(d.externalId);
    
    // Determine if it should be a top-level Epic row:
    let isTopLevelEpic = false;
    if (d.itemType === 'Epic') {
      isTopLevelEpic = true;
    } else if (d.itemType === 'Oportunidade') {
      // Opportunities are top-level only if they don't have an Epic as a parent
      const parentId = d.parentId || d.localParentId;
      const parentDemand = parentId ? demandsMap[parentId] : null;
      const parentIsEpic = parentDemand && parentDemand.itemType === 'Epic';
      isTopLevelEpic = !parentIsEpic;
    } else if (isParentOfSomeone) {
      // Non-Epic, non-Opportunity parents (like Legend or others)
      // are top-level if they don't have a parent that is also in the project (excluding Legend parents)
      const parentId = d.parentId || d.localParentId;
      const parentDemand = parentId ? demandsMap[parentId] : null;
      const hasParentInProject = parentDemand && parentDemand.itemType?.toLowerCase() !== 'legend';
      isTopLevelEpic = !hasParentInProject;
    }

    if (isTopLevelEpic) {
      techEpics.push(d);
      techEpicMap[d.externalId] = [];
      bizEpicMap[d.externalId] = [];
    }
  });

  demands.forEach(d => {
    if (d.itemType?.toLowerCase() === 'legend') {
      return;
    }
    if (techEpicMap[d.externalId] !== undefined) {
      return;
    }
    if (d.origin === 'Negocio') {
      const lpId = d.localParentId;
      if (lpId && lpId !== 'NONE' && bizEpicMap[lpId] !== undefined) {
        bizEpicMap[lpId].push(d);
      } else {
        standaloneBizDemands.push(d);
      }
    } else {
      const pId = d.parentId || d.localParentId;
      if (pId && techEpicMap[pId] !== undefined) {
        techEpicMap[pId].push(d);
      } else {
        standaloneDemands.push(d);
      }
    }
  });

  // Aliases para compatibilidade com o relatório de Tecnologia existente
  const epics = techEpics;
  const epicMap = techEpicMap;

  const renderAiSummaryTab = () => {
    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 overflow-y-auto">
        {/* Left Column: AI Summary Report */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                  Status Report Inteligente (Gemini)
                </h3>
                <p className="text-xs text-slate-500">Relatório consolidado gerado automaticamente pela Inteligência Artificial</p>
              </div>
              
              <div className="flex items-center gap-2">
                {aiGeneratedAt && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Gerado em: {aiGeneratedAt}
                  </span>
                )}
                <button
                  onClick={() => handleFetchAiSummary(true)}
                  disabled={isGeneratingAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-50 disabled:text-slate-400 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  {isGeneratingAi ? 'Atualizando...' : 'Atualizar com IA'}
                </button>
              </div>
            </div>

            {aiError && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            {isGeneratingAi && !aiReport ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700 animate-pulse">Consultando o Gemini...</p>
                  <p className="text-xs text-slate-400 mt-1">Consolidando anotações locais, datas e comentários das demandas.</p>
                </div>
              </div>
            ) : aiReport ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-750 leading-relaxed whitespace-pre-wrap font-sans max-h-[55vh] overflow-y-auto custom-scrollbar">
                {aiReport}
              </div>
            ) : (
              <div className="text-center py-20 border border-dashed border-slate-200 rounded-xl text-slate-400 flex flex-col items-center justify-center gap-3">
                <Sparkles className="w-10 h-10 text-slate-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-650">Nenhum resumo gerado.</p>
                  <p className="text-xs mt-1">Clique no botão "Atualizar com IA" para gerar o resumo semanal do projeto.</p>
                </div>
              </div>
            )}
          </div>

          {aiReport && !isGeneratingAi && (
            <div className="border-t border-slate-100 pt-4 mt-6 flex justify-end">
              <button
                onClick={handleCopyAiReport}
                disabled={copiedAi}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                {copiedAi ? 'Copiado!' : 'Copiar Relatório'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Source Material Context */}
        <div className="w-full lg:w-80 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col shadow-xs max-h-[75vh]">
          <h4 className="font-bold text-xs text-slate-550 uppercase tracking-wider mb-3">Fontes de Contexto Enviadas</h4>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {data.demands && data.demands.length > 0 ? (
              data.demands.map(d => {
                const hasDates = d.promisedDate || d.followUpDate;
                const hasLocalNotes = d.managerNotes || d.current_status_notes || d.blocker_notes;
                
                return (
                  <div 
                    key={d.externalId}
                    onClick={() => onSelectDemand(d.externalId)}
                    className="bg-white border border-slate-150 hover:border-emerald-500/50 rounded-xl p-3 space-y-2 cursor-pointer shadow-xs transition-all active:scale-98 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors uppercase">{d.externalId}</span>
                      <span className="text-[9px] font-semibold bg-slate-100 border border-slate-150 px-1.5 py-0.5 rounded text-slate-600">
                        {d.externalStatus}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-snug">{d.title}</p>
                    
                    {hasDates && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {d.promisedDate && (
                          <span className="text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded">
                            Promessa: {d.promisedDate}
                          </span>
                        )}
                        {d.followUpDate && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded">
                            Cobrança: {d.followUpDate}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {hasLocalNotes && (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1 mt-1 text-[10px]">
                        {d.managerNotes && (
                          <p className="text-slate-600 line-clamp-1"><strong className="text-slate-700 font-bold">Gestora:</strong> {d.managerNotes}</p>
                        )}
                        {d.current_status_notes && (
                          <p className="text-slate-600 line-clamp-1"><strong className="text-emerald-700 font-bold">Evolução:</strong> {d.current_status_notes}</p>
                        )}
                        {d.blocker_notes && (
                          <p className="text-slate-600 line-clamp-1"><strong className="text-rose-700 font-bold">Impedimento:</strong> {d.blocker_notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Nenhuma demanda ativa neste projeto.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex-1 ${isPresentationMode ? 'fixed inset-0 z-[100] bg-white w-screen h-screen overflow-y-auto p-4 sm:p-8 lg:p-12 flex flex-col items-center justify-start' : 'overflow-y-auto w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 space-y-6'}`}>
      {isPresentationMode && (
        <style dangerouslySetInnerHTML={{ __html: `
          aside { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; height: 100vh !important; }
        `}} />
      )}

      {/* Top Navigation (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-sicoob-text hover:bg-slate-50 transition-colors bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold select-none w-fit"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Portfólio
          </button>

          <div className="flex items-center gap-2">
            {(activeTab === 'report_tech' || activeTab === 'report_biz') && (
              <>
                <button
                  onClick={() => setIsPresentationMode(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sicoob-primary hover:bg-sicoob-secondary text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 select-none"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Modo Apresentação
                </button>
                <button
                  onClick={exportToPPTX}
                  className="flex items-center gap-2 px-4 py-2.5 bg-sicoob-primary hover:bg-sicoob-secondary text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 select-none"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar PPTX
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 select-none"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar Excel
                </button>
              </>
            )}

            <button
              onClick={fetchOverview}
              className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-sicoob-text hover:bg-slate-50 rounded-xl transition-all"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Close Presentation Mode Button */}
      {isPresentationMode && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
          <button
            onClick={exportToPPTX}
            className="px-4 py-2.5 bg-sicoob-primary hover:bg-sicoob-secondary text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 select-none"
          >
            <Download className="w-3.5 h-3.5" /> Exportar PPTX
          </button>
          <button
            onClick={() => setIsPresentationMode(false)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-sicoob-text rounded-xl text-xs font-bold shadow-sm transition-all opacity-70 hover:opacity-100 flex items-center gap-1.5 select-none"
            title="Pressione ESC para sair"
          >
            <X className="w-4 h-4" /> Sair da Apresentação
          </button>
        </div>
      )}

      {/* Header Executivo Card (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 backdrop-blur-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-sicoob-text tracking-tight">{project.name}</h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  project.health_status === 'Verde' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  project.health_status === 'Amarelo' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                  'bg-rose-50 text-rose-700 border border-rose-100'
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
                <span className="text-[10px] text-slate-500 ml-2 italic">
                  (Farol automático baseado em blockers e prazos)
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="bg-white/40 border border-slate-200/50 rounded-xl px-4 py-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-400" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Patrocinador / Sponsor</span>
                  <span className="font-bold text-sicoob-text">{project.sponsor || 'Não definido'}</span>
                </div>
              </div>

              <div className="bg-white/40 border border-slate-200/50 rounded-xl px-4 py-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sicoob-primary" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Previsão de Lançamento</span>
                  <span className="font-bold text-sicoob-text">{project.target_go_live || 'Sem previsão'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 pt-2 border-t border-slate-250">
            <div className="flex justify-between text-xs font-semibold text-slate-500">
              <span>Progresso Realizado</span>
              <span className="text-brand-400">{project.progress}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-3 border border-slate-200 overflow-hidden">
              <div
                className="bg-gradient-to-r from-sicoob-primary to-sicoob-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <div className="flex border-b border-slate-200 select-none">
          <button
            onClick={() => setActiveTab('operational')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'operational'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Gestão Operacional
          </button>
          <button
            onClick={() => setActiveTab('report_tech')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'report_tech'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Report Executivo Tecnologia
          </button>
          <button
            onClick={() => setActiveTab('report_biz')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'report_biz'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Report Executivo Negócios
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'roadmap'
                ? 'border-sicoob-primary text-sicoob-primary'
                : 'border-transparent text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Mapa do Roadmap
          </button>
          {data?.project?.has_gantt_chart === 1 && (
            <button
              onClick={() => setActiveTab('gantt')}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'gantt'
                  ? 'border-sicoob-primary text-sicoob-primary'
                  : 'border-transparent text-slate-500 hover:text-sicoob-text'
              }`}
            >
              Cronograma
            </button>
          )}
          <button
            onClick={() => setActiveTab('ai_summary')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ai_summary'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-emerald-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Resumo IA
          </button>
        </div>
      )}

      {/* Conditional Tabs Content */}
      {activeTab === 'operational' && !isPresentationMode ? (
        <div className="space-y-6">


          {/* Kanban Board of Tracks */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-sicoob-text flex items-center gap-2">
              <Activity className="w-4 h-4 text-sicoob-primary" /> Board de Trilhas (Entregáveis Vinculados)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Jira */}
              <div className="bg-white/10 border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    Sicoob TI (Jira)
                  </span>
                  <span className="bg-sky-500/10 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {jiraDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(jiraDemands, "Sem entregas no Sicoob TI (Jira)")}
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs text-slate-500 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${jiraBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {jiraBlockedCount}
                  </span>
                </div>
              </div>

              {/* Azure */}
              <div className="bg-white/10 border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    MAG TI (Azure DevOps)
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {azureDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(azureDemands, "Sem entregas no MAG TI (Azure)")}
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs text-slate-500 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${azureBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {azureBlockedCount}
                  </span>
                </div>
              </div>

              {/* Negócios */}
              <div className="bg-white/10 border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[380px] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    Negócios / GTM
                  </span>
                  <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {businessDemands.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                  {renderColumnDemands(businessDemands, "Sem demandas de Negócio")}
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs text-slate-500 mt-auto">
                  <span>Impedimentos Ativos:</span>
                  <span className={`font-bold ${businessBlockedCount > 0 ? 'text-rose-400 font-extrabold text-sm' : 'text-slate-500'}`}>
                    {businessBlockedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (activeTab === 'report_tech' || (isPresentationMode && activeTab === 'report_tech')) ? (
        /* Report Executivo Slide view */
        <div className={`bg-white border border-slate-200 rounded-2xl p-8 shadow-sm w-full ${isPresentationMode ? 'animate-in zoom-in-95 duration-300' : ''}`}>
          {/* Slide Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
            <div>
              <span className="text-[10px] text-sicoob-primary font-extrabold uppercase tracking-widest bg-sicoob-primary/10 border border-sicoob-primary/20 px-2.5 py-1 rounded-lg">
                PO STATUS REPORT
              </span>
              <h2 className="text-2xl font-bold text-sicoob-text tracking-tight mt-3">
                Status Report Semanal
              </h2>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
              <div>Data: <strong className="text-sicoob-text">{new Date().toLocaleDateString('pt-BR')}</strong></div>
              {project.sponsor && <div>Sponsor: <strong className="text-sicoob-text">{project.sponsor}</strong></div>}
            </div>
          </div>

          {/* Desktop view (lg and up): fluid fixed table with no horizontal scroll */}
          <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-slate-200/85 bg-white/40">
            <table className="w-full min-w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-extrabold select-none">
                  <th className="px-6 py-4 w-[20%]">EIXO / EPIC</th>
                  <th className="px-6 py-4 w-[25%]">DEMANDAS EM ANDAMENTO</th>
                  <th className="px-6 py-4 w-[27.5%]">SITUAÇÃO ATUAL</th>
                  <th className="px-6 py-4 w-[27.5%]">IMPEDIMENTOS / PONTOS DE ATENÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Epics / Eixos rows */}
                {epics.map(epic => {
                  const children = epicMap[epic.externalId] || [];
                  const visibleChildren = children.filter(shouldShowInExecutiveReport);
                  
                  // Collect status notes
                  const statusNotesList = [];
                  if (epic.current_status_notes && epic.current_status_notes.trim()) {
                    statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
                  }
                  visibleChildren.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  // Collect impediments
                  const impedimentsList = [];
                  if (shouldShowInExecutiveReport(epic)) {
                    if (epic.blocker_notes && epic.blocker_notes.trim()) {
                      impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                    }
                    if (isDemandBlocked(epic)) {
                      let bList = epic.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
                      const bMsg = bStr ? `Bloqueado pela demanda ${bStr}` : `Bloqueado (Status: ${epic.mappedStatus || epic.externalStatus})`;
                      impedimentsList.push({ id: epic.externalId, text: bMsg });
                    }
                  }
                  // Check Children
                  visibleChildren.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    }
                    if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
                      const bMsg = bStr ? `Bloqueado pela demanda ${bStr}` : `Bloqueado (Status: ${c.mappedStatus || c.externalStatus})`;
                      impedimentsList.push({ id: c.externalId, text: bMsg });
                    }
                  });

                  // Only render row if Epic is visible, or if it has visible child demands or impediments
                  if (visibleChildren.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0 && !shouldShowInExecutiveReport(epic)) {
                    return null;
                  }

                  return (
                    <tr key={epic.externalId} className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo (Epic Name) */}
                      <td className="px-6 py-5 font-bold text-xs text-sicoob-text break-words">
                        <div 
                          onClick={() => onSelectDemand(epic.externalId)}
                          className="border-l-4 border-emerald-500 pl-3 py-1 space-y-1.5 cursor-pointer hover:bg-white hover:border-emerald-400 p-1.5 rounded transition-all"
                        >
                          <span className="text-sicoob-text text-sm font-semibold tracking-tight leading-snug block hover:underline">{epic.title}</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                          {(epic.mappedStatus || epic.externalStatus) && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 ${getStatusBadgeClass(epic.mappedStatus || epic.externalStatus)}`}>
                              {epic.mappedStatus || epic.externalStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words">
                        {visibleChildren.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleChildren.map(c => (
                              <div
                                key={c.externalId}
                                onClick={() => onSelectDemand(c.externalId)}
                                className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 hover:border-emerald-500/30 hover:bg-white/80 p-2 rounded-lg cursor-pointer transition-all"
                              >
                                <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                                  <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                  {c.title}
                                  {(c.mappedStatus || c.externalStatus) && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(c.mappedStatus || c.externalStatus)}`}>
                                      {c.mappedStatus || c.externalStatus}
                                    </span>
                                  )}
                                </span>
                                {c.promisedDate && (
                                  <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                    {formatPromisedDate(c.promisedDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic py-1 block">Nenhuma demanda ativa vinculada.</span>
                        )}
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-450 mr-1">[{item.id}]:</strong>
                                <span className="text-slate-600">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-base font-semibold pl-2 block">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Standalone demands row */}
                {(() => {
                  const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
                  const statusNotesList = [];
                  const impedimentsList = [];

                  visibleStandalone.forEach(d => {
                    if (d.current_status_notes && d.current_status_notes.trim()) {
                      statusNotesList.push({ id: d.externalId, text: d.current_status_notes.trim() });
                    }
                    if (d.blocker_notes && d.blocker_notes.trim()) {
                      impedimentsList.push({ id: d.externalId, text: d.blocker_notes.trim() });
                    } else if (isDemandBlocked(d)) {
                      let bList = d.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: d.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  if (visibleStandalone.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0) {
                    return null;
                  }

                  return (
                    <tr className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo */}
                      <td className="px-6 py-5 font-bold text-xs text-sicoob-text break-words">
                        <div className="border-l-4 border-sicoob-primary pl-3 py-0.5 space-y-1">
                          <span className="text-sicoob-text text-sm font-semibold block leading-snug">Demandas Independentes</span>
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Sem Epic/Eixo Vinculado</span>
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words">
                        {visibleStandalone.length > 0 ? (
                          <div className="space-y-1.5">
                            {visibleStandalone.map(d => (
                              <div
                                key={d.externalId}
                                onClick={() => onSelectDemand(d.externalId)}
                                className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 hover:border-slate-300/85 hover:bg-white/80 p-2 rounded-lg cursor-pointer transition-all"
                              >
                                <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                                  <span className="text-slate-500 font-bold mr-1">[{d.externalId}]</span>
                                  {d.title}
                                  {(d.mappedStatus || d.externalStatus) && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(d.mappedStatus || d.externalStatus)}`}>
                                      {d.mappedStatus || d.externalStatus}
                                    </span>
                                  )}
                                </span>
                                {d.promisedDate && (
                                  <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                    {formatPromisedDate(d.promisedDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic py-1 block">Nenhuma demanda ativa independente.</span>
                        )}
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1">[{item.id}]:</strong>
                                <span className="text-slate-600">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-base font-semibold pl-2 block">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet view (below lg): stacked cards to prevent horizontal scroll */}
          <div className="lg:hidden space-y-5">
            {epics.map(epic => {
              const children = epicMap[epic.externalId] || [];
              const visibleChildren = children.filter(shouldShowInExecutiveReport);
              
              const statusNotesList = [];
              if (epic.current_status_notes && epic.current_status_notes.trim()) {
                statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
              }
              visibleChildren.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              if (shouldShowInExecutiveReport(epic)) {
                if (epic.blocker_notes && epic.blocker_notes.trim()) {
                  impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                }
                if (isDemandBlocked(epic)) {
                  let bList = epic.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
                  const bMsg = bStr ? `Bloqueado pela demanda ${bStr}` : `Bloqueado (Status: ${epic.mappedStatus || epic.externalStatus})`;
                  impedimentsList.push({ id: epic.externalId, text: bMsg });
                }
              }
              visibleChildren.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                }
                if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? bList.join(', ') : '';
                  const bMsg = bStr ? `Bloqueado pela demanda ${bStr}` : `Bloqueado (Status: ${c.mappedStatus || c.externalStatus})`;
                  impedimentsList.push({ id: c.externalId, text: bMsg });
                }
              });

              if (visibleChildren.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0 && !shouldShowInExecutiveReport(epic)) {
                return null;
              }

              return (
                <div key={epic.externalId} className="bg-white border border-slate-200 shadow-xs border border-slate-200 rounded-xl p-5 space-y-4">
                  {/* Header Eixo */}
                  <div 
                    onClick={() => onSelectDemand(epic.externalId)}
                    className="border-l-4 border-emerald-500 pl-3 cursor-pointer hover:bg-white hover:border-emerald-450 p-1 rounded transition-all"
                  >
                    <h4 className="text-sicoob-text font-bold text-sm leading-snug hover:underline">{epic.title}</h4>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                  </div>

                  {/* Demandas em Andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Demandas em Andamento</span>
                    {visibleChildren.length > 0 ? (
                      <div className="space-y-1.5">
                        {visibleChildren.map(c => (
                          <div
                            key={c.externalId}
                            onClick={() => onSelectDemand(c.externalId)}
                            className="flex items-start justify-between gap-2.5 bg-white/40 border border-slate-200 p-2.5 rounded-lg cursor-pointer hover:border-emerald-500/30 transition-all"
                          >
                            <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                              <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                              {c.title}
                              {(c.mappedStatus || c.externalStatus) && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(c.mappedStatus || c.externalStatus)}`}>
                                  {c.mappedStatus || c.externalStatus}
                                </span>
                              )}
                            </span>
                            {c.promisedDate && (
                              <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                {formatPromisedDate(c.promisedDate)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs italic">Nenhuma demanda ativa vinculada.</span>
                    )}
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Standalone demands card */}
            {(() => {
              const visibleStandalone = standaloneDemands.filter(shouldShowInExecutiveReport);
              const statusNotesList = [];
              const impedimentsList = [];

              visibleStandalone.forEach(d => {
                if (d.current_status_notes && d.current_status_notes.trim()) {
                  statusNotesList.push({ id: d.externalId, text: d.current_status_notes.trim() });
                }
                if (d.blocker_notes && d.blocker_notes.trim()) {
                  impedimentsList.push({ id: d.externalId, text: d.blocker_notes.trim() });
                } else if (isDemandBlocked(d)) {
                  let bList = d.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: d.externalId, text: `Impedida${bStr}` });
                }
              });

              if (visibleStandalone.length === 0 && statusNotesList.length === 0 && impedimentsList.length === 0) {
                return null;
              }

              return (
                <div className="bg-white border border-slate-200 shadow-xs border border-slate-200 rounded-xl p-5 space-y-4">
                  {/* Header */}
                  <div className="border-l-4 border-sicoob-primary pl-3">
                    <h4 className="text-sicoob-text font-bold text-sm leading-snug">Demandas Independentes</h4>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Sem Epic/Eixo Vinculado</span>
                  </div>

                  {/* Demandas em Andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Demandas em Andamento</span>
                    {visibleStandalone.length > 0 ? (
                      <div className="space-y-1.5">
                        {visibleStandalone.map(d => (
                          <div
                            key={d.externalId}
                            onClick={() => onSelectDemand(d.externalId)}
                            className="flex items-start justify-between gap-2.5 bg-white/40 border border-slate-200 p-2.5 rounded-lg cursor-pointer hover:border-slate-300/85 transition-all"
                          >
                            <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                              <span className="text-slate-500 font-bold mr-1">[{d.externalId}]</span>
                              {d.title}
                            </span>
                            {d.promisedDate && (
                              <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-455 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                                {formatPromisedDate(d.promisedDate)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs italic">Nenhuma demanda ativa independente.</span>
                    )}
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-350 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
            })()}
          </div>
        </div>
      ) : (activeTab === 'report_biz' || (isPresentationMode && activeTab === 'report_biz')) ? (
        /* Report Executivo Negócios Slide view */
        <div className={`bg-white border border-slate-200 rounded-2xl p-8 shadow-sm w-full ${isPresentationMode ? 'animate-in zoom-in-95 duration-300' : ''}`}>
          {/* Slide Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 mb-6">
            <div>
              <span className="text-[10px] text-sicoob-primary font-extrabold uppercase tracking-widest bg-sicoob-primary/10 border border-sicoob-primary/20 px-2.5 py-1 rounded-lg">
                PO STATUS REPORT - NEGÓCIOS
              </span>
              <h2 className="text-2xl font-bold text-sicoob-text tracking-tight mt-3">
                Status Report Semanal (Negócios / GTM)
              </h2>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
              <div>Data: <strong className="text-sicoob-text">{new Date().toLocaleDateString('pt-BR')}</strong></div>
              {project.sponsor && <div>Sponsor: <strong className="text-sicoob-text">{project.sponsor}</strong></div>}
            </div>
          </div>

          {/* Desktop view (lg and up): fluid fixed table with no horizontal scroll */}
          <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-slate-200/85 bg-white/40">
            <table className="w-full min-w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-extrabold select-none">
                  <th className="px-6 py-4 w-[20%]">EIXO / EPIC</th>
                  <th className="px-6 py-4 w-[25%]">DEMANDAS EM ANDAMENTO</th>
                  <th className="px-6 py-4 w-[27.5%]">SITUAÇÃO ATUAL</th>
                  <th className="px-6 py-4 w-[27.5%]">IMPEDIMENTOS / PONTOS DE ATENÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Epics / Eixos rows */}
                {techEpics.map(epic => {
                  const children = bizEpicMap[epic.externalId] || [];
                  if (children.length === 0) return null;
                  
                  // Collect status notes
                  const statusNotesList = [];
                  if (epic.current_status_notes && epic.current_status_notes.trim()) {
                    statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
                  }
                  children.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  // Collect impediments
                  const impedimentsList = [];
                  if (epic.blocker_notes && epic.blocker_notes.trim()) {
                    impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
                  } else if (isDemandBlocked(epic)) {
                    impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.mappedStatus || epic.externalStatus})` });
                  }
                  children.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    } else if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  return (
                    <tr key={epic.externalId} className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo (Epic Name) */}
                      <td className="px-6 py-5 font-bold text-xs text-sicoob-text break-words">
                        <div 
                          onClick={() => onSelectDemand(epic.externalId)}
                          className="border-l-4 border-sicoob-primary pl-3 py-1 space-y-1.5 cursor-pointer hover:bg-slate-50 hover:border-sicoob-secondary p-1.5 rounded transition-all"
                        >
                          <span className="text-sicoob-text text-sm font-semibold tracking-tight leading-snug block hover:underline">{epic.title}</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                          {(epic.mappedStatus || epic.externalStatus) && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 ${getStatusBadgeClass(epic.mappedStatus || epic.externalStatus)}`}>
                              {epic.mappedStatus || epic.externalStatus}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words">
                        <div className="space-y-1.5">
                          {children.map(c => (
                            <div
                              key={c.externalId}
                              onClick={() => onSelectDemand(c.externalId)}
                              className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 hover:border-purple-500/30 hover:bg-white/80 p-2 rounded-lg cursor-pointer transition-all"
                            >
                              <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                                <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                {c.title}
                                {(c.mappedStatus || c.externalStatus) && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(c.mappedStatus || c.externalStatus)}`}>
                                    {c.mappedStatus || c.externalStatus}
                                  </span>
                                )}
                              </span>
                              {c.promisedDate && (
                                <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                  {formatPromisedDate(c.promisedDate)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-355 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Standalone Business Demands Row */}
                {standaloneBizDemands.length > 0 && (() => {
                  const statusNotesList = [];
                  standaloneBizDemands.forEach(c => {
                    if (c.current_status_notes && c.current_status_notes.trim()) {
                      statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                    }
                  });

                  const impedimentsList = [];
                  standaloneBizDemands.forEach(c => {
                    if (c.blocker_notes && c.blocker_notes.trim()) {
                      impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                    } else if (isDemandBlocked(c)) {
                      let bList = c.blockers;
                      if (typeof bList === 'string') {
                        try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                      }
                      const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                      impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                    }
                  });

                  return (
                    <tr className="align-top animate-in fade-in duration-300">
                      {/* Cell 1: Eixo */}
                      <td className="px-6 py-5 font-bold text-xs text-sicoob-text break-words">
                        <div className="border-l-4 border-sicoob-primary pl-3 py-0.5 space-y-1.5">
                          <span className="text-sicoob-text text-sm font-semibold tracking-tight leading-snug block">Demandas de Negócio Avulsas</span>
                          <span className="text-[10px] text-slate-500 font-bold font-mono">[SEM EIXO VINCULADO]</span>
                        </div>
                      </td>

                      {/* Cell 2: Demandas em Andamento */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words">
                        <div className="space-y-1.5">
                          {standaloneBizDemands.map(c => (
                            <div
                              key={c.externalId}
                              onClick={() => onSelectDemand(c.externalId)}
                              className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 hover:border-purple-500/30 hover:bg-white/80 p-2 rounded-lg cursor-pointer transition-all"
                            >
                              <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                                <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                                {c.title}
                                {(c.mappedStatus || c.externalStatus) && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(c.mappedStatus || c.externalStatus)}`}>
                                    {c.mappedStatus || c.externalStatus}
                                  </span>
                                )}
                              </span>
                              {c.promisedDate && (
                                <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                                  {formatPromisedDate(c.promisedDate)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cell 3: Situação Atual */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {statusNotesList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-600 text-xs">
                            {statusNotesList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-emerald-400 mr-1">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>

                      {/* Cell 4: Impedimentos */}
                      <td className="px-6 py-5 border-l border-slate-200 break-words whitespace-pre-wrap">
                        {impedimentsList.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-1.5 text-slate-355 text-xs">
                            {impedimentsList.map((item, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                                <span>{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet view (below lg): stacked cards to prevent horizontal scroll */}
          <div className="lg:hidden space-y-5">
            {techEpics.map(epic => {
              const children = bizEpicMap[epic.externalId] || [];
              if (children.length === 0) return null;
              
              const statusNotesList = [];
              if (epic.current_status_notes && epic.current_status_notes.trim()) {
                statusNotesList.push({ id: epic.externalId, text: epic.current_status_notes.trim() });
              }
              children.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              if (epic.blocker_notes && epic.blocker_notes.trim()) {
                impedimentsList.push({ id: epic.externalId, text: epic.blocker_notes.trim() });
              } else if (isDemandBlocked(epic)) {
                impedimentsList.push({ id: epic.externalId, text: `Travada (Status: ${epic.mappedStatus || epic.externalStatus})` });
              }
              children.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                } else if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                }
              });

              return (
                <div key={epic.externalId} className="bg-white/40 border border-slate-200 rounded-xl p-5 space-y-4">
                  {/* Eixo info */}
                  <div 
                    onClick={() => onSelectDemand(epic.externalId)}
                    className="border-l-4 border-sicoob-primary pl-3 py-0.5 space-y-1 cursor-pointer hover:bg-slate-50 hover:border-sicoob-secondary p-1 rounded transition-all"
                  >
                    <span className="text-sicoob-text text-sm font-semibold block hover:underline">{epic.title}</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[{epic.externalId}]</span>
                  </div>

                  {/* Demandas em andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Demandas de Negócio</span>
                    <div className="space-y-1.5">
                      {children.map(c => (
                        <div
                          key={c.externalId}
                          onClick={() => onSelectDemand(c.externalId)}
                          className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 p-2 rounded-lg cursor-pointer"
                        >
                          <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                            <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                            {c.title}
                            {(c.mappedStatus || c.externalStatus) && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold ml-2 select-none ${getStatusBadgeClass(c.mappedStatus || c.externalStatus)}`}>
                                {c.mappedStatus || c.externalStatus}
                              </span>
                            )}
                          </span>
                          {c.promisedDate && (
                            <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                              {formatPromisedDate(c.promisedDate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-355 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Standalone Biz Demands Card (Mobile) */}
            {standaloneBizDemands.length > 0 && (() => {
              const statusNotesList = [];
              standaloneBizDemands.forEach(c => {
                if (c.current_status_notes && c.current_status_notes.trim()) {
                  statusNotesList.push({ id: c.externalId, text: c.current_status_notes.trim() });
                }
              });

              const impedimentsList = [];
              standaloneBizDemands.forEach(c => {
                if (c.blocker_notes && c.blocker_notes.trim()) {
                  impedimentsList.push({ id: c.externalId, text: c.blocker_notes.trim() });
                } else if (isDemandBlocked(c)) {
                  let bList = c.blockers;
                  if (typeof bList === 'string') {
                    try { bList = JSON.parse(bList); } catch(e) { bList = []; }
                  }
                  const bStr = (Array.isArray(bList) && bList.length > 0) ? ` por: ${bList.join(', ')}` : '';
                  impedimentsList.push({ id: c.externalId, text: `Impedida${bStr}` });
                }
              });

              return (
                <div className="bg-white/40 border border-slate-200 rounded-xl p-5 space-y-4">
                  {/* Standalone Epic info */}
                  <div className="border-l-4 border-purple-500 pl-3 py-0.5 space-y-1">
                    <span className="text-sicoob-text text-sm font-semibold block">Demandas de Negócio Avulsas</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">[SEM EIXO VINCULADO]</span>
                  </div>

                  {/* Demandas em andamento */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Demandas de Negócio</span>
                    <div className="space-y-1.5">
                      {standaloneBizDemands.map(c => (
                        <div
                          key={c.externalId}
                          onClick={() => onSelectDemand(c.externalId)}
                          className="flex items-start justify-between gap-2.5 bg-white border border-slate-200 shadow-xs border border-slate-250 p-2 rounded-lg cursor-pointer"
                        >
                          <span className="text-xs text-sicoob-text font-medium hover:underline flex-1 leading-relaxed">
                            <span className="text-slate-500 font-bold mr-1">[{c.externalId}]</span>
                            {c.title}
                          </span>
                          {c.promisedDate && (
                            <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">
                              {formatPromisedDate(c.promisedDate)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Situação Atual */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Situação Atual</span>
                    {statusNotesList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 text-xs">
                        {statusNotesList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-emerald-400 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>

                  {/* Impedimentos */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Impedimentos / Pontos de Atenção</span>
                    {impedimentsList.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-slate-355 text-xs">
                        {impedimentsList.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <strong className="text-rose-455 mr-1 font-mono">[{item.id}]:</strong>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500 text-xs italic">-</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeTab === 'roadmap' ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 backdrop-blur-md h-[750px] flex flex-col">
          <h3 className="text-base font-bold text-sicoob-text mb-4 shrink-0">Mapa de Dependências e Roadmap</h3>
          <RoadmapGraphView demands={data.demands} onSelectDemand={onSelectDemand} />
        </div>
      ) : activeTab === 'gantt' ? (
        renderGanttTab()
      ) : activeTab === 'ai_summary' ? (
        renderAiSummaryTab()
      ) : null}
    </div>
  );
}

// Subcomponente Card de Demanda (utilizado no Kanban)
function DemandCard({ demand, onSelect }) {
  const isStale = demand.isStale;
  const isBlocked = (demand.externalStatus && demand.externalStatus.toLowerCase() === 'blocked') || (demand.blockers && demand.blockers.length > 0);
  
  return (
    <div
      onClick={() => onSelect(demand.externalId)}
      className={`bg-white/40 hover:bg-white/80 border p-4 rounded-xl cursor-pointer transition-all space-y-3 ${
        isBlocked ? 'border-rose-500/50 bg-rose-500/[0.03]' :
        isStale ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 flex-wrap">
          {demand.externalId}
          {isBlocked && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-100 rounded">
              Bloqueado
            </span>
          )}
          {isStale && !isBlocked && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded">
              Desatualizado
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {demand.mappedStatus && (
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold rounded ${
              demand.mappedStatus === 'Backlog' ? 'bg-slate-100 text-slate-500 border border-slate-300/60' :
              demand.mappedStatus === 'Em Refinamento' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
              demand.mappedStatus === 'Desenvolvimento' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
              demand.mappedStatus === 'Homologação' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {demand.mappedStatus}
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
            demand.externalStatus === 'Concluído' || demand.externalStatus === 'Concluido' || demand.externalStatus === 'Done' || demand.externalStatus === 'Closed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
            demand.externalStatus === 'Em Progresso' || demand.externalStatus === 'Desenvolvimento' || demand.externalStatus === 'Doing' || demand.externalStatus === 'Resolved' || demand.externalStatus === 'Active' || demand.externalStatus === 'Em andamento' ? 'bg-amber-500/10 text-amber-400 border border-emerald-500/20' :
            isBlocked || demand.externalStatus === 'Blocked' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
            'bg-slate-100 text-slate-500 border border-slate-300'
          }`}>
            {demand.externalStatus}
          </span>
        </div>
      </div>
      
      <h4 className="text-sm font-semibold text-sicoob-text line-clamp-2 leading-snug group-hover:text-white transition-colors">
        {demand.title}
      </h4>
      
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
        <span>Tipo: <strong className="text-slate-500">{demand.itemType}</strong></span>
        <span>Canal: <strong className="text-slate-500">{demand.origin}</strong></span>
      </div>
    </div>
  );
}

// Subcomponente Placeholder para Colunas Vazias
function EmptyColumnPlaceholder({ text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-200 rounded-xl text-slate-600 space-y-2 w-full">
      <CheckCircle2 className="w-8 h-8 opacity-45" />
      <span className="text-xs font-medium">{text}</span>
    </div>
  );
}
