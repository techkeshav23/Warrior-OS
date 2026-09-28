// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Graph Step Generators
// BFS, recursive DFS and Dijkstra on an undirected weighted graph
// ═══════════════════════════════════════════════════════════

import type {
  AlgoFrontierKind,
  AlgoGraph,
  AlgoGraphEdge,
  AlgoGraphFrame,
  GraphAlgorithmId,
} from '@/types/algo';
import { collectFrames } from './frames';

type GraphGenerator = Generator<AlgoGraphFrame, void, undefined>;

/**
 * Line numbers (0-based) into each algorithm's pseudocode in
 * `src/data/algorithms/graph.ts`. Keep the two files in sync.
 */
export const GRAPH_LINES = {
  bfs: { start: 1, dequeue: 3, targetFound: 4, skip: 6, discover: 7, done: 9 },
  dfs: { summary: 0, visit: 1, targetFound: 2, skip: 4, descend: 6, backtrack: 7 },
  dijkstra: { init: 1, seed: 2, exhausted: 3, pick: 4, settle: 5, stop: 6, relaxCheck: 8, relax: 9, path: 11 },
} as const;

interface Neighbor {
  to: string;
  edgeId: string;
  weight: number;
}

interface GraphExtras {
  activeEdge?: string | null;
  updated?: string | null;
  path?: readonly string[];
  pathEdges?: readonly string[];
  found?: boolean | null;
  pathCost?: number | null;
}

const EMPTY: readonly string[] = [];

/** Order node ids the way labels read: A..Z, then AA, AB, ... */
export function compareNodeIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical id for the undirected edge between two nodes. */
export function edgeIdFor(a: string, b: string): string {
  return compareNodeIds(a, b) <= 0 ? `${a}-${b}` : `${b}-${a}`;
}

/** Build a normalised edge (endpoints in label order). */
export function makeEdge(a: string, b: string, weight: number): AlgoGraphEdge {
  const [from, to] = compareNodeIds(a, b) <= 0 ? [a, b] : [b, a];
  return { id: `${from}-${to}`, from, to, weight };
}

/** Adjacency lists with neighbours in label order, ignoring self-loops and dangling edges. */
export function buildAdjacency(graph: AlgoGraph): Map<string, Neighbor[]> {
  const adjacency = new Map<string, Neighbor[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    const fromList = adjacency.get(edge.from);
    const toList = adjacency.get(edge.to);
    if (!fromList || !toList || edge.from === edge.to) continue;
    fromList.push({ to: edge.to, edgeId: edge.id, weight: edge.weight });
    toList.push({ to: edge.from, edgeId: edge.id, weight: edge.weight });
  }
  for (const list of adjacency.values()) list.sort((x, y) => compareNodeIds(x.to, y.to));
  return adjacency;
}

export function formatDistance(distance: number): string {
  return Number.isFinite(distance) ? String(distance) : '∞';
}

class GraphTracer {
  current: string | null = null;
  readonly visited: string[] = [];
  frontier: readonly string[] = EMPTY;
  readonly treeEdges: string[] = [];
  readonly order: string[] = [];
  distances: Record<string, number> | null = null;
  previous: Record<string, string | null> | null = null;
  private readonly kind: AlgoFrontierKind;

  constructor(kind: AlgoFrontierKind) {
    this.kind = kind;
  }

  frame(line: number, message: string, extras: GraphExtras = {}): AlgoGraphFrame {
    return {
      current: this.current,
      visited: this.visited.slice(),
      frontier: this.frontier.slice(),
      frontierKind: this.kind,
      activeEdge: extras.activeEdge ?? null,
      treeEdges: this.treeEdges.slice(),
      path: extras.path ?? EMPTY,
      pathEdges: extras.pathEdges ?? EMPTY,
      order: this.order.slice(),
      distances: this.distances ? { ...this.distances } : null,
      previous: this.previous ? { ...this.previous } : null,
      updated: extras.updated ?? null,
      found: extras.found ?? null,
      pathCost: extras.pathCost ?? null,
      line,
      message,
    };
  }
}

interface ParentLink {
  node: string;
  edge: string;
}

function tracePath(
  parents: Map<string, ParentLink>,
  source: string,
  target: string,
  weights: Map<string, number>
): { nodes: string[]; edges: string[]; cost: number } {
  const nodes = [target];
  const edges: string[] = [];
  let cost = 0;
  let cursor = target;
  while (cursor !== source) {
    const link = parents.get(cursor);
    if (!link) break;
    edges.push(link.edge);
    nodes.push(link.node);
    cost += weights.get(link.edge) ?? 0;
    cursor = link.node;
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges, cost };
}

