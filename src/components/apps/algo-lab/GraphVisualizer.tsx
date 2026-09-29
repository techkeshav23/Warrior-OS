// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Graph Visualizer
// SVG graph editor (click to add nodes, drag node → node for a
// weighted edge) with animated BFS, DFS and Dijkstra runs:
// visited blue, current yellow, shortest path green.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  memo,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Eraser, Flag, Hand, Info, MousePointer2, Play, RotateCcw, Target, Trash2, TriangleAlert, Waypoints, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, IconButton, Input, SegmentedControl, Select, ToolbarSeparator } from '@/components/ui';
import type { AlgoFrontierKind, AlgoGraphFrame, GraphAlgorithmId } from '@/types/algo';
import { GRAPH_ALGORITHMS, GRAPH_PRESETS } from '@/data/algorithms';
import { buildGraphFrames, compareNodeIds, formatDistance } from '@/lib/algorithms/graph';
import {
  DEFAULT_SPEED,
  EDGE_WEIGHT_MAX,
  EDGE_WEIGHT_MIN,
  GRAPH_NODE_RADIUS as R,
  GRAPH_VIEW_HEIGHT as H,
  GRAPH_VIEW_WIDTH as W,
  MAX_GRAPH_NODES,
  SPEED_LEVELS,
} from '@/lib/algorithms/constants';
import { clampWeight, useAlgoLabStore } from './useAlgoLabStore';
import { handlePlaybackKeys, usePlayback } from './usePlayback';
import { PlaybackControls } from './PlaybackControls';
import { CodePanel } from './CodePanel';
import { ComplexityCard } from './ComplexityCard';
import { LabLayout, StageLegend, Stat, StepMessage, type LegendItem } from './LabLayout';
import { ACCENT, LAB, nodeStyle, tint, type NodeStyle } from './labTheme';

type Tool = 'build' | 'move';
type Selection = { kind: 'node' | 'edge'; id: string } | null;
type Drag =
  | { kind: 'link'; from: string; x: number; y: number }
  | { kind: 'move'; id: string; x: number; y: number; dx: number; dy: number; moved: boolean }
  | null;
type Point = { x: number; y: number };

type NodeState = 'idle' | 'frontier' | 'visited' | 'current' | 'path';
type EdgeState = 'idle' | 'tree' | 'selected' | 'active' | 'path';

const EMPTY_FRAMES: AlgoGraphFrame[] = [];
const NO_IDS: readonly string[] = [];

const NODE_STYLE: Record<NodeState, NodeStyle> = {
  idle: nodeStyle(tint(LAB.plasma[400], 45)),
  frontier: nodeStyle(LAB.frontier, { width: 2 }),
  visited: nodeStyle(LAB.visited, { hot: true, width: 2.5 }),
  current: nodeStyle(LAB.compare, { hot: true, width: 3 }),
  path: nodeStyle(LAB.sorted, { hot: true, width: 3 }),
};

const EDGE_STYLE: Record<EdgeState, { stroke: string; width: number }> = {
  idle: { stroke: LAB.edge, width: 1.5 },
  tree: { stroke: tint(LAB.visited, 70), width: 2.5 },
  selected: { stroke: ACCENT, width: 3 },
  active: { stroke: LAB.compare, width: 3.5 },
  path: { stroke: LAB.sorted, width: 4 },
};

const FRONTIER_LABEL: Record<AlgoFrontierKind, string> = {
  queue: 'Queue',
  stack: 'Call stack',
  'priority-queue': 'Priority queue',
};

const TOOL_OPTIONS = [
  { value: 'build' as Tool, label: 'Build', icon: MousePointer2 },
  { value: 'move' as Tool, label: 'Move', icon: Hand },
];

const LEGEND: LegendItem[] = [
  { label: 'Current', color: LAB.compare, ring: true },
  { label: 'Visited', color: LAB.visited, ring: true },
  { label: 'In frontier', color: LAB.frontier, ring: true, dashed: true },
  { label: 'Path', color: LAB.sorted, ring: true },
];

