// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sorting Step Generators
// Pure generators that yield one frame per comparison / swap / write
// ═══════════════════════════════════════════════════════════

import type { AlgoSortFrame, SortAlgorithmId } from '@/types/algo';
import { collectFrames } from './frames';

type SortGenerator = Generator<AlgoSortFrame, void, undefined>;

interface FrameExtras {
  comparing?: readonly number[];
  swapping?: readonly number[];
  pivot?: number | null;
  range?: readonly [number, number] | null;
}

const NONE: readonly number[] = [];

/**
 * Line numbers (0-based) into each algorithm's pseudocode in
 * `src/data/algorithms/sorting.ts`. Keep the two files in sync.
 */
export const SORT_LINES = {
  'bubble-sort': { start: 0, pass: 1, compare: 4, swap: 5, markSorted: 7, earlyExit: 8, done: 9 },
  'selection-sort': { start: 0, assumeMin: 2, compare: 4, newMin: 5, swap: 6, markSorted: 7, done: 8 },
  'insertion-sort': { start: 0, takeKey: 2, compare: 4, shift: 5, place: 7, done: 8 },
  'merge-sort': { start: 0, split: 2, mergeCall: 5, compare: 10, takeRight: 11, takeLeft: 13, leftovers: 15 },
  'quick-sort': { start: 0, single: 1, choosePivot: 6, compare: 9, advance: 10, swap: 11, placePivot: 12, pivotFinal: 13 },
  'heap-sort': { start: 0, buildStep: 1, extractSwap: 4, markSorted: 5, compareLeft: 9, compareRight: 10, heapOk: 11, swap: 12 },
} as const;

/**
 * Holds the working array and counters, and snapshots them into frames.
 * Snapshots are shared between consecutive frames until something changes,
 * which keeps long runs (10k+ frames) cheap in memory.
 */
class SortTracer {
  readonly a: number[];
  comparisons = 0;
  moves = 0;
  private readonly sortedFlags: boolean[];
  private arraySnap: readonly number[];
  private sortedSnap: readonly boolean[];
  private arrayDirty = false;
  private sortedDirty = false;

  constructor(input: readonly number[]) {
    this.a = input.slice();
    this.sortedFlags = new Array<boolean>(this.a.length).fill(false);
    this.arraySnap = this.a.slice();
    this.sortedSnap = this.sortedFlags.slice();
  }

  swap(i: number, j: number): void {
    const tmp = this.a[i];
    this.a[i] = this.a[j];
    this.a[j] = tmp;
    this.moves++;
    this.arrayDirty = true;
  }

  /** Move the value at `from` down to index `to` (to ≤ from), shifting the values between one place right. */
  moveDown(from: number, to: number): void {
    const value = this.a[from];
    for (let k = from; k > to; k--) this.a[k] = this.a[k - 1];
    this.a[to] = value;
    this.moves++;
    this.arrayDirty = true;
  }

  isSorted(i: number): boolean {
    return this.sortedFlags[i];
  }

  markSorted(i: number): void {
    if (i < 0 || i >= this.sortedFlags.length || this.sortedFlags[i]) return;
    this.sortedFlags[i] = true;
    this.sortedDirty = true;
  }

  markAllSorted(): void {
    for (let i = 0; i < this.sortedFlags.length; i++) this.markSorted(i);
  }

  frame(line: number, message: string, extras: FrameExtras = {}): AlgoSortFrame {
    if (this.arrayDirty) {
      this.arraySnap = this.a.slice();
      this.arrayDirty = false;
    }
    if (this.sortedDirty) {
      this.sortedSnap = this.sortedFlags.slice();
      this.sortedDirty = false;
    }
    return {
      array: this.arraySnap,
      comparing: extras.comparing ?? NONE,
      swapping: extras.swapping ?? NONE,
      sorted: this.sortedSnap,
      pivot: extras.pivot ?? null,
      range: extras.range ?? null,
      line,
      message,
      comparisons: this.comparisons,
      moves: this.moves,
    };
  }
}

function doneMessage(t: SortTracer, moveWord: 'swaps' | 'writes'): string {
  return `Sorted! ${t.comparisons} comparisons and ${t.moves} ${moveWord}.`;
}

// ─── Bubble sort ───

