// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Themes
// subject → { objects, color, ambient, narration, text snippets }
// Covers all 12 GATE subjects + project / code / exam / mixed /
// idle / void edge cases. Consumed by DreamEngine to build scenes.
// ═══════════════════════════════════════════════════════════

import type { DreamTheme, DreamThemeKey } from '@/types/dream';

export const DREAM_THEMES: Record<DreamThemeKey, DreamTheme> = {
  // ─── GATE SUBJECT THEMES ───
  DBMS: {
    key: 'DBMS',
    label: 'Databases',
    objects: ['floating-table', 'er-diagram-web', 'database-cylinder', 'floating-table'],
    color: '#4FC3F7',
    ambientColor: '#06121b',
    ambient: 'digital-hum',
    narration: [
      'The tables realign in your sleep, keys finding their locks.',
      'Every query you wrote yesterday still hums through the schema.',
      'Normalized, indexed, remembered.',
    ],
    textSnippets: ['SELECT * FROM notes', 'JOIN ON id', 'GROUP BY subject', 'BCNF', 'COMMIT;', 'CREATE INDEX'],
  },
  OS: {
    key: 'OS',
    label: 'Operating Systems',
    objects: ['process-diagram', 'gantt-bar', 'clock-orb', 'process-diagram'],
    color: '#BA68C8',
    ambientColor: '#110818',
    ambient: 'kernel-drone',
    narration: [
      'Processes spin through the scheduler of your dreaming mind.',
      'Context switches ripple. The kernel of you never truly sleeps.',
      'Deadlocks dissolve, semaphores lower. You are in sync.',
    ],
    textSnippets: ['fork()', 'P1 → P2 → P3', 'wait(S)', 'signal(S)', 'page fault', 'RR q=4'],
  },
  CN: {
    key: 'CN',
    label: 'Computer Networks',
    objects: ['network-packet', 'router-node', 'network-packet', 'graph-edge'],
    color: '#4DD0E1',
    ambientColor: '#041316',
    ambient: 'packet-static',
    narration: [
      'Packets trace glowing paths across the void between neurons.',
      'The handshake completes. You are connected to what you learned.',
      'Routes converge. Your understanding found the shortest path.',
    ],
    textSnippets: ['SYN', 'SYN-ACK', 'ACK', '192.168.0.1/24', 'TTL 64', 'GET /'],
  },
  TOC: {
    key: 'TOC',
    label: 'Theory of Computation',
    objects: ['automaton-state', 'transition-arrow', 'set-venn', 'automaton-state'],
    color: '#9575CD',
    ambientColor: '#0e0a1c',
    ambient: 'formal-hum',
    narration: [
      'States accept and reject in the automaton of your rest.',
      'The machine halts. The proof was true all along.',
      'Every string you fed the language returned home accepted.',
    ],
    textSnippets: ['q0 → q1', 'a*b*', 'ε', 'accept', 'L = {aⁿbⁿ}', 'halt'],
  },
  COA: {
    key: 'COA',
    label: 'Computer Organization',
    objects: ['circuit-trace', 'logic-gate', 'clock-orb', 'gantt-bar'],
    color: '#FF8A65',
    ambientColor: '#1a0c06',
    ambient: 'silicon-hum',
    narration: [
      'The pipeline flows clean. No hazards, no stalls tonight.',
      'Cache lines warm with everything you touched yesterday.',
      'Clock cycles pulse beneath your dreaming architecture.',
    ],
    textSnippets: ['IF ID EX MEM WB', 'cache hit', 'MOV R1, R2', 'stall', 'LRU', '0x7FFF'],
  },
  DAA: {
    key: 'DAA',
    label: 'Algorithms',
    objects: ['sorting-bar', 'graph-edge', 'tree-node', 'sorting-bar'],
    color: '#81C784',
    ambientColor: '#07140a',
    ambient: 'compute-hum',
    narration: [
      'The bars re-arrange themselves into perfect order as you rest.',
      'Optimal substructure. Every subproblem you solved fits.',
      'Complexity collapses; the elegant solution finds you.',
    ],
    textSnippets: ['O(n log n)', 'T(n)=2T(n/2)+n', 'dp[i][j]', 'greedy', 'relax(u,v)', 'Θ(n²)'],
  },
  'Compiler Design': {
    key: 'Compiler Design',
    label: 'Compilers',
    objects: ['tree-node', 'code-block', 'transition-arrow', 'terminal-line'],
    color: '#F06292',
    ambientColor: '#1a0710',
    ambient: 'parse-drone',
    narration: [
      'Tokens stream, parse trees bloom, meaning compiles from noise.',
      'Every symbol resolved to the table it belonged in.',
      'From syntax to semantics, the grammar of you is well-formed.',
    ],
    textSnippets: ['LL(1)', 'FIRST(S)', 'id + id * id', 'shift', 'reduce', 't1 = a + b'],
  },
  'Digital Logic': {
    key: 'Digital Logic',
    label: 'Digital Logic',
    objects: ['logic-gate', 'circuit-trace', 'binary-stream', 'logic-gate'],
    color: '#FFD54F',
    ambientColor: '#181204',
    ambient: 'gate-hum',
    narration: [
      'Gates flip true and false in the circuits of your sleep.',
      'The Karnaugh map simplifies to a single glowing term.',
      'Zeros and ones settle into the truth you memorized.',
    ],
    textSnippets: ['A·B + C', 'NAND', 'K-map', 'D flip-flop', '1011₂', 'MUX 4:1'],
  },
  'Discrete Math': {
    key: 'Discrete Math',
    label: 'Discrete Math',
    objects: ['set-venn', 'graph-edge', 'tree-node', 'set-venn'],
    color: '#7986CB',
    ambientColor: '#0a0c1c',
    ambient: 'axiom-hum',
    narration: [
      'Sets intersect and unite in the lattice of your dreaming.',
      'The induction holds for n, and for n plus one, and forever.',
      'Every proof you closed still stands.',
    ],
    textSnippets: ['∀x ∃y', 'A ∩ B', 'p → q', 'n! / r!', '|V| − |E|', 'mod 7'],
  },
  'Engineering Math': {
    key: 'Engineering Math',
    label: 'Engineering Math',
    objects: ['integral-symbol', 'matrix-grid', 'graph-edge', 'matrix-grid'],
    color: '#4FC3F7',
    ambientColor: '#050f1a',
    ambient: 'continuum-hum',
    narration: [
      'Eigenvectors align along the axes of your resting mind.',
      'The integral converges; the area under you is finite and calm.',
      'Every transform you learned maps you to a stiller domain.',
    ],
    textSnippets: ['det(A)', 'λ₁, λ₂', '∫ f(x) dx', 'P(A|B)', 'Ax = b', 'dy/dx'],
  },
  'C Programming': {
    key: 'C Programming',
    label: 'C Programming',
    objects: ['code-block', 'linked-list', 'brace-glyph', 'terminal-line'],
    color: '#64B5F6',
    ambientColor: '#07101c',
    ambient: 'compile-hum',
    narration: [
      'Pointers chase addresses through the memory of your sleep.',
      'No segfaults tonight. Every reference resolves cleanly.',
      'Allocated, used, and freed. Nothing leaked.',
    ],
    textSnippets: ['int *p = &x;', 'malloc(n)', 'printf("%d")', 'struct node', '*p++', 'free(p);'],
  },
  'Data Structures': {
    key: 'Data Structures',
    label: 'Data Structures',
    objects: ['tree-node', 'linked-list', 'graph-edge', 'sorting-bar'],
    color: '#4DB6AC',
    ambientColor: '#051515',
    ambient: 'structure-hum',
    narration: [
      'Nodes link and balance themselves as the tree of you rotates.',
      'Every traversal returns; nothing you stored was lost.',
      'The heap settles, the stack unwinds, order is restored.',
    ],
    textSnippets: ['push()', 'pop()', 'enqueue', 'heapify', 'left → right', 'hash(k)'],
  },

  // ─── EDGE-CASE / SYNTHETIC THEMES ───
  project: {
    key: 'project',
    label: 'Your Projects',
    objects: ['kanban-card', 'rocket', 'checkmark-orb', 'code-block'],
    color: '#00E676',
    ambientColor: '#03140a',
    ambient: 'builder-hum',
    narration: [
      'The rocket you fueled climbs a little higher in your sleep.',
      'Cards moved, tasks closed. The work remembers you.',
      'What you shipped keeps glowing long after you log off.',
    ],
    textSnippets: ['git push', 'v1.0.0', 'deploy ✓', 'TODO → DONE', 'merge', 'ship it'],
  },
  code: {
    key: 'code',
    label: 'Building',
    objects: ['code-block', 'terminal-line', 'brace-glyph', 'binary-stream'],
    color: '#00F0FF',
    ambientColor: '#031116',
    ambient: 'flow-hum',
    narration: [
      'Braces close, tests pass green in the theater of your dream.',
      'You shaped logic yesterday; tonight it shapes you back.',
      'Every line compiles in the quiet of the night.',
    ],
    textSnippets: ['const x = 42;', '=> {}', 'npm run build', 'return true;', 'tests: pass', 'async'],
  },
  exam: {
    key: 'exam',
    label: 'Exam Prep',
    objects: ['exam-sheet', 'clock-orb', 'checkmark-orb', 'exam-sheet'],
    color: '#FFAB00',
    ambientColor: '#1a1003',
    ambient: 'pressure-hum',
    narration: [
      'You drilled hard yesterday. The pressure forged something sharp.',
      'Answer after answer, the exam fears you a little more now.',
      'Knowledge under load became knowledge you can trust.',
    ],
    textSnippets: ['Q.1', 'Q.27', '+2 marks', '−0.66', 'mock #3', 'GATE'],
  },
  mixed: {
    key: 'mixed',
    label: 'Many Paths',
    objects: ['star-cluster', 'graph-edge', 'matrix-grid', 'nebula-swirl'],
    color: '#7B61FF',
    ambientColor: '#0a0719',
    ambient: 'constellation-hum',
    narration: [
      'Many subjects wove together into one glowing constellation.',
      'You touched many disciplines; tonight they touch each other.',
      'A wide day of learning drifts across your resting sky.',
    ],
    textSnippets: ['DBMS', 'OS', 'CN', 'TOC', 'DAA', 'COA'],
  },
  idle: {
    key: 'idle',
    label: 'Stillness',
    objects: ['void-particles', 'distant-stars', 'dark-fog'],
    color: '#3a3a5e',
    ambientColor: '#05050a',
    ambient: 'silence',
    narration: [
      'Faint stars flicker where knowledge used to burn.',
      'A quiet day. The fire waits, patient, for your return.',
      'Silence settled over yesterday.',
    ],
    textSnippets: [],
  },
  void: {
    key: 'void',
    label: 'The Void',
    objects: ['void-particles', 'dark-fog', 'distant-stars'],
    color: '#2a2a44',
    ambientColor: '#010103',
    ambient: 'deep-void',
    narration: [
      'The void grew vast while you were away.',
      'I kept the lights dim, waiting.',
      'The path is cold now, but not gone.',
    ],
    textSnippets: [],
  },
};

