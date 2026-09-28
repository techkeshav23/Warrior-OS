// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Offline Brain
//
// Rule-based fallback used when Gemini is unavailable (no
// GEMINI_API_KEY on the server, or the /api/ai route itself is
// unreachable). It answers the things NEXUS gets asked most —
// greetings, GATE exam facts, core GATE CS concepts, study
// strategy, motivation, time/date — in the NEXUS voice, and always
// offers a concrete next step as action buttons.
//
// Pure module: no env, no stores, no browser APIs. Runs on the edge
// route and in the browser alike.
// ═══════════════════════════════════════════════════════════

import type { NexusChatTurn, NexusContext, NexusWireAction } from '@/types/nexus';

export interface OfflineBrainReply {
  reply: string;
  command: NexusWireAction | null;
  actions: NexusWireAction[];
}

export const NEXUS_OFFLINE_MODEL = 'nexus-offline';

const MAX_ACTIONS = 3;

// ─── Knowledge base: GATE CS concepts ───

interface Concept {
  /** Display name */
  name: string;
  subject: string;
  /** Regexes matched against the normalised question */
  match: RegExp[];
  /** definition → mechanism → GATE gotcha */
  body: string;
}

const CONCEPTS: readonly Concept[] = [
  // ── Operating Systems ──
  {
    name: 'Deadlock',
    subject: 'OS',
    match: [/\bdead\s?locks?\b/],
    body:
      '**Deadlock** = processes ka aisa set jahan har ek kisi aur ke held resource ka wait kar raha hai, aur koi aage nahi badh sakta.\n\n' +
      'Chaar **Coffman conditions** ek saath chahiye: mutual exclusion, hold & wait, no preemption, circular wait. Koi ek tod do — deadlock prevent.\n\n' +
      '**GATE gotcha:** Banker\'s algorithm *avoidance* hai (safe state check), prevention nahi. Safe state ⇒ no deadlock, but unsafe state ⇏ deadlock.',
  },
  {
    name: "Banker's algorithm",
    subject: 'OS',
    match: [/\bbankers?\b/, /\bsafe\s+state\b/],
    body:
      "**Banker's algorithm** = deadlock *avoidance*: har request grant karne se pehle check karo ki system safe state mein rahega ya nahi.\n\n" +
      '`Need = Max − Allocation`. Available se jis process ki Need poori ho sake use finish maano, uska Allocation wapas Available mein jodo, repeat. Sab finish ho gaye ⇒ safe sequence mil gaya.\n\n' +
      '**GATE gotcha:** Multiple safe sequences ho sakte hain; question "which is NOT a safe sequence" type aata hai — har option simulate kar.',
  },
  {
    name: 'Paging',
    subject: 'OS',
    match: [/\bpaging\b/, /\bpage\s+tables?\b/, /\bpage\s+size\b/],
    body:
      '**Paging** = logical address space ko fixed-size *pages* aur physical memory ko same-size *frames* mein todna. External fragmentation khatam.\n\n' +
      'Logical address = `page number | offset`. Page table page → frame map karta hai. Page table size = `(#pages) × (PTE size)`.\n\n' +
      '**GATE gotcha:** Internal fragmentation phir bhi hoti hai (last page). Multi-level paging questions mein bits ka hisaab: `offset bits = log2(page size)`.',
  },
  {
    name: 'TLB',
    subject: 'OS',
    match: [/\btlb\b/, /\btranslation\s+look\s?aside\b/, /\beffective\s+(?:memory\s+)?access\s+time\b/, /\bemat\b/],
    body:
      '**TLB** = page-table entries ka chhota fast cache, taaki har memory access pe page table na padhna pade.\n\n' +
      '`EMAT = h × (t + m) + (1 − h) × (t + 2m)` (single-level paging, t = TLB time, m = memory time, h = hit ratio).\n\n' +
      '**GATE gotcha:** Question mein TLB lookup parallel hai ya serial — dhyan se padh; multi-level paging mein miss pe `k` extra memory accesses.',
  },
  {
    name: 'Page replacement',
    subject: 'OS',
    match: [/\bpage\s+replacement\b/, /\b(?:lru|fifo|optimal)\b.*\bpage/, /\bbelady\b/, /\bpage\s+faults?\b/],
    body:
      '**Page replacement** = page fault pe frame khaali na ho to kaunsa page nikaalein.\n\n' +
      '- **FIFO:** sabse purana nikaalo — simple, lekin **Belady\'s anomaly** dikhata hai (zyada frames ⇒ zyada faults).\n' +
      '- **Optimal:** jo sabse der baad use hoga — minimum faults, practically impossible (future chahiye).\n' +
      '- **LRU:** jo sabse pehle use hua tha — stack algorithm, Belady-free.\n\n' +
      '**GATE gotcha:** Reference string pe table bana ke faults gin; initial empty frames ke misses bhi count hote hain.',
  },
  {
    name: 'Thrashing',
    subject: 'OS',
    match: [/\bthrashing\b/, /\bworking\s+set\b/],
    body:
      '**Thrashing** = CPU zyada time paging mein, kaam mein kam — kyunki processes ke working set memory mein fit nahi ho rahe.\n\n' +
      'Degree of multiprogramming badhao ⇒ CPU utilisation pehle badhti, fir achanak girti hai. Fix: working-set model ya page-fault-frequency control, multiprogramming kam karo.\n\n' +
      '**GATE gotcha:** Thrashing ke time CPU utilisation *low* hota hai, disk (paging device) utilisation *high*.',
  },
  {
    name: 'Semaphore',
    subject: 'OS',
    match: [/\bsemaphores?\b/, /\bmutex\b/, /\bcritical\s+section\b/, /\bsynchroni[sz]ation\b/, /\bproducer\s+consumer\b/],
    body:
      '**Semaphore** = integer variable jis pe sirf atomic `wait (P)` aur `signal (V)` chalte hain; critical section aur ordering control karta hai.\n\n' +
      'Binary semaphore ≈ mutex lock; counting semaphore N identical resources track karta hai. Critical-section solution ko **mutual exclusion, progress, bounded waiting** teeno chahiye.\n\n' +
      '**GATE gotcha:** Counting semaphore value negative ho to `|value|` = blocked processes. P/V sequence questions mein final value = `initial − #P + #V`.',
  },
  {
    name: 'CPU scheduling',
    subject: 'OS',
    match: [/\bscheduling\b/, /\bround\s+robin\b/, /\bsjf\b/, /\bsrtf\b/, /\bfcfs\b/, /\bturn\s?around\s+time\b/, /\bwaiting\s+time\b/],
    body:
      '**CPU scheduling** = ready queue se agla process chunna.\n\n' +
      '- **FCFS:** convoy effect. **SJF:** minimum average waiting time (non-preemptive optimal). **SRTF:** SJF ka preemptive version.\n' +
      '- **Round Robin:** time quantum; bahut bada quantum ⇒ FCFS, bahut chhota ⇒ context-switch overhead.\n\n' +
      '`TAT = CT − AT`, `WT = TAT − BT`. **GATE gotcha:** Gantt chart bana, idle gaps aur context-switch time (agar diya ho) mat bhool.',
  },
  {
    name: 'Process vs thread',
    subject: 'OS',
    match: [/\bprocess\s+(?:vs|and|versus)\s+threads?\b/, /\bthreads?\s+(?:vs|and|versus)\s+process/, /\bthreads?\b/, /\bcontext\s+switch/],
    body:
      '**Process** = program in execution, apna address space. **Thread** = process ke andar execution unit; code, data, open files share karte hain, stack + registers alag.\n\n' +
      'Thread switch sasta hai (address space same). User-level threads kernel ko dikhte nahi — ek block hua to poora process block (many-to-one).\n\n' +
      '**GATE gotcha:** `fork()` n baar ⇒ `2^n` processes total, `2^n − 1` child processes.',
  },
  {
    name: 'Disk scheduling',
    subject: 'OS',
    match: [/\bdisk\s+scheduling\b/, /\b(?:sstf|c-?scan|c-?look)\b/, /\bseek\s+time\b/],
    body:
      '**Disk scheduling** = pending I/O requests ko kis order mein serve karein taaki head movement kam ho.\n\n' +
      'FCFS, **SSTF** (nearest first, starvation possible), **SCAN** (elevator, end tak jaata hai), **LOOK** (last request tak), **C-SCAN/C-LOOK** (ek direction, wrap around).\n\n' +
      '**GATE gotcha:** Question mein head ki initial direction aur "total head movement" vs "cylinders crossed" dhyan se padh.',
  },
  // ── DBMS ──
  {
    name: 'Normalization',
    subject: 'DBMS',
    match: [/\bnormali[sz]ation\b/, /\b(?:1nf|2nf|3nf|bcnf|4nf)\b/, /\bnormal\s+forms?\b/],
    body:
      '**Normalization** = redundancy aur update anomalies hataane ke liye relations ko decompose karna.\n\n' +
      '- **1NF:** atomic values. **2NF:** koi partial dependency nahi (non-prime attribute poori candidate key pe depend kare).\n' +
      '- **3NF:** `X → A` mein X superkey ho *ya* A prime ho. **BCNF:** har non-trivial FD mein X superkey.\n\n' +
      '**GATE gotcha:** BCNF decomposition lossless hota hai par dependency-preserving guaranteed nahi; 3NF dono deta hai.',
  },
  {
    name: 'Functional dependency & keys',
    subject: 'DBMS',
    match: [/\bfunctional\s+dependenc/, /\bcandidate\s+keys?\b/, /\bsuper\s?keys?\b/, /\bclosure\b/, /\bprimary\s+key\b/],
    body:
      '**Functional dependency** `X → Y` = X ki value Y ko uniquely decide karti hai.\n\n' +
      'Attribute closure `X⁺` nikaal: agar `X⁺` = saare attributes ⇒ X superkey. Minimal superkey = **candidate key**. Jo attribute kisi FD ke right side pe nahi aata, woh har candidate key mein hoga.\n\n' +
      '**GATE gotcha:** n attributes wali relation mein superkeys count karne ke liye inclusion–exclusion lagta hai: `2^(n−k)` per key, fir overlaps minus.',
  },
  {
    name: 'ACID & transactions',
    subject: 'DBMS',
    match: [/\bacid\b/, /\btransactions?\b/, /\bserializab/, /\bconflict\s+serial/, /\brecoverab/],
    body:
      '**ACID** = Atomicity, Consistency, Isolation, Durability — transaction ki guarantees.\n\n' +
      '**Conflict serializability:** precedence graph bana (same item pe conflicting ops: R-W, W-R, W-W, alag transactions). Cycle nahi ⇒ conflict serializable.\n\n' +
      '**GATE gotcha:** Conflict serializable ⊂ view serializable. Blind writes ke bina view-serializable schedule conflict-serializable bhi hota hai. Cascadeless ⊂ recoverable.',
  },
  {
    name: 'Indexing & B+ trees',
    subject: 'DBMS',
    match: [/\bb\+?\s?trees?\b/, /\bindex(?:ing|es)?\b/, /\bb\s?plus\s+tree/],
    body:
      '**B+ tree** = balanced multi-way search tree; saara data leaves pe, leaves linked list — range queries fast.\n\n' +
      'Order p ka internal node: max p children, min `⌈p/2⌉` (root chhod ke). Order nikaalne ka formula: `p × (pointer size) + (p − 1) × (key size) ≤ block size`.\n\n' +
      '**GATE gotcha:** Leaf ka order alag formula se aata hai: `p_leaf × (key + record pointer) + block pointer ≤ block size`.',
  },
  {
    name: 'SQL joins',
    subject: 'DBMS',
    match: [/\bjoins?\b/, /\bsql\b/, /\bgroup\s+by\b/, /\brelational\s+algebra\b/],
    body:
      '**Join** = do relations ko matching condition pe combine karna.\n\n' +
      '- **Natural join:** common attributes pe equality, duplicates columns ek baar. **Left/right/full outer join:** unmatched tuples NULL ke saath.\n' +
      '- Relational algebra mein division (`÷`) "for all" queries ke liye.\n\n' +
      '**GATE gotcha:** `NULL` comparisons UNKNOWN dete hain — `WHERE x <> 5` NULL rows nahi laata. `COUNT(*)` NULL gine, `COUNT(col)` nahi.',
  },
  // ── Computer Networks ──
  {
    name: 'TCP vs UDP',
    subject: 'CN',
    match: [/\btcp\b/, /\budp\b/, /\bthree[\s-]way\s+handshake\b/],
    body:
      '**TCP** = connection-oriented, reliable, ordered byte stream (ACKs, retransmission, flow + congestion control). **UDP** = connectionless, no guarantee, low overhead.\n\n' +
      'TCP connection: 3-way handshake (SYN, SYN-ACK, ACK); SYN aur FIN ek sequence number consume karte hain.\n\n' +
      '**GATE gotcha:** TCP header 20–60 bytes, UDP header fixed 8 bytes. DNS mostly UDP (port 53), HTTP TCP.',
  },
  {
    name: 'Congestion control',
    subject: 'CN',
    match: [/\bcongestion\b/, /\bslow\s+start\b/, /\bcwnd\b/, /\baimd\b/],
    body:
      '**TCP congestion control** = sender ki window (`cwnd`) network load ke hisaab se adjust karna.\n\n' +
      'Slow start: har RTT `cwnd` double jab tak `ssthresh`; fir congestion avoidance: +1 MSS per RTT. Timeout ⇒ `ssthresh = cwnd/2`, `cwnd = 1 MSS`.\n\n' +
      '**GATE gotcha:** 3 duplicate ACKs (Reno fast recovery) pe `cwnd` half hota hai, 1 nahi. RTT-by-RTT table bana ke solve kar.',
  },
  {
    name: 'OSI / TCP-IP layers',
    subject: 'CN',
    match: [/\bosi\b/, /\blayers?\b.*\bnetwork/, /\btcp\s*\/\s*ip\s+model\b/],
    body:
      '**OSI model** (7): Physical, Data Link, Network, Transport, Session, Presentation, Application. **TCP/IP** (4–5): Link, Internet, Transport, Application.\n\n' +
      'Devices: hub (L1), switch/bridge (L2), router (L3). PDU: bits → frame → packet → segment → data.\n\n' +
      '**GATE gotcha:** ARP IP → MAC map karta hai (L2/L3 boundary); routers broadcast domains todte hain, switches collision domains.',
  },
  {
    name: 'Subnetting & IP addressing',
    subject: 'CN',
    match: [/\bsubnet/, /\bcidr\b/, /\bip\s+address/, /\bsupernet/, /\bnetmask\b/],
    body:
      '**Subnetting** = network bits se aage kuch host bits borrow karke network ko chhote subnets mein todna.\n\n' +
      '`/n` prefix ⇒ `2^(32−n)` addresses, `2^(32−n) − 2` usable hosts (network + broadcast minus). Subnet ID = IP AND mask.\n\n' +
      '**GATE gotcha:** Longest prefix match se routing hoti hai; supernetting ke liye blocks contiguous aur aligned hone chahiye.',
  },
  {
    name: 'Sliding window protocols',
    subject: 'CN',
    match: [/\bsliding\s+window\b/, /\bgo[\s-]back[\s-]n\b/, /\bselective\s+repeat\b/, /\bstop[\s-]and[\s-]wait\b/, /\befficiency\b.*\blink\b/],
    body:
      '**Sliding window** = ACK ka wait kiye bina multiple frames bhejna.\n\n' +
      'Stop-and-wait efficiency `= 1 / (1 + 2a)`, `a = Tp / Tt`. Go-Back-N: sender window `N`, seq bits ≥ `log2(N + 1)`. Selective Repeat: window ≤ `2^(k−1)`.\n\n' +
      '**GATE gotcha:** Full utilisation ke liye window ≥ `1 + 2a`; seq numbers ke bits usi se nikaal.',
  },
  {
    name: 'CSMA/CD & Ethernet',
    subject: 'CN',
    match: [/\bcsma\b/, /\bethernet\b/, /\bcollision\b/],
    body:
      '**CSMA/CD** = carrier sense, collision detect — classic Ethernet ka MAC protocol.\n\n' +
      'Collision detect karne ke liye `Tt ≥ 2 × Tp` ⇒ minimum frame size `= 2 × Tp × bandwidth`. Collision ke baad binary exponential backoff.\n\n' +
      '**GATE gotcha:** Ethernet minimum frame 64 bytes; bandwidth ya distance badhe to minimum frame size proportionally badhta hai.',
  },
  // ── TOC ──
  {
    name: 'DFA / NFA',
    subject: 'TOC',
    match: [/\bdfa\b/, /\bnfa\b/, /\bfinite\s+automat/, /\bminimi[sz]/],
    body:
      '**DFA** = har state + symbol pe exactly ek transition. **NFA** = multiple/ε transitions allowed. Power same — dono regular languages accept karte hain.\n\n' +
      'Subset construction se n-state NFA ⇒ worst case `2^n` state DFA. Minimal DFA unique hota hai (equivalence classes / Myhill–Nerode).\n\n' +
      '**GATE gotcha:** "Strings where k-th symbol from end is 1" ke minimal DFA mein `2^k` states lagte hain.',
  },
  {
    name: 'Regular languages & pumping lemma',
    subject: 'TOC',
    match: [/\bregular\s+(?:languages?|expressions?|grammar)\b/, /\bpumping\s+lemma\b/, /\bregex\b/],
    body:
      '**Regular language** = jise finite automaton ya regular expression describe kar sake.\n\n' +
      'Closed under union, concatenation, star, complement, intersection, reversal. **Pumping lemma** sirf non-regular *prove* karne ke kaam aata hai (necessary, not sufficient).\n\n' +
      '**GATE gotcha:** `a^n b^n` non-regular, lekin `a^n b^m` regular. Finite language hamesha regular.',
  },
  {
    name: 'CFG & PDA',
    subject: 'TOC',
    match: [/\bcfg\b/, /\bcontext[\s-]free\b/, /\bpda\b/, /\bpush\s?down\b/, /\bambiguous\s+grammar/],
    body:
      '**CFL** = context-free grammar se generate, **PDA** (stack wala automaton) se accept.\n\n' +
      'CFLs union, concatenation, star mein closed; **intersection aur complement mein nahi**. DCFL complement mein closed hai.\n\n' +
      '**GATE gotcha:** `a^n b^n c^n` CFL nahi hai. CFL ∩ regular = CFL. Grammar ambiguity undecidable hai.',
  },
  {
    name: 'Turing machines & decidability',
    subject: 'TOC',
    match: [/\bturing\b/, /\bdecidab/, /\bhalting\b/, /\brecursively\s+enumerable\b/, /\bundecidab/],
    body:
      '**Turing machine** = infinite tape + read/write head; recursively enumerable (RE) languages accept karti hai.\n\n' +
      '**Recursive (decidable):** TM har input pe halt kare. **RE:** member strings pe halt + accept. Halting problem RE hai par decidable nahi.\n\n' +
      '**GATE gotcha:** L aur L̅ dono RE ⇒ L recursive. **Rice\'s theorem:** RE languages ki koi bhi non-trivial property undecidable.',
  },
  // ── COA ──
  {
    name: 'Pipelining',
    subject: 'COA',
    match: [/\bpipelin/, /\bhazards?\b/, /\bspeed\s?up\b/],
    body:
      '**Pipelining** = instruction execution ko stages mein todke overlap karna (IF, ID, EX, MEM, WB).\n\n' +
      'k-stage pipeline, n instructions: time `= (k + n − 1) × cycle`. Ideal speedup → k. **Hazards:** structural, data (RAW — forwarding se kam), control (branch — stall/prediction).\n\n' +
      '**GATE gotcha:** Cycle time = sabse slow stage + latch delay; stalls CPI badhaate hain: `CPI = 1 + stalls per instruction`.',
  },
  {
    name: 'Cache memory',
    subject: 'COA',
    match: [/\bcache\b/, /\bdirect\s+mapp/, /\bset\s+associative\b/, /\bhit\s+ratio\b/],
    body:
      '**Cache** = CPU aur main memory ke beech chhoti fast memory; locality of reference use karti hai.\n\n' +
      'Address = `tag | index | block offset`. Direct mapped: 1 line per set; k-way set associative: k lines per set; fully associative: ek hi set.\n\n' +
      '**GATE gotcha:** Tag bits = address bits − index bits − offset bits; tag directory size = `#lines × (tag + valid/dirty bits)`.',
  },
  {
    name: 'Addressing modes',
    subject: 'COA',
    match: [/\baddressing\s+modes?\b/, /\binstruction\s+format/],
    body:
      '**Addressing mode** = operand ka effective address kaise nikaalein.\n\n' +
      'Immediate (operand hi instruction mein), direct, indirect, register, register indirect, indexed (arrays), base, PC-relative (branches, relocatable code).\n\n' +
      '**GATE gotcha:** Indirect mode mein ek extra memory access; PC-relative position-independent code deta hai.',
  },
  // ── DAA ──
  {
    name: 'Time complexity & Master theorem',
    subject: 'DAA',
    match: [/\bmaster\s+theorem\b/, /\brecurrence/, /\btime\s+complexity\b/, /\bbig[\s-]?o\b/, /\basymptotic/],
    body:
      '**Master theorem:** `T(n) = aT(n/b) + f(n)`. `n^(log_b a)` se compare kar:\n\n' +
      '- f chhota (polynomially) ⇒ `Θ(n^(log_b a))`\n- barabar ⇒ `Θ(n^(log_b a) · log n)`\n- f bada (+ regularity) ⇒ `Θ(f(n))`\n\n' +
      '**GATE gotcha:** `T(n) = 2T(n/2) + n log n` Master ke basic cases mein fit nahi hota — answer `Θ(n log² n)`.',
  },
  {
    name: 'Sorting algorithms',
    subject: 'DAA',
    match: [/\bsort(?:ing)?\b/, /\bquick\s?sort\b/, /\bmerge\s?sort\b/, /\bheap\s?sort\b/],
    body:
      '**Sorting quick table:**\n\n' +
      '- Merge sort: `Θ(n log n)` always, stable, `O(n)` extra space.\n' +
      '- Quick sort: avg `Θ(n log n)`, worst `Θ(n²)` (sorted input + first/last pivot), in-place.\n' +
      '- Heap sort: `Θ(n log n)`, in-place, not stable. Insertion: best `Θ(n)`, worst `Θ(n²)`.\n\n' +
      '**GATE gotcha:** Comparison sort lower bound `Ω(n log n)`; counting/radix linear hote hain kyunki comparison nahi karte.',
  },
  {
    name: 'Dynamic programming',
    subject: 'DAA',
    match: [/\bdynamic\s+programming\b/, /\bdp\b/, /\bknapsack\b/, /\blcs\b/, /\bmatrix\s+chain\b/],
    body:
      '**Dynamic programming** = overlapping subproblems + optimal substructure ⇒ har subproblem ek baar solve karke table mein store.\n\n' +
      'Classics: LCS `O(mn)`, 0/1 knapsack `O(nW)` (pseudo-polynomial), matrix chain `O(n³)`, Floyd–Warshall `O(V³)`, Bellman–Ford `O(VE)`.\n\n' +
      '**GATE gotcha:** Fractional knapsack greedy se solve hota hai, 0/1 knapsack nahi — DP chahiye.',
  },
  {
    name: 'Shortest paths & MST',
    subject: 'DAA',
    match: [/\bdijkstra\b/, /\bshortest\s+path/, /\bmst\b/, /\bminimum\s+spanning\b/, /\bkruskal\b/, /\bprim'?s?\b/, /\bbellman\b/],
    body:
      '**Dijkstra:** single-source shortest path, non-negative weights, `O((V + E) log V)` with binary heap. Negative edges ⇒ **Bellman–Ford** `O(VE)`.\n\n' +
      '**MST:** Kruskal (edges sort + union-find, `O(E log E)`), Prim (heap, `O((V + E) log V)`). Distinct weights ⇒ MST unique.\n\n' +
      '**GATE gotcha:** Har edge weight mein constant jodne se MST same rehta hai, shortest paths nahi.',
  },
  {
    name: 'Greedy algorithms',
    subject: 'DAA',
    match: [/\bgreedy\b/, /\bhuffman\b/, /\bactivity\s+selection\b/, /\bjob\s+sequencing\b/],
    body:
      '**Greedy** = har step pe locally best choice; kaam karta hai jab greedy-choice property + optimal substructure ho.\n\n' +
      'Classics: Huffman coding (min-heap, `O(n log n)`), activity selection (finish time se sort), fractional knapsack (value/weight ratio), Kruskal/Prim.\n\n' +
      '**GATE gotcha:** Huffman mein average code length = `Σ freq × depth`; ties ka order tree badal sakta hai par optimal length same.',
  },
  // ── Data Structures ──
  {
    name: 'Binary search tree & AVL',
    subject: 'Data Structures',
    match: [/\bbst\b/, /\bbinary\s+search\s+tree/, /\bavl\b/, /\brotation/],
    body:
      '**BST** = left < root < right. Search/insert/delete `O(h)`; skewed ho to `O(n)`.\n\n' +
      '**AVL** = har node ka balance factor `∈ {−1, 0, 1}`; height `O(log n)`. Imbalance pe LL, RR, LR, RL rotations.\n\n' +
      '**GATE gotcha:** Height h ke AVL mein minimum nodes `N(h) = N(h−1) + N(h−2) + 1`. BST ka inorder hamesha sorted.',
  },
  {
    name: 'Heap',
    subject: 'Data Structures',
    match: [/\bheaps?\b/, /\bpriority\s+queue\b/, /\bheapify\b/],
    body:
      '**Binary heap** = complete binary tree with heap property (max-heap: parent ≥ children), array mein store.\n\n' +
      'Index i ke children `2i+1`, `2i+2` (0-based). Insert/delete `O(log n)`, build-heap `O(n)` (bottom-up).\n\n' +
      '**GATE gotcha:** Max-heap mein minimum element leaves mein hota hai — `⌈n/2⌉` leaves check karne padte hain.',
  },
  {
    name: 'Hashing',
    subject: 'Data Structures',
    match: [/\bhash(?:ing|\s+tables?)?\b/, /\bprobing\b/, /\bchaining\b/],
    body:
      '**Hashing** = key ko hash function se table index pe map karna; average `O(1)` lookup.\n\n' +
      'Collisions: **chaining** (list per slot) ya **open addressing** — linear probing (primary clustering), quadratic (secondary clustering), double hashing.\n\n' +
      '**GATE gotcha:** Load factor α ke saath chaining ka expected unsuccessful search `1 + α`; open addressing mein α < 1 zaroori.',
  },
  {
    name: 'Stack & queue',
    subject: 'Data Structures',
    match: [/\bstacks?\b/, /\bqueues?\b/, /\bpostfix\b/, /\binfix\b/, /\bprefix\s+expression/],
    body:
      '**Stack** = LIFO (push/pop `O(1)`): recursion, expression evaluation, DFS. **Queue** = FIFO: BFS, scheduling.\n\n' +
      'Infix → postfix: operators stack pe, precedence + associativity ke hisaab se pop. Postfix evaluate: operands push, operator aaye to do pop.\n\n' +
      '**GATE gotcha:** Do stacks se queue: amortised `O(1)` per op; valid stack permutations ki count Catalan number `C(n)`.',
  },
  {
    name: 'Graph traversal (BFS/DFS)',
    subject: 'Data Structures',
    match: [/\bbfs\b/, /\bdfs\b/, /\bbreadth\s+first\b/, /\bdepth\s+first\b/, /\btopological\b/],
    body:
      '**BFS** = queue, level by level; unweighted shortest path deta hai. **DFS** = stack/recursion; cycle detection, topological sort, SCCs.\n\n' +
      'Dono `O(V + E)` adjacency list ke saath. Topological order sirf DAG mein; DFS finish times ke reverse order se.\n\n' +
      '**GATE gotcha:** Undirected DFS mein cross edges nahi hote; BFS tree mein non-tree edges ke endpoints ka level ≤ 1 alag.',
  },
  // ── Compiler Design ──
  {
    name: 'Parsing (LL / LR)',
    subject: 'Compiler Design',
    match: [/\bparsing\b/, /\bparsers?\b/, /\bll\s?\(?1\)?\b/, /\blr\s?\(?[01]\)?\b/, /\bslr\b/, /\blalr\b/, /\bfirst\s+and\s+follow\b/],
    body:
      '**Parsing** = token stream se syntax tree banana.\n\n' +
      'Top-down **LL(1):** left recursion aur common prefixes hataane padte hain; FIRST/FOLLOW table. Bottom-up power order: `LR(0) < SLR(1) < LALR(1) < CLR(1)`.\n\n' +
      '**GATE gotcha:** LALR ke states LR(0) jitne hote hain; LALR merge se reduce-reduce conflict aa sakta hai, shift-reduce naya nahi.',
  },
  {
    name: 'Lexical analysis',
    subject: 'Compiler Design',
    match: [/\blexical\b/, /\btokens?\b/, /\blexer\b/],
    body:
      '**Lexical analysis** = source code ko tokens mein todna (keywords, identifiers, operators, literals) — regular expressions + DFA se.\n\n' +
      'Whitespace/comments hatata hai, symbol table mein identifiers daalta hai.\n\n' +
      '**GATE gotcha:** Token count questions mein `printf("%d", x);` jaise string literal ek hi token hota hai.',
  },
  // ── Digital Logic ──
  {
    name: 'K-map & Boolean minimisation',
    subject: 'Digital Logic',
    match: [/\bk[\s-]?maps?\b/, /\bkarnaugh\b/, /\bboolean\b/, /\bminterms?\b/, /\bsop\b|\bpos\b/],
    body:
      '**K-map** = Boolean function ko minimise karne ka grid; adjacent cells ek variable se differ karte hain (Gray code).\n\n' +
      'Groups 1, 2, 4, 8… ke, jitne bade utna accha; wrap-around allowed. Essential prime implicants pehle cover kar, don\'t-cares zarurat ho to lo.\n\n' +
      '**GATE gotcha:** n variables pe `2^(2^n)` Boolean functions; self-dual functions `2^(2^(n−1))`.',
  },
  {
    name: 'Flip-flops & counters',
    subject: 'Digital Logic',
    match: [/\bflip[\s-]?flops?\b/, /\bcounters?\b/, /\blatch(?:es)?\b/],
    body:
      '**Flip-flop** = 1-bit edge-triggered memory. SR (S=R=1 invalid), JK (J=K=1 toggle), D (Q⁺ = D), T (toggle on T=1).\n\n' +
      'Ripple counter asynchronous (delay add hota hai), synchronous counter common clock. Mod-N counter ke liye `⌈log2 N⌉` flip-flops.\n\n' +
      '**GATE gotcha:** JK characteristic equation `Q⁺ = JQ̅ + K̅Q`; race-around condition level-triggered JK mein hota hai.',
  },
  // ── Discrete Math / Engineering Math ──
  {
    name: 'Propositional logic',
    subject: 'Discrete Math',
    match: [/\bpropositional\b/, /\bpredicate\s+logic\b/, /\btautolog/, /\bimplication\b/],
    body:
      '**Propositional logic** = true/false statements aur connectives. `p → q ≡ ¬p ∨ q`; contrapositive `¬q → ¬p` equivalent hai, converse nahi.\n\n' +
      'Tautology = har assignment pe true; satisfiable = kam se kam ek pe true.\n\n' +
      '**GATE gotcha:** `∀x ∃y P(x,y)` aur `∃y ∀x P(x,y)` same nahi — doosra zyada strong hai.',
  },
  {
    name: 'Graph theory',
    subject: 'Discrete Math',
    match: [/\bgraph\s+theory\b/, /\beuler/, /\bhamilton/, /\bchromatic\b/, /\bplanar\b/],
    body:
      '**Graph theory quick facts:** handshaking `Σ deg = 2E`; tree mein `E = V − 1`.\n\n' +
      'Euler circuit ⇔ connected + har vertex even degree. Planar: `V − E + F = 2`, simple planar mein `E ≤ 3V − 6`.\n\n' +
      '**GATE gotcha:** Hamiltonian cycle ke liye koi simple iff condition nahi (NP-complete). Bipartite ⇔ no odd cycle ⇔ 2-colourable.',
  },
  {
    name: 'Probability',
    subject: 'Engineering Math',
    match: [/\bprobability\b/, /\bbayes\b/, /\bexpectation\b/, /\brandom\s+variable/],
    body:
      '**Probability** GATE mein counting + conditional pe based hoti hai.\n\n' +
      '`P(A|B) = P(A ∩ B) / P(B)`; Bayes: `P(A|B) = P(B|A)P(A) / P(B)`. Expectation linear hai: `E[X + Y] = E[X] + E[Y]` (independence zaroori nahi).\n\n' +
      '**GATE gotcha:** Geometric distribution (first success) ka mean `1/p`; "at least one" = `1 − P(none)`.',
  },
  {
    name: 'Linear algebra',
    subject: 'Engineering Math',
    match: [/\beigen/, /\bmatrix\s+rank\b/, /\brank\s+of\b/, /\bdeterminant\b/, /\blinear\s+algebra\b/],
    body:
      '**Eigenvalues:** `Ax = λx`. Sum of eigenvalues = trace, product = determinant.\n\n' +
      'Rank = linearly independent rows; `Ax = b` consistent ⇔ `rank(A) = rank([A|b])`; unique solution jab rank = unknowns.\n\n' +
      '**GATE gotcha:** Triangular matrix ke eigenvalues diagonal entries hain; `A^k` ke eigenvalues `λ^k`.',
  },
  // ── C Programming ──
  {
    name: 'Pointers in C',
    subject: 'C Programming',
    match: [/\bpointers?\b/, /\bmalloc\b/, /\bdangling\b/, /\bcall\s+by\s+(?:value|reference)\b/],
    body:
      '**Pointer** = variable jo address store karta hai. `*p` dereference, `&x` address-of; pointer arithmetic element size ke units mein chalta hai.\n\n' +
      'C mein sab **call by value** hai — address pass karke reference simulate karte hain. `malloc` ka memory `free` karna padta hai; free ke baad use = dangling pointer.\n\n' +
      '**GATE gotcha:** `int a[3][4]; a + 1` agle *row* pe jaata hai (16 bytes aage with 4-byte int), `*a + 1` agle element pe.',
  },
  {
    name: 'Recursion & static variables',
    subject: 'C Programming',
    match: [/\brecursion\b/, /\bstatic\s+variables?\b/, /\bstorage\s+class/],
    body:
      '**Recursion** = function khud ko call kare; har call ka apna stack frame. Base case ke bina stack overflow.\n\n' +
      '`static` local variable ek hi baar initialise hota hai aur calls ke beech value retain karta hai — recursion trace questions ka favourite.\n\n' +
      '**GATE gotcha:** Output-trace questions mein recursive call ke *pehle* aur *baad* ke `printf` ka order dhyan se likh.',
  },
];

// ─── GATE exam facts ───

const GATE_EXAM_REPLY =
  '**GATE CS pattern (quick):**\n\n' +
  '- 65 questions, 100 marks, 3 hours, computer-based.\n' +
  '- General Aptitude 15 marks, Engineering Maths ~13, core CS ~72.\n' +
  '- Question types: **MCQ**, **MSQ** (multiple correct), **NAT** (numerical answer).\n' +
  '- Negative marking sirf MCQ pe: 1-mark ⇒ −1/3, 2-mark ⇒ −2/3. MSQ aur NAT mein negative nahi.\n\n' +
  'Official notice har saal check kar — pattern chhota-mota badal sakta hai. Ab ek mock laga aur apna baseline dekh.';

const GATE_STRATEGY_REPLY =
  '**GATE plan jo kaam karta hai:**\n\n' +
  '1. Subject-wise: concept padh → apne notes → us topic ke PYQs same din.\n' +
  '2. Har din 1 weak subject + 1 strong subject — sirf comfort zone mat padh.\n' +
  '3. Har hafte ek full mock, fir mistakes ka error log.\n' +
  '4. Last 2 months: revision + mocks, naya topic kam.\n\n' +
  'Aaj ka next step: ek pomodoro aur ek quiz.';

// ─── Helpers ───

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"`‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashPick<T>(items: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}

function greetingFor(ctx: Partial<NexusContext> | null): string {
  switch (ctx?.timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
    case 'night':
    case 'late-night':
      return 'Raat ho gayi hai';
    default:
      return 'Namaste';
  }
}

function quiz(subject?: string, label?: string): NexusWireAction {
  return { type: 'start_quiz', ...(subject ? { target: subject } : {}), ...(label ? { label } : {}) };
}

function ask(prompt: string, label?: string): NexusWireAction {
  return { type: 'ask', target: prompt, ...(label ? { label } : {}) };
}

function reply(text: string, actions: NexusWireAction[] = []): OfflineBrainReply {
  return { reply: text, command: null, actions: actions.slice(0, MAX_ACTIONS) };
}

/** Best-scoring concept for a question (longest regex match wins ties). */
function findConcept(text: string): Concept | null {
  let best: Concept | null = null;
  let bestScore = 0;
  for (const concept of CONCEPTS) {
    let score = 0;
    for (const re of concept.match) {
      const m = re.exec(text);
      if (m) score += 10 + m[0].length;
    }
    if (score > bestScore) {
      best = concept;
      bestScore = score;
    }
  }
  return best;
}

const SUBJECT_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:dbms|database|sql)\b/, 'DBMS'],
  [/\b(?:os|operating\s+systems?)\b/, 'OS'],
  [/\b(?:cn|computer\s+networks?|networking)\b/, 'CN'],
  [/\b(?:toc|theory\s+of\s+computation|automata)\b/, 'TOC'],
  [/\b(?:coa|computer\s+organi[sz]ation|architecture)\b/, 'COA'],
  [/\b(?:daa|algorithms?)\b/, 'DAA'],
  [/\b(?:compiler|compilers)\b/, 'Compiler Design'],
  [/\b(?:digital\s+logic|digital)\b/, 'Digital Logic'],
  [/\b(?:discrete)\b/, 'Discrete Math'],
  [/\b(?:maths?|engineering\s+math)\b/, 'Engineering Math'],
  [/\b(?:data\s+structures?|dsa)\b/, 'Data Structures'],
  [/\b(?:c\s+programming|c\s+language)\b/, 'C Programming'],
];

