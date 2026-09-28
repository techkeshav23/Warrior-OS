// ═══════════════════════════════════════════════════════════
// WARRIOR OS — War Cry System
// Anonymous war cries. The composer (in the leaderboard + campfire)
// offers presets and custom text (max 50 chars), rate-limited to one
// per 2 minutes. Cries float up as glass bubbles on every online
// warrior's desktop (realtime mode) and fade within 5 s; max 3 are
// visible at once, the rest queue. In simulated mode a cry is shown
// only on this desktop — and the UI says so.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, Send } from 'lucide-react';
import {
  MAX_VISIBLE_WARCRIES,
  WARCRY_MAX_LENGTH,
  WARCRY_RATE_LIMIT_MS,
  useGhostStore,
} from '@/stores/useGhostStore';
import { sendWarCry } from '@/lib/ghost-presence';
import type { WarCryPreset } from '@/types/ghost';
import { cn } from '@/lib/utils';

const BUBBLE_LIFETIME_MS = 5000;

export const WARCRY_PRESETS: WarCryPreset[] = [
  { label: "LET'S GO! 🔥", message: "LET'S GO! 🔥" },
  { label: 'Never give up! ⚔️', message: 'Never give up! ⚔️' },
  { label: 'OS done! 📚', message: 'OS done! 📚' },
  { label: 'Grinding hard 💪', message: 'Grinding hard 💪' },
  { label: 'Focus mode 🎯', message: 'Focus mode 🎯' },
];

// ─────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────

export function WarCryComposer({ compact = false }: { compact?: boolean }) {
  const mode = useGhostStore((s) => s.mode);
  const lastWarCryAt = useGhostStore((s) => s.lastWarCryAt);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once per second only while cooling down.
  useEffect(() => {
    if (lastWarCryAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - lastWarCryAt >= WARCRY_RATE_LIMIT_MS) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lastWarCryAt]);

  const remaining =
    lastWarCryAt === null ? 0 : Math.min(WARCRY_RATE_LIMIT_MS, Math.max(0, WARCRY_RATE_LIMIT_MS - (now - lastWarCryAt)));
  const cooling = remaining > 0;
  const offline = mode === 'disabled' || mode === 'connecting';
  const disabled = cooling || offline || sending;

  const send = (message: string) => {
    if (disabled) return;
    setSending(true);
    sendWarCry(message)
      .then((result) => {
        if (result.ok) {
          setText('');
          setNow(Date.now());
          setStatus({
            tone: 'ok',
            text: result.broadcast
              ? 'Sent to every warrior online.'
              : 'Simulated mode: only your desktop shows it.',
          });
        } else {
          setStatus({ tone: 'error', text: result.message });
        }
      })
      .finally(() => setSending(false));
  };

  const presets = compact ? WARCRY_PRESETS.slice(0, 3) : WARCRY_PRESETS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Megaphone size={13} className="text-accent-secondary" />
        <span className="text-[11px] font-medium text-text-secondary">Send an anonymous war cry</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={disabled}
            onClick={() => send(p.message)}
            className={cn(
              'rounded-full border border-white/10 bg-white/5 text-text-primary transition-all',
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
              disabled
                ? 'cursor-not-allowed opacity-40'
                : 'hover:border-accent-secondary/50 hover:bg-accent-secondary/10'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          maxLength={WARCRY_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(text);
          }}
          placeholder={offline ? 'Connecting…' : cooling ? 'Cooling down…' : 'Custom war cry…'}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus-ring disabled:opacity-40"
          aria-label="Custom war cry"
        />
        <button
          type="button"
          disabled={disabled || !text.trim()}
          onClick={() => send(text)}
          className={cn(
            'flex items-center justify-center rounded-lg p-2 transition-all',
            disabled || !text.trim()
              ? 'cursor-not-allowed bg-white/5 text-text-muted'
              : 'bg-accent-secondary/20 text-accent-secondary hover:bg-accent-secondary/30'
          )}
          aria-label="Send war cry"
        >
          <Send size={13} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-text-secondary">
        <span>
          {text.length}/{WARCRY_MAX_LENGTH}
        </span>
        {cooling && <span>Next in {Math.ceil(remaining / 1000)}s</span>}
      </div>
      {status && (
        <p className={cn('text-[10px]', status.tone === 'ok' ? 'text-accent-success' : 'text-accent-warning')}>
          {status.text}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating bubbles overlay (desktop-wide)
// ─────────────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function WarCryBubblesInner() {
  const warCries = useGhostStore((s) => s.warCries);
  const dismissWarCry = useGhostStore((s) => s.dismissWarCry);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const visible = useMemo(() => warCries.slice(0, MAX_VISIBLE_WARCRIES), [warCries]);

  // Each bubble lives 5 s from the moment it becomes visible; queued
  // cries take the freed slots.
  useEffect(() => {
    const timers = timersRef.current;
    for (const cry of visible) {
      if (!timers.has(cry.id)) {
        timers.set(
          cry.id,
          setTimeout(() => {
            timers.delete(cry.id);
            dismissWarCry(cry.id);
          }, BUBBLE_LIFETIME_MS)
        );
      }
    }
    for (const [id, timer] of timers) {
      if (!visible.some((c) => c.id === id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
  }, [visible, dismissWarCry]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 'var(--z-notification)' }}
      aria-live="polite"
    >
      <AnimatePresence>
        {visible.map((cry) => {
          const left = 8 + (hashId(cry.id) % 62);
          return (
            <motion.div
              key={cry.id}
              className="absolute"
              style={{ left: `${left}vw`, bottom: '16%' }}
              initial={{ opacity: 0, y: 30, scale: 0.88 }}
              animate={{ opacity: [0, 1, 1, 0], y: -150, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: BUBBLE_LIFETIME_MS / 1000, ease: 'easeOut', times: [0, 0.12, 0.75, 1] }}
            >
              <div
                className={cn(
                  'glass-dark max-w-[250px] rounded-2xl border px-3.5 py-2 shadow-xl',
                  cry.isSelf ? 'border-accent-primary/40 glass-glow' : 'border-accent-secondary/30'
                )}
              >
                <p className="font-mono text-[10px] text-text-secondary">
                  {cry.isSelf ? `${cry.anonymousId} (you)` : cry.anonymousId}
                </p>
                <p className="text-sm text-text-primary text-glow-sm break-words">{cry.message}</p>
                {cry.isLocalOnly && (
                  <p className="mt-0.5 text-[9px] text-accent-warning/80">simulated mode · not broadcast</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const WarCryBubbles = memo(WarCryBubblesInner);

/** The desktop-wide overlay part of the war cry system. */
export const WarCrySystem = WarCryBubbles;
