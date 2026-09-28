// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Themes
// activity → { objects, color, ambient, narration, text snippets }
// One theme per kind of day (decks, notes, projects, code, music,
// habits, focus) + marathon / mixed / idle / void. DreamEngine picks
// one from yesterday's real activity and mixes the user's own names
// (decks, note titles, projects, habits) into the glowing text.
// ═══════════════════════════════════════════════════════════

import type { DreamActivityKey, DreamTheme, DreamThemeKey } from '@/types/dream';

export const DREAM_THEMES: Record<DreamThemeKey, DreamTheme> = {
  // ─── ACTIVITY THEMES ───
  decks: {
    key: 'decks',
    label: 'Training Grounds',
    objects: ['flash-card', 'recall-ring', 'checkmark-orb', 'flash-card'],
    color: '#22D3EE',
    ambientColor: '#04121a',
    ambient: 'recall-hum',
    narration: [
      'Cards flip in the dark, and every answer lands a little faster.',
      'What you recalled yesterday is settling into long-term memory.',
      'The intervals stretch. The knowledge holds.',
    ],
    textSnippets: ['recall ✓', 'again', 'good', 'easy', 'next: 3d', 'mastered'],
  },
  notes: {
    key: 'notes',
    label: 'The Archive',
    objects: ['note-page', 'quill', 'graph-edge', 'tree-node'],
    color: '#FFCA28',
    ambientColor: '#161004',
    ambient: 'paper-hush',
    narration: [
      'The pages you wrote drift through the archive of your sleep.',
      'Every idea you wrote down found its shelf tonight.',
      'Links form between your thoughts while you rest.',
    ],
    textSnippets: ['# idea', '[[link]]', '- [x] done', '> remember', '## draft', '#tag'],
  },
  project: {
    key: 'project',
    label: 'The Forge',
    objects: ['kanban-card', 'rocket', 'checkmark-orb', 'gantt-bar'],
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
    objects: ['code-block', 'terminal-line', 'brace-glyph', 'binary-stream', 'circuit-trace', 'sorting-bar'],
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
  music: {
    key: 'music',
    label: 'Soundscape',
    objects: ['music-note', 'sound-wave', 'equalizer', 'music-note'],
    color: '#F472B6',
    ambientColor: '#1a0714',
    ambient: 'melody-drift',
    narration: [
      'Yesterday’s melodies still hum somewhere in the dark.',
      'The rhythm you typed to keeps time in your sleep.',
      'Every note you let play became part of the night.',
    ],
    textSnippets: ['♪', '♫', '96 bpm', 'minor key', 'lo-fi', 'fade in'],
  },
  habits: {
    key: 'habits',
    label: 'The Discipline Machine',
    objects: ['flame', 'habit-grid', 'checkmark-orb', 'flame'],
    color: '#FF7043',
    ambientColor: '#1a0904',
    ambient: 'ember-crackle',
    narration: [
      'Small promises kept, one after another. The machine hums.',
      'Discipline stacked quietly yesterday. It compounds tonight.',
      'Every box you ticked keeps the fire fed.',
    ],
    textSnippets: ['✓ done', 'day +1', 'no zero days', 'streak', 'routine', 'again tomorrow'],
  },
  focus: {
    key: 'focus',
    label: 'Deep Focus',
    objects: ['hourglass', 'clock-orb', 'nebula-swirl', 'hourglass'],
    color: '#7C4DFF',
    ambientColor: '#0a0619',
    ambient: 'still-drone',
    narration: [
      'Hours of focus fold into a single sharp point of light.',
      'The noise fell away yesterday. The quiet remembers you.',
      'Deep work leaves deep traces.',
    ],
    textSnippets: ['deep work', '25:00', 'flow', 'in the zone', 'one thing', 'no distractions'],
  },

  // ─── EDGE-CASE / SYNTHETIC THEMES ───
  marathon: {
    key: 'marathon',
    label: 'Iron Day',
    objects: ['flame', 'rocket', 'checkmark-orb', 'clock-orb'],
    color: '#FFAB00',
    ambientColor: '#1a1003',
    ambient: 'forge-roar',
    narration: [
      'A full day, fought on every front. The machine ran hot.',
      'You trained, built and kept your word to yourself. Rest now.',
      'Pressure forged something sharp yesterday.',
    ],
    textSnippets: ['all in', 'no zero days', '+XP', 'keep going', 'iron will', 'discipline'],
  },
  mixed: {
    key: 'mixed',
    label: 'Many Paths',
    objects: ['star-cluster', 'graph-edge', 'nebula-swirl', 'star-cluster'],
    color: '#7B61FF',
    ambientColor: '#0a0719',
    ambient: 'constellation-hum',
    narration: [
      'Many threads of yesterday wove into one glowing constellation.',
      'You moved in many directions; tonight they meet.',
      'A wide day drifts across your resting sky.',
    ],
    textSnippets: ['learn', 'build', 'write', 'train', 'create', 'rest'],
  },
  idle: {
    key: 'idle',
    label: 'Stillness',
    objects: ['void-particles', 'distant-stars', 'dark-fog'],
    color: '#3a3a5e',
    ambientColor: '#05050a',
    ambient: 'silence',
    narration: [
      'Faint stars flicker where the fire used to burn.',
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

/** How each activity reads in a sentence ("Training, writing and building"). */
export const DREAM_ACTIVITY_NOUNS: Record<DreamActivityKey, string> = {
  decks: 'training',
  notes: 'writing',
  project: 'building',
  code: 'coding',
  music: 'music',
  habits: 'habits',
  focus: 'deep focus',
};

// ─── HELPERS ───

/** Safe theme lookup — falls back to idle if a key is somehow unknown. */
export function getDreamTheme(key: DreamThemeKey): DreamTheme {
  return DREAM_THEMES[key] ?? DREAM_THEMES.idle;
}

/** The activity theme keys (one per kind of day). */
export const ACTIVITY_THEME_KEYS: DreamActivityKey[] = ['decks', 'notes', 'project', 'code', 'music', 'habits', 'focus'];

export function isActivityKey(key: string): key is DreamActivityKey {
  return (ACTIVITY_THEME_KEYS as string[]).includes(key);
}

/** True for any theme key a dream can have (journal clean-up). */
export function isDreamThemeKey(key: string): key is DreamThemeKey {
  return Object.prototype.hasOwnProperty.call(DREAM_THEMES, key);
}
