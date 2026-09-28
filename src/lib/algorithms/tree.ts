// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tree Step Generators
// BST / AVL insert, delete and search, traversals, and tree layout
// ═══════════════════════════════════════════════════════════

import type {
  AlgoRotation,
  AlgoTreeFrame,
  AlgoTreeMode,
  AlgoTreeNode,
  AlgoTreeRun,
  TreeOperationId,
} from '@/types/algo';
import { collectFrames } from './frames';

type TreeGenerator = Generator<AlgoTreeFrame, void, undefined>;

export type TreeAction = 'insert' | 'delete' | 'search' | 'inorder' | 'preorder' | 'postorder';
export type TraversalKind = 'inorder' | 'preorder' | 'postorder';

/**
 * Line numbers (0-based) into each operation's pseudocode in
 * `src/data/algorithms/tree.ts`. Keep the two files in sync.
 */
export const TREE_LINES = {
  'bst-insert': { empty: 1, duplicate: 4, attachLeft: 6, goLeft: 7, attachRight: 9, goRight: 10 },
  'avl-insert': { bst: 1, walkUp: 2, balance: 4, LL: 5, RR: 6, LR: 7, RL: 8 },
  'bst-search': { start: 1, found: 3, goLeft: 4, goRight: 5, notFound: 6 },
  'bst-delete': { search: 1, notFound: 2, leaf: 3, unlinkLeaf: 4, oneChild: 5, splice: 6, twoChildren: 7, successor: 8, detachSuccessor: 9, replace: 10 },
  'avl-delete': { bst: 1, walkUp: 2, balance: 4, LL: 5, LR: 6, RR: 7, RL: 8 },
  inorder: { call: 0, left: 2, visit: 3, right: 4 },
  preorder: { call: 0, visit: 2, left: 3, right: 4 },
  postorder: { call: 0, left: 2, right: 3, visit: 4 },
} as const;

interface MNode {
  id: string;
  value: number;
  left: MNode | null;
  right: MNode | null;
  height: number;
}

interface TreeExtras {
  current?: string | null;
  found?: string | null;
  removing?: string | null;
  rotating?: readonly string[];
  rotation?: AlgoRotation | null;
}

const NO_IDS: readonly string[] = [];

// ─── Structural helpers ───

function heightOf(node: MNode | null): number {
  return node ? node.height : 0;
}

function updateHeight(node: MNode): void {
  node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));
}

function balanceOf(node: MNode): number {
  return heightOf(node.left) - heightOf(node.right);
}

function toMutable(node: AlgoTreeNode | null): MNode | null {
  if (!node) return null;
  const left = toMutable(node.left);
  const right = toMutable(node.right);
  return { id: node.id, value: node.value, left, right, height: 1 + Math.max(heightOf(left), heightOf(right)) };
}

function snapshotTree(node: MNode | null): AlgoTreeNode | null {
  if (!node) return null;
  return { id: node.id, value: node.value, left: snapshotTree(node.left), right: snapshotTree(node.right) };
}

function createNode(id: string, value: number): MNode {
  return { id, value, left: null, right: null, height: 1 };
}

/** Right rotation at y. Returns the new subtree root (y's old left child). */
function rotateRight(y: MNode): MNode {
  const x = y.left;
  if (!x) return y;
  y.left = x.right;
  x.right = y;
  updateHeight(y);
  updateHeight(x);
  return x;
}

