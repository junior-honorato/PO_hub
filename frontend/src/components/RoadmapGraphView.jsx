import React, { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Network, RefreshCw } from 'lucide-react';

const nodeWidth = 200;
const nodeHeight = 85;

// Custom Node Component
const DemandNode = ({ data }) => {
  const origin = data.origin;
  let borderColor = 'border-emerald-500';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';

  if (origin === 'Jira') {
    borderColor = 'border-sky-500';
    badgeColor = 'bg-sky-50 text-sky-700 border-sky-100';
  } else if (origin === 'Negocio') {
    borderColor = 'border-purple-500';
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-100';
  }

  return (
    <div className={`p-3 bg-white border ${borderColor} rounded-xl shadow-xs w-[200px] text-xs font-sans hover:shadow-sm transition-all`}>
      <Handle type="target" position={Position.Top} style={{ background: '#00AE9D' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#00AE9D' }} />
      
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-slate-450 tracking-wider uppercase text-[9px]">{data.externalId}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${badgeColor}`}>
          {data.origin}
        </span>
      </div>
      
      <p className="font-bold text-sicoob-text truncate mb-1" title={data.title}>
        {data.title}
      </p>
      
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span className="truncate max-w-[120px] font-bold text-slate-650">{data.externalStatus}</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#00AE9D' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#00AE9D' }} />
    </div>
  );
};

const nodeTypes = {
  demandNode: DemandNode,
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

export default function RoadmapGraphView({ demands, onSelectDemand }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [direction, setDirection] = useState('TB');

  useEffect(() => {
    if (!demands || demands.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Filter out Bug and Incident / Incidente items (operational demands)
    const filteredDemands = demands.filter((d) => {
      if (!d) return false;
      const typeField = (d.type || d.issueType || d.itemType || '').toLowerCase();
      if (typeField === 'bug' || typeField === 'incident' || typeField === 'incidente') {
        return false;
      }
      if (d.title && typeof d.title === 'string') {
        const titleLower = d.title.toLowerCase();
        if (
          titleLower.startsWith('bug:') ||
          titleLower.startsWith('incidente:') ||
          titleLower.startsWith('incident:')
        ) {
          return false;
        }
      }
      return true;
    });

    // 1. Identify which demands have active parent-child or blocker/blocked relationship
    const parentIds = new Set(filteredDemands.map(d => d.parentId).filter(Boolean));
    const blockerIds = new Set();
    filteredDemands.forEach(d => {
      if (d.blockers && Array.isArray(d.blockers)) {
        d.blockers.forEach(b => blockerIds.add(b));
      }
    });

    const connectedDemands = filteredDemands.filter((d) => {
      const hasParent = !!d.parentId && filteredDemands.some(p => p.externalId === d.parentId);
      const isParent = parentIds.has(d.externalId);
      const hasBlockers = !!d.blockers && Array.isArray(d.blockers) && d.blockers.some(b => filteredDemands.some(p => p.externalId === b));
      const isBlocker = blockerIds.has(d.externalId);
      return hasParent || isParent || hasBlockers || isBlocker;
    });

    if (connectedDemands.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 2. Create nodes
    const initialNodes = connectedDemands.map((d) => ({
      id: d.externalId,
      type: 'demandNode',
      data: {
        externalId: d.externalId,
        origin: d.origin,
        title: d.title,
        externalStatus: d.externalStatus,
      },
      position: { x: 0, y: 0 },
    }));

    // 3. Create edges (Hierarchy + Blockers)
    const initialEdges = [];

    connectedDemands.forEach((d) => {
      // Hierarchy Edge: parentId -> id
      if (d.parentId) {
        const parentExists = connectedDemands.some((p) => p.externalId === d.parentId);
        if (parentExists) {
          initialEdges.push({
            id: `h-${d.parentId}-${d.externalId}`,
            source: d.parentId,
            target: d.externalId,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          });
        }
      }

      // Blocker Edge: blockerId -> id
      if (d.blockers && Array.isArray(d.blockers)) {
        d.blockers.forEach((blockerId) => {
          const blockerExists = connectedDemands.some((b) => b.externalId === blockerId);
          if (blockerExists) {
            initialEdges.push({
              id: `b-${blockerId}-${d.externalId}`,
              source: blockerId,
              target: d.externalId,
              animated: true,
              style: { stroke: '#b91c1c', strokeWidth: 2, strokeDasharray: '5,5' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#b91c1c',
              },
            });
          }
        });
      }
    });

    // 4. Compute layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      direction
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [demands, direction]);

  const onNodeClick = (event, node) => {
    if (onSelectDemand) {
      onSelectDemand(node.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-sicoob-bg text-sicoob-text overflow-hidden relative">
      <div className="px-4 py-4 sm:px-6 lg:px-8 xl:px-12 sm:py-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 z-10 bg-white/80 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-sicoob-text tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-sicoob-primary" /> Mapa do Roadmap
          </h2>
          <p className="text-sm text-slate-450 font-medium">Relações de hierarquia (cinza) e bloqueios ativos (vermelho animado)</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setDirection('TB')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              direction === 'TB' ? 'bg-sicoob-primary text-white shadow-sm' : 'text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Vertical (Árvore)
          </button>
          <button
            onClick={() => setDirection('LR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              direction === 'LR' ? 'bg-sicoob-primary text-white shadow-sm' : 'text-slate-500 hover:text-sicoob-text'
            }`}
          >
            Horizontal
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative min-h-[500px]">
        {!demands || demands.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-450 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-sicoob-primary" />
            Carregando mapa de dependências...
          </div>
        ) : nodes.length > 0 ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            className="w-full h-full"
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="react-flow__controls bg-white border border-slate-250 text-slate-550 fill-slate-550 rounded-lg p-1 [&>button]:border-slate-200 hover:[&>button]:bg-slate-100 hover:[&>button]:text-sicoob-text shadow-xs" />
          </ReactFlow>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 mb-4 shadow-sm">
              <Network className="w-8 h-8 text-sicoob-primary" />
            </div>
            <h3 className="text-lg font-bold text-sicoob-text mb-2">Nenhum vínculo estabelecido</h3>
            <p className="text-sm text-slate-450 max-w-md font-medium">
              O Mapa do Roadmap está vazio porque não existem dependências manuais ativas. 
              Vincule um Item Pai ou adicione Bloqueadores no painel de detalhes de qualquer demanda para vê-las aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
