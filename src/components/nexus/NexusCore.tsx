// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Core
//
// The brain. Single entry point that takes a user message, decides
// whether it's a deterministic command or a chat-with-AI request, and
// executes accordingly. Returns the reply text the UI should render.
//
// Used by: NexusChat (full AI Assist window), CommandPalette (Ctrl+K),
// future: voice input, Dynamic Island prompts.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useXPStore } from '@/stores/useXPStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { parseLocalIntent, type LocalIntent } from '@/lib/nexus-intent';
import type { NexusContext } from '@/types/nexus';

interface ChatTurn {
  role: 'user' | 'nexus';
  content: string;
}

interface NexusReply {
  /** Human-readable reply text to show in chat */
  reply: string;
  /** Source: deterministic local handling or AI roundtrip */
  source: 'local' | 'ai' | 'error';
  /** Intent that fired locally, if any */
  intent?: LocalIntent;
}

/**
 * Public hook: returns an `ask(message)` function that returns a NexusReply.
 * The hook also handles side-effects (opening apps, switching workspaces).
 */
export function useNexusCore() {
  const launchApp = useAppStore((s) => s.launchApp);
  const registeredApps = useAppStore((s) => s.registeredApps);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const setWallpaper = useSettingsStore((s) => s.setWallpaper);
  const clearHistory = useNexusStore((s) => s.clearHistory);

  const ask = useCallback(
    async (message: string, history: ChatTurn[] = []): Promise<NexusReply> => {
      const trimmed = message.trim();
      if (!trimmed) return { reply: 'Kuch likh to sahi.', source: 'local' };

      // ── Step 1: try deterministic local intent ──
      const intent = parseLocalIntent(trimmed);

      if (intent.type === 'open_app') {
        launchApp(intent.appId, activeWorkspaceId);
        return {
          reply: `${intent.appName} khol diya.`,
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'switch_workspace') {
        switchWorkspace(intent.workspaceId);
        return {
          reply: `${intent.workspaceId} workspace pe aa gaye.`,
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'study_mode') {
        switchWorkspace('study');
        setWallpaper('void');                // calm dark wallpaper for focus
        launchApp('gate-prep', 'study');
        launchApp('notes', 'study');
        return {
          reply: 'Study mode active. GATE Arena + Notes open. Distractions off. Padh le.',
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'chill_mode') {
        switchWorkspace('chill');
        setWallpaper('aurora');
        launchApp('music-player', 'chill');
        return {
          reply: 'Chill mode. Aurora wallpaper, music on. Saans le, fir wapas.',
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'start_quiz') {
        launchApp('gate-prep', activeWorkspaceId);
        return {
          reply: intent.subject
            ? `GATE Arena khol diya. ${intent.subject} subject select kar, quiz start.`
            : 'GATE Arena open. Subject choose kar.',
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'show_stats') {
        launchApp('warrior-profile', activeWorkspaceId);
        const xp = useXPStore.getState().xp;
        const level = useXPStore.getState().level;
        const attempts = useQuizHistoryStore.getState().attempts.length;
        return {
          reply: `Lvl ${level}, ${xp} XP, ${attempts} quiz attempts. Stats Center khul gaya — detail wahaan.`,
          source: 'local',
          intent,
        };
      }

      if (intent.type === 'clear_chat') {
        clearHistory();
        return { reply: 'Chat saaf.', source: 'local', intent };
      }

      // ── Step 2: hand off to Gemini ──
      try {
        const context = snapshotContext({
          openApps: useAppStore.getState().runningAppIds,
          currentWorkspace: activeWorkspaceId,
          userLevel: useXPStore.getState().level,
        });

        const resp = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history,
            context,
          }),
        });
        const data: { reply?: string; error?: string } = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return {
            reply: data.reply ?? 'NEXUS reach nahi ho raha. Network check kar.',
            source: 'error',
          };
        }
        return { reply: data.reply ?? 'NEXUS chup ho gaya.', source: 'ai' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        return { reply: `NEXUS down: ${msg}`, source: 'error' };
      }
    },
    [launchApp, activeWorkspaceId, switchWorkspace, setWallpaper, clearHistory]
  );

  // Expose registered apps for any UI that wants to list capabilities.
  return { ask, registeredApps };
}

/**
 * Compose a context snapshot from live stores. Pure function so it's easy
 * to unit-test later.
 */
function snapshotContext(overrides: Partial<NexusContext>): NexusContext {
  const now = new Date();
  const h = now.getHours();
  let timeOfDay: NexusContext['timeOfDay'] = 'morning';
  if (h >= 12 && h < 17) timeOfDay = 'afternoon';
  else if (h >= 17 && h < 21) timeOfDay = 'evening';
  else if (h >= 21 || h < 1) timeOfDay = 'night';
  else if (h >= 1 && h < 5) timeOfDay = 'late-night';

  return {
    openApps: [],
    currentWorkspace: 'study',
    timeOfDay,
    userLevel: 1,
    currentStreak: 0,
    idleMinutes: 0,
    studyHoursToday: 0,
    ...overrides,
  };
}