/** Left rotation at x. Returns the new subtree root (x's old right child). */
function rotateLeft(x: MNode): MNode {
  const y = x.right;
  if (!y) return x;
  x.right = y.left;
  y.left = x;
  updateHeight(x);
  updateHeight(y);
  return y;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

// ─── Tracer ───

class TreeTracer {
  root: MNode | null;
  readonly path: string[] = [];
  readonly visited: string[] = [];
  readonly output: number[] = [];
  rotations = 0;
  changed = false;
  private snap: AlgoTreeNode | null;
  private dirty = false;

  constructor(root: MNode | null) {
    this.root = root;
    this.snap = snapshotTree(root);
  }

  /** Call after any structural change so the next frame re-snapshots. */
  touch(): void {
    this.dirty = true;
  }

  snapshot(): AlgoTreeNode | null {
    if (this.dirty) {
      this.snap = snapshotTree(this.root);
      this.dirty = false;
    }
    return this.snap;
  }

  frame(line: number, message: string, extras: TreeExtras = {}): AlgoTreeFrame {
    return {
      root: this.snapshot(),
      current: extras.current ?? null,
      path: this.path.slice(),
      found: extras.found ?? null,
      removing: extras.removing ?? null,
      rotating: extras.rotating ?? NO_IDS,
      visited: this.visited.slice(),
      output: this.output.slice(),
      rotation: extras.rotation ?? null,
      line,
      message,
    };
  }
}

function replaceChild(t: TreeTracer, parent: MNode | null, oldChild: MNode, newChild: MNode | null): void {
  if (parent === null) t.root = newChild;
  else if (parent.left === oldChild) parent.left = newChild;
  else parent.right = newChild;
  t.touch();
}

// ─── AVL rebalancing (shared by insert and delete) ───

interface RebalanceLines {
  walkUp: number;
  balance: number;
  LL: number;
  RR: number;
  LR: number;
  RL: number;
}

/**
 * Walk the recorded root→leaf path bottom-up, fixing heights and rotating
 * wherever the balance factor leaves {−1, 0, +1}. Parents are taken from the
 * path, so every frame shows the whole, correctly linked tree.
 */
function* rebalanceUp(t: TreeTracer, path: MNode[], lines: RebalanceLines, insertedKey: number | null): TreeGenerator {
  for (let k = path.length - 1; k >= 0; k--) {
    const a = path[k];
    const parent = k > 0 ? path[k - 1] : null;
    updateHeight(a);
    const bf = balanceOf(a);
    if (Math.abs(bf) <= 1) {
      yield t.frame(lines.balance, `Node ${a.value}: height ${a.height}, balance factor ${signed(bf)}. Balanced.`, {
        current: a.id,
      });
      continue;
    }

    const leftHeavy = bf > 1;
    const child = leftHeavy ? a.left : a.right;
    if (!child) continue; // impossible when |bf| > 1, kept for type safety
    const childBf = balanceOf(child);
    const rotation: AlgoRotation = leftHeavy ? (childBf >= 0 ? 'LL' : 'LR') : childBf <= 0 ? 'RR' : 'RL';
    const grand = rotation === 'LL' ? child.left : rotation === 'RR' ? child.right : rotation === 'LR' ? child.right : child.left;
    const involved = [a.id, child.id, ...(grand ? [grand.id] : [])];
    const rule =
      insertedKey !== null
        ? `${insertedKey} ${rotation === 'LL' || rotation === 'RL' ? '<' : '>'} ${child.value}`
        : `the ${leftHeavy ? 'left' : 'right'} child's balance is ${signed(childBf)}`;
    const caseName = { LL: 'Left-Left', RR: 'Right-Right', LR: 'Left-Right', RL: 'Right-Left' }[rotation];

    yield t.frame(
      lines[rotation],
      `Node ${a.value} has balance factor ${signed(bf)} and ${rule}: ${caseName} case.`,
      { current: a.id, rotating: involved }
    );

    let newRoot: MNode;
    if (rotation === 'LL' || rotation === 'RR') {
      newRoot = rotation === 'LL' ? rotateRight(a) : rotateLeft(a);
      replaceChild(t, parent, a, newRoot);
      t.rotations++;
      yield t.frame(
        lines[rotation],
        `Rotate ${rotation === 'LL' ? 'right' : 'left'} at ${a.value}: ${newRoot.value} is now the root of this subtree.`,
        { rotating: involved, rotation, found: newRoot.id }
      );
    } else {
      // Double rotation: first straighten the child, then rotate at a.
      if (rotation === 'LR') a.left = rotateLeft(child);
      else a.right = rotateRight(child);
      t.touch();
      t.rotations++;
      yield t.frame(
        lines[rotation],
        `Step 1 of 2: rotate ${rotation === 'LR' ? 'left' : 'right'} at ${child.value} to turn the zig-zag into a straight line.`,
        { rotating: involved, rotation, current: a.id }
      );
      newRoot = rotation === 'LR' ? rotateRight(a) : rotateLeft(a);
      replaceChild(t, parent, a, newRoot);
      t.rotations++;
      yield t.frame(
        lines[rotation],
        `Step 2 of 2: rotate ${rotation === 'LR' ? 'right' : 'left'} at ${a.value}: ${newRoot.value} is now the root of this subtree.`,
        { rotating: involved, rotation, found: newRoot.id }
      );
    }
    path[k] = newRoot;
  }
}

// ─── Insert ───

function* insertSteps(t: TreeTracer, value: number, mode: AlgoTreeMode, newId: string): TreeGenerator {
  const B = TREE_LINES['bst-insert'];
  const A = TREE_LINES['avl-insert'];
  const avl = mode === 'avl';
  const line = (bstLine: number) => (avl ? A.bst : bstLine);

  if (t.root === null) {
    t.root = createNode(newId, value);
    t.touch();
    t.changed = true;
    yield t.frame(line(B.empty), `The tree is empty, so ${value} becomes the root.`, { found: newId });
    return;
  }

  const path: MNode[] = [];
  let node: MNode = t.root;
  for (;;) {
    path.push(node);
    t.path.push(node.id);
    if (value === node.value) {
      yield t.frame(line(B.duplicate), `${value} is already in the tree. Keys stay unique, so nothing is inserted.`, {
        found: node.id,
      });
      return;
    }
    if (value < node.value) {
      if (node.left === null) {
        node.left = createNode(newId, value);
        t.touch();
        yield t.frame(line(B.attachLeft), `${value} < ${node.value} and ${node.value} has no left child: attach ${value} there.`, {
          found: newId,
        });
        break;
      }
      yield t.frame(line(B.goLeft), `${value} < ${node.value}: go left.`, { current: node.id });
      node = node.left;
    } else {
      if (node.right === null) {
        node.right = createNode(newId, value);
        t.touch();
        yield t.frame(line(B.attachRight), `${value} > ${node.value} and ${node.value} has no right child: attach ${value} there.`, {
          found: newId,
        });
        break;
      }
      yield t.frame(line(B.goRight), `${value} > ${node.value}: go right.`, { current: node.id });
      node = node.right;
    }
  }
  t.changed = true;

  if (!avl) {
    // Heights still matter internally if this tree is later rebalanced.
    for (let k = path.length - 1; k >= 0; k--) updateHeight(path[k]);
    return;
  }

  yield* rebalanceUp(t, path, A, value);
  yield t.frame(
    A.walkUp,
    t.rotations > 0
      ? `Inserted ${value}. ${t.rotations} rotation${t.rotations === 1 ? '' : 's'} restored the AVL balance.`
      : `Inserted ${value}. Every balance factor is still in {−1, 0, +1}.`,
    { found: newId }
  );
}

// ─── Delete ───

function* deleteSteps(t: TreeTracer, value: number, mode: AlgoTreeMode): TreeGenerator {
  const B = TREE_LINES['bst-delete'];
  const A = TREE_LINES['avl-delete'];
  const avl = mode === 'avl';
  const line = (bstLine: number) => (avl ? A.bst : bstLine);

  const ancestors: MNode[] = [];
  let node = t.root;
  while (node !== null && node.value !== value) {
    t.path.push(node.id);
    const goLeft = value < node.value;
    yield t.frame(line(B.search), `${value} ${goLeft ? '<' : '>'} ${node.value}: go ${goLeft ? 'left' : 'right'}.`, {
      current: node.id,
    });
    ancestors.push(node);
    node = goLeft ? node.left : node.right;
  }

  if (node === null) {
    yield t.frame(line(B.notFound), `${value} is not in the tree, so there is nothing to delete.`);
    return;
  }

  t.path.push(node.id);
  const target = node;
  const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
  const rebalancePath: MNode[] = ancestors.slice();
  const leftChild = target.left;
  const rightChild = target.right;

  if (leftChild === null && rightChild === null) {
    yield t.frame(line(B.leaf), `Found ${value}. It is a leaf, so it can simply be removed.`, { removing: target.id });
    replaceChild(t, parent, target, null);
    yield t.frame(line(B.unlinkLeaf), `Removed ${value}.`);
  } else if (leftChild !== null && rightChild !== null) {
    yield t.frame(line(B.twoChildren), `Found ${value}. It has two children, so its inorder successor takes its place.`, {
      removing: target.id,
    });
    let succParent: MNode = target;
    let succ: MNode = rightChild;
    const chain: MNode[] = [];
    yield t.frame(line(B.successor), `Step into the right subtree at ${succ.value}.`, {
      current: succ.id,
      removing: target.id,
    });
    while (succ.left !== null) {
      chain.push(succ);
      succParent = succ;
      succ = succ.left;
      yield t.frame(line(B.successor), `Go left to ${succ.value}.`, { current: succ.id, removing: target.id });
    }
    yield t.frame(
      line(B.successor),
      `${succ.value} has no left child, so it is the successor: the smallest key larger than ${value}.`,
      { found: succ.id, removing: target.id }
    );
    if (succParent !== target) {
      const lifted = succ.right;
      yield t.frame(
        line(B.detachSuccessor),
        lifted
          ? `Unlink ${succ.value}: its right child ${lifted.value} takes its old spot under ${succParent.value}.`
          : `Unlink ${succ.value} from ${succParent.value}.`,
        { current: succ.id, removing: target.id }
      );
      succParent.left = lifted;
      succ.right = rightChild;
    }
    succ.left = leftChild;
    replaceChild(t, parent, target, succ);
    yield t.frame(line(B.replace), `${succ.value} takes ${value}'s place and adopts both of its children.`, {
      found: succ.id,
    });
    rebalancePath.push(succ, ...chain);
  } else {
    const child = leftChild ?? rightChild;
    if (child) {
      yield t.frame(line(B.oneChild), `Found ${value}. It has a single child (${child.value}).`, {
        removing: target.id,
        current: child.id,
      });
      replaceChild(t, parent, target, child);
      yield t.frame(line(B.splice), `Link ${parent ? parent.value : 'the root pointer'} straight to ${child.value}.`, {
        found: child.id,
      });
    }
  }
  t.changed = true;

  if (!avl) {
    for (let k = rebalancePath.length - 1; k >= 0; k--) updateHeight(rebalancePath[k]);
    return;
  }

  yield* rebalanceUp(t, rebalancePath, A, null);
  yield t.frame(
    A.walkUp,
    t.rotations > 0
      ? `Deleted ${value}. ${t.rotations} rotation${t.rotations === 1 ? '' : 's'} restored the AVL balance.`
      : `Deleted ${value}. The tree is still balanced.`
  );
}

// ─── Search ───

function* searchSteps(t: TreeTracer, value: number): TreeGenerator {
  const L = TREE_LINES['bst-search'];
  let node = t.root;
  if (node === null) {
    yield t.frame(L.notFound, 'The tree is empty, so the search fails immediately.');
    return;
  }
  yield t.frame(L.start, `Search for ${value}, starting at the root ${node.value}.`, { current: node.id });
  while (node !== null) {
    t.path.push(node.id);
    if (value === node.value) {
      yield t.frame(L.found, `${value} = ${node.value}: found it!`, { found: node.id });
      return;
    }
    if (value < node.value) {
      yield t.frame(
        L.goLeft,
        node.left ? `${value} < ${node.value}: go left to ${node.left.value}.` : `${value} < ${node.value}, but there is no left child.`,
        { current: node.id }
      );
      node = node.left;
    } else {
      yield t.frame(
        L.goRight,
        node.right ? `${value} > ${node.value}: go right to ${node.right.value}.` : `${value} > ${node.value}, but there is no right child.`,
        { current: node.id }
      );
      node = node.right;
    }
  }
  yield t.frame(L.notFound, `Fell off the tree: ${value} is not stored here.`);
}

// ─── Traversals ───

function* traversalSteps(t: TreeTracer, kind: TraversalKind): TreeGenerator {
  const L = TREE_LINES[kind];
  const root = t.root;
  if (root === null) {
    yield t.frame(L.call, 'The tree is empty: there is nothing to traverse.');
    return;
  }
  yield t.frame(L.call, `Start the ${kind} traversal at the root ${root.value}.`, { current: root.id });

  const visit = function* (n: MNode): TreeGenerator {
    t.visited.push(n.id);
    t.output.push(n.value);
    yield t.frame(L.visit, `Visit ${n.value}. Output so far: ${t.output.join(', ')}.`, { current: n.id });
  };

  const walk = function* (n: MNode): TreeGenerator {
    t.path.push(n.id);
    const descend = function* (child: MNode | null, side: 'left' | 'right'): TreeGenerator {
      if (child === null) return;
      yield t.frame(side === 'left' ? L.left : L.right, `At ${n.value}: go ${side} to ${child.value}.`, { current: n.id });
      yield* walk(child);
    };
    if (kind === 'preorder') {
      yield* visit(n);
      yield* descend(n.left, 'left');
      yield* descend(n.right, 'right');
    } else if (kind === 'inorder') {
      yield* descend(n.left, 'left');
      yield* visit(n);
      yield* descend(n.right, 'right');
    } else {
      yield* descend(n.left, 'left');
      yield* descend(n.right, 'right');
      yield* visit(n);
    }
    t.path.pop();
  };

  yield* walk(root);
  yield t.frame(L.call, `${kind[0].toUpperCase()}${kind.slice(1)} traversal complete: ${t.output.join(', ')}.`);
}

// ─── Public API ───

export function treeOperationId(mode: AlgoTreeMode, action: TreeAction): TreeOperationId {
  switch (action) {
    case 'insert':
      return mode === 'avl' ? 'avl-insert' : 'bst-insert';
    case 'delete':
      return mode === 'avl' ? 'avl-delete' : 'bst-delete';
    case 'search':
      return 'bst-search';
    default:
      return action;
  }
}

/** Id for a new node that no node in `root` uses yet. */
export function nextNodeId(root: AlgoTreeNode | null): string {
  let max = 0;
  const walk = (node: AlgoTreeNode | null) => {
    if (!node) return;
    const match = /^t(\d+)$/.exec(node.id);
    if (match) max = Math.max(max, Number(match[1]));
    walk(node.left);
    walk(node.right);
  };
  walk(root);
  return `t${max + 1}`;
}

/** Run one operation on an immutable tree and return its frames plus the resulting tree. */
export function runTreeOperation(
  mode: AlgoTreeMode,
  root: AlgoTreeNode | null,
  action: TreeAction,
  value = 0
): AlgoTreeRun {
  const t = new TreeTracer(toMutable(root));
  let generator: TreeGenerator;
  switch (action) {
    case 'insert':
      generator = insertSteps(t, value, mode, nextNodeId(root));
      break;
    case 'delete':
      generator = deleteSteps(t, value, mode);
      break;
    case 'search':
      generator = searchSteps(t, value);
      break;
    default:
      generator = traversalSteps(t, action);
  }
  const { frames } = collectFrames(generator);
  return {
    operation: treeOperationId(mode, action),
    frames,
    root: t.changed ? t.snapshot() : root,
    rotations: t.rotations,
    changed: t.changed,
  };
}

/** Build a tree by inserting values one after another (no frames kept). */
export function buildTree(mode: AlgoTreeMode, values: readonly number[]): AlgoTreeNode | null {
  let root: AlgoTreeNode | null = null;
  for (const value of values) root = runTreeOperation(mode, root, 'insert', value).root;
  return root;
}

/** A still frame of a tree, used before any operation has run. */
export function idleTreeFrame(root: AlgoTreeNode | null, message: string): AlgoTreeFrame {
  return {
    root,
    current: null,
    path: NO_IDS,
    found: null,
    removing: null,
    rotating: NO_IDS,
    visited: NO_IDS,
    output: [],
    rotation: null,
    line: -1,
    message,
  };
}

export function treeSize(root: AlgoTreeNode | null): number {
  return root ? 1 + treeSize(root.left) + treeSize(root.right) : 0;
}

export function treeHeight(root: AlgoTreeNode | null): number {
  return root ? 1 + Math.max(treeHeight(root.left), treeHeight(root.right)) : 0;
}

export function treeContains(root: AlgoTreeNode | null, value: number): boolean {
  let node = root;
  while (node) {
    if (value === node.value) return true;
    node = value < node.value ? node.left : node.right;
  }
  return false;
}

/** Keys in sorted (inorder) order. */
export function treeValues(root: AlgoTreeNode | null): number[] {
  const out: number[] = [];
  const walk = (node: AlgoTreeNode | null) => {
    if (!node) return;
    walk(node.left);
    out.push(node.value);
    walk(node.right);
  };
  walk(root);
  return out;
}

/** True when every node satisfies the AVL balance condition. */
export function isAvlBalanced(root: AlgoTreeNode | null): boolean {
  const check = (node: AlgoTreeNode | null): number => {
    if (!node) return 0;
    const left = check(node.left);
    const right = check(node.right);
    if (left < 0 || right < 0 || Math.abs(left - right) > 1) return -1;
    return 1 + Math.max(left, right);
  };
  return check(root) >= 0;
}

// ─── Layout ───

export interface TreeLayoutNode {
  id: string;
  value: number;
  x: number;
  y: number;
  /** height(left) − height(right) */
  balance: number;
  parentId: string | null;
}

export interface TreeLayoutEdge {
  /** The child's id: an edge keeps its identity when a rotation re-parents the child. */
  id: string;
  parentId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
  radius: number;
}

/**
 * Place nodes by inorder rank (x) and depth (y) inside a width × height box.
 * Two nodes at the same depth are always ≥ 2 ranks apart, so they never overlap.
 */
export function layoutTree(root: AlgoTreeNode | null, width: number, height: number): TreeLayout {
  interface Raw {
    id: string;
    value: number;
    rank: number;
    depth: number;
    parentId: string | null;
    balance: number;
  }
  const raw: Raw[] = [];
  let nextRank = 0;
  let maxDepth = 0;
  const walk = (node: AlgoTreeNode | null, depth: number, parentId: string | null): number => {
    if (!node) return 0;
    const leftHeight = walk(node.left, depth + 1, node.id);
    const entry: Raw = { id: node.id, value: node.value, rank: nextRank++, depth, parentId, balance: 0 };
    raw.push(entry);
    const rightHeight = walk(node.right, depth + 1, node.id);
    entry.balance = leftHeight - rightHeight;
    if (depth > maxDepth) maxDepth = depth;
    return 1 + Math.max(leftHeight, rightHeight);
  };
  walk(root, 0, null);

  const count = raw.length;
  const marginX = 48;
  const top = 52;
  const bottom = 44;
  const spacingX = count > 1 ? Math.min(90, (width - 2 * marginX) / (count - 1)) : 0;
  const spacingY = maxDepth > 0 ? Math.min(92, (height - top - bottom) / maxDepth) : 0;
  const startX = (width - spacingX * Math.max(0, count - 1)) / 2;
  const radius = Math.max(
    9,
    Math.min(24, spacingX > 0 ? spacingX * 0.8 : 24, spacingY > 0 ? spacingY * 0.42 : 24)
  );

  const positions = new Map<string, { x: number; y: number }>();
  const nodes: TreeLayoutNode[] = raw.map((entry) => {
    const x = startX + entry.rank * spacingX;
    const y = top + entry.depth * spacingY;
    positions.set(entry.id, { x, y });
    return { id: entry.id, value: entry.value, x, y, balance: entry.balance, parentId: entry.parentId };
  });

  const edges: TreeLayoutEdge[] = [];
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = positions.get(node.parentId);
    if (!parent) continue;
    edges.push({ id: node.id, parentId: node.parentId, x1: parent.x, y1: parent.y, x2: node.x, y2: node.y });
  }

  return { nodes, edges, radius };
}
