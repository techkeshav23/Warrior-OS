// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Graph Algorithm Metadata & Preset Graphs
// Pseudocode line numbers are referenced by GRAPH_LINES in
// src/lib/algorithms/graph.ts — edit both together.
// ═══════════════════════════════════════════════════════════

import type { AlgoGraph, AlgoGraphEdge, AlgorithmMeta, GraphAlgorithmId } from '@/types/algo';

export const GRAPH_ALGORITHMS: Record<GraphAlgorithmId, AlgorithmMeta> = {
  bfs: {
    id: 'bfs',
    name: 'Breadth-First Search',
    category: 'graph',
    complexity: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)' },
    stable: null,
    inPlace: null,
    description:
      'Explores the graph in waves: first every neighbour of the source, then their neighbours, and so on. A FIFO queue holds the frontier.',
    steps: [
      'Mark the source discovered and put it in the queue.',
      'Dequeue a node and look at each of its neighbours.',
      'Mark every undiscovered neighbour, remember its parent, and enqueue it.',
      'Stop at the target, or when the queue runs dry.',
    ],
    pseudocode: [
      'procedure BFS(G, s)',
      '  mark s discovered;  Q ← [s]',
      '  while Q is not empty do',
      '    u ← Q.dequeue()',
      '    if u = target then stop   // path found',
      '    for each neighbour v of u do',
      '      if v is not discovered then',
      '        mark v discovered;  parent[v] ← u',
      '        Q.enqueue(v)',
      '  return parent[]   // walk it back from the target',
    ],
    facts: [
      'Finds shortest paths by number of edges (unweighted graphs).',
      'The BFS tree has no edges skipping a level: every edge joins levels that differ by at most one.',
      'O(V + E) with adjacency lists, O(V²) with an adjacency matrix.',
    ],
  },

  dfs: {
    id: 'dfs',
    name: 'Depth-First Search',
    category: 'graph',
    complexity: { best: 'O(V + E)', average: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)' },
    stable: null,
    inPlace: null,
    description:
      'Dives as deep as possible along one branch before backtracking. The recursion (call) stack remembers the way back.',
    steps: [
      'Visit the current node and mark it.',
      'For each unvisited neighbour, recurse into it immediately.',
      'When every neighbour is explored, backtrack to the caller.',
      'Stop as soon as the target is visited.',
    ],
    pseudocode: [
      'procedure DFS(u)',
      '  mark u visited',
      '  if u = target then stop   // path found',
      '  for each neighbour v of u do',
      '    if v is not visited then',
      '      parent[v] ← u',
      '      DFS(v)',
      '  backtrack   // return to the caller',
    ],
    facts: [
      'A back edge in the DFS tree means the graph has a cycle.',
      'The basis of topological sort, SCCs, bridges and articulation points.',
      'The path it finds is valid but not necessarily the shortest.',
    ],
  },

  dijkstra: {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    category: 'graph',
    complexity: {
      best: 'O((V + E) log V)',
      average: 'O((V + E) log V)',
      worst: 'O((V + E) log V)',
      space: 'O(V)',
    },
    stable: null,
    inPlace: null,
    description:
      'Grows a set of settled vertices whose shortest distance from the source is final, always settling the closest unsettled vertex next and relaxing its edges.',
    steps: [
      'Every distance starts at ∞, except the source at 0.',
      'Settle the queued vertex with the smallest tentative distance.',
      'Relax its edges: keep any shorter route to a neighbour.',
      'At the target, follow the predecessors back to read off the path.',
    ],
    pseudocode: [
      'procedure Dijkstra(G, s)',
      '  for each vertex v: dist[v] ← ∞;  prev[v] ← nil',
      '  dist[s] ← 0;  Q ← {s}',
      '  while Q is not empty do',
      '    u ← the vertex in Q with the smallest dist[u]',
      '    remove u from Q;  u is now settled',
      '    if u = target then stop',
      '    for each edge (u, v, w) where v is not settled do',
      '      if dist[u] + w < dist[v] then',
      '        dist[v] ← dist[u] + w;  prev[v] ← u',
      '        add v to Q, or lower its key',
      '  path ← follow prev[] back from the target',
    ],
    facts: [
      'Needs non-negative edge weights; use Bellman-Ford when weights can be negative.',
      'Greedy: once a vertex is settled its distance never changes.',
      'O((V + E) log V) with a binary heap, O(V²) with a plain array (better for dense graphs).',
    ],
  },
};

// ─── Preset graphs (coordinates in a 1000 × 600 viewBox) ───

export type GraphPresetId = 'city' | 'grid' | 'tree' | 'islands';

export interface GraphPreset {
  id: GraphPresetId;
  name: string;
  description: string;
  graph: AlgoGraph;
  source: string;
  target: string | null;
}

