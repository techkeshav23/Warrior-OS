// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Formula Cards Data
// Quick-reference formulas for GATE subjects
// ═══════════════════════════════════════════════════════════

export interface FormulaCard {
  id: string;
  subject: string;
  topic: string;
  formula: string;
  explanation: string;
}

export const FORMULA_CARDS: FormulaCard[] = [
  // ─── OS ───
  { id: 'f-os-01', subject: 'OS', topic: 'CPU Scheduling', formula: 'Turnaround = Completion − Arrival', explanation: 'Total time from arrival to completion of a process.' },
  { id: 'f-os-02', subject: 'OS', topic: 'CPU Scheduling', formula: 'Waiting = Turnaround − Burst', explanation: 'Time spent waiting in the ready queue.' },
  { id: 'f-os-03', subject: 'OS', topic: 'Memory', formula: 'EMAT = h(Tc + Tm) + (1−h)(Tc + 2Tm)', explanation: 'Effective Memory Access Time with TLB. h=hit ratio, Tc=TLB time, Tm=memory time.' },
  { id: 'f-os-04', subject: 'OS', topic: 'Memory', formula: 'Page Table Entries = 2^(VA bits − page offset bits)', explanation: 'Number of page table entries from virtual address size and page size.' },
  { id: 'f-os-05', subject: 'OS', topic: 'Deadlock', formula: 'Min resources no deadlock = n(k−1) + 1', explanation: 'n processes, each needing max k resources. Pigeonhole principle.' },
  { id: 'f-os-06', subject: 'OS', topic: 'Disk', formula: 'Disk Access = Seek + Rotation + Transfer', explanation: 'Total disk access time is sum of seek, rotational latency, and transfer time.' },

  // ─── DBMS ───
  { id: 'f-dbms-01', subject: 'DBMS', topic: 'Normalization', formula: '2NF: No partial dependency on candidate key', explanation: 'All non-prime attributes fully depend on entire candidate key.' },
  { id: 'f-dbms-02', subject: 'DBMS', topic: 'Normalization', formula: '3NF: No transitive dependency', explanation: 'Non-prime → non-prime dependency removed. X→A: X is superkey OR A is prime.' },
  { id: 'f-dbms-03', subject: 'DBMS', topic: 'Normalization', formula: 'BCNF: Every FD X→Y, X is superkey', explanation: 'Strictest normal form based on FDs. Lossless but may lose dependency preservation.' },
  { id: 'f-dbms-04', subject: 'DBMS', topic: 'Indexing', formula: 'B+ tree height ≤ ⌈log_⌈p/2⌉(N)⌉', explanation: 'p = order, N = records. Height determines max disk accesses for search.' },
  { id: 'f-dbms-05', subject: 'DBMS', topic: 'Transactions', formula: 'Serializability: Check conflict/equivalence via precedence graph', explanation: 'No cycle in precedence graph → conflict serializable.' },

  // ─── CN ───
  { id: 'f-cn-01', subject: 'CN', topic: 'Performance', formula: 'Throughput = Window × Frame / RTT', explanation: 'Max data rate for sliding window protocol.' },
  { id: 'f-cn-02', subject: 'CN', topic: 'Performance', formula: 'Efficiency(Stop&Wait) = Tt/(Tt + 2Tp)', explanation: 'Tt=transmission time, Tp=propagation delay.' },
  { id: 'f-cn-03', subject: 'CN', topic: 'Subnetting', formula: 'Hosts per subnet = 2^h − 2', explanation: 'h = host bits. Subtract 2 for network and broadcast addresses.' },
  { id: 'f-cn-04', subject: 'CN', topic: 'Subnetting', formula: 'Subnets = 2^s', explanation: 's = borrowed bits from host portion.' },
  { id: 'f-cn-05', subject: 'CN', topic: 'Error Detection', formula: 'Hamming: d(min) ≥ 2t+1 to correct t errors', explanation: 'Minimum Hamming distance needed between codewords.' },
  { id: 'f-cn-06', subject: 'CN', topic: 'Flow Control', formula: 'SR: W ≤ 2^(n−1)', explanation: 'Selective Repeat max window size with n-bit sequence number.' },

  // ─── TOC ───
  { id: 'f-toc-01', subject: 'TOC', topic: 'Languages', formula: 'Regular ⊂ DCFL ⊂ CFL ⊂ CSL ⊂ RE', explanation: 'Chomsky hierarchy from least to most powerful.' },
  { id: 'f-toc-02', subject: 'TOC', topic: 'Pumping Lemma', formula: '∀w ∈ L, |w|≥p ⇒ w=xyz, |xy|≤p, |y|>0, ∀i≥0: xy^iz ∈ L', explanation: 'If L is regular, every long string can be pumped.' },
  { id: 'f-toc-03', subject: 'TOC', topic: 'Finite Automata', formula: 'NFA→DFA: max 2^n states', explanation: 'Subset construction may produce up to 2^n states from n-state NFA.' },
  { id: 'f-toc-04', subject: 'TOC', topic: 'Closure', formula: 'Regular: closed ∪,∩,−,*,·,complement', explanation: 'Regular languages closed under all boolean & regex operations.' },

  // ─── Data Structures ───
  { id: 'f-ds-01', subject: 'Data Structures', topic: 'Trees', formula: 'Nodes in complete binary tree: 2^(h+1) − 1', explanation: 'h = height (root at 0). Full tree has this many nodes.' },
  { id: 'f-ds-02', subject: 'Data Structures', topic: 'Graphs', formula: 'Edges in complete graph: n(n−1)/2', explanation: 'K_n has n(n-1)/2 edges.' },
  { id: 'f-ds-03', subject: 'Data Structures', topic: 'Hashing', formula: 'Load factor α = n/m', explanation: 'n = number of keys, m = table size. α > 1 means chaining needed.' },
  { id: 'f-ds-04', subject: 'Data Structures', topic: 'Trees', formula: 'AVL balance factor = |h(left) − h(right)| ≤ 1', explanation: 'AVL tree property. Rotations fix violations.' },

  // ─── Algorithms ───
  { id: 'f-daa-01', subject: 'DAA', topic: 'Master Theorem', formula: 'T(n)=aT(n/b)+f(n): compare f(n) with n^(log_b a)', explanation: 'Case 1: f < n^c → O(n^c). Case 2: f = n^c → O(n^c log n). Case 3: f > n^c → O(f(n)).' },
  { id: 'f-daa-02', subject: 'DAA', topic: 'Sorting', formula: 'Comparison sort lower bound: Ω(n log n)', explanation: 'No comparison-based sort can do better than n log n in worst case.' },
  { id: 'f-daa-03', subject: 'DAA', topic: 'Graph', formula: 'Dijkstra: O((V+E) log V) with min-heap', explanation: 'V extract-min + E decrease-key operations.' },
  { id: 'f-daa-04', subject: 'DAA', topic: 'Graph', formula: 'Bellman-Ford: O(VE)', explanation: 'V-1 iterations × E edge relaxations. Detects negative cycles.' },
  { id: 'f-daa-05', subject: 'DAA', topic: 'DP', formula: 'LCS: O(mn) time, O(mn) space', explanation: 'm,n = lengths of two strings. Can optimize space to O(min(m,n)).' },

  // ─── COA ───
  { id: 'f-coa-01', subject: 'COA', topic: 'Pipeline', formula: 'Speedup = n×k / (n+k−1)', explanation: 'n instructions, k stages. Approaches k as n→∞.' },
  { id: 'f-coa-02', subject: 'COA', topic: 'Cache', formula: 'AMAT = Hit_time + Miss_rate × Miss_penalty', explanation: 'Average Memory Access Time.' },
  { id: 'f-coa-03', subject: 'COA', topic: 'Cache', formula: 'Cache size = Lines × Block_size', explanation: 'Total data capacity of cache (excluding tag/valid bits).' },
  { id: 'f-coa-04', subject: 'COA', topic: 'Performance', formula: 'CPI = Σ(CPI_i × F_i)', explanation: 'Average CPI from instruction mix. F_i = fraction of instruction type i.' },

  // ─── Discrete Math ───
  { id: 'f-dm-01', subject: 'Discrete Math', topic: 'Combinatorics', formula: 'C(n,r) = n! / (r! × (n−r)!)', explanation: 'Number of ways to choose r items from n (unordered).' },
  { id: 'f-dm-02', subject: 'Discrete Math', topic: 'Combinatorics', formula: 'Stars & Bars: C(n+r−1, r−1)', explanation: 'Distribute n identical objects into r distinct bins.' },
  { id: 'f-dm-03', subject: 'Discrete Math', topic: 'Graph Theory', formula: 'Euler: V − E + F = 2', explanation: 'For connected planar graphs. V=vertices, E=edges, F=faces.' },
  { id: 'f-dm-04', subject: 'Discrete Math', topic: 'Logic', formula: 'Contrapositive: p→q ≡ ¬q→¬p', explanation: 'Always logically equivalent. Used in proofs.' },
];

/** Get formulas by subject */
export function getFormulasBySubject(subject: string): FormulaCard[] {
  return FORMULA_CARDS.filter((f) => f.subject === subject);
}

/** Get all formula subjects */
export function getFormulaSubjects(): string[] {
  return [...new Set(FORMULA_CARDS.map((f) => f.subject))];
}
