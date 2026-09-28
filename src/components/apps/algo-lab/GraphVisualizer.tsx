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
import { Eraser, Flag, Hand, MousePointer2, Play, Target, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { LabLayout, Stat, StepMessage } from './LabLayout';

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

const NODE_STYLE: Record<NodeState, { fill: string; stroke: string; text: string; width: number }> = {
  idle: { fill: '#0f172a', stroke: 'rgba(34, 211, 238, 0.55)', text: '#e2e8f0', width: 2 },
  frontier: { fill: '#1e1b4b', stroke: '#a78bfa', text: '#ddd6fe', width: 2.5 },
  visited: { fill: 'rgba(59, 130, 246, 0.38)', stroke: '#60a5fa', text: '#dbeafe', width: 2.5 },
  current: { fill: 'rgba(250, 204, 21, 0.35)', stroke: '#facc15', text: '#fef9c3', width: 3.5 },
  path: { fill: 'rgba(16, 185, 129, 0.42)', stroke: '#34d399', text: '#d1fae5', width: 3.5 },
};

const EDGE_STYLE: Record<EdgeState, { stroke: string; width: number }> = {
  idle: { stroke: 'rgba(255, 255, 255, 0.22)', width: 2 },
  tree: { stroke: 'rgba(96, 165, 250, 0.75)', width: 3 },
  selected: { stroke: '#22d3ee', width: 3.5 },
  active: { stroke: '#facc15', width: 4 },
  path: { stroke: '#34d399', width: 5 },
};

const FRONTIER_LABEL: Record<AlgoFrontierKind, string> = {
  queue: 'Queue',
  stack: 'Call stack',
  'priority-queue': 'Priority queue',
};

const TOOL_OPTIONS: { id: Tool; label: string; hint: string }[] = [
  { id: 'build', label: 'Build', hint: 'Click to add nodes, drag node to node to connect' },
  { id: 'move', label: 'Move', hint: 'Drag nodes to reposition them' },
];

const LEGEND: { label: string; color: string; dashed?: boolean }[] = [
  { label: 'Current', color: '#facc15' },
  { label: 'Visited', color: '#60a5fa' },
  { label: 'In frontier', color: '#a78bfa', dashed: true },
  { label: 'Path', color: '#34d399' },
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
      <circle r={8} fill={color} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#0b1020">
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
    <label className="flex items-center gap-1.5 text-[11px] text-white/60">
      Weight
      <input
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
        className={cn(
          'w-16 rounded-md border bg-black/40 px-2 py-1 font-mono text-[12px] text-white outline-none',
          valid ? 'border-white/15 focus:border-cyan-400/60' : 'border-rose-500/60'
        )}
      />
      {!valid && <span className="text-rose-300">{`${EDGE_WEIGHT_MIN}–${EDGE_WEIGHT_MAX}`}</span>}
    </label>
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
    <div className="flex w-36 shrink-0 flex-col border-l border-white/10 bg-black/25">
      <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/55">
        dist[ ] &amp; prev[ ]
      </div>
      {distances && previous ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          <table className="w-full font-mono text-[11px]">
            <thead className="sticky top-0 bg-[#0c0f1a] text-white/50">
              <tr>
                <th className="px-2 py-1 text-left font-normal">v</th>
                <th className="px-1 py-1 text-right font-normal">dist</th>
                <th className="px-2 py-1 text-right font-normal">prev</th>
              </tr>
            </thead>
            <tbody>
              {nodeIds.map((id) => {
                const isCurrent = frame?.current === id;
                const isUpdated = frame?.updated === id;
                const onPath = frame?.path.includes(id) ?? false;
                return (
                  <tr
                    key={id}
                    className={cn(
                      'transition-colors duration-200',
                      onPath
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : isUpdated
                          ? 'bg-emerald-400/10 text-emerald-200'
                          : isCurrent
                            ? 'bg-yellow-400/15 text-yellow-100'
                            : settled.has(id)
                              ? 'text-sky-200'
                              : 'text-white/70'
                    )}
                  >
                    <td className="px-2 py-0.5">
                      {id}
                      {settled.has(id) && <span className="ml-1 text-sky-300">✓</span>}
                    </td>
                    <td className="px-1 py-0.5 text-right tabular-nums">{formatDistance(distances[id] ?? Infinity)}</td>
                    <td className="px-2 py-0.5 text-right">{previous[id] ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-2.5 text-[11px] leading-snug text-white/50">
          Run Dijkstra to watch every tentative distance and predecessor update.
        </p>
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

  const toolbar = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
        <div className="flex items-center rounded-md border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Editing tool">
          {TOOL_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              aria-pressed={tool === option.id}
              onClick={() => setTool(option.id)}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-0.5 transition-colors',
                tool === option.id ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/60 hover:text-white'
              )}
            >
              {option.id === 'build' ? (
                <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Hand className="h-3.5 w-3.5" aria-hidden />
              )}
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-white/60">
          <Flag className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          Source
          <select
            value={source ?? ''}
            onChange={(event) => {
              setGraphSource(event.target.value === '' ? null : event.target.value);
              invalidateRun();
            }}
            className="rounded-md border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-white outline-none focus:border-cyan-400/60"
          >
            <option value="" className="bg-[#0f1220]">
              –
            </option>
            {nodeIds.map((id) => (
              <option key={id} value={id} className="bg-[#0f1220]">
                {id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-white/60">
          <Target className="h-3.5 w-3.5 text-pink-300" aria-hidden />
          Target
          <select
            value={target ?? ''}
            onChange={(event) => {
              setGraphTarget(event.target.value === '' ? null : event.target.value);
              invalidateRun();
            }}
            className="rounded-md border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-white outline-none focus:border-cyan-400/60"
          >
            <option value="" className="bg-[#0f1220]">
              none (visit all)
            </option>
            {nodeIds.map((id) => (
              <option key={id} value={id} className="bg-[#0f1220]">
                {id}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={runAlgorithm}
          disabled={source === null || graph.nodes.length === 0}
          className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/20 px-2.5 py-1 font-medium text-cyan-100 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          {run ? 'Run again' : `Run ${algorithm === 'dijkstra' ? 'Dijkstra' : algorithm.toUpperCase()}`}
        </button>
        {run && (
          <button
            type="button"
            onClick={invalidateRun}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
            title="Clear the highlights and go back to editing"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear run
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={preset === 'custom' ? '' : preset}
            onChange={(event) => {
              const chosen = GRAPH_PRESETS.find((candidate) => candidate.id === event.target.value);
              if (!chosen) return;
              loadGraphPreset(chosen.id);
              setSelection(null);
              setNotice(null);
              invalidateRun();
            }}
            aria-label="Preset graph"
            className="rounded-md border border-white/15 bg-black/40 px-1.5 py-1 text-white outline-none focus:border-cyan-400/60"
          >
            <option value="" disabled className="bg-[#0f1220]">
              Custom graph
            </option>
            {GRAPH_PRESETS.map((candidate) => (
              <option key={candidate.id} value={candidate.id} className="bg-[#0f1220]">
                Preset: {candidate.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              clearGraph();
              setSelection(null);
              setNotice(null);
              invalidateRun();
            }}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
            title="Remove every node and edge"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        </div>
      </div>

      <div className="flex min-h-[1.75rem] flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {selectedEdge ? (
          <>
            <span className="font-mono text-cyan-200">
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
            <button
              type="button"
              onClick={deleteSelection}
              className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete edge
            </button>
          </>
        ) : selectedNode ? (
          <>
            <span className="font-mono text-cyan-200">Node {selectedNode.id}</span>
            <button
              type="button"
              onClick={() => {
                setGraphSource(selectedNode.id);
                invalidateRun();
              }}
              disabled={source === selectedNode.id}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/75 hover:bg-white/10 disabled:opacity-40"
            >
              Set as source
            </button>
            <button
              type="button"
              onClick={() => {
                setGraphTarget(selectedNode.id);
                invalidateRun();
              }}
              disabled={target === selectedNode.id}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/75 hover:bg-white/10 disabled:opacity-40"
            >
              Set as target
            </button>
            <button
              type="button"
              onClick={deleteSelection}
              className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete node
            </button>
          </>
        ) : notice ? (
          <span className="text-amber-200">{notice}</span>
        ) : (
          <span className="text-white/50">
            Click empty space to add a node · drag from one node to another to connect them · Shift+drag (or Move)
            to reposition · click a node or weight to edit · Delete removes the selection
          </span>
        )}
      </div>
    </div>
  );

  // ─── Stage ───

  const stage = (
    <div className="flex h-full min-h-0">
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
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
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
                    fill="#0b1020"
                    stroke={state === 'idle' ? 'rgba(255,255,255,0.18)' : style.stroke}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontFamily="var(--font-mono), monospace"
                    fill={state === 'idle' ? 'rgba(255,255,255,0.8)' : style.stroke}
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
              stroke="#22d3ee"
              strokeWidth={2.5}
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
                {selected && <circle r={R + 7} fill="none" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={2} />}
                {state === 'current' && <circle r={R + 6} fill="none" stroke="#facc15" strokeOpacity={0.35} strokeWidth={6} />}
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
                {node.id === source && <NodeBadge letter="S" color="#22d3ee" x={-R + 3} y={-R + 3} />}
                {node.id === target && <NodeBadge letter="T" color="#f472b6" x={R - 3} y={-R + 3} />}
                {distance !== undefined && (
                  <text
                    y={R + 15}
                    textAnchor="middle"
                    fontSize={12}
                    fontFamily="var(--font-mono), monospace"
                    fill={frame?.updated === node.id ? '#6ee7b7' : 'rgba(255,255,255,0.75)'}
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
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/50">
            Empty canvas. Click anywhere to add your first node, or pick a preset.
          </div>
        )}
      </div>
      {algorithm === 'dijkstra' && <DistanceTable nodeIds={nodeIds} frame={frame} />}
    </div>
  );

  // ─── Footer ───

  const footer = (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px]">
        <span className="flex min-w-0 items-center gap-1.5 text-white/60">
          <span className="shrink-0">{FRONTIER_LABEL[frame?.frontierKind ?? (algorithm === 'bfs' ? 'queue' : algorithm === 'dfs' ? 'stack' : 'priority-queue')]}:</span>
          <span className="truncate font-mono text-violet-200">
            {frame && frame.frontier.length > 0
              ? frame.frontier
                  .map((id) =>
                    frame.frontierKind === 'priority-queue' && frame.distances
                      ? `${id}(${formatDistance(frame.distances[id] ?? Infinity)})`
                      : id
                  )
                  .join(frame.frontierKind === 'stack' ? ' → ' : ' · ')
              : 'empty'}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-white/60">
          <span className="shrink-0">Order:</span>
          <span className="truncate font-mono text-sky-200">{frame && frame.order.length > 0 ? frame.order.join(' ') : '–'}</span>
        </span>
        <span className="ml-auto flex items-center gap-3 text-white/55">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full border-2"
                style={{ borderColor: item.color, borderStyle: item.dashed ? 'dashed' : 'solid' }}
                aria-hidden
              />
              {item.label}
            </span>
          ))}
        </span>
      </div>
      <StepMessage
        message={
          frame
            ? frame.message
            : `Pick a source${algorithm === 'bfs' || algorithm === 'dijkstra' ? ' and target' : ''}, then press Run. ${graph.nodes.length} nodes, ${graph.edges.length} edges.`
        }
      >
        {frame ? (
          <>
            {frame.pathCost !== null && <Stat label="path cost" value={frame.pathCost} className="text-emerald-300" />}
            <Stat label="visited" value={frame.visited.length} />
          </>
        ) : null}
      </StepMessage>
      <PlaybackControls
        player={player}
        speedKind="graph"
        speedLevel={speedLevel}
        onSpeedChange={(level) => setSpeed('graph', level)}
        disabled={!run}
      />
    </>
  );

  return (
    <LabLayout
      title={meta.name}
      subtitle={meta.description}
      category="graph"
      toolbar={toolbar}
      stage={stage}
      stageLabel="Graph canvas. Delete removes the selected node or edge; Space plays or pauses."
      footer={footer}
      code={<CodePanel title={meta.name} lines={meta.pseudocode} activeLine={frame ? frame.line : -1} />}
      details={<ComplexityCard meta={meta} />}
      onStageKeyDown={onKeyDown}
    />
  );
}

export const GraphVisualizer = memo(GraphVisualizerInner);
