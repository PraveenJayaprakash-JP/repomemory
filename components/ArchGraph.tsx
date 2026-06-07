'use client';

import { useMemo, useState, useCallback } from 'react';
import type { ArchitectureGraph, GraphNode, GraphEdge } from '@/lib/graph';

// ─── Layout constants ───────────────────────────────────────

const NODE_WIDTH = 152;
const NODE_HEIGHT = 36;
const H_GAP = 28;
const V_GAP = 72;
const X_PADDING = 32;

interface LayoutNode {
  x: number;
  y: number;
  width: number;
  height: number;
  node: GraphNode;
}

const TYPE_COLORS: Record<GraphNode['type'], { fill: string; stroke: string; text: string }> = {
  framework: { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e40af' },
  module: { fill: '#dcfce7', stroke: '#22c55e', text: '#166534' },
  directory: { fill: '#f1f5f9', stroke: '#64748b', text: '#334155' },
  file: { fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' },
  database: { fill: '#f3e8ff', stroke: '#a855f7', text: '#6b21a8' },
  service: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
};

const DARK_TYPE_COLORS: Record<GraphNode['type'], { fill: string; stroke: string; text: string }> = {
  framework: { fill: '#1e3a5f', stroke: '#60a5fa', text: '#bfdbfe' },
  module: { fill: '#14532d', stroke: '#4ade80', text: '#bbf7d0' },
  directory: { fill: '#1e293b', stroke: '#94a3b8', text: '#cbd5e1' },
  file: { fill: '#1f2937', stroke: '#9ca3af', text: '#d1d5db' },
  database: { fill: '#3b0764', stroke: '#c084fc', text: '#e9d5ff' },
  service: { fill: '#451a03', stroke: '#fbbf24', text: '#fde68a' },
};

// ─── Tree layout algorithm ──────────────────────────────────

interface TreeLayoutInput {
  node: GraphNode;
  children: TreeLayoutInput[];
}

function buildTree(nodes: GraphNode[], edges: GraphEdge[]): TreeLayoutInput[] {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const childrenMap = new Map<string, string[]>();
  for (const e of edges) {
    const existing = childrenMap.get(e.source) ?? [];
    existing.push(e.target);
    childrenMap.set(e.source, existing);
  }

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set<string>();
  for (const e of edges) hasIncoming.add(e.target);
  const rootIds = nodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id);

  function build(id: string): TreeLayoutInput {
    const node = nodeMap.get(id)!;
    const childIds = childrenMap.get(id) ?? [];
    return {
      node,
      children: childIds.map(childId => build(childId)),
    };
  }

  return rootIds.map(id => build(id));
}

interface SizedNode {
  x: number;
  y: number;
  width: number;
  height: number;
  node: GraphNode;
  children: SizedNode[];
}

function computeSubtreeWidth(root: TreeLayoutInput): number {
  if (root.children.length === 0) {
    return NODE_WIDTH;
  }
  const childrenWidth = root.children.reduce((sum, c) => sum + computeSubtreeWidth(c), 0);
  const gaps = (root.children.length - 1) * H_GAP;
  return Math.max(NODE_WIDTH, childrenWidth + gaps);
}

function layoutTree(root: TreeLayoutInput, depth: number, left: number): SizedNode {
  const totalWidth = computeSubtreeWidth(root);
  const x = left + (totalWidth - NODE_WIDTH) / 2;

  const sized: SizedNode = {
    x,
    y: depth * V_GAP,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    node: root.node,
    children: [],
  };

  let childLeft = left;
  for (const child of root.children) {
    const childWidth = computeSubtreeWidth(child);
    const childSized = layoutTree(child, depth + 1, childLeft);
    sized.children.push(childSized);
    childLeft += childWidth + H_GAP;
  }

  return sized;
}

function flattenTree(roots: SizedNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: SizedNode) {
    result.push({ x: n.x, y: n.y, width: n.width, height: n.height, node: n.node });
    for (const c of n.children) walk(c);
  }
  for (const r of roots) walk(r);
  return result;
}

function computeTotalBounds(roots: SizedNode[]): { width: number; height: number } {
  let maxRight = 0;
  let maxBottom = 0;
  function walk(n: SizedNode) {
    maxRight = Math.max(maxRight, n.x + n.width);
    maxBottom = Math.max(maxBottom, n.y + n.height);
    for (const c of n.children) walk(c);
  }
  for (const r of roots) walk(r);
  return { width: maxRight + X_PADDING, height: maxBottom + 40 };
}

// ─── Edge path generator ────────────────────────────────────

function buildEdges(
  nodes: ArchitectureGraph['nodes'],
  edges: ArchitectureGraph['edges'],
  layoutMap: Map<string, LayoutNode>
): Array<{ sourceId: string; targetId: string; label?: string; d: string }> {
  const result: Array<{ sourceId: string; targetId: string; label?: string; d: string }> = [];
  for (const e of edges) {
    const src = layoutMap.get(e.source);
    const tgt = layoutMap.get(e.target);
    if (!src || !tgt) continue;

    const x1 = src.x + src.width / 2;
    const y1 = src.y + src.height;
    const x2 = tgt.x + tgt.width / 2;
    const y2 = tgt.y;
    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    result.push({ sourceId: e.source, targetId: e.target, label: e.label, d });
  }
  return result;
}

// ─── Tooltip component ──────────────────────────────────────

