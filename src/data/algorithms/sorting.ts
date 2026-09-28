// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sorting Algorithm Metadata
// Complexity, stability, steps and pseudocode for the six sorts.
// Pseudocode line numbers are referenced by SORT_LINES in
// src/lib/algorithms/sorting.ts — edit both together.
// ═══════════════════════════════════════════════════════════

import type { AlgorithmMeta, SortAlgorithmId } from '@/types/algo';

export const SORTING_ALGORITHMS: Record<SortAlgorithmId, AlgorithmMeta> = {
  'bubble-sort': {
    id: 'bubble-sort',
    name: 'Bubble Sort',
    category: 'sorting',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    stable: true,
    inPlace: true,
    moveLabel: 'swaps',
    description:
      'Walks the array repeatedly, swapping neighbours that are out of order. After each pass the largest remaining value has bubbled to the end.',
    steps: [
      'Compare each pair of neighbours from left to right.',
      'Swap the pair whenever the left value is larger.',
      'After pass i, the last i values are in their final places.',
      'Stop early if a whole pass makes no swaps.',
    ],
    pseudocode: [
      'procedure bubbleSort(A[0..n−1])',
      '  for i ← 0 to n − 2 do',
      '    swapped ← false',
      '    for j ← 0 to n − i − 2 do',
      '      if A[j] > A[j + 1] then',
      '        swap A[j] and A[j + 1]',
      '        swapped ← true',
      '    mark A[n − i − 1] as sorted',
      '    if swapped = false then break',
      '  return A',
    ],
    facts: [
      'The number of swaps equals the number of inversions in the input.',
      'The O(n) best case needs the early-exit "swapped" flag.',
      'Stable: equal values are never swapped past each other.',
    ],
  },

  'selection-sort': {
    id: 'selection-sort',
    name: 'Selection Sort',
    category: 'sorting',
    complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    stable: false,
    inPlace: true,
    moveLabel: 'swaps',
    description:
      'Finds the smallest value in the unsorted part and swaps it to the front, growing a sorted prefix one element per pass.',
    steps: [
      'Assume the first unsorted value is the minimum.',
      'Scan the rest of the unsorted part for anything smaller.',
      'Swap the true minimum into the first unsorted slot.',
      'Repeat with the unsorted part one element shorter.',
    ],
    pseudocode: [
      'procedure selectionSort(A[0..n−1])',
      '  for i ← 0 to n − 2 do',
      '    min ← i',
      '    for j ← i + 1 to n − 1 do',
      '      if A[j] < A[min] then',
      '        min ← j',
      '    if min ≠ i then swap A[i] and A[min]',
      '    mark A[i] as sorted',
      '  return A',
    ],
    facts: [
      'Always makes exactly n(n − 1)/2 comparisons, whatever the input.',
      'At most n − 1 swaps: handy when writes are expensive.',
      'Not stable: the long-distance swap can jump over an equal value.',
    ],
  },

  'insertion-sort': {
    id: 'insertion-sort',
    name: 'Insertion Sort',
    category: 'sorting',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    stable: true,
    inPlace: true,
    moveLabel: 'writes',
    description:
      'Builds a sorted prefix by taking the next value and shifting larger values right until the gap is where it belongs, like sorting a hand of cards.',
    steps: [
      'Take the next value as the key.',
      'Shift every larger value in the sorted prefix one place right.',
      'Drop the key into the gap that opens up.',
      'The prefix is now one element longer and still sorted.',
    ],
    pseudocode: [
      'procedure insertionSort(A[0..n−1])',
      '  for i ← 1 to n − 1 do',
      '    key ← A[i]',
      '    j ← i − 1',
      '    while j ≥ 0 and A[j] > key do',
      '      A[j + 1] ← A[j]',
      '      j ← j − 1',
      '    A[j + 1] ← key',
      '  return A',
    ],
    facts: [
      'Runs in O(n + d) time, where d is the number of inversions: great on nearly sorted data.',
      'Online: it can sort values as they arrive.',
      'Hybrid sorts (Timsort, introsort) use it for small sub-arrays.',
    ],
  },

  'merge-sort': {
    id: 'merge-sort',
    name: 'Merge Sort',
    category: 'sorting',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
    stable: true,
    inPlace: false,
    moveLabel: 'writes',
    description:
      'Divide and conquer: split the array in half, sort each half recursively, then merge the two sorted runs by repeatedly taking the smaller head.',
    steps: [
      'Split the range at its midpoint.',
      'Recursively sort the left half, then the right half.',
      'Merge: compare the heads of both runs and copy the smaller one out.',
      'Copy whatever is left of either run once the other is empty.',
    ],
    pseudocode: [
      'procedure mergeSort(A, lo, hi)',
      '  if lo ≥ hi then return',
      '  mid ← ⌊(lo + hi) / 2⌋',
      '  mergeSort(A, lo, mid)',
      '  mergeSort(A, mid + 1, hi)',
      '  merge(A, lo, mid, hi)',
      'procedure merge(A, lo, mid, hi)',
      '  L ← A[lo..mid];  R ← A[mid + 1..hi]',
      '  i ← 0;  j ← 0;  k ← lo',
      '  while i < |L| and j < |R| do',
      '    if R[j] < L[i] then',
      '      A[k] ← R[j];  j ← j + 1',
      '    else',
      '      A[k] ← L[i];  i ← i + 1',
      '    k ← k + 1',
      '  copy what is left of L, then R, into A[k..hi]',
    ],
    facts: [
      'Recurrence T(n) = 2T(n/2) + Θ(n) solves to Θ(n log n) (Master theorem, case 2).',
      'Taking from R only when strictly smaller is what keeps it stable.',
      'The standard choice for linked lists and external (on-disk) sorting.',
    ],
  },

  'quick-sort': {
    id: 'quick-sort',
    name: 'Quick Sort',
    category: 'sorting',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)' },
    stable: false,
    inPlace: true,
    moveLabel: 'swaps',
    description:
      'Picks a pivot, partitions the range so smaller values sit left of it and the rest right, then sorts both sides recursively. This uses the Lomuto partition with the last element as pivot.',
    steps: [
      'Choose the last element of the range as the pivot.',
      'Sweep the range, swapping values smaller than the pivot into a growing left zone.',
      'Swap the pivot just after that zone: it is now in its final place.',
      'Recursively sort the parts left and right of the pivot.',
    ],
    pseudocode: [
      'procedure quickSort(A, lo, hi)',
      '  if lo ≥ hi then return',
      '  p ← partition(A, lo, hi)',
      '  quickSort(A, lo, p − 1)',
      '  quickSort(A, p + 1, hi)',
      'procedure partition(A, lo, hi)',
      '  pivot ← A[hi]',
      '  i ← lo − 1',
      '  for j ← lo to hi − 1 do',
      '    if A[j] < pivot then',
      '      i ← i + 1',
      '      swap A[i] and A[j]',
      '  swap A[i + 1] and A[hi]',
      '  return i + 1',
    ],
    facts: [
      'Worst case O(n²) when the pivot is always the minimum or maximum, e.g. already sorted input with a last-element pivot.',
      'Best and average recurrence: T(n) = 2T(n/2) + Θ(n).',
      'Randomised or median-of-three pivots make the worst case very unlikely.',
    ],
  },

  'heap-sort': {
    id: 'heap-sort',
    name: 'Heap Sort',
    category: 'sorting',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
    stable: false,
    inPlace: true,
    moveLabel: 'swaps',
    description:
      'Turns the array into a max-heap, then repeatedly swaps the root (the maximum) to the end and sifts the new root down to repair the heap.',
    steps: [
      'Build a max-heap bottom-up by sifting down every internal node.',
      'Swap the root (the maximum) with the last heap element.',
      'Shrink the heap by one: that slot is now sorted.',
      'Sift the new root down to restore the heap, and repeat.',
    ],
    pseudocode: [
      'procedure heapSort(A[0..n−1])',
      '  for i ← ⌊n / 2⌋ − 1 downto 0 do',
      '    siftDown(A, i, n)',
      '  for end ← n − 1 downto 1 do',
      '    swap A[0] and A[end]',
      '    mark A[end] as sorted',
      '    siftDown(A, 0, end)',
      'procedure siftDown(A, i, size)',
      '  largest ← i;  l ← 2i + 1;  r ← 2i + 2',
      '  if l < size and A[l] > A[largest] then largest ← l',
      '  if r < size and A[r] > A[largest] then largest ← r',
      '  if largest ≠ i then',
      '    swap A[i] and A[largest]',
      '    siftDown(A, largest, size)',
    ],
    facts: [
      'Building the heap bottom-up costs O(n), not O(n log n).',
      'In an array heap the children of index i are 2i + 1 and 2i + 2.',
      'Guaranteed O(n log n) with O(1) extra space, but not stable.',
    ],
  },
};
