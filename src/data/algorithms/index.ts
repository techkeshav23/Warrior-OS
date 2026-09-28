// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algorithm Catalogue
// Metadata for every Algo Lab algorithm plus the sidebar layout
// ═══════════════════════════════════════════════════════════

import type {
  AlgoCategory,
  AlgoLabView,
  AlgoTreeMode,
  AlgorithmId,
  AlgorithmMeta,
  GraphAlgorithmId,
  SortAlgorithmId,
} from '@/types/algo';
import { SORTING_ALGORITHMS } from './sorting';
import { GRAPH_ALGORITHMS } from './graph';
import { TREE_OPERATIONS } from './tree';

export { SORTING_ALGORITHMS } from './sorting';
export { GRAPH_ALGORITHMS, GRAPH_PRESETS, DEFAULT_GRAPH_PRESET, getGraphPreset } from './graph';
export type { GraphPreset, GraphPresetId } from './graph';
export { TREE_OPERATIONS, TREE_MODES } from './tree';
export type { TreeModeInfo } from './tree';

/** Every algorithm the lab can visualize (17 entries). */
export const ALGORITHMS: Record<AlgorithmId, AlgorithmMeta> = {
  ...SORTING_ALGORITHMS,
  ...GRAPH_ALGORITHMS,
  ...TREE_OPERATIONS,
};

export function getAlgorithm(id: AlgorithmId): AlgorithmMeta {
  return ALGORITHMS[id];
}

export function getAlgorithmsByCategory(category: AlgoCategory): AlgorithmMeta[] {
  return Object.values(ALGORITHMS).filter((meta) => meta.category === category);
}

// ─── Sidebar ───

export interface AlgoLabEntry {
  view: AlgoLabView;
  label: string;
  /** Two or three letters shown when the sidebar is collapsed. */
  short: string;
  hint: string;
}

export interface AlgoLabSection {
  category: AlgoCategory;
  label: string;
  icon: string;
  entries: AlgoLabEntry[];
}

export const ALGO_LAB_SECTIONS: AlgoLabSection[] = [
  {
    category: 'sorting',
    label: 'Sorting',
    icon: '📊',
    entries: [
      { view: 'bubble-sort', label: 'Bubble Sort', short: 'Bu', hint: 'O(n²) · stable' },
      { view: 'selection-sort', label: 'Selection Sort', short: 'Se', hint: 'O(n²) · few swaps' },
      { view: 'insertion-sort', label: 'Insertion Sort', short: 'In', hint: 'O(n²) · adaptive' },
      { view: 'merge-sort', label: 'Merge Sort', short: 'Me', hint: 'O(n log n) · stable' },
      { view: 'quick-sort', label: 'Quick Sort', short: 'Qu', hint: 'O(n log n) average' },
      { view: 'heap-sort', label: 'Heap Sort', short: 'He', hint: 'O(n log n) · in place' },
      { view: 'compare', label: 'Compare Race', short: 'VS', hint: 'Two sorts, one dataset' },
    ],
  },
  {
    category: 'graph',
    label: 'Graphs',
    icon: '🕸️',
    entries: [
      { view: 'bfs', label: 'BFS', short: 'BF', hint: 'Level by level' },
      { view: 'dfs', label: 'DFS', short: 'DF', hint: 'Deep before wide' },
      { view: 'dijkstra', label: 'Dijkstra', short: 'Dj', hint: 'Weighted shortest path' },
    ],
  },
  {
    category: 'tree',
    label: 'Trees',
    icon: '🌳',
    entries: [
      { view: 'bst', label: 'Binary Search Tree', short: 'BST', hint: 'Insert · delete · search' },
      { view: 'avl', label: 'AVL Tree', short: 'AVL', hint: 'Self-balancing rotations' },
    ],
  },
];

const SORT_VIEWS: readonly string[] = [
  'bubble-sort',
  'selection-sort',
  'insertion-sort',
  'merge-sort',
  'quick-sort',
  'heap-sort',
];
const GRAPH_VIEWS: readonly string[] = ['bfs', 'dfs', 'dijkstra'];
const TREE_VIEWS: readonly string[] = ['bst', 'avl'];

export function isSortView(view: AlgoLabView): view is SortAlgorithmId {
  return SORT_VIEWS.includes(view);
}

export function isGraphView(view: AlgoLabView): view is GraphAlgorithmId {
  return GRAPH_VIEWS.includes(view);
}

export function isTreeView(view: AlgoLabView): view is AlgoTreeMode {
  return TREE_VIEWS.includes(view);
}

export function isAlgoLabView(value: unknown): value is AlgoLabView {
  return (
    typeof value === 'string' &&
    (value === 'compare' || SORT_VIEWS.includes(value) || GRAPH_VIEWS.includes(value) || TREE_VIEWS.includes(value))
  );
}

export function viewCategory(view: AlgoLabView): AlgoCategory {
  if (isGraphView(view)) return 'graph';
  if (isTreeView(view)) return 'tree';
  return 'sorting';
}

export function viewLabel(view: AlgoLabView): string {
  for (const section of ALGO_LAB_SECTIONS) {
    const entry = section.entries.find((candidate) => candidate.view === view);
    if (entry) return entry.label;
  }
  return 'Algo Lab';
}
