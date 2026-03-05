// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Questions: Data Structures
// ═══════════════════════════════════════════════════════════

import type { Question } from '@/types/gate';

export const DS_QUESTIONS: Question[] = [
  {
    id: 'ds-001', subject: 'Data Structures', topic: 'Arrays & Linked Lists',
    type: 'mcq', question: 'Time complexity of inserting at the beginning of a singly linked list is:',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], answer: 0, difficulty: 'easy', marks: 1,
    explanation: 'Inserting at the head only requires updating the head pointer, which takes constant time O(1).',
  },
  {
    id: 'ds-002', subject: 'Data Structures', topic: 'Stacks & Queues',
    type: 'mcq', question: 'Which data structure is used for function call management in recursion?',
    options: ['Queue', 'Stack', 'Heap', 'Tree'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'The system uses a call stack to manage function calls, storing return addresses and local variables in LIFO order.',
  },
  {
    id: 'ds-003', subject: 'Data Structures', topic: 'Trees',
    type: 'mcq', question: 'The maximum number of nodes in a binary tree of height h is:',
    options: ['2h', '2^h - 1', '2^(h+1) - 1', 'h²'], answer: 2, difficulty: 'easy', marks: 1,
    explanation: 'A complete binary tree of height h has maximum 2^(h+1) - 1 nodes (where height of root = 0).',
  },
  {
    id: 'ds-004', subject: 'Data Structures', topic: 'Trees',
    type: 'numerical', question: 'A complete binary tree has 31 nodes. What is its height? (root at height 0)',
    options: [], answer: '4', difficulty: 'easy', marks: 1,
    explanation: '2^(h+1) - 1 = 31 → 2^(h+1) = 32 → h+1 = 5 → h = 4.',
  },
  {
    id: 'ds-005', subject: 'Data Structures', topic: 'BST',
    type: 'mcq', question: 'Worst case time complexity of search in a BST with n nodes is:',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 2, difficulty: 'easy', marks: 1,
    explanation: 'In worst case, BST degenerates to a linked list (skewed tree), making search O(n). AVL/Red-Black trees guarantee O(log n).',
  },
  {
    id: 'ds-006', subject: 'Data Structures', topic: 'Heaps',
    type: 'mcq', question: 'Building a max-heap from an array of n elements takes:',
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 0, difficulty: 'medium', marks: 1,
    explanation: 'Bottom-up heap construction (Floyd\'s algorithm) runs in O(n) time, not O(n log n) as commonly misbelieved.',
  },
  {
    id: 'ds-007', subject: 'Data Structures', topic: 'Graphs',
    type: 'mcq', question: 'BFS uses which data structure?',
    options: ['Stack', 'Queue', 'Priority Queue', 'Dequeue'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'BFS (Breadth-First Search) uses a queue to explore nodes level by level. DFS uses a stack (or recursion).',
  },
  {
    id: 'ds-008', subject: 'Data Structures', topic: 'Graphs',
    type: 'numerical', question: 'A connected graph with n vertices needs at least how many edges?',
    options: [], answer: 'n-1', difficulty: 'easy', marks: 1,
    explanation: 'A connected graph with n vertices needs minimum n-1 edges (a tree). Adding any more creates cycles.',
  },
  {
    id: 'ds-009', subject: 'Data Structures', topic: 'Hashing',
    type: 'mcq', question: 'Linear probing in open addressing suffers from:',
    options: ['Secondary clustering', 'Primary clustering', 'No clustering', 'Overflow'], answer: 1, difficulty: 'medium', marks: 1,
    explanation: 'Linear probing causes primary clustering — consecutive occupied cells form clusters, increasing search time for nearby keys.',
  },
  {
    id: 'ds-010', subject: 'Data Structures', topic: 'Hashing',
    type: 'numerical', question: 'A hash table of size 10 uses h(k)=k mod 10. Keys inserted: 12, 22, 32. Using linear probing, at what index is 32 stored?',
    options: [], answer: '4', difficulty: 'medium', marks: 2,
    explanation: 'h(12)=2, h(22)=2(collision→3), h(32)=2(collision→3→4). 32 is stored at index 4.',
  },
  {
    id: 'ds-011', subject: 'Data Structures', topic: 'Trees',
    type: 'mcq', question: 'Inorder traversal of a BST gives:',
    options: ['Random order', 'Sorted ascending order', 'Sorted descending order', 'Level order'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Inorder traversal (Left-Root-Right) of a BST always produces elements in sorted ascending order.',
  },
  {
    id: 'ds-012', subject: 'Data Structures', topic: 'Graphs',
    type: 'mcq', question: 'Topological sort is possible only for:',
    options: ['Undirected graphs', 'DAGs (Directed Acyclic Graphs)', 'Trees only', 'Complete graphs'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Topological sorting produces a linear ordering of vertices such that for every edge u→v, u comes before v. This is only possible in DAGs.',
  },
  {
    id: 'ds-013', subject: 'Data Structures', topic: 'Trees',
    type: 'mcq', question: 'AVL tree is a:',
    options: ['Binary tree', 'Self-balancing BST', 'B-tree', 'Heap'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'AVL tree is a self-balancing BST where the heights of left and right subtrees differ by at most 1 for every node.',
  },
  {
    id: 'ds-014', subject: 'Data Structures', topic: 'Heaps',
    type: 'numerical', question: 'In a min-heap with 7 elements, maximum how many comparisons needed to extract the minimum?',
    options: [], answer: '4', difficulty: 'medium', marks: 2,
    explanation: 'Extract-min removes root, places last element at root, then sifts down. Height = ⌊log2(7)⌋ = 2. Each level needs 2 comparisons (compare children, compare with parent). Total ≈ 2×2 = 4.',
  },
  {
    id: 'ds-015', subject: 'Data Structures', topic: 'Arrays & Linked Lists',
    type: 'mcq', question: 'Doubly linked list allows traversal in:',
    options: ['Forward only', 'Backward only', 'Both directions', 'Random'], answer: 2, difficulty: 'easy', marks: 1,
    explanation: 'Doubly linked list has both next and prev pointers, allowing traversal in both forward and backward directions.',
  },
  {
    id: 'ds-016', subject: 'Data Structures', topic: 'Graphs',
    type: 'numerical', question: 'A complete graph with 6 vertices has how many edges?',
    options: [], answer: '15', difficulty: 'easy', marks: 1,
    explanation: 'Complete graph K_n has n(n-1)/2 edges. K_6 = 6×5/2 = 15.',
  },
  {
    id: 'ds-017', subject: 'Data Structures', topic: 'Trees',
    type: 'mcq', question: 'Which tree traversal uses a queue?',
    options: ['Inorder', 'Preorder', 'Postorder', 'Level order'], answer: 3, difficulty: 'easy', marks: 1,
    explanation: 'Level order (BFS) traversal of a tree uses a queue. DFS traversals (inorder, preorder, postorder) use stack/recursion.',
  },
  {
    id: 'ds-018', subject: 'Data Structures', topic: 'Stacks & Queues',
    type: 'mcq', question: 'To implement a queue using two stacks, dequeue operation has amortized complexity of:',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], answer: 0, difficulty: 'medium', marks: 1,
    explanation: 'Using two stacks: push to stack1, pop from stack2. When stack2 is empty, transfer all from stack1. Amortized dequeue = O(1).',
  },
];