function autoWeight(a: Point, b: Point): number {
  return clampWeight(Math.round(Math.hypot(a.x - b.x, a.y - b.y) / 60));
}

/** Same margin the store applies when a node is dropped (radius + 4). */
const CANVAS_MARGIN = R + 4;

function clampPoint(p: Point): Point {
  return {
    x: Math.max(CANVAS_MARGIN, Math.min(W - CANVAS_MARGIN, p.x)),
    y: Math.max(CANVAS_MARGIN, Math.min(H - CANVAS_MARGIN, p.y)),
  };
}

function NodeBadge({ letter, color, x, y }: { letter: string; color: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={8} style={{ fill: color }} stroke={LAB.ink[950]} strokeWidth={1.5} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={LAB.ink[950]}>
        {letter}
      </text>
    </g>
  );
}

function EdgeWeightEditor({ weight, onCommit }: { weight: number; onCommit: (weight: number) => void }) {
  const [draft, setDraft] = useState(String(weight));
  const value = Number(draft);
  const valid = /^\d+$/.test(draft) && value >= EDGE_WEIGHT_MIN && value <= EDGE_WEIGHT_MAX;
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label">Weight</span>
      <div className="w-20">
        <Input
          size="sm"
          type="number"
          min={EDGE_WEIGHT_MIN}
          max={EDGE_WEIGHT_MAX}
          step={1}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const parsed = Number(next);
            if (/^\d+$/.test(next) && parsed >= EDGE_WEIGHT_MIN && parsed <= EDGE_WEIGHT_MAX) onCommit(parsed);
          }}
          aria-invalid={!valid}
          aria-label="Edge weight"
          className="tabular font-mono"
        />
      </div>
      {!valid && <span className="text-xs text-danger">{`${EDGE_WEIGHT_MIN}–${EDGE_WEIGHT_MAX}`}</span>}
    </div>
  );
}