interface TooltipData {
  label: string;
  type: string;
  id: string;
  x: number;
  y: number;
}

function NodeTooltip({ data }: { data: TooltipData }) {
  return (
    <div
      className="absolute z-50 px-3 py-2 text-xs rounded-md border shadow-lg pointer-events-none
        bg-popover text-popover-foreground border-border max-w-[200px]"
      style={{ left: data.x + 8, top: data.y - 8, transform: 'translateY(-100%)' }}
    >
      <div className="font-medium truncate">{data.label}</div>
      <div className="text-muted-foreground mt-0.5">Type: {data.type}</div>
      <div className="text-muted-foreground text-[10px] truncate">ID: {data.id}</div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────

interface ArchGraphProps {
  graph: ArchitectureGraph;
  className?: string;
}

export default function ArchGraph({ graph, className }: ArchGraphProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const { layoutNodes, edgePaths, svgWidth, svgHeight } = useMemo(() => {
    if (graph.nodes.length === 0) {
      return { layoutNodes: [], edgePaths: [], svgWidth: 400, svgHeight: 200 };
    }

    const trees = buildTree(graph.nodes, graph.edges);

    // Layout each tree root with horizontal offset
    const sizedRoots: SizedNode[] = [];
    let rootLeft = X_PADDING;
    for (const tree of trees) {
      const width = computeSubtreeWidth(tree);
      const sized = layoutTree(tree, 0, rootLeft);
      sizedRoots.push(sized);
      rootLeft += width + H_GAP * 2;
    }

    const layoutNodes = flattenTree(sizedRoots);
    const layoutMap = new Map<string, LayoutNode>();
    for (const ln of layoutNodes) layoutMap.set(ln.node.id, ln);

    const edgePaths = buildEdges(graph.nodes, graph.edges, layoutMap);
    const bounds = computeTotalBounds(sizedRoots);

    return {
      layoutNodes,
      edgePaths,
      svgWidth: Math.max(bounds.width, 400),
      svgHeight: Math.max(bounds.height, 200),
    };
  }, [graph]);

  const handleMouseEnter = useCallback((ln: LayoutNode, event: React.MouseEvent) => {
    setTooltip({
      label: ln.node.label,
      type: ln.node.type,
      id: ln.node.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // ── Empty state ──
  if (graph.nodes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className ?? ''}`}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground mb-4 opacity-40"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground">No architecture data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Scan a repository with more source files to generate the architecture graph.
        </p>
      </div>
    );
  }

  // ── Minimal graph fallback ──
  if (layoutNodes.length <= 2) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-center ${className ?? ''}`}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground mb-4 opacity-40"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground">Minimal architecture detected</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">
          This repository has a flat structure with few modules. Add more source directories
          to see a richer dependency map.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-auto ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto min-h-[300px]"
        role="img"
        aria-label="Architecture dependency graph"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground" />
          </marker>
        </defs>

        {/* Edges */}
        {edgePaths.map((ep, i) => (
          <g key={`edge-${i}`}>
            <path
              d={ep.d}
              fill="none"
              className="stroke-muted-foreground/40"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
            {ep.label && (
              <text
                x={0}
                y={-4}
                className="fill-muted-foreground text-[9px]"
                textAnchor="middle"
              >
                <textPath href={`#edge-label-path-${i}`} startOffset="50%">
                  {ep.label}
                </textPath>
              </text>
            )}
            {/* Hidden path for label textPath reference */}
            {ep.label && (
              <path
                id={`edge-label-path-${i}`}
                d={ep.d}
                fill="none"
                stroke="none"
              />
            )}
          </g>
        ))}

        {/* Nodes */}
        {layoutNodes.map((ln) => {
          const colors = TYPE_COLORS[ln.node.type];
          const darkColors = DARK_TYPE_COLORS[ln.node.type];
          const rx = 6;

          return (
            <g
              key={ln.node.id}
              transform={`translate(${ln.x}, ${ln.y})`}
              onMouseEnter={(e) => handleMouseEnter(ln, e)}
              onMouseLeave={handleMouseLeave}
              className="cursor-pointer transition-opacity hover:opacity-90"
            >
              {/* Node background — light mode */}
              <rect
                x="0"
                y="0"
                width={ln.width}
                height={ln.height}
                rx={rx}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth="1.5"
                className="block dark:hidden"
              />
              {/* Node background — dark mode */}
              <rect
                x="0"
                y="0"
                width={ln.width}
                height={ln.height}
                rx={rx}
                fill={darkColors.fill}
                stroke={darkColors.stroke}
                strokeWidth="1.5"
                className="hidden dark:block"
              />
              {/* Node label — light mode */}
              <text
                x={ln.width / 2}
                y={ln.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={colors.text}
                className="text-[11px] font-medium select-none block dark:hidden"
                style={{ pointerEvents: 'none' }}
              >
                {ln.node.label.length > 22
                  ? ln.node.label.slice(0, 20) + '…'
                  : ln.node.label}
              </text>
              {/* Node label — dark mode */}
              <text
                x={ln.width / 2}
                y={ln.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={darkColors.text}
                className="text-[11px] font-medium select-none hidden dark:block"
                style={{ pointerEvents: 'none' }}
              >
                {ln.node.label.length > 22
                  ? ln.node.label.slice(0, 20) + '…'
                  : ln.node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && <NodeTooltip data={tooltip} />}
    </div>
  );
}
