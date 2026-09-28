// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Suggestions
// Proactive nudge engine (time of day, streak risk, last activity,
// open apps, continuous study, typing biometrics — tasks 4.4 + 6.62)
// plus THE single 'warrior:nexus-say' listener other features use to
// make NEXUS speak. Everything is delivered through the OS
// notification API (toast + Dynamic Island unread count) and kept
// in the NEXUS nudge feed shown inside AI Assist.
// Rules: at most one suggestion every 10 minutes, never the same one
// twice in a row, silent during forced breaks or hidden tabs.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useDecayStore } from '@/stores/useDecayStore';
import {
  clearPendingWarriorEvent,
  LEGACY_NEXUS_EVENT,
  parseNexusSayDetail,
  takePendingWarriorEvent,
  WARRIOR_EVENTS,
} from '@/lib/nexus/events';
import {
  collectSuggestionSnapshot,
  NEXUS_SUGGESTION_COOLDOWN_MS,
  pickSuggestion,
  type SuggestionRuntime,
} from '@/lib/nexus/suggestions';
import { playNexusChime } from '@/lib/nexus/chime';
import type { NotificationType } from '@/types/notification';
import type { NexusActionButton, NexusTone } from '@/types/nexus';

/** First check shortly after the desktop appears, then once a minute. */
const FIRST_CHECK_MS = 90_000;
const CHECK_INTERVAL_MS = 60_000;
const DUPLICATE_WINDOW_MS = 4000;

const TONE_TO_NOTIFICATION: Record<NexusTone, NotificationType> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
};

const lastDelivered = { text: '', at: 0 };

/**
 * Show a NEXUS message through the notification system (toast +
 * Dynamic Island count) and record it in the nudge feed.
 */
export function deliverNexusMessage(
  text: string,
  tone: NexusTone,
  options: { source: 'suggestion' | 'event'; ruleId?: string; action?: NexusActionButton }
): void {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!clean) return;
  const now = Date.now();
  // The same line arriving twice (pending + live, or double dispatch) shows once.
  if (clean === lastDelivered.text && now - lastDelivered.at < DUPLICATE_WINDOW_MS) return;
  lastDelivered.text = clean;
  lastDelivered.at = now;

  useNotificationStore.getState().addNotification({
    type: TONE_TO_NOTIFICATION[tone],
    title: 'NEXUS',
    message: clean,
    icon: '🧠',
    autoDismiss: 8000,
  });
  useNexusStore.getState().pushNudge({
    ruleId: options.ruleId ?? 'event',
    text: clean,
    tone,
    at: now,
    source: options.source,
    ...(options.action ? { action: options.action } : {}),
  });
}

function NexusSuggestionsInner() {
  // ── 'warrior:nexus-say' (+ legacy 'warrior:nexus') listener ──
  useEffect(() => {
    const handleSay = (raw: unknown) => {
      const detail = parseNexusSayDetail(raw);
      if (detail) deliverNexusMessage(detail.text, detail.tone ?? 'info', { source: 'event' });
    };

    // Messages sent before the desktop mounted (dream, lock, boot...).
    const pending = takePendingWarriorEvent(WARRIOR_EVENTS.nexusSay);
    if (pending) handleSay(pending);

    const onSay = (event: Event) => {
      clearPendingWarriorEvent(WARRIOR_EVENTS.nexusSay);
      handleSay((event as CustomEvent<unknown>).detail);
    };
    const onLegacy = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (detail && typeof detail === 'object') {
        const message = (detail as { message?: unknown }).message;
        if (typeof message === 'string') deliverNexusMessage(message, 'success', { source: 'event' });
      }
    };

    window.addEventListener(WARRIOR_EVENTS.nexusSay, onSay);
    window.addEventListener(LEGACY_NEXUS_EVENT, onLegacy);
    return () => {
      window.removeEventListener(WARRIOR_EVENTS.nexusSay, onSay);
      window.removeEventListener(LEGACY_NEXUS_EVENT, onLegacy);
    };
  }, []);

  // ── Proactive suggestion loop ──
  useEffect(() => {
    const runtime: SuggestionRuntime = { sessionStart: Date.now(), emptySince: null };

    const evaluate = () => {
      const now = Date.now();
      const windowCount = useWindowStore.getState().windows.length;
      runtime.emptySince = windowCount === 0 ? (runtime.emptySince ?? now) : null;

      const nexus = useNexusStore.getState();
      if (!nexus.suggestionsEnabled) return;
      if (document.visibilityState === 'hidden') return;
      if (useDecayStore.getState().isOnBreak) return;
      if (nexus.lastSuggestionAt !== null && now - nexus.lastSuggestionAt < NEXUS_SUGGESTION_COOLDOWN_MS) return;

      const snapshot = collectSuggestionSnapshot(now, runtime);
      const pick = pickSuggestion(snapshot, {
        lastId: nexus.lastSuggestionId,
        ruleLastFired: nexus.ruleLastFired,
      });
      if (!pick) return;

      nexus.recordSuggestion(pick.id, now);
      playNexusChime('nudge');
      deliverNexusMessage(pick.text, pick.tone, { source: 'suggestion', ruleId: pick.id, action: pick.action });
    };

    const firstCheck = window.setTimeout(evaluate, FIRST_CHECK_MS);
    const interval = window.setInterval(evaluate, CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

export const NexusSuggestions = memo(NexusSuggestionsInner);
