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
  const isJira = data.origin === 'Jira';
  const borderColor = isJira ? 'border-sky-500' : 'border-emerald-500';
  const badgeColor = isJira ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  return (
    <div className={`p-3 bg-slate-900 border ${borderColor} rounded-xl shadow-lg w-[200px] text-xs font-sans`}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#555' }} />
      
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-slate-400 tracking-wider uppercase text-[9px]">{data.externalId}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${badgeColor}`}>
          {data.origin}
        </span>
      </div>
      
      <p className="font-semibold text-slate-100 truncate mb-1" title={data.title}>
        {data.title}
      </p>
      
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="truncate max-w-[120px] font-semibold text-slate-300">{data.externalStatus}</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#555' }} />
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
    if (!demands || demands.length === 0) return;

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

    // 1. Create nodes
    const initialNodes = filteredDemands.map((d) => ({
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

    // 2. Create edges (Hierarchy + Blockers)
    const initialEdges = [];

    filteredDemands.forEach((d) => {
      // Hierarchy Edge: parentId -> id
      if (d.parentId) {
        // Verify parent exists in filteredDemands
        const parentExists = filteredDemands.some((p) => p.externalId === d.parentId);
        if (parentExists) {
          initialEdges.push({
            id: `h-${d.parentId}-${d.externalId}`,
            source: d.parentId,
            target: d.externalId,
            style: { stroke: '#64748b', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#64748b',
            },
          });
        }
      }

      // Blocker Edge: blockerId -> id
      if (d.blockers && Array.isArray(d.blockers)) {
        d.blockers.forEach((blockerId) => {
          const blockerExists = filteredDemands.some((b) => b.externalId === blockerId);
          if (blockerExists) {
            initialEdges.push({
              id: `b-${blockerId}-${d.externalId}`,
              source: blockerId,
              target: d.externalId,
              animated: true,
              style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5,5' },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#ef4444',
              },
            });
          }
        });
      }
    });

    // 3. Compute layout
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
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      <div className="px-8 py-6 border-b border-slate-900 flex items-center justify-between z-10 bg-slate-950/80 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-400" /> Mapa do Roadmap
          </h2>
          <p className="text-sm text-slate-400">Relações de hierarquia (cinza) e bloqueios ativos (vermelho animado)</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setDirection('TB')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              direction === 'TB' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vertical (Árvore)
          </button>
          <button
            onClick={() => setDirection('LR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              direction === 'LR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Horizontal
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative min-h-[500px]">
        {demands && demands.length > 0 ? (
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
            <Background color="#1e293b" gap={16} size={1} />
            <Controls className="react-flow__controls bg-slate-900 border border-slate-800 text-slate-400 fill-slate-400 rounded-lg p-1 [&>button]:border-slate-800 hover:[&>button]:bg-slate-800 hover:[&>button]:text-white" />
          </ReactFlow>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            Carregando mapa de dependências...
          </div>
        )}
      </div>
    </div>
  );
}