export function* bubbleSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['bubble-sort'];
  const t = new SortTracer(input);
  const a = t.a;
  const n = a.length;
  yield t.frame(L.start, `Bubble sort on ${n} values: compare neighbours and swap them when they are out of order.`);

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    const last = n - i - 1;
    yield t.frame(L.pass, `Pass ${i + 1}: the largest unsorted value bubbles up to index ${last}.`);
    for (let j = 0; j < last; j++) {
      t.comparisons++;
      yield t.frame(L.compare, `Compare A[${j}] = ${a[j]} with A[${j + 1}] = ${a[j + 1]}.`, {
        comparing: [j, j + 1],
      });
      if (a[j] > a[j + 1]) {
        t.swap(j, j + 1);
        swapped = true;
        yield t.frame(L.swap, `${a[j + 1]} > ${a[j]}, so swap them.`, { swapping: [j, j + 1] });
      }
    }
    t.markSorted(last);
    yield t.frame(L.markSorted, `A[${last}] = ${a[last]} is now in its final place.`);
    if (!swapped) {
      yield t.frame(L.earlyExit, 'No swaps in this pass, so the array is already sorted. Stop early.');
      break;
    }
  }

  t.markAllSorted();
  yield t.frame(L.done, doneMessage(t, 'swaps'));
}

// ─── Selection sort ───

export function* selectionSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['selection-sort'];
  const t = new SortTracer(input);
  const a = t.a;
  const n = a.length;
  yield t.frame(L.start, `Selection sort on ${n} values: find the smallest unsorted value and move it to the front.`);

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    yield t.frame(L.assumeMin, `Pass ${i + 1}: assume A[${i}] = ${a[i]} is the minimum.`, { pivot: min });
    for (let j = i + 1; j < n; j++) {
      t.comparisons++;
      yield t.frame(L.compare, `Is A[${j}] = ${a[j]} smaller than the current minimum ${a[min]}?`, {
        comparing: [j],
        pivot: min,
      });
      if (a[j] < a[min]) {
        min = j;
        yield t.frame(L.newMin, `Yes: A[${j}] = ${a[j]} is the new minimum.`, { pivot: min });
      }
    }
    if (min !== i) {
      t.swap(i, min);
      yield t.frame(L.swap, `Swap the minimum ${a[i]} into position ${i}.`, { swapping: [i, min] });
    } else {
      yield t.frame(L.swap, `A[${i}] = ${a[i]} is already the minimum, so no swap is needed.`, { pivot: i });
    }
    t.markSorted(i);
    yield t.frame(L.markSorted, `A[${i}] = ${a[i]} is in its final place.`);
  }

  t.markAllSorted();
  yield t.frame(L.done, doneMessage(t, 'swaps'));
}

// ─── Insertion sort ───

export function* insertionSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['insertion-sort'];
  const t = new SortTracer(input);
  const a = t.a;
  const n = a.length;
  yield t.frame(L.start, `Insertion sort on ${n} values: grow a sorted prefix by inserting one value at a time.`, {
    range: [0, 0],
  });

  for (let i = 1; i < n; i++) {
    const key = a[i];
    const range: [number, number] = [0, i];
    yield t.frame(L.takeKey, `Take key = A[${i}] = ${key} and insert it into the sorted prefix A[0..${i - 1}].`, {
      pivot: i,
      range,
    });
    // The key's bar slides left one place per shift: the array always shows
    // "prefix + hole holding the key", exactly the algorithm's logical state.
    let j = i - 1;
    while (j >= 0) {
      t.comparisons++;
      yield t.frame(L.compare, `Compare A[${j}] = ${a[j]} with key ${key}.`, {
        comparing: [j],
        pivot: j + 1,
        range,
      });
      if (a[j] <= key) break;
      t.swap(j, j + 1);
      yield t.frame(L.shift, `${a[j + 1]} > ${key}, so shift ${a[j + 1]} one place right.`, {
        swapping: [j + 1],
        pivot: j,
        range,
      });
      j--;
    }
    const target = j + 1;
    if (target !== i) t.moves++; // A[j + 1] ← key
    yield t.frame(
      L.place,
      target === i ? `${key} is already in the right place.` : `Place key ${key} at index ${target}.`,
      { pivot: target, range }
    );
  }

  t.markAllSorted();
  yield t.frame(L.done, doneMessage(t, 'writes'));
}

// ─── Merge sort ───

