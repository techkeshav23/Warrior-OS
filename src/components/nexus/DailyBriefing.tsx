// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Daily Briefing (owner only)
// Mounted once in the desktop phase (NexusLayer). Once per briefing
// day it runs the morning briefing (first desktop session before
// 20:00, titled by time of day) and the evening debrief (first check
// at or after 20:00). Waits ~4 s after the desktop appears, and while
// the tab is hidden, a forced break, a celebration cinematic or the
// tour is on screen. JARVIS writes it when the server has a model;
// otherwise (or on any error) the local template does. Shown as a
// forged HUD plate top-center: Speak, Open in NEXUS, Dismiss (X/Esc).
// Settings → NEXUS "Brief me now" dispatches BRIEFING_NOW_EVENT.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, MessageSquareText, MoonStar, Sunrise, Volume2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';
import { getVisitorMode } from '@/lib/visitor';
import { isJarvisAvailable, runJarvis } from '@/lib/jarvis/client';
import { isSpeaking, speakNexus, stopSpeaking } from '@/lib/nexus/speech';

import { openOrFocusApp } from '@/lib/nexus/windows';
import {
  BRIEFING_NOW_EVENT,
  briefingKindForNow,
  briefingTitle,
  buildJarvisBriefingPrompt,
  buildLocalBriefing,
  dueBriefing,
  markBriefingRun,
  type BriefingKind,
} from '@/lib/nexus/briefing';
import { useNexusStore } from '@/stores/useNexusStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useTourStore } from '@/stores/useTourStore';
import { useEffectsStore } from '@/components/effects/useEffectsStore';
import { NexusMarkdown } from './NexusMarkdown';

/** A briefing is read out in full (the cloud voice takes up to ~1200 characters). */
const BRIEFING_SPEECH_CHARS = 1100;

/** Let the desktop settle (first toasts, sync pull) before briefing. */
const START_DELAY_MS = 4000;
const CHECK_INTERVAL_MS = 15_000;

type View =
  | { status: 'loading'; kind: BriefingKind; title: string }
  | {
      status: 'ready';
      kind: BriefingKind;
      title: string;
      text: string;
      spoken: string;
      source: 'ai' | 'local';
    };

interface Produced {
  text: string;
  spoken: string;
  source: 'ai' | 'local';
}

async function produceBriefing(kind: BriefingKind): Promise<Produced> {
  try {
    if (await isJarvisAvailable()) {
      const turn = await runJarvis(buildJarvisBriefingPrompt(kind), []);
      if (turn.reply && !turn.error) return { text: turn.reply, spoken: turn.reply, source: 'ai' };
    }
  } catch {
    // fall through to the local template
  }
  const local = await buildLocalBriefing(kind);
  return { text: local.markdown, spoken: local.spoken, source: 'local' };
}

/** Nothing full-screen or blocking is showing, and the tab is visible. */
function canBriefNow(): boolean {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
  if (useDecayStore.getState().isOnBreak) return false;
  if (useEffectsStore.getState().current) return false;
  if (useTourStore.getState().active) return false;
  return true;
}

