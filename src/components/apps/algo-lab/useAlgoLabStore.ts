// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Store
// Persisted lab state: selection, dataset, graph, trees, speeds
// and progress (drives the Algo Lab achievements)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  AlgoDatasetShape,
  AlgoGraph,
  AlgoLabView,
  AlgoTreeMode,
  AlgoTreeNode,
  SortAlgorithmId,
} from '@/types/algo';
import { useXPStore } from '@/stores/useXPStore';
import { DEFAULT_GRAPH_PRESET, GRAPH_PRESETS, TREE_MODES, getGraphPreset, isAlgoLabView } from '@/data/algorithms';
import type { GraphPreset, GraphPresetId } from '@/data/algorithms';
import {
  ARRAY_SIZE_DEFAULT,
  ARRAY_SIZE_MAX,
  ARRAY_SIZE_MIN,
  DEFAULT_SPEED,
  EDGE_WEIGHT_MAX,
  EDGE_WEIGHT_MIN,
  GRAPH_VIEW_HEIGHT,
  GRAPH_VIEW_WIDTH,
  MAX_GRAPH_NODES,
  MAX_TREE_NODES,
  RACE_SPEED_LEVELS,
  SPEED_LEVELS,
  type SpeedKind,
} from '@/lib/algorithms/constants';
import { createRng, generateDataset } from '@/lib/algorithms/dataset';
import { compareNodeIds, makeEdge } from '@/lib/algorithms/graph';
import { isSortAlgorithmId, SORT_ALGORITHM_IDS } from '@/lib/algorithms/sorting';
import { buildTree, isAvlBalanced, treeValues } from '@/lib/algorithms/tree';

/** Achievement ids unlocked from the lab. Definitions live in src/data/achievements.ts. */
export const ALGO_ACHIEVEMENTS = {
  firstRun: 'algo-first-run',
  allSorts: 'algo-all-sorts',
  dijkstraPath: 'algo-dijkstra-path',
  raceFinished: 'algo-race-finished',
  avlRotation: 'algo-avl-rotation',
} as const;

export type DatasetSource = AlgoDatasetShape | 'custom';
export type RunKind = 'sort' | 'graph' | 'tree';

const DATASET_SOURCES: readonly DatasetSource[] = ['random', 'nearly-sorted', 'reversed', 'few-unique', 'custom'];

interface AlgoLabState {
  view: AlgoLabView;

  // Sorting dataset (shared by the sorting visualizer and Compare Mode)
  dataset: number[];
  datasetSource: DatasetSource;
  arraySize: number;

  // Graph editor
  graph: AlgoGraph;
  graphPreset: GraphPresetId | 'custom';
  graphSource: string | null;
  graphTarget: string | null;

  // One tree per structure
  trees: Record<AlgoTreeMode, AlgoTreeNode | null>;

  // Playback speed levels (indices into SPEED_LEVELS / RACE_SPEED_LEVELS)
  speeds: Record<SpeedKind, number>;

  // Compare Mode contenders
  raceLeft: SortAlgorithmId;
  raceRight: SortAlgorithmId;

  // Progress
  completedSorts: SortAlgorithmId[];
  totalRuns: number;
  racesFinished: number;
  dijkstraPaths: number;
  rotationsSeen: number;
  lastUsedAt: string | null;

  // ─── Actions ───
  setView: (view: AlgoLabView) => void;
  regenerateDataset: (shape?: AlgoDatasetShape, size?: number) => void;
  setCustomDataset: (values: number[]) => void;
  setSpeed: (kind: SpeedKind, level: number) => void;

  addNode: (x: number, y: number) => string | null;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  addEdge: (a: string, b: string, weight: number) => string | null;
  setEdgeWeight: (id: string, weight: number) => void;
  removeEdge: (id: string) => void;
  loadGraphPreset: (id: GraphPresetId) => void;
  clearGraph: () => void;
  setGraphSource: (id: string | null) => void;
  setGraphTarget: (id: string | null) => void;

