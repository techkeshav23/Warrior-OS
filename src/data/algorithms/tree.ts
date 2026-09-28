// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tree Operation Metadata & Preset Trees
// Pseudocode line numbers are referenced by TREE_LINES in
// src/lib/algorithms/tree.ts — edit both together.
// ═══════════════════════════════════════════════════════════

import type { AlgoTreeMode, AlgorithmMeta, TreeOperationId } from '@/types/algo';

const TRAVERSAL_COMPLEXITY = { best: 'O(n)', average: 'O(n)', worst: 'O(n)', space: 'O(h)' };

export const TREE_OPERATIONS: Record<TreeOperationId, AlgorithmMeta> = {
  'bst-insert': {
    id: 'bst-insert',
    name: 'BST Insert',
    category: 'tree',
    complexity: { best: 'O(1)', average: 'O(log n)', worst: 'O(n)', space: 'O(1)' },
    stable: null,
    inPlace: null,
    description:
      'Walks down from the root, going left for smaller keys and right for larger ones, and hangs the new key on the first empty child slot.',
    steps: [
      'Start at the root; an empty tree simply gets a new root.',
      'Go left if the key is smaller than the node, right if larger.',
      'Stop at a duplicate: keys stay unique.',
      'Attach the new node where the walk falls off the tree.',
    ],
    pseudocode: [
      'procedure insert(root, key)',
      '  if root = nil then root ← new node(key); return',
      '  node ← root',
      '  loop',
      '    if key = node.key then return   // keys stay unique',
      '    if key < node.key then',
      '      if node.left = nil then node.left ← new node(key); return',
      '      node ← node.left',
      '    else',
      '      if node.right = nil then node.right ← new node(key); return',
      '      node ← node.right',
    ],
    facts: [
      'Inserting keys in sorted order degrades a BST into a linked list of height n − 1.',
      'The cost is proportional to the height h of the tree: O(h).',
    ],
  },

  'bst-search': {
    id: 'bst-search',
    name: 'BST Search',
    category: 'tree',
    complexity: { best: 'O(1)', average: 'O(log n)', worst: 'O(n)', space: 'O(1)' },
    stable: null,
    inPlace: null,
    description:
      'Binary search on a linked structure: every comparison discards one whole subtree, so the search follows a single root-to-leaf path.',
    steps: [
      'Start at the root.',
      'Equal key: found.',
      'Smaller key: continue in the left subtree; larger: in the right subtree.',
      'Falling off the tree means the key is absent.',
    ],
    pseudocode: [
      'procedure search(root, key)',
      '  node ← root',
      '  while node ≠ nil do',
      '    if key = node.key then return node   // found',
      '    if key < node.key then node ← node.left',
      '    else node ← node.right',
      '  return nil   // not found',
    ],
    facts: [
      'A balanced tree needs at most ⌊log₂ n⌋ + 1 comparisons.',
      'Inorder traversal of a BST lists its keys in sorted order.',
    ],
  },

  'bst-delete': {
    id: 'bst-delete',
    name: 'BST Delete',
    category: 'tree',
    complexity: { best: 'O(1)', average: 'O(log n)', worst: 'O(n)', space: 'O(1)' },
    stable: null,
    inPlace: null,
    description:
      'Removes a key in one of three ways: a leaf is unlinked, a node with one child is spliced out, and a node with two children is replaced by its inorder successor.',
    steps: [
      'Search for the key, remembering the parent.',
      'Leaf: unlink it.',
      'One child: link the parent straight to that child.',
      'Two children: move the inorder successor (leftmost node of the right subtree) into its place.',
    ],
    pseudocode: [
      'procedure delete(root, key)',
      '  find the node holding key, remembering its parent',
      '  if node = nil then return   // key not found',
      '  if node has no children then',
      '    unlink node from its parent',
      '  else if node has one child then',
      '    link the parent straight to that child',
      '  else',
      '    succ ← leftmost node of node.right   // inorder successor',
      '    unlink succ, lifting succ.right into its old spot',
      '    put succ where node was, adopting both children',
    ],
    facts: [
      'The inorder successor of a node with two children never has a left child.',
      'Using the inorder predecessor (rightmost of the left subtree) works just as well.',
    ],
  },

  'avl-insert': {
    id: 'avl-insert',
    name: 'AVL Insert',
    category: 'tree',
    complexity: { best: 'O(log n)', average: 'O(log n)', worst: 'O(log n)', space: 'O(log n)' },
    stable: null,
    inPlace: null,
    description:
      'A BST insert followed by a walk back up the path, fixing heights and rotating any node whose balance factor leaves {−1, 0, +1}.',
    steps: [
      'Insert the key exactly as in a plain BST.',
      'Walk back up, recomputing each ancestor\'s height and balance factor.',
      'Balance factor +2 or −2: pick the LL, RR, LR or RL case.',
      'Apply a single or double rotation; the subtree regains its old height.',
    ],
    pseudocode: [
      'procedure avlInsert(root, key)',
      '  insert key as in a plain BST',
      '  for each ancestor a of the new node, bottom-up do',
      '    height(a) ← 1 + max(height(a.left), height(a.right))',
      '    bf ← height(a.left) − height(a.right)',
      '    if bf > 1 and key < a.left.key then rotateRight(a)   // LL',
      '    if bf < −1 and key > a.right.key then rotateLeft(a)   // RR',
      '    if bf > 1 and key > a.left.key then rotateLeft(a.left); rotateRight(a)   // LR',
      '    if bf < −1 and key < a.right.key then rotateRight(a.right); rotateLeft(a)   // RL',
    ],
    facts: [
      'An insertion needs at most one single or double rotation.',
      'AVL height is below 1.44 · log₂(n + 2), so every operation is O(log n).',
      'Minimum nodes in an AVL tree of height h: N(h) = N(h − 1) + N(h − 2) + 1.',
    ],
  },

  'avl-delete': {
    id: 'avl-delete',
    name: 'AVL Delete',
    category: 'tree',
    complexity: { best: 'O(log n)', average: 'O(log n)', worst: 'O(log n)', space: 'O(log n)' },
    stable: null,
    inPlace: null,
    description:
      'A BST delete followed by rebalancing every ancestor of the removed spot. Unlike insertion, a deletion can trigger rotations at several levels.',
    steps: [
      'Delete the key exactly as in a plain BST.',
      'Walk up from the deepest changed node to the root.',
      'Recompute height and balance factor at each ancestor.',
      'Use the child\'s balance to choose LL, LR, RR or RL, rotate, and keep walking up.',
    ],
    pseudocode: [
      'procedure avlDelete(root, key)',
      '  delete key as in a plain BST',
      '  for each ancestor a of the removed spot, bottom-up do',
      '    height(a) ← 1 + max(height(a.left), height(a.right))',
      '    bf ← height(a.left) − height(a.right)',
      '    if bf > 1 and balance(a.left) ≥ 0 then rotateRight(a)   // LL',
      '    if bf > 1 and balance(a.left) < 0 then rotateLeft(a.left); rotateRight(a)   // LR',
      '    if bf < −1 and balance(a.right) ≤ 0 then rotateLeft(a)   // RR',
      '    if bf < −1 and balance(a.right) > 0 then rotateRight(a.right); rotateLeft(a)   // RL',
    ],
    facts: [
      'A deletion may need up to O(log n) rotations, one per level.',
      'When the heavy child is perfectly balanced (bf 0), a single rotation is enough.',
    ],
  },

  inorder: {
    id: 'inorder',
    name: 'Inorder Traversal',
    category: 'tree',
    complexity: TRAVERSAL_COMPLEXITY,
    stable: null,
    inPlace: null,
    description: 'Left subtree, then the node, then the right subtree. On a BST this lists the keys in ascending order.',
    steps: ['Traverse the left subtree.', 'Visit the node.', 'Traverse the right subtree.'],
    pseudocode: [
      'procedure inorder(node)',
      '  if node = nil then return',
      '  inorder(node.left)',
      '  visit(node)',
      '  inorder(node.right)',
    ],
    facts: [
      'Inorder of a BST is sorted: a quick way to validate a BST.',
      'Inorder plus preorder (or postorder) uniquely determines a binary tree.',
    ],
  },

  preorder: {
    id: 'preorder',
    name: 'Preorder Traversal',
    category: 'tree',
    complexity: TRAVERSAL_COMPLEXITY,
    stable: null,
    inPlace: null,
    description: 'The node first, then its left subtree, then its right subtree. Useful for copying or serialising a tree.',
    steps: ['Visit the node.', 'Traverse the left subtree.', 'Traverse the right subtree.'],
    pseudocode: [
      'procedure preorder(node)',
      '  if node = nil then return',
      '  visit(node)',
      '  preorder(node.left)',
      '  preorder(node.right)',
    ],
    facts: [
      'The first key of a preorder sequence is always the root.',
      'Preorder alone rebuilds a BST: insert the keys in that order.',
    ],
  },

  postorder: {
    id: 'postorder',
    name: 'Postorder Traversal',
    category: 'tree',
    complexity: TRAVERSAL_COMPLEXITY,
    stable: null,
    inPlace: null,
    description: 'Both subtrees before the node itself. Children are always handled before their parent.',
    steps: ['Traverse the left subtree.', 'Traverse the right subtree.', 'Visit the node.'],
    pseudocode: [
      'procedure postorder(node)',
      '  if node = nil then return',
      '  postorder(node.left)',
      '  postorder(node.right)',
      '  visit(node)',
    ],
    facts: [
      'The last key of a postorder sequence is always the root.',
      'Used to free a tree and to evaluate expression trees.',
    ],
  },
};

// ─── Tree structures offered in the sidebar ───

export interface TreeModeInfo {
  mode: AlgoTreeMode;
  name: string;
  description: string;
  /** Keys inserted, in order, to build the starting tree. */
  presetValues: number[];
  hint: string;
}

export const TREE_MODES: Record<AlgoTreeMode, TreeModeInfo> = {
  bst: {
    mode: 'bst',
    name: 'Binary Search Tree',
    description: 'Every key in a left subtree is smaller than its ancestor, every key in a right subtree larger.',
    presetValues: [50, 30, 70, 20, 40, 60, 80, 35, 65],
    hint: 'Delete 30 to see the two-children case, or insert keys in ascending order to watch the tree degrade into a list.',
  },
  avl: {
    mode: 'avl',
    name: 'AVL Tree',
    description: 'A self-balancing BST: the heights of the two subtrees of any node differ by at most one.',
    presetValues: [40, 20, 60, 10, 30],
    hint: 'Insert 5 for a single (LL) rotation, or 25 for a double (LR) rotation.',
  },
};
