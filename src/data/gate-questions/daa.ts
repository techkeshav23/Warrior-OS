// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Questions: Algorithms (DAA)
// ═══════════════════════════════════════════════════════════

import type { Question } from '@/types/gate';

export const DAA_QUESTIONS: Question[] = [
  {
    id: 'daa-001', subject: 'DAA', topic: 'Sorting',
    type: 'mcq', question: 'Which sorting algorithm has worst-case O(n log n)?',
    options: ['Quick Sort', 'Merge Sort', 'Bubble Sort', 'Selection Sort'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Merge Sort always runs in O(n log n) in all cases. Quick Sort has O(n²) worst case.',
  },
  {
    id: 'daa-002', subject: 'DAA', topic: 'Sorting',
    type: 'numerical', question: 'The minimum number of comparisons needed to find both the minimum and maximum of n elements is:',
    options: [], answer: '3n/2-2', difficulty: 'medium', marks: 2,
    explanation: 'Using the tournament method: compare pairs, then find min among losers and max among winners = 3⌈n/2⌉ - 2.',
  },
  {
    id: 'daa-003', subject: 'DAA', topic: 'Divide and Conquer',
    type: 'mcq', question: 'Master theorem applies to recurrences of the form:',
    options: ['T(n) = aT(n/b) + f(n)', 'T(n) = T(n-1) + n', 'T(n) = 2^n', 'All recurrences'], answer: 0, difficulty: 'easy', marks: 1,
    explanation: 'Master theorem applies to recurrences of form T(n) = aT(n/b) + O(n^k log^p n) where a≥1, b>1.',
  },
  {
    id: 'daa-004', subject: 'DAA', topic: 'Greedy Algorithms',
    type: 'mcq', question: 'Huffman coding is an example of:',
    options: ['Dynamic Programming', 'Greedy Algorithm', 'Divide and Conquer', 'Backtracking'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Huffman coding uses a greedy approach: always combine the two lowest-frequency characters first to build the optimal prefix-free code.',
  },
  {
    id: 'daa-005', subject: 'DAA', topic: 'Dynamic Programming',
    type: 'mcq', question: '0/1 Knapsack problem can be solved using:',
    options: ['Greedy only', 'Dynamic Programming', 'BFS', 'Sorting'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: '0/1 Knapsack requires DP because items cannot be fractioned. Fractional Knapsack can use greedy.',
  },
  {
    id: 'daa-006', subject: 'DAA', topic: 'Graph Algorithms',
    type: 'mcq', question: 'Dijkstra\'s algorithm does NOT work with:',
    options: ['Directed graphs', 'Undirected graphs', 'Negative weight edges', 'Weighted graphs'], answer: 2, difficulty: 'easy', marks: 1,
    explanation: 'Dijkstra fails with negative weight edges because it assumes once a vertex is finalized, no shorter path exists. Bellman-Ford handles negative edges.',
  },
  {
    id: 'daa-007', subject: 'DAA', topic: 'Graph Algorithms',
    type: 'numerical', question: 'Time complexity of Dijkstra\'s algorithm using min-heap with V vertices and E edges is O(?). Express as V and E with log.',
    options: [], answer: '(V+E)logV', difficulty: 'medium', marks: 2,
    explanation: 'With binary min-heap: V extract-min operations (O(V log V)) + E decrease-key operations (O(E log V)) = O((V+E) log V).',
  },
  {
    id: 'daa-008', subject: 'DAA', topic: 'Complexity Classes',
    type: 'mcq', question: 'Which is true about P and NP?',
    options: ['P = NP (proven)', 'P ≠ NP (proven)', 'P ⊆ NP', 'NP ⊆ P'], answer: 2, difficulty: 'medium', marks: 1,
    explanation: 'P ⊆ NP is known (every problem solvable efficiently is also verifiable efficiently). Whether P = NP is the famous unsolved millennium problem.',
  },
  {
    id: 'daa-009', subject: 'DAA', topic: 'Complexity Classes',
    type: 'mcq', question: 'An NP-complete problem is:',
    options: ['Not solvable', 'In NP and NP-hard', 'Always exponential', 'In P'], answer: 1, difficulty: 'medium', marks: 1,
    explanation: 'NP-complete = NP ∩ NP-hard. It\'s in NP (verifiable in polynomial time) and every NP problem reduces to it in polynomial time.',
  },
  {
    id: 'daa-010', subject: 'DAA', topic: 'Graph Algorithms',
    type: 'mcq', question: 'Kruskal\'s algorithm for MST works by:',
    options: ['Adding nearest vertex', 'Adding cheapest edge that doesn\'t form cycle', 'BFS traversal', 'DFS traversal'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Kruskal\'s sorts edges by weight and adds cheapest edge that doesn\'t create a cycle (uses Union-Find). Prim\'s grows from a vertex.',
  },
  {
    id: 'daa-011', subject: 'DAA', topic: 'Dynamic Programming',
    type: 'numerical', question: 'Longest Common Subsequence of "ABCBDAB" and "BDCAB" has length:',
    options: [], answer: '4', difficulty: 'medium', marks: 2,
    explanation: 'LCS = "BCAB" (length 4). DP table construction shows this is the maximum.',
  },
  {
    id: 'daa-012', subject: 'DAA', topic: 'Sorting',
    type: 'mcq', question: 'Lower bound for comparison-based sorting is:',
    options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Any comparison-based sorting algorithm must make at least Ω(n log n) comparisons in the worst case (from decision tree argument).',
  },
  {
    id: 'daa-013', subject: 'DAA', topic: 'Backtracking',
    type: 'mcq', question: 'N-Queens problem is best solved by:',
    options: ['Greedy', 'Dynamic Programming', 'Backtracking', 'Divide and Conquer'], answer: 2, difficulty: 'easy', marks: 1,
    explanation: 'N-Queens uses backtracking: place queens one row at a time, check constraints, backtrack if no valid position exists.',
  },
  {
    id: 'daa-014', subject: 'DAA', topic: 'Graph Algorithms',
    type: 'mcq', question: 'Bellman-Ford can detect:',
    options: ['Positive cycles', 'Negative weight cycles', 'Self-loops only', 'Disconnected components'], answer: 1, difficulty: 'medium', marks: 1,
    explanation: 'After V-1 relaxation iterations, if any edge can still be relaxed, a negative weight cycle exists. Bellman-Ford detects this.',
  },
  {
    id: 'daa-015', subject: 'DAA', topic: 'Divide and Conquer',
    type: 'numerical', question: 'For T(n) = 2T(n/2) + n, using Master theorem, T(n) = O(n^a log^b n). What is a?',
    options: [], answer: '1', difficulty: 'medium', marks: 1,
    explanation: 'a=2, b=2, f(n)=n. log_b(a)=log_2(2)=1. f(n)=n=n^1. Case 2: T(n)=O(n log n). So a=1, b=1.',
  },
  {
    id: 'daa-016', subject: 'DAA', topic: 'Greedy Algorithms',
    type: 'mcq', question: 'Activity selection problem is solved optimally by:',
    options: ['DP only', 'Greedy (sort by finish time)', 'Backtracking', 'BFS'], answer: 1, difficulty: 'easy', marks: 1,
    explanation: 'Activity selection is optimally solved by greedy: sort by finish time, always pick the earliest-finishing compatible activity.',
  },
];