// ─── ACTIVITY-BASED NARRATION (spec 6.66) ───
export const DREAM_NARRATION_HINTS = {
  studiedHard: 'Your knowledge grew stronger yesterday.',
  coded: 'The code flows through your veins.',
  builtProject: 'What you built yesterday still glows in the dark.',
  idle: 'The void grows when you rest too long...',
  streakAlive: 'The fire burns eternal.',
  streakBroken: 'A flame extinguished. Will you relight it?',
  returned: 'You returned. The fire remembers you.',
} as const;

// ─── HELPERS ───

/** Safe theme lookup — falls back to idle if a key is somehow unknown. */
export function getDreamTheme(key: DreamThemeKey): DreamTheme {
  return DREAM_THEMES[key] ?? DREAM_THEMES.idle;
}

/** GATE subject theme keys (the 12 real subjects). */
export const SUBJECT_THEME_KEYS: DreamThemeKey[] = [
  'DBMS',
  'OS',
  'CN',
  'TOC',
  'COA',
  'DAA',
  'Compiler Design',
  'Digital Logic',
  'Discrete Math',
  'Engineering Math',
  'C Programming',
  'Data Structures',
];

/**
 * Map a raw GATE subject string to its theme key. Unknown strings fall
 * back to 'mixed' so a scene can still render.
 */
export function themeKeyForSubject(subject: string): DreamThemeKey {
  return (SUBJECT_THEME_KEYS as string[]).includes(subject) ? (subject as DreamThemeKey) : 'mixed';
}
