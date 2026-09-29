// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phase 6 Achievement Definitions (TASK 6.69–6.76)
// The 34 "Living World" achievements, using the exact ids the
// feature code already unlocks (creature/CreatureEngine, ghost-presence
// engine, memory-palace/palaceData, biometrics/decay/phantom
// achievements.ts, dream/dreamJournal, procedural-music/achievements).
//
// Plus SUPPLEMENT_ACHIEVEMENTS: ids unlocked by the achievement,
// effects, widgets and PWA code that the base catalogue lacks, and
// LEGACY_ACHIEVEMENT_OVERRIDES: retitles of older entries whose titles
// now collide with a spec'd Phase 6 achievement.
//
// Merge with withPhase6Achievements(BASE) in data/achievements.ts:
// entries with an existing id replace that entry in place (so spec XP
// and titles win), new ids are appended.
// ═══════════════════════════════════════════════════════════

import type { Achievement } from '@/types/achievement';

type Def = Omit<Achievement, 'unlockedAt'>;

function def(a: Def): Achievement {
  return { ...a, unlockedAt: null };
}

// ─── 6.69 · Warrior Creature (6) ───
const CREATURE: Achievement[] = [
  def({
    id: 'first-pet',
    title: 'First Pet',
    description: 'Your Warrior Creature hatched from its egg. A companion for the journey ahead.',
    category: 'special',
    icon: '🥚',
    xpReward: 500,
    rarity: 'rare',
    conditionId: 'creature.hatched',
  }),
  def({
    id: 'creature-growing-up',
    title: 'Growing Up',
    description: 'Your creature reached the Teen stage.',
    category: 'special',
    icon: '🐣',
    xpReward: 200,
    rarity: 'uncommon',
    conditionId: 'creature.stage>=teen',
  }),
  def({
    id: 'creature-evolution',
    title: 'Evolution',
    description: 'Your creature changed its form for the first time.',
    category: 'special',
    icon: '🧬',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'creature.formChanges>=1',
  }),
  def({
    id: 'creature-legendary',
    title: 'Legendary Beast',
    description: 'Your creature reached the Legendary stage.',
    category: 'special',
    icon: '🐉',
    xpReward: 1000,
    rarity: 'epic',
    conditionId: 'creature.stage>=legendary',
  }),
  def({
    id: 'creature-mythic',
    title: 'Mythic Bond',
    description: 'Your creature ascended to its Mythic form. An unbreakable bond.',
    category: 'special',
    icon: '✨',
    xpReward: 2000,
    rarity: 'legendary',
    conditionId: 'creature.stage>=mythic',
  }),
  def({
    id: 'creature-happy-week',
    title: 'Happy Pet',
    description: 'Kept your creature happy for 7 days straight.',
    category: 'streak',
    icon: '💖',
    xpReward: 500,
    rarity: 'rare',
    conditionId: 'creature.happyStreak>=7',
  }),
];

// ─── 6.70 · Ghost Warriors (5) ───
const GHOST: Achievement[] = [
  def({
    id: 'ghost-not-alone',
    title: 'Not Alone',
    description: 'Saw another warrior online for the first time.',
    category: 'exploration',
    icon: '👻',
    xpReward: 100,
    rarity: 'common',
    conditionId: 'ghost.othersOnline>=1',
  }),
  def({
    id: 'ghost-first-cry',
    title: 'War Cry',
    description: 'Sent your first anonymous war cry to the warriors around the campfire.',
    category: 'exploration',
    icon: '📣',
    xpReward: 100,
    rarity: 'common',
    conditionId: 'ghost.warCriesSent>=1',
  }),
  def({
    id: 'ghost-campfire-bonfire',
    title: 'Campfire Stories',
    description: 'Were online while 10 or more warriors studied at the same time.',
    category: 'exploration',
    icon: '🔥',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'ghost.online>=10',
  }),
  def({
    id: 'ghost-top-warrior',
    title: 'Top Warrior',
    description: 'Reached #1 on the daily Ghost Warriors leaderboard.',
    category: 'special',
    icon: '🏆',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'ghost.dailyRank==1',
  }),
  def({
    id: 'ghost-band-of-brothers',
    title: 'Band of Brothers',
    description: 'Spent 50+ hours online alongside other warriors.',
    category: 'special',
    icon: '🤝',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'ghost.minutesWithOthers>=3000',
  }),
];