function edgeWeights(graph: AlgoGraph): Map<string, number> {
  return new Map(graph.edges.map((edge) => [edge.id, edge.weight]));
}

// ─── Breadth-first search ───

export function* bfsSteps(graph: AlgoGraph, source: string, target: string | null): GraphGenerator {
  const L = GRAPH_LINES.bfs;
  const adjacency = buildAdjacency(graph);
  const weights = edgeWeights(graph);
  const t = new GraphTracer('queue');
  const discovered = new Set<string>([source]);
  const parents = new Map<string, ParentLink>();
  const queue: string[] = [source];
  t.frontier = queue;

  yield t.frame(L.start, `Start at ${source}: mark it discovered and enqueue it.`);

  while (queue.length > 0) {
    const u = queue[0];
    queue.shift();
    t.current = u;
    t.order.push(u);
    yield t.frame(L.dequeue, `Dequeue ${u}. Queue is now [${queue.join(', ')}].`);

    if (target !== null && u === target) {
      const route = tracePath(parents, source, target, weights);
      t.visited.push(u);
      yield t.frame(
        L.targetFound,
        `Reached ${target}! Fewest-edges path: ${route.nodes.join(' → ')} (${route.edges.length} edge${route.edges.length === 1 ? '' : 's'}, total weight ${route.cost}).`,
        { path: route.nodes, pathEdges: route.edges, found: true, pathCost: route.cost }
      );
      return;
    }

    for (const { to: v, edgeId } of adjacency.get(u) ?? []) {
      if (discovered.has(v)) {
        yield t.frame(L.skip, `${v} is already discovered, skip it.`, { activeEdge: edgeId });
        continue;
      }
      discovered.add(v);
      parents.set(v, { node: u, edge: edgeId });
      t.treeEdges.push(edgeId);
      queue.push(v);
      yield t.frame(L.discover, `Discover ${v} through ${u} and enqueue it.`, { activeEdge: edgeId });
    }

    t.visited.push(u);
    t.current = null;
  }

  if (target !== null) {
    yield t.frame(L.done, `The queue is empty: ${target} is unreachable from ${source}.`, { found: false });
  } else {
    yield t.frame(L.done, `BFS complete. Visit order: ${t.order.join(', ')}.`);
  }
}

// ─── Depth-first search (recursive) ───

export function* dfsSteps(graph: AlgoGraph, source: string, target: string | null): GraphGenerator {
  const L = GRAPH_LINES.dfs;
  const adjacency = buildAdjacency(graph);
  const weights = edgeWeights(graph);
  const t = new GraphTracer('stack');
  const visited = new Set<string>();
  const parents = new Map<string, ParentLink>();
  const callStack: string[] = [];
  t.frontier = callStack;
  let found = false;

  const visit = function* (u: string): GraphGenerator {
    visited.add(u);
    callStack.push(u);
    t.current = u;
    t.order.push(u);
    t.visited.push(u);
    yield t.frame(L.visit, `Visit ${u}. Call stack: ${callStack.join(' → ')}.`);

    if (target !== null && u === target) {
      found = true;
      return;
    }

    for (const { to: v, edgeId } of adjacency.get(u) ?? []) {
      if (visited.has(v)) {
        yield t.frame(L.skip, `${v} is already visited, skip it.`, { activeEdge: edgeId });
        continue;
      }
      parents.set(v, { node: u, edge: edgeId });
      t.treeEdges.push(edgeId);
      yield t.frame(L.descend, `Go deeper: ${u} → ${v}.`, { activeEdge: edgeId });
      yield* visit(v);
      if (found) return;
    }

    callStack.pop();
    const caller = callStack.length > 0 ? callStack[callStack.length - 1] : null;
    t.current = caller;
    yield t.frame(
      L.backtrack,
      caller
        ? `Every neighbour of ${u} is explored: backtrack to ${caller}.`
        : `Every neighbour of ${u} is explored: the search returns.`
    );
  };

  yield* visit(source);

  if (found && target !== null) {
    const route = tracePath(parents, source, target, weights);
    yield t.frame(
      L.targetFound,
      `Reached ${target}! DFS path: ${route.nodes.join(' → ')} (total weight ${route.cost}). DFS does not promise the shortest path.`,
      { path: route.nodes, pathEdges: route.edges, found: true, pathCost: route.cost }
    );
  } else if (target !== null) {
    t.current = null;
    yield t.frame(L.summary, `Search exhausted: ${target} is unreachable from ${source}.`, { found: false });
  } else {
    t.current = null;
    yield t.frame(L.summary, `DFS complete. Visit order: ${t.order.join(', ')}.`);
  }
}

// ─── Dijkstra's shortest paths ───