  setTree: (mode: AlgoTreeMode, root: AlgoTreeNode | null) => void;
  resetTree: (mode: AlgoTreeMode) => void;

  setRaceSide: (side: 'left' | 'right', algorithm: SortAlgorithmId) => void;

  recordRun: (kind: RunKind, sort?: SortAlgorithmId) => void;
  recordRace: (left: SortAlgorithmId, right: SortAlgorithmId) => void;
  recordDijkstraPath: () => void;
  recordRotations: (count: number) => void;
  touch: () => void;
}

// ─── Helpers ───

function unlock(id: string): void {
  useXPStore.getState().unlockAchievement(id);
}

export function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return EDGE_WEIGHT_MIN;
  return Math.max(EDGE_WEIGHT_MIN, Math.min(EDGE_WEIGHT_MAX, Math.round(weight)));
}

function clampToCanvas(value: number, max: number): number {
  const margin = 26;
  return Math.max(margin, Math.min(max - margin, Math.round(value)));
}

function cloneGraph(graph: AlgoGraph): AlgoGraph {
  return {
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

function firstFreeLabel(graph: AlgoGraph): string | null {
  const used = new Set(graph.nodes.map((node) => node.id));
  for (let code = 65; code < 65 + MAX_GRAPH_NODES; code++) {
    const label = String.fromCharCode(code);
    if (!used.has(label)) return label;
  }
  return null;
}

function presetTree(mode: AlgoTreeMode): AlgoTreeNode | null {
  return buildTree(mode, TREE_MODES[mode].presetValues);
}

function clampLevel(level: number, kind: SpeedKind): number {
  const max = (kind === 'race' ? RACE_SPEED_LEVELS : SPEED_LEVELS).length - 1;
  if (!Number.isFinite(level)) return DEFAULT_SPEED[kind];
  return Math.max(0, Math.min(max, Math.round(level)));
}

function graphFromPreset(preset: GraphPreset) {
  return {
    graph: cloneGraph(preset.graph),
    graphPreset: preset.id,
    graphSource: preset.source,
    graphTarget: preset.target,
  };
}

// Deterministic first dataset: no randomness at module load.
const INITIAL_DATASET = generateDataset('random', ARRAY_SIZE_DEFAULT, createRng(20260928));

type PersistedLab = Pick<
  AlgoLabState,
  | 'view'
  | 'dataset'
  | 'datasetSource'
  | 'arraySize'
  | 'graph'
  | 'graphPreset'
  | 'graphSource'
  | 'graphTarget'
  | 'trees'
  | 'speeds'
  | 'raceLeft'
  | 'raceRight'
  | 'completedSorts'
  | 'totalRuns'
  | 'racesFinished'
  | 'dijkstraPaths'
  | 'rotationsSeen'
  | 'lastUsedAt'
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** A persisted graph with only well-formed nodes and edges, or null if unusable. */
function sanitizeGraph(raw: unknown): AlgoGraph | null {
  if (!isRecord(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
  const nodes: AlgoGraph['nodes'] = [];
  const seen = new Set<string>();
  for (const node of raw.nodes) {
    if (!isRecord(node) || typeof node.id !== 'string' || seen.has(node.id)) continue;
    if (typeof node.x !== 'number' || typeof node.y !== 'number') continue;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || nodes.length >= MAX_GRAPH_NODES) continue;
    seen.add(node.id);
    nodes.push({ id: node.id, x: clampToCanvas(node.x, GRAPH_VIEW_WIDTH), y: clampToCanvas(node.y, GRAPH_VIEW_HEIGHT) });
  }
  const edges: AlgoGraph['edges'] = [];
  const edgeIds = new Set<string>();
  for (const edge of raw.edges) {
    if (!isRecord(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string') continue;
    if (edge.from === edge.to || !seen.has(edge.from) || !seen.has(edge.to)) continue;
    const clean = makeEdge(edge.from, edge.to, clampWeight(Number(edge.weight)));
    if (edgeIds.has(clean.id)) continue;
    edgeIds.add(clean.id);
    edges.push(clean);
  }
  return { nodes, edges };
}

/**
 * A persisted tree rebuilt from well-formed nodes: null for an empty tree,
 * undefined when the data is unusable (not a BST, duplicate ids, too big).
 */
function sanitizeTree(raw: unknown, depth: number, ids: Set<string> = new Set()): AlgoTreeNode | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw) || depth > MAX_TREE_NODES || typeof raw.id !== 'string' || ids.has(raw.id)) return undefined;
  if (typeof raw.value !== 'number' || !Number.isInteger(raw.value)) return undefined;
  ids.add(raw.id);
  if (ids.size > MAX_TREE_NODES) return undefined;
  const left = sanitizeTree(raw.left, depth + 1, ids);
  const right = sanitizeTree(raw.right, depth + 1, ids);
  if (left === undefined || right === undefined) return undefined;
  const node: AlgoTreeNode = { id: raw.id, value: raw.value, left, right };
  const keys = treeValues(node);
  for (let i = 1; i < keys.length; i++) if (keys[i] <= keys[i - 1]) return undefined;
  return node;
}

/** Keep only well-formed persisted fields, so a damaged blob can never break the lab. */
function sanitizePersisted(raw: unknown): Partial<PersistedLab> {
  if (!isRecord(raw)) return {};
  const out: Partial<PersistedLab> = {};
  if (isAlgoLabView(raw.view)) out.view = raw.view;
  if (Array.isArray(raw.dataset) && raw.dataset.length >= 2 && raw.dataset.every((v) => isCount(v) && v >= 1)) {
    out.dataset = raw.dataset as number[];
  }
  const source = DATASET_SOURCES.find((candidate) => candidate === raw.datasetSource);
  if (source) out.datasetSource = source;
  if (isCount(raw.arraySize)) out.arraySize = Math.max(ARRAY_SIZE_MIN, Math.min(ARRAY_SIZE_MAX, raw.arraySize));
  const graph = sanitizeGraph(raw.graph);
  if (graph) {
    const ids = new Set(graph.nodes.map((node) => node.id));
    const preset = GRAPH_PRESETS.find((candidate) => candidate.id === raw.graphPreset);
    out.graph = graph;
    out.graphPreset = preset ? preset.id : 'custom';
    out.graphSource = typeof raw.graphSource === 'string' && ids.has(raw.graphSource) ? raw.graphSource : null;
    out.graphTarget = typeof raw.graphTarget === 'string' && ids.has(raw.graphTarget) ? raw.graphTarget : null;
  }
  if (isRecord(raw.trees)) {
    const bst = sanitizeTree(raw.trees.bst, 0);
    const avl = sanitizeTree(raw.trees.avl, 0);
    out.trees = {
      bst: bst === undefined ? presetTree('bst') : bst,
      avl: avl === undefined || !isAvlBalanced(avl) ? presetTree('avl') : avl,
    };
  }
  if (isRecord(raw.speeds)) {
    const speeds = raw.speeds;
    out.speeds = {
      sort: clampLevel(Number(speeds.sort ?? DEFAULT_SPEED.sort), 'sort'),
      graph: clampLevel(Number(speeds.graph ?? DEFAULT_SPEED.graph), 'graph'),
      tree: clampLevel(Number(speeds.tree ?? DEFAULT_SPEED.tree), 'tree'),
      race: clampLevel(Number(speeds.race ?? DEFAULT_SPEED.race), 'race'),
    };
  }
  if (typeof raw.raceLeft === 'string' && isSortAlgorithmId(raw.raceLeft)) out.raceLeft = raw.raceLeft;
  if (typeof raw.raceRight === 'string' && isSortAlgorithmId(raw.raceRight)) out.raceRight = raw.raceRight;
  if (Array.isArray(raw.completedSorts)) {
    out.completedSorts = raw.completedSorts.filter(
      (id): id is SortAlgorithmId => typeof id === 'string' && isSortAlgorithmId(id)
    );
  }
  if (isCount(raw.totalRuns)) out.totalRuns = raw.totalRuns;
  if (isCount(raw.racesFinished)) out.racesFinished = raw.racesFinished;
  if (isCount(raw.dijkstraPaths)) out.dijkstraPaths = raw.dijkstraPaths;
  if (isCount(raw.rotationsSeen)) out.rotationsSeen = raw.rotationsSeen;
  if (typeof raw.lastUsedAt === 'string') out.lastUsedAt = raw.lastUsedAt;
  return out;
}

export const useAlgoLabStore = create<AlgoLabState>()(
  persist(
    immer((set, get) => ({
      view: 'bubble-sort',

      dataset: INITIAL_DATASET,
      datasetSource: 'random',
      arraySize: ARRAY_SIZE_DEFAULT,

      ...graphFromPreset(DEFAULT_GRAPH_PRESET),

      trees: { bst: presetTree('bst'), avl: presetTree('avl') },

      speeds: { ...DEFAULT_SPEED },

      raceLeft: 'insertion-sort',
      raceRight: 'merge-sort',

      completedSorts: [],
      totalRuns: 0,
      racesFinished: 0,
      dijkstraPaths: 0,
      rotationsSeen: 0,
      lastUsedAt: null,

      setView: (view) =>
        set((s) => {
          s.view = view;
        }),

      regenerateDataset: (shape, size) =>
        set((s) => {
          const nextShape: AlgoDatasetShape =
            shape ?? (s.datasetSource === 'custom' ? 'random' : s.datasetSource);
          const nextSize = Math.max(ARRAY_SIZE_MIN, Math.min(ARRAY_SIZE_MAX, Math.round(size ?? s.arraySize)));
          s.dataset = generateDataset(nextShape, nextSize, Math.random);
          s.datasetSource = nextShape;
          s.arraySize = nextSize;
        }),

      setCustomDataset: (values) =>
        set((s) => {
          s.dataset = values.slice();
          s.datasetSource = 'custom';
          s.arraySize = Math.max(ARRAY_SIZE_MIN, Math.min(ARRAY_SIZE_MAX, values.length));
        }),

      setSpeed: (kind, level) =>
        set((s) => {
          s.speeds[kind] = clampLevel(level, kind);
        }),

      // ─── Graph editing ───

      addNode: (x, y) => {
        const label = firstFreeLabel(get().graph);
        if (label === null) return null;
        set((s) => {
          s.graph.nodes.push({
            id: label,
            x: clampToCanvas(x, GRAPH_VIEW_WIDTH),
            y: clampToCanvas(y, GRAPH_VIEW_HEIGHT),
          });
          s.graph.nodes.sort((a, b) => compareNodeIds(a.id, b.id));
          s.graphPreset = 'custom';
          if (s.graphSource === null) s.graphSource = label;
        });
        return label;
      },

      moveNode: (id, x, y) =>
        set((s) => {
          const node = s.graph.nodes.find((candidate) => candidate.id === id);
          if (!node) return;
          node.x = clampToCanvas(x, GRAPH_VIEW_WIDTH);
          node.y = clampToCanvas(y, GRAPH_VIEW_HEIGHT);
        }),

      removeNode: (id) =>
        set((s) => {
          s.graph.nodes = s.graph.nodes.filter((node) => node.id !== id);
          s.graph.edges = s.graph.edges.filter((edge) => edge.from !== id && edge.to !== id);
          s.graphPreset = 'custom';
          if (s.graphSource === id) s.graphSource = s.graph.nodes.length > 0 ? s.graph.nodes[0].id : null;
          if (s.graphTarget === id) s.graphTarget = null;
        }),

      addEdge: (a, b, weight) => {
        if (a === b) return null;
        const { graph } = get();
        const ids = new Set(graph.nodes.map((node) => node.id));
        if (!ids.has(a) || !ids.has(b)) return null;
        const edge = makeEdge(a, b, clampWeight(weight));
        if (graph.edges.some((existing) => existing.id === edge.id)) return null;
        set((s) => {
          s.graph.edges.push(edge);
          s.graphPreset = 'custom';
        });
        return edge.id;
      },

      setEdgeWeight: (id, weight) =>
        set((s) => {
          const edge = s.graph.edges.find((candidate) => candidate.id === id);
          if (!edge) return;
          edge.weight = clampWeight(weight);
          s.graphPreset = 'custom';
        }),

      removeEdge: (id) =>
        set((s) => {
          s.graph.edges = s.graph.edges.filter((edge) => edge.id !== id);
          s.graphPreset = 'custom';
        }),

      loadGraphPreset: (id) =>
        set((s) => {
          const next = graphFromPreset(getGraphPreset(id));
          s.graph = next.graph;
          s.graphPreset = next.graphPreset;
          s.graphSource = next.graphSource;
          s.graphTarget = next.graphTarget;
        }),

      clearGraph: () =>
        set((s) => {
          s.graph = { nodes: [], edges: [] };
          s.graphPreset = 'custom';
          s.graphSource = null;
          s.graphTarget = null;
        }),

      setGraphSource: (id) =>
        set((s) => {
          s.graphSource = id;
        }),

      setGraphTarget: (id) =>
        set((s) => {
          s.graphTarget = id;
        }),

      // ─── Trees ───

      setTree: (mode, root) =>
        set((s) => {
          s.trees[mode] = root;
        }),

      resetTree: (mode) =>
        set((s) => {
          s.trees[mode] = presetTree(mode);
        }),

      // ─── Compare Mode ───

      setRaceSide: (side, algorithm) =>
        set((s) => {
          if (side === 'left') s.raceLeft = algorithm;
          else s.raceRight = algorithm;
        }),

      // ─── Progress & achievements ───

      recordRun: (kind, sort) => {
        set((s) => {
          s.totalRuns += 1;
          if (kind === 'sort' && sort && !s.completedSorts.includes(sort)) s.completedSorts.push(sort);
        });
        unlock(ALGO_ACHIEVEMENTS.firstRun);
        const done = get().completedSorts;
        if (SORT_ALGORITHM_IDS.every((id) => done.includes(id))) unlock(ALGO_ACHIEVEMENTS.allSorts);
      },

      recordRace: (left, right) => {
        set((s) => {
          s.racesFinished += 1;
          s.totalRuns += 1;
          for (const id of [left, right]) {
            if (!s.completedSorts.includes(id)) s.completedSorts.push(id);
          }
        });
        unlock(ALGO_ACHIEVEMENTS.firstRun);
        unlock(ALGO_ACHIEVEMENTS.raceFinished);
        const done = get().completedSorts;
        if (SORT_ALGORITHM_IDS.every((id) => done.includes(id))) unlock(ALGO_ACHIEVEMENTS.allSorts);
      },

      recordDijkstraPath: () => {
        set((s) => {
          s.dijkstraPaths += 1;
        });
        unlock(ALGO_ACHIEVEMENTS.dijkstraPath);
      },

      recordRotations: (count) => {
        if (count <= 0) return;
        set((s) => {
          s.rotationsSeen += count;
        });
        unlock(ALGO_ACHIEVEMENTS.avlRotation);
      },

      touch: () =>
        set((s) => {
          s.lastUsedAt = new Date().toISOString();
        }),
    })),
    {
      name: 'warrior-os-algo-lab',
      partialize: (state): PersistedLab => ({
        view: state.view,
        dataset: state.dataset,
        datasetSource: state.datasetSource,
        arraySize: state.arraySize,
        graph: state.graph,
        graphPreset: state.graphPreset,
        graphSource: state.graphSource,
        graphTarget: state.graphTarget,
        trees: state.trees,
        speeds: state.speeds,
        raceLeft: state.raceLeft,
        raceRight: state.raceRight,
        completedSorts: state.completedSorts,
        totalRuns: state.totalRuns,
        racesFinished: state.racesFinished,
        dijkstraPaths: state.dijkstraPaths,
        rotationsSeen: state.rotationsSeen,
        lastUsedAt: state.lastUsedAt,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    }
  )
);