// ─── 6.71 · Memory Palace (4) ───
const PALACE: Achievement[] = [
  def({
    id: 'palace-architect',
    title: 'The Architect',
    description: 'Entered your Memory Palace for the first time.',
    category: 'exploration',
    icon: '🏛️',
    xpReward: 200,
    rarity: 'uncommon',
    conditionId: 'palace.entered',
  }),
  def({
    id: 'palace-grand-library',
    title: 'Grand Library',
    description: 'Your Memory Palace holds 50 or more knowledge objects.',
    category: 'study',
    icon: '📚',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'palace.objects>=50',
  }),
  def({
    id: 'palace-of-wisdom',
    title: 'Palace of Wisdom',
    description: 'Visited every room of your Memory Palace (5+ rooms).',
    category: 'exploration',
    icon: '🗝️',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'palace.visitedAllSubjects',
  }),
  def({
    id: 'palace-curator',
    title: 'Curator',
    description: 'Revised 100 knowledge objects inside the palace.',
    category: 'study',
    icon: '🖼️',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'palace.revisions>=100',
  }),
];

// ─── 6.72 · Biometrics (4) ───
const BIOMETRICS: Achievement[] = [
  def({
    id: 'biometrics-zone-hour',
    title: 'In The Zone',
    description: 'Kept your focus above 95% for one continuous hour.',
    category: 'study',
    icon: '🎯',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'biometrics.focus>95for60m',
  }),
  def({
    id: 'biometrics-self-aware',
    title: 'Self-Aware',
    description: 'Checked your biometrics on 30 different days.',
    category: 'streak',
    icon: '🪞',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'biometrics.historyDays>=30',
  }),
  def({
    id: 'biometrics-zen-master',
    title: 'Zen Master',
    description: 'Kept your stress below 10% for two hours.',
    category: 'special',
    icon: '🧘',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'biometrics.stress<10for120m',
  }),
  def({
    id: 'biometrics-speedster',
    title: 'Speedster',
    description: 'Typed at 100+ WPM in the typing biometrics.',
    category: 'special',
    icon: '⚡',
    xpReward: 200,
    rarity: 'uncommon',
    conditionId: 'biometrics.wpm>=100',
  }),
];

// ─── 6.73 · Reality Decay + breaks (4) ───
const DECAY: Achievement[] = [
  def({
    id: 'decay-mortal',
    title: 'Mortal',
    description: 'Studied long enough to trigger the first stage of reality decay.',
    category: 'special',
    icon: '🥀',
    xpReward: 100,
    rarity: 'common',
    conditionId: 'decay.stage>=1',
  }),
  def({
    id: 'decay-iron-body',
    title: 'Iron Body',
    description: 'Pushed reality into full Stage 5 decay 10 times.',
    category: 'special',
    icon: '🦾',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'decay.fullDecays>=10',
  }),
  def({
    id: 'decay-balanced-warrior',
    title: 'Balanced Warrior',
    description: 'Took 50 forced recovery breaks.',
    category: 'streak',
    icon: '⚖️',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'decay.forcedBreaks>=50',
  }),
  def({
    id: 'decay-the-machine',
    title: 'The Machine',
    description: 'Studied 8+ hours in a single day while taking proper breaks.',
    category: 'study',
    icon: '🤖',
    xpReward: 1000,
    rarity: 'legendary',
    conditionId: 'decay.dayStudy>=480m&breaks>=2',
  }),
];