function DailyBriefingInner() {
  const [view, setView] = useState<View | null>(null);
  const reduce = useReducedMotion();
  const runId = useRef(0);
  const busy = useRef(false);
  const spoke = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const start = useCallback((kind: BriefingKind) => {
    const id = ++runId.current;
    busy.current = true;
    spoke.current = false;
    setView({ status: 'loading', kind, title: briefingTitle(kind, Date.now()) });
    void produceBriefing(kind)
      .then((result) => {
        if (runId.current !== id) return; // dismissed or replaced meanwhile
        setView({ status: 'ready', kind, title: briefingTitle(kind, Date.now()), ...result });
        // Auto-speak for owners who hear NEXUS replies (speakNexus checks the preference).
        try {
          if (useNexusStore.getState().voiceReplies) spoke.current = speakNexus(result.spoken, { maxChars: BRIEFING_SPEECH_CHARS });
        } catch {
          /* speech unavailable or blocked: the card still shows */
        }
      })
      .catch(() => {
        if (runId.current === id) setView(null);
      })
      .finally(() => {
        if (runId.current === id) busy.current = false;
      });
  }, []);

  const dismiss = useCallback(() => {
    runId.current += 1;
    busy.current = false;
    if (spoke.current && isSpeaking()) stopSpeaking();
    spoke.current = false;
    setView(null);
  }, []);

  // ── Daily scheduler ──
  useEffect(() => {
    if (getVisitorMode() !== 'owner') return;
    const mountedAt = Date.now();
    const check = () => {
      try {
        const now = Date.now();
        if (now - mountedAt < START_DELAY_MS || busy.current || getVisitorMode() !== 'owner') return;
        if (!canBriefNow()) return;
        const kind = dueBriefing(now);
        if (!kind) return;
        // Claim the slot first, so another tab or device does not repeat it.
        markBriefingRun(kind, now);
        start(kind);
      } catch {
        /* never let the briefing disturb the desktop */
      }
    };
    const first = window.setTimeout(check, START_DELAY_MS + 50);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [start]);

  // ── "Brief me now" (Settings → NEXUS) ──
  useEffect(() => {
    const onNow = () => {
      if (getVisitorMode() !== 'owner') return;
      const now = Date.now();
      const kind = briefingKindForNow(now);
      try {
        markBriefingRun(kind, now);
      } catch {
        /* ignore */
      }
      start(kind);
    };
    window.addEventListener(BRIEFING_NOW_EVENT, onNow);
    return () => window.removeEventListener(BRIEFING_NOW_EVENT, onNow);
  }, [start]);

  // ── Esc closes the card (when nothing else has claimed the key) ──
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const active = document.activeElement;
      const insideCard = !!active && !!cardRef.current?.contains(active);
      const nothingFocused = !active || active === document.body;
      if (insideCard || nothingFocused) dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, dismiss]);

  const speak = useCallback(() => {
    if (view?.status !== 'ready') return;
    try {
      spoke.current = speakNexus(view.spoken, { force: true, maxChars: BRIEFING_SPEECH_CHARS });
    } catch {
      /* ignore */
    }
  }, [view]);

  const openInNexus = useCallback(() => {
    if (view?.status !== 'ready') return;
    try {
      const nexus = useNexusStore.getState();
      const id = nexus.ensureConversation();
      nexus.appendMessage(id, {
        role: 'nexus',
        content: `**${view.title}**\n\n${view.text}`,
        source: view.source,
      });
      openOrFocusApp('nexus-ai');
    } catch {
      /* the card stays; nothing else to do */
      return;
    }
    runId.current += 1;
    setView(null);
  }, [view]);

  const Icon = view?.kind === 'evening' ? MoonStar : Sunrise;
  const heading = view?.kind === 'evening' ? 'Evening debrief' : (view?.title ?? '');

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-16 flex justify-center px-3"
      style={{ zIndex: 'calc(var(--z-taskbar) + 1)' }}
    >
      <AnimatePresence>
        {view && (
          <motion.section
            key="briefing"
            ref={cardRef}
            role="region"
            aria-label={heading}
            aria-busy={view.status === 'loading'}
            data-daily-briefing={view.status}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="armor-drop pointer-events-auto w-full max-w-[32rem]"
          >
            <div className="armor-popover chamfer-md rivets flex max-h-[min(62vh,34rem)] flex-col [--rivet-inset:7px]">
              {/* Header */}
              <header className="flex items-center gap-3 border-b border-line px-4 pb-2.5 pt-3">
                <span className="flex size-7 shrink-0 items-center justify-center text-plasma-400">
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="engraved truncate font-display text-sm uppercase tracking-[0.18em] text-fg" title={heading}>
                    {heading}
                  </h2>
                  <p className="hud-label mt-0.5">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {view.status === 'ready' ? ` · ${view.source === 'ai' ? 'JARVIS' : 'NEXUS'}` : ''}
                  </p>
                </div>
                <IconButton icon={X} aria-label="Dismiss briefing" size="sm" onClick={dismiss} tooltip shortcut="Esc" />
              </header>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {view.status === 'loading' ? (
                  <div className="flex items-center gap-2.5 py-3 text-sm text-fg-muted" role="status">
                    <Loader2 size={16} strokeWidth={1.75} className="shrink-0 text-plasma-400 motion-safe:animate-spin" aria-hidden />
                    NEXUS is preparing your briefing…
                  </div>
                ) : (
                  <NexusMarkdown text={view.text} className="text-fg-muted leading-relaxed" />
                )}
              </div>

              {/* Actions */}
              {view.status === 'ready' && (
                <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 pb-3 pt-2.5">
                  <Button size="sm" variant="ghost" leadingIcon={Volume2} onClick={speak}>
                    Speak
                  </Button>
                  <Button size="sm" variant="primary" leadingIcon={MessageSquareText} onClick={openInNexus}>
                    Open in NEXUS
                  </Button>
                </footer>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export const DailyBriefing = memo(DailyBriefingInner);