function DistanceTable({
  nodeIds,
  frame,
}: {
  nodeIds: readonly string[];
  frame: AlgoGraphFrame | null;
}) {
  const distances = frame?.distances ?? null;
  const previous = frame?.previous ?? null;
  const settled = new Set(frame?.visited ?? NO_IDS);
  return (
    <div className="flex w-40 shrink-0 flex-col border-l border-line bg-ink-950/35">
      <div className="hud-label flex h-9 shrink-0 items-center border-b border-line px-3">dist · prev</div>
      {distances && previous ? (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <table className="w-full font-mono text-xs">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="text-fg-subtle">
                <th scope="col" className="px-3 py-1.5 text-left text-2xs font-medium uppercase tracking-[0.14em]">v</th>
                <th scope="col" className="px-1 py-1.5 text-right text-2xs font-medium uppercase tracking-[0.14em]">dist</th>
                <th scope="col" className="px-3 py-1.5 text-right text-2xs font-medium uppercase tracking-[0.14em]">prev</th>
              </tr>
            </thead>
            <tbody>
              {nodeIds.map((id) => {
                const isCurrent = frame?.current === id;
                const isUpdated = frame?.updated === id;
                const onPath = frame?.path.includes(id) ?? false;
                const done = settled.has(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      'border-t border-line transition-colors duration-180',
                      onPath
                        ? 'bg-success/12 text-success'
                        : isUpdated
                          ? 'bg-success/8 text-success'
                          : isCurrent
                            ? 'bg-warning/12 text-warning'
                            : done
                              ? 'text-info'
                              : 'text-fg-muted'
                    )}
                  >
                    <td className="px-3 py-1">
                      <span className="flex items-center gap-1">
                        {id}
                        {done && <span className="size-1 rounded-full bg-current" aria-label="settled" />}
                      </span>
                    </td>
                    <td className="tabular px-1 py-1 text-right">{formatDistance(distances[id] ?? Infinity)}</td>
                    <td className="px-3 py-1 text-right">{previous[id] ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-fg-subtle">Run Dijkstra to watch every tentative distance and predecessor update.</p>
      )}
    </div>
  );
}

function GraphVisualizerInner({ algorithm }: { algorithm: GraphAlgorithmId }) {
  const meta = GRAPH_ALGORITHMS[algorithm];
  const graph = useAlgoLabStore((s) => s.graph);
  const preset = useAlgoLabStore((s) => s.graphPreset);
  const source = useAlgoLabStore((s) => s.graphSource);
  const target = useAlgoLabStore((s) => s.graphTarget);
  const speedLevel = useAlgoLabStore((s) => s.speeds.graph);
  const setSpeed = useAlgoLabStore((s) => s.setSpeed);
  const addNode = useAlgoLabStore((s) => s.addNode);
  const moveNode = useAlgoLabStore((s) => s.moveNode);
  const removeNode = useAlgoLabStore((s) => s.removeNode);
  const addEdge = useAlgoLabStore((s) => s.addEdge);
  const setEdgeWeight = useAlgoLabStore((s) => s.setEdgeWeight);
  const removeEdge = useAlgoLabStore((s) => s.removeEdge);
  const loadGraphPreset = useAlgoLabStore((s) => s.loadGraphPreset);
  const clearGraph = useAlgoLabStore((s) => s.clearGraph);
  const setGraphSource = useAlgoLabStore((s) => s.setGraphSource);
  const setGraphTarget = useAlgoLabStore((s) => s.setGraphTarget);
  const recordRun = useAlgoLabStore((s) => s.recordRun);
  const recordDijkstraPath = useAlgoLabStore((s) => s.recordDijkstraPath);

  const [run, setRun] = useState<AlgoGraphFrame[] | null>(null);
  const [tool, setTool] = useState<Tool>('build');
  const [selection, setSelection] = useState<Selection>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pressRef = useRef<Point | null>(null);
  const reactId = useId();
  const patternId = `algo-grid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const frames = run ?? EMPTY_FRAMES;
  const stepsPerSecond = SPEED_LEVELS[speedLevel] ?? SPEED_LEVELS[DEFAULT_SPEED.graph];
  const player = usePlayback(frames, {
    stepsPerSecond,
    autoPlay: true,
    onComplete: () => {
      recordRun('graph');
      const finalFrame = frames[frames.length - 1];
      if (algorithm === 'dijkstra' && finalFrame && finalFrame.found === true) recordDijkstraPath();
    },
  });
  const frame = run ? (player.frame ?? null) : null;

  const nodeIds = useMemo(() => graph.nodes.map((node) => node.id).sort(compareNodeIds), [graph.nodes]);

  // Live positions: the dragged node follows the pointer until it is dropped.
  const positions = useMemo(() => {
    const map = new Map<string, Point>();
    for (const node of graph.nodes) map.set(node.id, { x: node.x, y: node.y });
    if (drag && drag.kind === 'move') map.set(drag.id, { x: drag.x, y: drag.y });
    return map;
  }, [graph.nodes, drag]);

  const visited = new Set(frame?.visited ?? NO_IDS);
  const frontier = new Set(frame?.frontier ?? NO_IDS);
  const pathNodes = new Set(frame?.path ?? NO_IDS);
  const pathEdges = new Set(frame?.pathEdges ?? NO_IDS);
  const treeEdges = new Set(frame?.treeEdges ?? NO_IDS);

  const nodeState = (id: string): NodeState => {
    if (pathNodes.has(id)) return 'path';
    if (frame?.current === id) return 'current';
    if (visited.has(id)) return 'visited';
    if (frontier.has(id)) return 'frontier';
    return 'idle';
  };

  const edgeState = (id: string): EdgeState => {
    if (pathEdges.has(id)) return 'path';
    if (frame?.activeEdge === id) return 'active';
    if (selection?.kind === 'edge' && selection.id === id) return 'selected';
    if (treeEdges.has(id)) return 'tree';
    return 'idle';
  };

  // ─── Pointer helpers (event handlers only) ───

  const pointFromEvent = (event: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return clampPoint({ x: p.x, y: p.y });
  };

  const nodeAt = (point: Point): string | null => {
    let best: string | null = null;
    let bestDistance = R + 8;
    for (const node of graph.nodes) {
      const pos = positions.get(node.id) ?? node;
      const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (distance <= bestDistance) {
        best = node.id;
        bestDistance = distance;
      }
    }
    return best;
  };

  const invalidateRun = () => setRun(null);

  const onNodePointerDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    const node = positions.get(id);
    if (!point || !node) return;
    pressRef.current = null;
    svgRef.current?.setPointerCapture(event.pointerId);
    setNotice(null);
    if (tool === 'move' || event.shiftKey) {
      setDrag({ kind: 'move', id, x: node.x, y: node.y, dx: node.x - point.x, dy: node.y - point.y, moved: false });
    } else {
      setDrag({ kind: 'link', from: id, x: point.x, y: point.y });
    }
  };

  const onEdgePointerDown = (event: ReactPointerEvent<SVGElement>, id: string) => {
    if (event.button !== 0) return;
    pressRef.current = null;
    setNotice(null);
    setSelection({ kind: 'edge', id });
  };

  const onBackgroundPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    pressRef.current = pointFromEvent(event);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (drag.kind === 'move') {
      const next = clampPoint({ x: point.x + drag.dx, y: point.y + drag.dy });
      setDrag({ ...drag, x: next.x, y: next.y, moved: true });
    } else {
      setDrag({ ...drag, x: point.x, y: point.y });
    }
  };

  const onBackgroundTap = (point: Point) => {
    if (selection) {
      setSelection(null);
      return;
    }
    if (tool !== 'build' || nodeAt(point) !== null) return;
    const id = addNode(point.x, point.y);
    if (id === null) {
      setNotice(`The canvas holds at most ${MAX_GRAPH_NODES} nodes.`);
      return;
    }
    setNotice(null);
    invalidateRun();
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    if (!drag) {
      const press = pressRef.current;
      pressRef.current = null;
      if (press && point && Math.hypot(point.x - press.x, point.y - press.y) <= 6) onBackgroundTap(point);
      return;
    }
    const finished = drag;
    setDrag(null);
    if (finished.kind === 'move') {
      if (finished.moved) moveNode(finished.id, finished.x, finished.y);
      else setSelection({ kind: 'node', id: finished.id });
      return;
    }
    const hit = point ? nodeAt(point) : null;
    if (hit === null) return;
    if (hit === finished.from) {
      setSelection({ kind: 'node', id: hit });
      return;
    }
    const from = positions.get(finished.from);
    const to = positions.get(hit);
    const edgeId = addEdge(finished.from, hit, from && to ? autoWeight(from, to) : 1);
    if (edgeId === null) {
      setNotice(`${finished.from} and ${hit} are already connected. Click the weight to edit it.`);
      return;
    }
    setSelection({ kind: 'edge', id: edgeId });
    invalidateRun();
  };

  const onPointerCancel = () => {
    setDrag(null);
    pressRef.current = null;
  };

  // ─── Editing actions ───

  const deleteSelection = () => {
    if (!selection) return;
    if (selection.kind === 'node') removeNode(selection.id);
    else removeEdge(selection.id);
    setSelection(null);
    invalidateRun();
  };

  const runAlgorithm = () => {
    const next = buildGraphFrames(algorithm, graph, source, target);
    if (next.length === 0) {
      setNotice('Pick a source node first (or click the canvas to add one).');
      return;
    }
    setSelection(null);
    setNotice(null);
    setRun(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const element = event.target instanceof HTMLElement ? event.target : null;
    const typing = element !== null && element.closest('input, textarea, select, [contenteditable="true"]') !== null;
    if (!typing && selection && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (!typing && event.key === 'Escape') {
      setSelection(null);
      setDrag(null);
      return;
    }
    handlePlaybackKeys(event, player);
  };

  const selectedEdge = selection?.kind === 'edge' ? graph.edges.find((edge) => edge.id === selection.id) : undefined;
  const selectedNode = selection?.kind === 'node' ? graph.nodes.find((node) => node.id === selection.id) : undefined;
  const linkFrom = drag && drag.kind === 'link' ? positions.get(drag.from) : undefined;

  // ─── Toolbar ───

  const runLabel = algorithm === 'dijkstra' ? 'Dijkstra' : algorithm.toUpperCase();
  const nodeOptions = nodeIds.map((id) => ({ value: id, label: id }));

  const toolbar = (
    <>
      <SegmentedControl<Tool>
        size="sm"
        aria-label="Editing tool"
        value={tool}
        onChange={setTool}
        options={TOOL_OPTIONS}
      />

      <ToolbarSeparator />

      <div className="w-24 shrink-0" title="Source node">
        <Select
          size="sm"
          aria-label="Source"
          leadingIcon={Flag}
          value={source ?? ''}
          onValueChange={(value) => {
            setGraphSource(value === '' ? null : value);
            invalidateRun();
          }}
          options={[{ value: '', label: '–' }, ...nodeOptions]}
        />
      </div>
      <div className="w-36 shrink-0" title="Target node">
        <Select
          size="sm"
          aria-label="Target"
          leadingIcon={Target}
          value={target ?? ''}
          onValueChange={(value) => {
            setGraphTarget(value === '' ? null : value);
            invalidateRun();
          }}
          options={[{ value: '', label: 'None (visit all)' }, ...nodeOptions]}
        />
      </div>

      {run ? (
        <>
          <Button size="sm" variant="secondary" leadingIcon={RotateCcw} onClick={runAlgorithm}>
            Run again
          </Button>
          <IconButton
            icon={X}
            size="sm"
            aria-label="Clear the highlights and go back to editing"
            tooltip
            onClick={invalidateRun}
          />
        </>
      ) : (
        <Button
          size="sm"
          variant="primary"
          leadingIcon={Play}
          onClick={runAlgorithm}
          disabled={source === null || graph.nodes.length === 0}
        >
          Run {runLabel}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1 pl-2">
        <div className="w-44 shrink-0">
          <Select
            size="sm"
            aria-label="Preset graph"
            value={preset === 'custom' ? '' : preset}
            onValueChange={(value) => {
              const chosen = GRAPH_PRESETS.find((candidate) => candidate.id === value);
              if (!chosen) return;
              loadGraphPreset(chosen.id);
              setSelection(null);
              setNotice(null);
              invalidateRun();
            }}
          >
            <option value="" disabled>
              Custom graph
            </option>
            {GRAPH_PRESETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                Preset: {candidate.name}
              </option>
            ))}
          </Select>
        </div>
        <IconButton
          icon={Eraser}
          size="sm"
          variant="ghost-danger"
          aria-label="Remove every node and edge"
          tooltip
          onClick={() => {
            clearGraph();
            setSelection(null);
            setNotice(null);
            invalidateRun();
          }}
        />
      </div>
    </>
  );

  const subbar = (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-1.5 text-xs">
      {selectedEdge ? (
        <>
          <span className="font-mono text-ui font-medium text-accent">
            Edge {selectedEdge.from}–{selectedEdge.to}
          </span>
          <EdgeWeightEditor
            key={selectedEdge.id}
            weight={selectedEdge.weight}
            onCommit={(weight) => {
              setEdgeWeight(selectedEdge.id, weight);
              invalidateRun();
            }}
          />
          <Button size="sm" variant="danger" leadingIcon={Trash2} onClick={deleteSelection}>
            Delete edge
          </Button>
        </>
      ) : selectedNode ? (
        <>
          <span className="font-mono text-ui font-medium text-accent">Node {selectedNode.id}</span>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={Flag}
            onClick={() => {
              setGraphSource(selectedNode.id);
              invalidateRun();
            }}
            disabled={source === selectedNode.id}
          >
            Set as source
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={Target}
            onClick={() => {
              setGraphTarget(selectedNode.id);
              invalidateRun();
            }}
            disabled={target === selectedNode.id}
          >
            Set as target
          </Button>
          <Button size="sm" variant="danger" leadingIcon={Trash2} onClick={deleteSelection}>
            Delete node
          </Button>
        </>
      ) : notice ? (
        <span className="flex items-center gap-2 text-warning" role="status">
          <TriangleAlert size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          {notice}
        </span>
      ) : (
        <span className="flex min-w-0 items-center gap-2 text-fg-subtle">
          <Info size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          <span className="truncate" title="Click empty space to add a node · drag from one node to another to connect them · Shift+drag (or Move) to reposition · click a node or weight to edit · Delete removes the selection">
            Click empty space to add a node · drag node to node to connect · Shift+drag (or Move) to reposition · click a
            node or weight to edit · Delete removes the selection
          </span>
        </span>
      )}
    </div>
  );

  // ─── Stage ───

  const stage = (
    <div className="flex min-h-0 flex-1">
      <div className="relative min-w-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn('h-full w-full touch-none select-none', tool === 'move' ? 'cursor-grab' : 'cursor-crosshair')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          role="application"
          aria-label="Graph canvas"
        >
          <defs>
            <pattern id={patternId} width={40} height={40} patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={LAB.grid} strokeWidth={1} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patternId})`} onPointerDown={onBackgroundPointerDown} />

          {graph.edges.map((edge) => {
            const a = positions.get(edge.from);
            const b = positions.get(edge.to);
            if (!a || !b) return null;
            const state = edgeState(edge.id);
            const style = EDGE_STYLE[state];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onPointerDown={(event) => onEdgePointerDown(event, edge.id)}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeLinecap="round"
                  pointerEvents="none"
                  style={{ stroke: style.stroke, strokeWidth: style.width, transition: 'stroke 200ms, stroke-width 200ms' }}
                />
                <g
                  transform={`translate(${mx} ${my})`}
                  className="cursor-pointer"
                  onPointerDown={(event) => onEdgePointerDown(event, edge.id)}
                >
                  <rect
                    x={-14}
                    y={-10}
                    width={28}
                    height={20}
                    rx={6}
                    fill={LAB.ink[900]}
                    style={{ stroke: state === 'idle' ? LAB.line.strong : style.stroke }}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontFamily="var(--font-mono), monospace"
                    style={{ fill: state === 'idle' ? LAB.fg.muted : style.stroke }}
                    pointerEvents="none"
                  >
                    {edge.weight}
                  </text>
                </g>
              </g>
            );
          })}

          {drag && drag.kind === 'link' && linkFrom && (
            <line
              x1={linkFrom.x}
              y1={linkFrom.y}
              x2={drag.x}
              y2={drag.y}
              style={{ stroke: ACCENT }}
              strokeWidth={2}
              strokeDasharray="7 6"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}

          {graph.nodes.map((node) => {
            const pos = positions.get(node.id) ?? node;
            const state = nodeState(node.id);
            const style = NODE_STYLE[state];
            const selected = selection?.kind === 'node' && selection.id === node.id;
            const distance = frame?.distances ? frame.distances[node.id] : undefined;
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x} ${pos.y})`}
                className={tool === 'move' ? 'cursor-grab' : 'cursor-pointer'}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
              >
                {selected && <circle r={R + 7} fill="none" style={{ stroke: ACCENT }} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 3" />}
                {state === 'current' && <circle r={R + 6} fill="none" stroke={LAB.compare} strokeOpacity={0.28} strokeWidth={6} />}
                <circle
                  r={R}
                  strokeDasharray={state === 'frontier' ? '5 4' : undefined}
                  style={{
                    fill: style.fill,
                    stroke: style.stroke,
                    strokeWidth: style.width,
                    transition: 'fill 200ms, stroke 200ms',
                  }}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={15}
                  fontWeight={600}
                  fontFamily="var(--font-mono), monospace"
                  fill={style.text}
                  pointerEvents="none"
                >
                  {node.id}
                </text>
                {node.id === source && <NodeBadge letter="S" color={ACCENT} x={-R + 3} y={-R + 3} />}
                {node.id === target && <NodeBadge letter="T" color={LAB.target} x={R - 3} y={-R + 3} />}
                {distance !== undefined && (
                  <text
                    y={R + 15}
                    textAnchor="middle"
                    fontSize={12}
                    fontFamily="var(--font-mono), monospace"
                    fill={frame?.updated === node.id ? LAB.sorted : LAB.fg.muted}
                    fontWeight={frame?.updated === node.id ? 700 : 400}
                    pointerEvents="none"
                  >
                    {formatDistance(distance)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {graph.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <EmptyState
              size="sm"
              grid={false}
              icon={Waypoints}
              title="Empty canvas"
              description="Click anywhere to add your first node, or pick a preset."
            />
          </div>
        )}
      </div>
      {algorithm === 'dijkstra' && <DistanceTable nodeIds={nodeIds} frame={frame} />}
    </div>
  );

  // ─── Narration ───

  const frontierKind = frame?.frontierKind ?? (algorithm === 'bfs' ? 'queue' : algorithm === 'dfs' ? 'stack' : 'priority-queue');
  const frontierText =
    frame && frame.frontier.length > 0
      ? frame.frontier
          .map((id) =>
            frame.frontierKind === 'priority-queue' && frame.distances
              ? `${id}(${formatDistance(frame.distances[id] ?? Infinity)})`
              : id
          )
          .join(frame.frontierKind === 'stack' ? ' → ' : ' · ')
      : 'empty';
  const orderText = frame && frame.order.length > 0 ? frame.order.join(' ') : '–';

  const structures = (
    <div className="grid shrink-0 grid-cols-1 gap-x-6 gap-y-1 border-b border-line px-3 py-2 @xl/stage:grid-cols-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="hud-label shrink-0">{FRONTIER_LABEL[frontierKind]}</span>
        <span className="tabular min-w-0 truncate font-mono text-xs text-viz-3" title={frontierText}>
          {frontierText}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="hud-label shrink-0">Order</span>
        <span className="tabular min-w-0 truncate font-mono text-xs text-info" title={orderText}>
          {orderText}
        </span>
      </span>
    </div>
  );

  return (
    <LabLayout
      view={algorithm}
      title={meta.name}
      category="graph"
      toolbar={toolbar}
      subbar={subbar}
      stage={
        <>
          {structures}
          {stage}
          <StageLegend items={LEGEND} />
        </>
      }
      stageLabel="Graph canvas. Delete removes the selected node or edge; Space plays or pauses."
      narration={
        <StepMessage
          message={
            frame
              ? frame.message
              : `Pick a source${algorithm === 'bfs' || algorithm === 'dijkstra' ? ' and target' : ''}, then press Run. ${graph.nodes.length} nodes, ${graph.edges.length} edges.`
          }
        >
          {frame ? (
            <>
              {frame.pathCost !== null && <Stat label="path cost" value={frame.pathCost} tone="success" />}
              <Stat label="visited" value={frame.visited.length} tone="info" />
            </>
          ) : null}
        </StepMessage>
      }
      aside={
        <>
          <ComplexityCard meta={meta} />
          <CodePanel title={meta.name} lines={meta.pseudocode} activeLine={frame ? frame.line : -1} meta={meta} className="flex-1" />
        </>
      }
      playback={
        <PlaybackControls
          player={player}
          speedKind="graph"
          speedLevel={speedLevel}
          onSpeedChange={(level) => setSpeed('graph', level)}
          disabled={!run}
          emphasis="soft"
        />
      }
      onStageKeyDown={onKeyDown}
    />
  );
}

export const GraphVisualizer = memo(GraphVisualizerInner);