// ─── 6.74 · Dreams (4) ───
const DREAM: Achievement[] = [
  def({
    id: 'dream-first',
    title: 'Dreamer',
    description: 'Saw your first dream sequence.',
    category: 'exploration',
    icon: '🌙',
    xpReward: 100,
    rarity: 'common',
    conditionId: 'dream.total>=1',
  }),
  def({
    id: 'dream-lucid',
    title: 'Lucid',
    description: 'Saw dreams on 30 different days.',
    category: 'streak',
    icon: '💫',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'dream.days>=30',
  }),
  def({
    id: 'dream-nightmare',
    title: 'Nightmare',
    description: 'Drifted through the void dream after a day without study.',
    category: 'special',
    icon: '🌑',
    xpReward: 100,
    rarity: 'uncommon',
    hidden: true,
    conditionId: 'dream.voidSeen',
  }),
  def({
    id: 'dream-walker',
    title: 'Dream Walker',
    description: 'Dreamed of 5 or more different things (activities or decks).',
    category: 'exploration',
    icon: '🚪',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'dream.subjects>=5',
  }),
];

// ─── 6.75 · Phantom Windows (3) ───
const PHANTOM: Achievement[] = [
  def({
    id: 'phantom-resurrect',
    title: 'Ghost Whisperer',
    description: 'Resurrected a closed app by clicking its phantom before it dissolved.',
    category: 'exploration',
    icon: '🪄',
    xpReward: 200,
    rarity: 'uncommon',
    conditionId: 'phantom.resurrections>=1',
  }),
  def({
    id: 'phantom-necromancer',
    title: 'Necromancer',
    description: 'Resurrected 50 phantom windows in total.',
    category: 'special',
    icon: '💀',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'phantom.resurrections>=50',
  }),
  def({
    id: 'phantom-let-it-go',
    title: 'Let It Go',
    description: 'Let 100 phantoms dissolve without resurrecting them.',
    category: 'special',
    icon: '🍃',
    xpReward: 200,
    rarity: 'rare',
    conditionId: 'phantom.dissolves>=100',
  }),
];

// ─── 6.76 · Procedural music (4) ───
const MUSIC: Achievement[] = [
  def({
    id: 'music-composer',
    title: 'The Composer',
    description: 'Listened to 10 hours of procedurally generated music.',
    category: 'exploration',
    icon: '🎼',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'music.totalSeconds>=36000',
  }),
  def({
    id: 'music-rhythm-master',
    title: 'Rhythm Master',
    description: 'Spent 5 hours in Typing Rhythm mode.',
    category: 'build',
    icon: '🥁',
    xpReward: 500,
    rarity: 'epic',
    conditionId: 'music.codingSeconds>=18000',
  }),
  def({
    id: 'music-night-music',
    title: 'Night Music',
    description: 'Listened to the night ambient past midnight.',
    category: 'special',
    icon: '🌌',
    xpReward: 200,
    rarity: 'uncommon',
    conditionId: 'music.night@00-05',
  }),
  def({
    id: 'music-full-orchestra',
    title: 'Full Orchestra',
    description: 'Used all 4 procedural music modes in one day.',
    category: 'exploration',
    icon: '🎻',
    xpReward: 300,
    rarity: 'rare',
    conditionId: 'music.modesToday>=4',
  }),
];

/** All 34 Phase 6 achievements (TASK 6.69–6.76), in spec order. */
export const PHASE6_ACHIEVEMENTS: Achievement[] = [
  ...CREATURE,
  ...GHOST,
  ...PALACE,
  ...BIOMETRICS,
  ...DECAY,
  ...DREAM,
  ...PHANTOM,
  ...MUSIC,
];

/**
 * Ids already unlocked by the achievement / effects / widgets / PWA
 * code but missing from the base catalogue (unlocks of unknown ids are
 * silent no-ops, so these never fired before).
 */