function* mergeRuns(t: SortTracer, lo: number, mid: number, hi: number, isFinal: boolean): SortGenerator {
  const L = SORT_LINES['merge-sort'];
  const a = t.a;
  const range: [number, number] = [lo, hi];
  yield t.frame(L.mergeCall, `Both halves are sorted. Merge A[${lo}..${mid}] with A[${mid + 1}..${hi}].`, { range });

  // The display keeps the array a permutation: A[lo..k-1] is merged output,
  // then the rest of the left run, then the rest of the right run.
  let leftRemaining = mid - lo + 1;
  let rightRemaining = hi - mid;
  let k = lo;
  while (leftRemaining > 0 && rightRemaining > 0) {
    const leftHead = k;
    const rightHead = k + leftRemaining;
    t.comparisons++;
    yield t.frame(L.compare, `Compare left head ${a[leftHead]} with right head ${a[rightHead]}.`, {
      comparing: [leftHead, rightHead],
      range,
    });
    if (a[rightHead] < a[leftHead]) {
      t.moveDown(rightHead, k);
      rightRemaining--;
      if (isFinal) t.markSorted(k);
      yield t.frame(L.takeRight, `${a[k]} < ${a[k + 1]}: take ${a[k]} from the right run into A[${k}].`, {
        swapping: [k],
        range,
      });
    } else {
      t.moves++; // A[k] ← L[i]; the value is already in place in this view
      leftRemaining--;
      if (isFinal) t.markSorted(k);
      yield t.frame(L.takeLeft, `Take ${a[k]} from the left run into A[${k}].`, { swapping: [k], range });
    }
    k++;
  }

  const leftovers = leftRemaining + rightRemaining;
  if (leftovers > 0) {
    const written: number[] = [];
    for (let p = k; p <= hi; p++) {
      written.push(p);
      if (isFinal) t.markSorted(p);
    }
    t.moves += leftovers;
    yield t.frame(
      L.leftovers,
      `Copy the ${leftovers} leftover value${leftovers === 1 ? '' : 's'} into A[${k}..${hi}].`,
      { swapping: written, range }
    );
  }
}

function* mergeSortRange(t: SortTracer, lo: number, hi: number, n: number): SortGenerator {
  if (lo >= hi) return;
  const L = SORT_LINES['merge-sort'];
  const mid = Math.floor((lo + hi) / 2);
  yield t.frame(L.split, `Split A[${lo}..${hi}] at mid = ${mid}.`, { range: [lo, hi] });
  yield* mergeSortRange(t, lo, mid, n);
  yield* mergeSortRange(t, mid + 1, hi, n);
  yield* mergeRuns(t, lo, mid, hi, lo === 0 && hi === n - 1);
}

export function* mergeSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['merge-sort'];
  const t = new SortTracer(input);
  const n = t.a.length;
  yield t.frame(L.start, `Merge sort on ${n} values: split in halves, sort each half, then merge them.`);
  yield* mergeSortRange(t, 0, n - 1, n);
  t.markAllSorted();
  yield t.frame(L.start, doneMessage(t, 'writes'));
}

// ─── Quick sort (Lomuto partition) ───

function* partition(t: SortTracer, lo: number, hi: number): Generator<AlgoSortFrame, number, undefined> {
  const L = SORT_LINES['quick-sort'];
  const a = t.a;
  const range: [number, number] = [lo, hi];
  const pivot = a[hi];
  yield t.frame(L.choosePivot, `Partition A[${lo}..${hi}] around pivot ${pivot} (the last element).`, {
    pivot: hi,
    range,
  });

  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    t.comparisons++;
    yield t.frame(L.compare, `Is A[${j}] = ${a[j]} < pivot ${pivot}?`, { comparing: [j], pivot: hi, range });
    if (a[j] < pivot) {
      i++;
      if (i !== j) {
        t.swap(i, j);
        yield t.frame(L.swap, `Yes: swap ${a[i]} into the "smaller than pivot" zone at index ${i}.`, {
          swapping: [i, j],
          pivot: hi,
          range,
        });
      } else {
        yield t.frame(L.advance, `Yes: ${a[j]} is already inside the "smaller than pivot" zone (i = ${i}).`, {
          pivot: hi,
          range,
        });
      }
    }
  }

  const p = i + 1;
  if (p !== hi) {
    t.swap(p, hi);
    yield t.frame(L.placePivot, `Swap the pivot ${pivot} into index ${p}.`, { swapping: [p, hi], pivot: p, range });
  }
  t.markSorted(p);
  yield t.frame(L.pivotFinal, `Pivot ${pivot} is now in its final position ${p}.`, { range });
  return p;
}

