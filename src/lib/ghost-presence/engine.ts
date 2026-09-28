// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: engine
// Chooses the data source (Firebase RTDB when configured, else the
// labelled simulation), keeps the ghost store in sync, refreshes the
// local warrior's own stats every minute (no network write), counts
// minutes spent with other real warriors and unlocks the Ghost Warrior
// achievements — presence-based ones only with real (realtime) data.
// ═══════════════════════════════════════════════════════════

import { useGhostStore } from '@/stores/useGhostStore';
import type { GhostWarrior } from '@/types/ghost';
import { onAchievementsSeeded, unlockPhase6Achievement } from '@/components/creature/osBridge';
import { isRealtimePresenceConfigured } from './config';
import { getSessionWarriorId } from './identity';
import { computeSelfStats } from './selfStats';
import { connectRealtimePresence } from './realtime';
import { startSimulation } from './simulation';
import { setGhostTransport, type GhostTransport } from './transport';

export const GHOST_ACHIEVEMENT_IDS = {
  notAlone: 'ghost-not-alone',
  firstCry: 'ghost-first-cry',
  campfire: 'ghost-campfire-bonfire',
  topWarrior: 'ghost-top-warrior',
  bandOfBrothers: 'ghost-band-of-brothers',
} as const;

/** 50 hours online alongside other warriors. */
export const BAND_OF_BROTHERS_MINUTES = 50 * 60;
/** "Campfire Stories": 10+ warriors online at once. */
export const CAMPFIRE_STORIES_ONLINE = 10;

/** Lifetime-counter achievements (valid in any mode — counters only grow in realtime). */
export function reconcileGhostAchievements(): void {
  const { lifetime } = useGhostStore.getState();
  if (lifetime.warCriesSent >= 1) unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.firstCry);
  if (lifetime.minutesWithOthers >= BAND_OF_BROTHERS_MINUTES) {
    unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.bandOfBrothers);
  }
  if (lifetime.maxOnlineSeen >= 2) unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.notAlone);
  if (lifetime.maxOnlineSeen >= CAMPFIRE_STORIES_ONLINE) unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.campfire);
}

/** Achievements that depend on live presence — real warriors only. */
function evaluateLiveAchievements(): void {
  const s = useGhostStore.getState();
  if (s.mode !== 'realtime') return;
  const online = s.getOnlineCount();
  const others = s.getOthersOnlineCount();
  s.noteOnlineCount(online);
  if (others >= 1) unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.notAlone);
  if (online >= CAMPFIRE_STORIES_ONLINE) unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.campfire);
  const self = s.getSelf();
  if (others >= 1 && self && self.studyHoursToday > 0 && s.getSelfRank() === 1) {
    unlockPhase6Achievement(GHOST_ACHIEVEMENT_IDS.topWarrior);
  }
  reconcileGhostAchievements();
}

/**
 * Start presence for this session. Returns a stop function (removes our
 * presence row in realtime mode). Browser only.
 */
export function startGhostPresence(): () => void {
  const store = () => useGhostStore.getState();
  const selfId = getSessionWarriorId();
  store().setSelfId(selfId);

  let stopped = false;
  let transport: GhostTransport | null = null;
  let remote: GhostWarrior[] = [];

  // Merge the transport's list with fresh local stats for ourselves.
  const publish = () => {
    if (stopped) return;
    const stats = computeSelfStats();
    const list = remote.map((w) => (w.anonymousId === selfId ? { ...w, ...stats, isSelf: true, isOnline: true } : w));
    if (!list.some((w) => w.anonymousId === selfId)) {
      list.unshift({
        anonymousId: selfId,
        ...stats,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        isSelf: true,
      });
    }
    store().updatePresence(list);
    evaluateLiveAchievements();
  };

  const onWarriors = (warriors: GhostWarrior[]) => {
    remote = warriors;
    publish();
  };

  const startSim = (reason: string | null) => {
    if (stopped) return;
    store().setMode('simulated', reason);
    transport = startSimulation({ selfId, onWarriors, onWarCry: (cry) => store().addWarCry(cry) });
    setGhostTransport(transport);
  };

  if (isRealtimePresenceConfigured()) {
    store().setMode('connecting', null);
    connectRealtimePresence({
      selfId,
      getSelfStats: computeSelfStats,
      onWarriors,
      onWarCry: (cry) => store().addWarCry(cry),
      onStatus: (connected, error) => {
        if (stopped) return;
        store().setMode(connected ? 'realtime' : 'connecting', error);
        if (connected) evaluateLiveAchievements();
      },
    })
      .then((t) => {
        if (stopped) {
          t.stop();
          return;
        }
        transport = t;
        setGhostTransport(t);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'unknown error';
        startSim(`Firebase Realtime Database unreachable (${msg}).`);
      });
  } else {
    startSim(null);
  }

  // Local refresh + lifetime counters (no network writes here).
  const ticker = setInterval(() => {
    publish();
    const s = store();
    if (s.mode === 'realtime' && document.visibilityState === 'visible' && s.getOthersOnlineCount() > 0) {
      s.addMinutesWithOthers(1);
    }
    reconcileGhostAchievements();
  }, 60_000);

  reconcileGhostAchievements();
  const unsubSeed = onAchievementsSeeded(evaluateLiveAchievements);

  return () => {
    stopped = true;
    clearInterval(ticker);
    unsubSeed();
    transport?.stop();
    transport = null;
    setGhostTransport(null);
    store().setMode('disabled', null);
    store().reset();
  };
}
