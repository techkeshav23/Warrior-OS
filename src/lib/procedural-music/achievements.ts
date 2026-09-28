// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Achievements
// Checked when a mode starts playing and on every listening tick.
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { useMusicGenStore, type ListenSeconds, type MusicMood } from '@/stores/useMusicGenStore';

export const MUSIC_ACHIEVEMENTS = {
  /** All four moods composed at least once. */
  osComposer: 'os-composer',
  /** All four moods on the same day (spec "Full Orchestra"). */
  fullOrchestra: 'music-full-orchestra',
  /** 10 hours of procedural music in total (spec "The Composer"). */
  composer: 'music-composer',
  /** 5 hours in Typing Rhythm mode (spec "Rhythm Master"). */
  rhythmMaster: 'music-rhythm-master',
  /** Night ambient playing past midnight (spec "Night Music"). */
  nightMusic: 'music-night-music',
} as const;

export const COMPOSER_SECONDS = 10 * 60 * 60;
export const RHYTHM_MASTER_SECONDS = 5 * 60 * 60;
/** "Past midnight" = 00:00–04:59 local time. */
export const NIGHT_MUSIC_LAST_HOUR = 4;

function unlockOnce(id: string): void {
  const xp = useXPStore.getState();
  const existing = xp.achievements.find((a) => a.id === id);
  if (existing?.unlockedAt) return;
  xp.unlockAchievement(id);
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A mode just started playing. */
export function onMusicModeUsed(mood: MusicMood, now: number): void {
  const { ever, today } = useMusicGenStore.getState().markModeUsed(mood, localDayKey(now));
  if (ever >= 4) unlockOnce(MUSIC_ACHIEVEMENTS.osComposer);
  if (today >= 4) unlockOnce(MUSIC_ACHIEVEMENTS.fullOrchestra);
}

/** Listening time was just credited to `mood` (totals are lifetime seconds). */
export function onMusicListenTick(mood: MusicMood, totals: ListenSeconds, now: number): void {
  const total = totals.morning + totals.study + totals.coding + totals.night;
  if (total >= COMPOSER_SECONDS) unlockOnce(MUSIC_ACHIEVEMENTS.composer);
  if (totals.coding >= RHYTHM_MASTER_SECONDS) unlockOnce(MUSIC_ACHIEVEMENTS.rhythmMaster);
  if (mood === 'night' && new Date(now).getHours() <= NIGHT_MUSIC_LAST_HOUR) {
    unlockOnce(MUSIC_ACHIEVEMENTS.nightMusic);
  }
}