function* quickSortRange(t: SortTracer, lo: number, hi: number): SortGenerator {
  if (lo > hi) return;
  if (lo === hi) {
    if (!t.isSorted(lo)) {
      t.markSorted(lo);
      yield t.frame(SORT_LINES['quick-sort'].single, `A[${lo}] = ${t.a[lo]} is a single element, so it is already in place.`, {
        range: [lo, hi],
      });
    }
    return;
  }
  const p = yield* partition(t, lo, hi);
  yield* quickSortRange(t, lo, p - 1);
  yield* quickSortRange(t, p + 1, hi);
}

export function* quickSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['quick-sort'];
  const t = new SortTracer(input);
  const n = t.a.length;
  yield t.frame(L.start, `Quick sort on ${n} values: partition around a pivot, then sort each side.`);
  yield* quickSortRange(t, 0, n - 1);
  t.markAllSorted();
  yield t.frame(L.start, doneMessage(t, 'swaps'));
}

// ─── Heap sort ───

function* siftDown(t: SortTracer, start: number, size: number): SortGenerator {
  const L = SORT_LINES['heap-sort'];
  const a = t.a;
  const range: [number, number] = [0, size - 1];
  let i = start;
  for (;;) {
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left >= size) return; // leaf: nothing below it
    t.comparisons++;
    yield t.frame(L.compareLeft, `Left child A[${left}] = ${a[left]} vs A[${largest}] = ${a[largest]}.`, {
      comparing: [left, largest],
      range,
    });
    if (a[left] > a[largest]) largest = left;
    if (right < size) {
      t.comparisons++;
      yield t.frame(L.compareRight, `Right child A[${right}] = ${a[right]} vs A[${largest}] = ${a[largest]}.`, {
        comparing: [right, largest],
        range,
      });
      if (a[right] > a[largest]) largest = right;
    }
    if (largest === i) {
      yield t.frame(L.heapOk, `A[${i}] = ${a[i]} is at least as large as its children: heap property holds.`, {
        pivot: i,
        range,
      });
      return;
    }
    t.swap(i, largest);
    yield t.frame(L.swap, `Swap A[${i}] and A[${largest}], then keep sifting ${a[largest]} down.`, {
      swapping: [i, largest],
      range,
    });
    i = largest;
  }
}

export function* heapSortSteps(input: readonly number[]): SortGenerator {
  const L = SORT_LINES['heap-sort'];
  const t = new SortTracer(input);
  const a = t.a;
  const n = a.length;
  yield t.frame(L.start, `Heap sort on ${n} values: build a max-heap, then repeatedly move the maximum to the end.`);

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield t.frame(L.buildStep, `Build the heap: sift down A[${i}] = ${a[i]}.`, { pivot: i, range: [0, n - 1] });
    yield* siftDown(t, i, n);
  }

  for (let end = n - 1; end >= 1; end--) {
    t.swap(0, end);
    yield t.frame(L.extractSwap, `The root holds the maximum: swap A[0] with A[${end}], moving ${a[end]} to the end.`, {
      swapping: [0, end],
      range: [0, end],
    });
    t.markSorted(end);
    yield t.frame(L.markSorted, `A[${end}] = ${a[end]} is in its final place. The heap shrinks to A[0..${end - 1}].`, {
      range: [0, end - 1],
    });
    yield* siftDown(t, 0, end);
  }

  t.markAllSorted();
  yield t.frame(L.start, doneMessage(t, 'swaps'));
}

// ─── Registry ───

export const SORT_STEP_GENERATORS: Record<SortAlgorithmId, (input: readonly number[]) => SortGenerator> = {
  'bubble-sort': bubbleSortSteps,
  'selection-sort': selectionSortSteps,
  'insertion-sort': insertionSortSteps,
  'merge-sort': mergeSortSteps,
  'quick-sort': quickSortSteps,
  'heap-sort': heapSortSteps,
};

export const SORT_ALGORITHM_IDS: readonly SortAlgorithmId[] = [
  'bubble-sort',
  'selection-sort',
  'insertion-sort',
  'merge-sort',
  'quick-sort',
  'heap-sort',
];

export function isSortAlgorithmId(value: string): value is SortAlgorithmId {
  return (SORT_ALGORITHM_IDS as readonly string[]).includes(value);
}

/** Every frame of a sort, from the untouched input to the fully sorted array. */
export function buildSortFrames(algorithm: SortAlgorithmId, input: readonly number[]): AlgoSortFrame[] {
  return collectFrames(SORT_STEP_GENERATORS[algorithm](input)).frames;
}

/** Comparisons + moves at each frame: the clock Compare Mode races on. */
export function frameOps(frame: AlgoSortFrame): number {
  return frame.comparisons + frame.moves;
}