function edge(a: string, b: string, weight: number): AlgoGraphEdge {
  const [from, to] = a < b ? [a, b] : [b, a];
  return { id: `${from}-${to}`, from, to, weight };
}

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: 'city',
    name: 'City map',
    description: 'Weighted roads where the fewest-hops route (BFS) is not the cheapest route (Dijkstra).',
    source: 'A',
    target: 'G',
    graph: {
      nodes: [
        { id: 'A', x: 110, y: 300 },
        { id: 'B', x: 300, y: 150 },
        { id: 'C', x: 300, y: 450 },
        { id: 'D', x: 510, y: 300 },
        { id: 'E', x: 710, y: 150 },
        { id: 'F', x: 710, y: 450 },
        { id: 'G', x: 890, y: 300 },
        { id: 'H', x: 510, y: 70 },
      ],
      edges: [
        edge('A', 'B', 4),
        edge('A', 'C', 2),
        edge('B', 'C', 1),
        edge('B', 'D', 5),
        edge('C', 'D', 8),
        edge('C', 'F', 10),
        edge('D', 'E', 3),
        edge('D', 'F', 2),
        edge('E', 'G', 6),
        edge('F', 'G', 2),
        edge('B', 'H', 7),
        edge('E', 'H', 4),
      ],
    },
  },
  {
    id: 'grid',
    name: 'Grid',
    description: 'A 3 × 4 lattice with uneven weights: watch Dijkstra route around the expensive edges.',
    source: 'A',
    target: 'L',
    graph: {
      nodes: [
        { id: 'A', x: 200, y: 150 },
        { id: 'B', x: 400, y: 150 },
        { id: 'C', x: 600, y: 150 },
        { id: 'D', x: 800, y: 150 },
        { id: 'E', x: 200, y: 300 },
        { id: 'F', x: 400, y: 300 },
        { id: 'G', x: 600, y: 300 },
        { id: 'H', x: 800, y: 300 },
        { id: 'I', x: 200, y: 450 },
        { id: 'J', x: 400, y: 450 },
        { id: 'K', x: 600, y: 450 },
        { id: 'L', x: 800, y: 450 },
      ],
      edges: [
        edge('A', 'B', 3),
        edge('B', 'C', 7),
        edge('C', 'D', 2),
        edge('E', 'F', 1),
        edge('F', 'G', 8),
        edge('G', 'H', 3),
        edge('I', 'J', 6),
        edge('J', 'K', 2),
        edge('K', 'L', 4),
        edge('A', 'E', 2),
        edge('B', 'F', 5),
        edge('C', 'G', 1),
        edge('D', 'H', 6),
        edge('E', 'I', 4),
        edge('F', 'J', 2),
        edge('G', 'K', 5),
        edge('H', 'L', 1),
      ],
    },
  },
  {
    id: 'tree',
    name: 'Tree',
    description: 'A small tree: BFS goes level by level while DFS dives down each branch first.',
    source: 'A',
    target: 'G',
    graph: {
      nodes: [
        { id: 'A', x: 500, y: 90 },
        { id: 'B', x: 300, y: 250 },
        { id: 'C', x: 700, y: 250 },
        { id: 'D', x: 180, y: 430 },
        { id: 'E', x: 410, y: 430 },
        { id: 'F', x: 590, y: 430 },
        { id: 'G', x: 820, y: 430 },
      ],
      edges: [
        edge('A', 'B', 2),
        edge('A', 'C', 3),
        edge('B', 'D', 4),
        edge('B', 'E', 1),
        edge('C', 'F', 5),
        edge('C', 'G', 2),
      ],
    },
  },
  {
    id: 'islands',
    name: 'Islands',
    description: 'Two disconnected components: the target on the other island is unreachable.',
    source: 'A',
    target: 'F',
    graph: {
      nodes: [
        { id: 'A', x: 150, y: 210 },
        { id: 'B', x: 360, y: 120 },
        { id: 'C', x: 360, y: 330 },
        { id: 'D', x: 190, y: 450 },
        { id: 'E', x: 650, y: 180 },
        { id: 'F', x: 860, y: 270 },
        { id: 'G', x: 700, y: 440 },
      ],
      edges: [
        edge('A', 'B', 3),
        edge('A', 'C', 5),
        edge('B', 'C', 2),
        edge('C', 'D', 4),
        edge('A', 'D', 7),
        edge('E', 'F', 2),
        edge('F', 'G', 3),
        edge('E', 'G', 6),
      ],
    },
  },
];

export const DEFAULT_GRAPH_PRESET: GraphPreset = GRAPH_PRESETS[0];

export function getGraphPreset(id: GraphPresetId): GraphPreset {
  return GRAPH_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_GRAPH_PRESET;
}