function findSubjectHint(text: string): string | null {
  for (const [re, subject] of SUBJECT_HINTS) if (re.test(text)) return subject;
  return null;
}

/** Topic of the previous NEXUS answer, for "explain more" / "example do" follow-ups. */
function previousConcept(history: readonly NexusChatTurn[]): Concept | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    const concept = findConcept(normalize(turn.content));
    if (concept) return concept;
  }
  return null;
}

// ─── Main entry ───

/**
 * Answer a message without any LLM. Always returns something useful:
 * a direct answer when a rule matches, otherwise an honest "offline"
 * reply with the closest actionable next steps.
 */
export function offlineNexusReply(
  rawMessage: string,
  context: Partial<NexusContext> | null = null,
  history: readonly NexusChatTurn[] = []
): OfflineBrainReply {
  const text = normalize(rawMessage);
  const streak = typeof context?.currentStreak === 'number' ? context.currentStreak : null;
  const lastQuiz = typeof context?.lastQuizScore === 'number' ? Math.round(context.lastQuizScore) : null;
  const late = context?.timeOfDay === 'late-night';

  if (!text) return reply('Kuch likh to sahi.');

  // Greetings
  if (/^(?:hi+|hey+|hello+|yo|namaste|namaskar|sup|hola|good\s+(?:morning|afternoon|evening|night)|kaise\s+ho|kya\s+haal\s+hai|wassup|whats\s+up)\b[\s!.?]*(?:nexus|warrior|bhai|yaar)?[\s!.?]*$/.test(text)) {
    const streakLine =
      streak !== null && streak > 0
        ? ` Streak ${streak} din ka hai — aaj bhi todna nahi.`
        : ' Aaj ka pehla kadam uthate hain.';
    return reply(`${greetingFor(context)}, warrior.${streakLine} Kya karna hai — quiz, notes ya focus session?`, [
      { type: 'study_mode', label: 'Study mode' },
      quiz(undefined, 'Quick quiz'),
      ask('What should I study today?', 'Aaj kya padhu?'),
    ]);
  }

  // Thanks
  if (/^(?:thanks?|thank\s+you|thx|ty|shukriya|dhanyavaad|dhanyavad|great|nice|awesome|cool|ok(?:ay)?\s+thanks?)\b/.test(text)) {
    return reply(hashPick(['Kaam pe lag ja ab.', 'Thanks baad mein — pehle ek pomodoro.', 'Chal, ab execute kar.'], text), [
      { type: 'start_pomodoro', target: '25', label: '25 min focus' },
    ]);
  }

  // Identity
  if (/\b(?:who|what)\s+are\s+(?:you|u)\b|\btum\s+kaun\b|\btu\s+kaun\b|\byour\s+name\b|\bintroduce\s+yourself\b/.test(text)) {
    return reply(
      'Main **NEXUS** hoon — WARRIOR OS ka built-in brain. Apps, notes, GATE quizzes, pomodoro aur smart modes main seedha chalata hoon. Abhi offline brain mode mein hoon: GATE concepts, exam strategy aur saare OS commands kaam karte hain; open-ended AI chat ke liye server pe `GEMINI_API_KEY` chahiye.',
      [ask('help', 'What can you do?'), { type: 'study_mode', label: 'Study mode' }]
    );
  }

  // Time / date
  if (/\b(?:what\s+(?:is\s+the\s+)?time|time\s+kya\s+hai|kitne\s+baje|current\s+time)\b/.test(text)) {
    const now = context?.localTime ? `Abhi ${context.localTime} ho rahe hain.` : 'Clock taskbar pe hai.';
    return reply(`${now}${late ? ' Late ho gaya — revision kar, naya heavy topic kal subah.' : ' Time hai — ek focus session nikaal.'}`, [
      { type: 'start_pomodoro', target: '25', label: '25 min focus' },
    ]);
  }
  if (/\b(?:what\s+(?:is\s+)?(?:the\s+)?(?:date|day)|aaj\s+kya\s+(?:date|din)|today'?s?\s+date)\b/.test(text)) {
    return reply('Date taskbar clock pe hai (Calendar app mein poora month). Date se zyada important — aaj ka target kya hai?', [
      { type: 'open_app', target: 'Calendar', label: 'Open Calendar' },
      ask('What should I study today?', 'Aaj kya padhu?'),
    ]);
  }

  // Motivation / fatigue / procrastination
  if (/\b(?:demotivat|unmotivat|no\s+motivation|motivation|give\s+up|quit|haar|hopeless|depress|sad|udaas|bored|boring|procrastinat|lazy|aalas|man\s+nahi|mann\s+nahi|can'?t\s+focus|cant\s+focus|distract)/.test(text)) {
    const base = hashPick(
      [
        'Motivation aata-jaata hai, **discipline** rehta hai. Bas 25 minute — timer start kar, baaki baad mein soch.',
        'Mann nahi hai? Theek hai. Sabse chhota task utha: ek PYQ. Momentum khud aa jayega.',
        'Har topper ke bhi aise din aate hain. Farak ye hai ki woh fir bhi ek session nikaalte hain. Tu bhi nikaal.',
      ],
      text
    );
    const streakLine = streak !== null && streak > 0 ? ` ${streak} din ka streak hai — use bekaar mat jaane de.` : '';
    return reply(`${base}${streakLine}`, [
      { type: 'start_pomodoro', target: '25', label: '25 min focus' },
      { type: 'study_mode', label: 'Study mode' },
      { type: 'take_break', label: 'Breathing break' },
    ]);
  }
  if (/\b(?:tired|thak|sleepy|neend|exhausted|burn\s?out|headache|sar\s+dard)\b/.test(text)) {
    return reply(
      late
        ? 'Thaka hua dimaag galtiyan karta hai. Aaj 10 min light revision, fir so ja — kal subah fresh start.'
        : '5 minute break le: paani pee, screen se nazar hata, 4-7-8 breathing. Fir ek chhota pomodoro.',
      [
        { type: 'take_break', label: 'Take a break' },
        { type: 'chill_mode', label: 'Chill mode' },
      ]
    );
  }

  // GATE exam facts & strategy
  if (/\bgate\b/.test(text) && /\b(?:pattern|marks?|marking|negative|syllabus|exam\s+structure|questions?\s+count|how\s+many\s+questions|duration|paper)\b/.test(text)) {
    return reply(GATE_EXAM_REPLY, [
      { type: 'start_mock_test', label: 'Start mock test' },
      { type: 'open_flashcards', label: 'Formula cards' },
    ]);
  }
  if (/\b(?:what\s+should\s+i\s+(?:study|do|padhu)|kya\s+padh(?:u|oon|na\s+chahiye)|aaj\s+kya\s+(?:padhu|karu)|study\s+plan|strategy|how\s+to\s+(?:prepare|crack|study)|preparation|timetable|time\s+table|roadmap)\b/.test(text)) {
    if (lastQuiz !== null && lastQuiz < 60) {
      return reply(
        `Last quiz ${lastQuiz}% tha — pehle wahi weak area fix kar. Concept revise kar, fir usi subject ka quiz. Uske baad naya topic.\n\n${GATE_STRATEGY_REPLY}`,
        [quiz(undefined, 'Retry quiz'), { type: 'study_mode', label: 'Study mode' }]
      );
    }
    return reply(GATE_STRATEGY_REPLY, [
      { type: 'study_mode', label: 'Study mode' },
      quiz(undefined, 'Quick quiz'),
      { type: 'open_app', target: 'Habit Forge', label: 'Plan habits' },
    ]);
  }

  // Concept questions (also "explain more" follow-ups)
  const concept = findConcept(text);
  if (concept) {
    return reply(concept.body, [
      quiz(concept.subject, `${concept.subject} quiz`),
      { type: 'search_notes', target: concept.name.split(/[\s&/(]/)[0].toLowerCase(), label: 'My notes on it' },
      { type: 'open_flashcards', target: concept.subject, label: 'Formula cards' },
    ]);
  }
  if (/^(?:explain\s+(?:more|again)|more|aur\s+batao|example(?:\s+do)?|detail(?:\s+mein)?|elaborate|samjha(?:o)?)\b/.test(text)) {
    const prev = previousConcept(history);
    if (prev) {
      return reply(
        `**${prev.name}** ka depth offline mein itna hi hai — best next step: apne notes mein iske 2-3 PYQs solve kar, fir ${prev.subject} quiz.`,
        [quiz(prev.subject, `${prev.subject} quiz`), { type: 'search_notes', target: prev.name.toLowerCase() }]
      );
    }
  }

  // Code questions
  if (/\b(?:code|coding|program|function|bug|error|compile|javascript|typescript|react|python|java|leetcode)\b/.test(text) || /c\+\+/.test(text)) {
    return reply(
      'Offline brain full code generation nahi karta. Approach: problem ko chhote cases mein tod, pehle brute force likh, fir optimise. Code Lab khol ke try kar — atak jaaye to exact error yahan paste kar (Gemini key ho to poora debug milega).',
      [
        { type: 'open_app', target: 'Code Lab', label: 'Open Code Lab' },
        { type: 'open_app', target: 'Algo Lab', label: 'Algo visualizer' },
      ]
    );
  }

  // A subject was named but no specific concept matched.
  const subject = findSubjectHint(text);
  if (subject) {
    return reply(
      `${subject} ka specific topic bol (jaise "${subject === 'DBMS' ? 'normalization' : subject === 'OS' ? 'paging' : subject === 'CN' ? 'subnetting' : 'key concept'} explain kar") — offline brain mein core GATE concepts ke short notes hain. Ya seedha ${subject} quiz se apna level check kar.`,
      [quiz(subject, `${subject} quiz`), { type: 'open_flashcards', target: subject, label: `${subject} cards` }, { type: 'search_notes', target: subject.toLowerCase() }]
    );
  }

  // Honest fallback
  return reply(
    'Ye offline brain ke bahar hai — full AI answers ke liye server pe `GEMINI_API_KEY` set kar. Abhi main ye kar sakta hoon: apps chalana, GATE concepts (paging, normalization, TCP, DFA…), exam strategy, notes search, quizzes, pomodoro aur smart modes.',
    [ask('help', 'What can you do?'), ask('Explain deadlock', 'Explain deadlock'), { type: 'study_mode', label: 'Study mode' }]
  );
}
