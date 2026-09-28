// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Themes
// subject → { objects, color, ambient, narration }
// Covers all 12 GATE subjects + project / code / exam / mixed /
// idle / void edge cases. Consumed by DreamEngine to build scenes.
// ═══════════════════════════════════════════════════════════

import type { DreamTheme, DreamThemeKey } from '@/types/dream';

// ─── GATE SUBJECT THEMES ───
export const DREAM_THEMES: Record<DreamThemeKey, DreamTheme> = {
  DBMS: {
    key: 'DBMS',
    label: 'Databases',
    objects: ['floating-table', 'sql-query-text', 'er-diagram-web', 'database-cylinder'],
    color: '#4FC3F7',
    ambientColor: '#0a1a26',
    ambient: 'digital-hum',
    narration: [
      'The tables realign in your sleep, keys finding their locks.',
      'Every query you wrote yesterday still hums through the schema.',
      'Normalized, indexed, remembered — your knowledge grew stronger.',
    ],
  },
  OS: {
    key: 'OS',
    label: 'Operating Systems',
    objects: ['process-diagram', 'gantt-bar', 'binary-stream', 'clock-orb'],
    color: '#BA68C8',
    ambientColor: '#160a1f',
    ambient: 'kernel-drone',
    narration: [
      'Processes spin through the scheduler of your dreaming mind.',
      'Context switches ripple — the kernel of you never truly sleeps.',
      'Deadlocks dissolve, semaphores lower. You are in sync.',
    ],
  },
  CN: {
    key: 'CN',
    label: 'Computer Networks',
    objects: ['network-packet', 'router-node', 'binary-stream', 'graph-edge'],
    color: '#4DD0E1',
    ambientColor: '#08191c',
    ambient: 'packet-static',
    narration: [
      'Packets trace glowing paths across the void between neurons.',
      'The handshake completes. You are connected to what you learned.',
      'Routes converge — your understanding found the shortest path.',
    ],
  },
  TOC: {
    key: 'TOC',
    label: 'Theory of Computation',
    objects: ['automaton-state', 'transition-arrow', 'set-venn', 'graph-edge'],
    color: '#9575CD',
    ambientColor: '#120c22',
    ambient: 'formal-hum',
    narration: [
      'States accept and reject in the automaton of your rest.',
      'The machine halts. The proof was true all along.',
      'Every string you fed the language returned home accepted.',
    ],
  },
  COA: {
    key: 'COA',
    label: 'Computer Organization',
    objects: ['circuit-trace', 'binary-stream', 'logic-gate', 'clock-orb'],
    color: '#FF8A65',
    ambientColor: '#1f0f08',
    ambient: 'silicon-hum',
    narration: [
      'The pipeline flows clean, no hazards, no stalls tonight.',
      'Cache lines warm with everything you touched yesterday.',
      'Clock cycles pulse beneath your dreaming architecture.',
    ],
  },
  DAA: {
    key: 'DAA',
    label: 'Algorithms',
    objects: ['sorting-bar', 'graph-edge', 'tree-node', 'matrix-grid'],
    color: '#81C784',
    ambientColor: '#0c1a0d',
    ambient: 'compute-hum',
    narration: [
      'The bars re-arrange themselves into perfect order as you rest.',
      'Optimal substructure — every subproblem you solved fits.',
      'Complexity collapses; the elegant solution finds you.',
    ],
  },
  'Compiler Design': {
    key: 'Compiler Design',
    label: 'Compilers',
    objects: ['tree-node', 'code-block', 'transition-arrow', 'terminal-line'],
    color: '#F06292',
    ambientColor: '#1f0a14',
    ambient: 'parse-drone',
    narration: [
      'Tokens stream, parse trees bloom, meaning compiles from noise.',
      'Every symbol resolved to the table it belonged in.',
      'From syntax to semantics — the grammar of you is well-formed.',
    ],
  },
  'Digital Logic': {
    key: 'Digital Logic',
    label: 'Digital Logic',
    objects: ['logic-gate', 'circuit-trace', 'binary-stream', 'matrix-grid'],
    color: '#FFD54F',
    ambientColor: '#1f1806',
    ambient: 'gate-hum',
    narration: [
      'Gates flip true and false in the circuits of your sleep.',
      'The Karnaugh map simplifies to a single glowing term.',
      'Zeros and ones settle into the truth you memorized.',
    ],
  },
  'Discrete Math': {
    key: 'Discrete Math',
    label: 'Discrete Math',
    objects: ['set-venn', 'graph-edge', 'tree-node', 'matrix-grid'],
    color: '#7986CB',
    ambientColor: '#0e1022',
    ambient: 'axiom-hum',
    narration: [
      'Sets intersect and unite in the lattice of your dreaming.',
      'The induction holds for n, and for n plus one, and forever.',
      'Every proof you closed still stands, quod erat demonstrandum.',
    ],
  },
  'Engineering Math': {
    key: 'Engineering Math',
    label: 'Engineering Math',
    objects: ['integral-symbol', 'matrix-grid', 'graph-edge', 'star-cluster'],
    color: '#4FC3F7',
    ambientColor: '#08131f',
    ambient: 'continuum-hum',
    narration: [
      'Eigenvectors align along the axes of your resting mind.',
      'The integral converges; the area under you is finite and calm.',
      'Every transform you learned maps you to a stiller domain.',
    ],
  },
  'C Programming': {
    key: 'C Programming',
    label: 'C Programming',
    objects: ['code-block', 'terminal-line', 'brace-glyph', 'linked-list'],
    color: '#64B5F6',
    ambientColor: '#0a1420',
    ambient: 'compile-hum',
    narration: [
      'Pointers chase addresses through the memory of your sleep.',
      'No segfaults tonight — every reference resolves cleanly.',
      'The code flows through your veins, allocated and freed.',
    ],
  },
  'Data Structures': {
    key: 'Data Structures',
    label: 'Data Structures',
    objects: ['tree-node', 'linked-list', 'graph-edge', 'sorting-bar'],
    color: '#4DB6AC',
    ambientColor: '#08191a',
    ambient: 'structure-hum',
    narration: [
      'Nodes link and balance themselves as the tree of you rotates.',
      'Every traversal returns; nothing you stored was lost.',
      'The heap settles, the stack unwinds, order is restored.',
    ],
  },

  // ─── EDGE-CASE / SYNTHETIC THEMES ───
  project: {
    key: 'project',
    label: 'Your Projects',
    objects: ['kanban-card', 'rocket', 'checkmark-orb', 'code-block'],
    color: '#00E676',
    ambientColor: '#04180d',
    ambient: 'builder-hum',
    narration: [
      'What you built yesterday drifts through the dark, still glowing.',
      'The rocket you fueled climbs a little higher in your sleep.',
      'Cards moved, tasks closed — the work remembers you.',
    ],
  },
  code: {
    key: 'code',
    label: 'Building',
    objects: ['code-block', 'terminal-line', 'brace-glyph', 'binary-stream'],
    color: '#00F0FF',
    ambientColor: '#04141a',
    ambient: 'flow-hum',
    narration: [
      'The code flows through your veins even now, warm and syntactic.',
      'Braces close, tests pass green in the theater of your dream.',
      'You shaped logic yesterday; tonight it shapes you back.',
    ],
  },
  exam: {
    key: 'exam',
    label: 'Exam Prep',
    objects: ['exam-sheet', 'clock-orb', 'checkmark-orb', 'matrix-grid'],
    color: '#FFAB00',
    ambientColor: '#1f1404',
    ambient: 'pressure-hum',
    narration: [
      'You drilled hard yesterday. The pressure forged something sharp.',
      'Answer after answer — the exam fears you a little more now.',
      'Knowledge under load became knowledge you can trust.',
    ],
  },
  mixed: {
    key: 'mixed',
    label: 'Many Paths',
    objects: ['star-cluster', 'graph-edge', 'matrix-grid', 'nebula-swirl'],
    color: '#7B61FF',
    ambientColor: '#0d0a1f',
    ambient: 'constellation-hum',
    narration: [
      'Many subjects wove together into one glowing constellation.',
      'You touched many disciplines; tonight they touch each other.',
      'A wide day of learning drifts across your resting sky.',
    ],
  },
  idle: {
    key: 'idle',
    label: 'Stillness',
    objects: ['void-particles', 'distant-stars', 'dark-fog'],
    color: '#3a3a5e',
    ambientColor: '#08080f',
    ambient: 'silence',
    narration: [
      'The void grows when you rest too long...',
      'Faint stars flicker where knowledge used to burn.',
      'A quiet day. The fire waits, patient, for your return.',
    ],
  },
  void: {
    key: 'void',
    label: 'The Void',
    objects: ['void-particles', 'dark-fog', 'distant-stars'],
    color: '#1a1a2e',
    ambientColor: '#020205',
    ambient: 'deep-void',
    narration: [
      'You have been gone a long time. The void has grown vast.',
      'I kept the lights dim, waiting. Will you return to the fire?',
      'The path is cold now — but not gone. Come back, warrior.',
    ],
  },
};

// ─── ACTIVITY-BASED NARRATION OVERLAYS ───
// Chosen dynamically by DreamEngine on top of the theme's base lines.
export const DREAM_NARRATION_HINTS = {
  studiedHard: 'Your knowledge grew stronger yesterday.',
  coded: 'The code flows through your veins.',
  builtProject: 'What you built yesterday still glows in the dark.',
  streakAlive: 'The fire burns eternal.',
  streakBroken: 'A flame extinguished. Will you relight it?',
  idle: 'The void grows when you rest too long...',
  returned: 'You returned. The fire remembers you.',
} as const;

// ─── HELPERS ───

/** Safe theme lookup — falls back to idle if a key is somehow unknown. */
export function getDreamTheme(key: DreamThemeKey): DreamTheme {
  return DREAM_THEMES[key] ?? DREAM_THEMES.idle;
}

/**
 * Map a raw GATE subject string to its theme key. Unknown strings fall
 * back to 'mixed' so a scene can still render.
 */
export function themeKeyForSubject(subject: string): DreamThemeKey {
  if (Object.prototype.hasOwnProperty.call(DREAM_THEMES, subject)) {
    return subject as DreamThemeKey;
  }
  return 'mixed';
}