export function* dijkstraSteps(graph: AlgoGraph, source: string, target: string | null): GraphGenerator {
  const L = GRAPH_LINES.dijkstra;
  const adjacency = buildAdjacency(graph);
  const t = new GraphTracer('priority-queue');
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const prevEdge = new Map<string, string>();
  for (const node of graph.nodes) {
    dist[node.id] = Infinity;
    prev[node.id] = null;
  }
  t.distances = dist;
  t.previous = prev;

  const inQueue = new Set<string>();
  const settled = new Set<string>();
  const syncQueue = () => {
    t.frontier = [...inQueue].sort((a, b) => dist[a] - dist[b] || compareNodeIds(a, b));
  };

  yield t.frame(L.init, 'Set every distance to ∞ and every predecessor to nil.');

  dist[source] = 0;
  inQueue.add(source);
  syncQueue();
  yield t.frame(L.seed, `dist[${source}] ← 0 and put ${source} in the priority queue.`, { updated: source });

  while (inQueue.size > 0) {
    syncQueue();
    const u = t.frontier[0];
    t.current = u;
    yield t.frame(L.pick, `Pick ${u}: it has the smallest tentative distance in the queue (${dist[u]}).`);

    inQueue.delete(u);
    settled.add(u);
    t.visited.push(u);
    t.order.push(u);
    syncQueue();
    yield t.frame(L.settle, `${u} is settled: dist[${u}] = ${dist[u]} is final.`);

    if (target !== null && u === target) {
      const nodes = [target];
      const edges: string[] = [];
      let cursor = target;
      while (cursor !== source) {
        const before = prev[cursor];
        const edge = prevEdge.get(cursor);
        if (before === null || edge === undefined) break;
        nodes.push(before);
        edges.push(edge);
        cursor = before;
      }
      nodes.reverse();
      edges.reverse();
      yield t.frame(L.stop, `${target} is settled, so its distance can no longer improve. Stop.`);
      yield t.frame(
        L.path,
        `Shortest path ${nodes.join(' → ')} with total weight ${dist[target]}.`,
        { path: nodes, pathEdges: edges, found: true, pathCost: dist[target] }
      );
      return;
    }

    for (const { to: v, edgeId, weight } of adjacency.get(u) ?? []) {
      if (settled.has(v)) continue;
      const candidate = dist[u] + weight;
      if (candidate < dist[v]) {
        yield t.frame(
          L.relaxCheck,
          `Edge ${u}–${v} (w = ${weight}): ${dist[u]} + ${weight} = ${candidate} < dist[${v}] = ${formatDistance(dist[v])}.`,
          { activeEdge: edgeId }
        );
        dist[v] = candidate;
        prev[v] = u;
        prevEdge.set(v, edgeId);
        inQueue.add(v);
        syncQueue();
        yield t.frame(L.relax, `Shorter path found: dist[${v}] ← ${candidate}, prev[${v}] ← ${u}.`, {
          activeEdge: edgeId,
          updated: v,
        });
      } else {
        yield t.frame(
          L.relaxCheck,
          `Edge ${u}–${v} (w = ${weight}): ${dist[u]} + ${weight} = ${candidate} ≥ dist[${v}] = ${formatDistance(dist[v])}, keep it.`,
          { activeEdge: edgeId }
        );
      }
    }
    t.current = null;
  }

  if (target !== null) {
    yield t.frame(L.path, `The queue is empty: ${target} is unreachable from ${source} (distance ∞).`, {
      found: false,
    });
  } else {
    yield t.frame(L.exhausted, 'The queue is empty: every reachable vertex is settled with its shortest distance.');
  }
}

// ─── Registry ───

export const GRAPH_STEP_GENERATORS: Record<
  GraphAlgorithmId,
  (graph: AlgoGraph, source: string, target: string | null) => GraphGenerator
> = {
  bfs: bfsSteps,
  dfs: dfsSteps,
  dijkstra: dijkstraSteps,
};

export const GRAPH_ALGORITHM_IDS: readonly GraphAlgorithmId[] = ['bfs', 'dfs', 'dijkstra'];

export function isGraphAlgorithmId(value: string): value is GraphAlgorithmId {
  return (GRAPH_ALGORITHM_IDS as readonly string[]).includes(value);
}

/** All frames for a run, or an empty list when the source is missing. */
export function buildGraphFrames(
  algorithm: GraphAlgorithmId,
  graph: AlgoGraph,
  source: string | null,
  target: string | null
): AlgoGraphFrame[] {
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (source === null || !ids.has(source)) return [];
  const safeTarget = target !== null && ids.has(target) ? target : null;
  return collectFrames(GRAPH_STEP_GENERATORS[algorithm](graph, source, safeTarget)).frames;
}
