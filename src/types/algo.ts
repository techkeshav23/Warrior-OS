// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Types
// Algorithm metadata, visualization frames, graph and tree models
// ═══════════════════════════════════════════════════════════

export type AlgoCategory = 'sorting' | 'graph' | 'tree';

export type SortAlgorithmId =
  | 'bubble-sort'
  | 'selection-sort'
  | 'insertion-sort'
  | 'merge-sort'
  | 'quick-sort'
  | 'heap-sort';

export type GraphAlgorithmId = 'bfs' | 'dfs' | 'dijkstra';

export type TreeOperationId =
  | 'bst-insert'
  | 'bst-search'
  | 'bst-delete'
  | 'avl-insert'
  | 'avl-delete'
  | 'inorder'
  | 'preorder'
  | 'postorder';

export type AlgorithmId = SortAlgorithmId | GraphAlgorithmId | TreeOperationId;

/** The two tree structures the tree visualizer works on. */
export type AlgoTreeMode = 'bst' | 'avl';

/** Everything that can be picked in the Algo Lab sidebar. */
export type AlgoLabView = SortAlgorithmId | 'compare' | GraphAlgorithmId | AlgoTreeMode;

export interface AlgoComplexity {
  best: string;
  average: string;
  worst: string;
  space: string;
}

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  category: AlgoCategory;
  complexity: AlgoComplexity;
  /** Whether equal keys keep their relative order; null when stability does not apply. */
  stable: boolean | null;
  /** Whether the algorithm needs only O(1) extra memory besides the input; null when it does not apply. */
  inPlace: boolean | null;
  /** What the move counter measures for a sort (swaps or array writes). */
  moveLabel?: 'swaps' | 'writes';
  description: string;
  /** Plain-language outline of the procedure, in order. */
  steps: string[];
  /** Pseudocode lines. Visualization frames point at them by 0-based index. */
  pseudocode: string[];
  /** Exam-style facts worth remembering. */
  facts: string[];
}

// ─── Sorting ───

export type AlgoDatasetShape = 'random' | 'nearly-sorted' | 'reversed' | 'few-unique';

/** One step of a sorting visualization. Arrays are shared between frames when unchanged. */
export interface AlgoSortFrame {
  array: readonly number[];
  /** Indices being compared (drawn yellow). */
  comparing: readonly number[];
  /** Indices being swapped or written (drawn red). */
  swapping: readonly number[];
  /** sorted[i] is true once index i holds its final value (drawn green). */
  sorted: readonly boolean[];
  /** Pivot, key or current-minimum index (drawn purple). */
  pivot: number | null;
  /** Sub-array the algorithm is working on; unsorted bars outside it are dimmed. */
  range: readonly [number, number] | null;
  /** Active pseudocode line (0-based). */
  line: number;
  message: string;
  comparisons: number;
  /** Swaps or writes so far, depending on the algorithm. */
  moves: number;
}

// ─── Graphs ───

export interface AlgoGraphNode {
  /** Also the node's label (A, B, C, ...). */
  id: string;
  x: number;
  y: number;
}

/** Undirected weighted edge. `from` sorts before `to`. */
export interface AlgoGraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface AlgoGraph {
  nodes: AlgoGraphNode[];
  edges: AlgoGraphEdge[];
}

export type AlgoFrontierKind = 'queue' | 'stack' | 'priority-queue';

/** One step of a graph traversal or shortest-path visualization. */
export interface AlgoGraphFrame {
  /** Node being processed (drawn yellow). */
  current: string | null;
  /** Processed / settled nodes (drawn blue). */
  visited: readonly string[];
  /** Contents of the queue, recursion stack or priority queue, in order. */
  frontier: readonly string[];
  frontierKind: AlgoFrontierKind;
  /** Edge being examined in this step. */
  activeEdge: string | null;
  /** Edges through which nodes were discovered. */
  treeEdges: readonly string[];
  /** Final path from source to target (drawn green). */
  path: readonly string[];
  pathEdges: readonly string[];
  /** Order in which nodes were visited or settled. */
  order: readonly string[];
  /** Dijkstra only: tentative distances (Infinity = unknown). */
  distances: Readonly<Record<string, number>> | null;
  /** Dijkstra only: predecessor of each node on its best known path. */
  previous: Readonly<Record<string, string | null>> | null;
  /** Node whose distance improved in this step. */
  updated: string | null;
  /** Whether the target was reached; null while running or when no target is set. */
  found: boolean | null;
  /** Sum of edge weights along `path`, when a path was found. */
  pathCost: number | null;
  line: number;
  message: string;
}

// ─── Trees ───

/** Immutable binary tree snapshot. Ids are stable so nodes can animate between frames. */
export interface AlgoTreeNode {
  id: string;
  value: number;
  left: AlgoTreeNode | null;
  right: AlgoTreeNode | null;
}

export type AlgoRotation = 'LL' | 'RR' | 'LR' | 'RL';

/** One step of a tree operation. */
export interface AlgoTreeFrame {
  root: AlgoTreeNode | null;
  /** Node being compared or visited (drawn yellow). */
  current: string | null;
  /** Nodes on the search path or recursion stack (outlined). */
  path: readonly string[];
  /** Node found, inserted or promoted (drawn green). */
  found: string | null;
  /** Node about to be removed (drawn red). */
  removing: string | null;
  /** Nodes taking part in a rotation (drawn orange). */
  rotating: readonly string[];
  /** Traversal: nodes already output (drawn blue). */
  visited: readonly string[];
  /** Traversal output so far. */
  output: readonly number[];
  rotation: AlgoRotation | null;
  line: number;
  message: string;
}

/** Result of running one tree operation: its frames and the tree it leaves behind. */
export interface AlgoTreeRun {
  operation: TreeOperationId;
  frames: AlgoTreeFrame[];
  root: AlgoTreeNode | null;
  rotations: number;
  /** Whether the tree structure changed. */
  changed: boolean;
}