export const SUPPLEMENT_ACHIEVEMENTS: Achievement[] = [
  def({
    id: 'first-note',
    title: 'First Scroll',
    description: 'Wrote your first note in the Notes Archive.',
    category: 'study',
    icon: '📜',
    xpReward: 50,
    rarity: 'common',
    conditionId: 'notes.created>=1',
  }),
  def({
    id: 'shortcut-master',
    title: 'Shortcut Master',
    description: 'Used every global shortcut: Ctrl+K, Ctrl+1/2/3 and Ctrl+Alt+W (next / previous background).',
    category: 'exploration',
    icon: '⌨️',
    xpReward: 100,
    rarity: 'uncommon',
    conditionId: 'shortcuts.allGlobalUsed',
  }),
  def({
    id: 'target-crushed',
    title: 'Target Crushed',
    description: "Hit your daily goal on the desktop Daily goal widget.",
    category: 'study',
    icon: '🎯',
    xpReward: 100,
    rarity: 'uncommon',
    conditionId: 'widgets.dailyTargetMet',
  }),
  def({
    id: 'trophy-room',
    title: 'Trophy Room',
    description: 'Opened the achievement gallery in the Stats Center.',
    category: 'exploration',
    icon: '🏺',
    xpReward: 25,
    rarity: 'common',
    conditionId: 'stats.galleryOpened',
  }),
  def({
    id: 'collector-10',
    title: 'Collector',
    description: 'Unlocked 10 achievements.',
    category: 'special',
    icon: '🎖️',
    xpReward: 150,
    rarity: 'uncommon',
    conditionId: 'achievements.unlocked>=10',
  }),
  def({
    id: 'collector-25',
    title: 'Hall of Fame',
    description: 'Unlocked 25 achievements.',
    category: 'special',
    icon: '🏅',
    xpReward: 400,
    rarity: 'epic',
    conditionId: 'achievements.unlocked>=25',
  }),
  def({
    id: 'pwa-installed',
    title: 'Native Warrior',
    description: 'Installed Warrior OS as an app and launched it standalone.',
    category: 'exploration',
    icon: '📲',
    xpReward: 150,
    rarity: 'rare',
    conditionId: 'pwa.standalone',
  }),
];

/** Retitles of older entries whose titles collide with Phase 6 ones (or each other). */
export const LEGACY_ACHIEVEMENT_OVERRIDES: Achievement[] = [
  // 'Rising Warrior' stays with level-5 (the XP ladder); the 3-day streak gets its own name.
  def({
    id: 'streak-3',
    title: 'Kindled Forge',
    description: 'Maintain a 3-day streak',
    category: 'streak',
    icon: '🌟',
    xpReward: 75,
    rarity: 'common',
  }),
  def({
    id: 'biometrics-first-read',
    title: 'First Reading',
    description: 'The OS read your mental state from your typing for the first time.',
    category: 'exploration',
    icon: '🧠',
    xpReward: 50,
    rarity: 'common',
  }),
  def({
    id: 'biometrics-in-the-zone',
    title: 'Laser Focus',
    description: 'Reached 90%+ focus while typing.',
    category: 'special',
    icon: '🔭',
    xpReward: 150,
    rarity: 'rare',
  }),
  def({
    id: 'phantom-first-ghost',
    title: 'Ghost in the Machine',
    description: 'Watched a phantom of a closed window drift across your desktop for the first time.',
    category: 'exploration',
    icon: '🌫️',
    xpReward: 50,
    rarity: 'common',
  }),
];

/**
 * Base catalogue + Phase 6 + supplements. Same-id entries are replaced
 * in place (keeps base order), new ids are appended in order. The
 * 'warrior-complete' badge is kept last so it reads as the capstone.
 */
export function withPhase6Achievements(base: readonly Achievement[]): Achievement[] {
  const additions = [...PHASE6_ACHIEVEMENTS, ...SUPPLEMENT_ACHIEVEMENTS, ...LEGACY_ACHIEVEMENT_OVERRIDES];
  const byId = new Map(additions.map((a) => [a.id, a] as const));
  const seen = new Set<string>();
  const merged: Achievement[] = [];
  for (const a of base) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    merged.push(byId.get(a.id) ?? a);
  }
  for (const a of additions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    merged.push(a);
  }
  const capstone = merged.findIndex((a) => a.id === 'warrior-complete');
  if (capstone >= 0) merged.push(...merged.splice(capstone, 1));
  return merged;
}
