// ═══════════════════════════════════════════════════════════
// WARRIOR OS — War Cry System
// Anonymous war cries. The composer (in the leaderboard + campfire)
// offers preset chips and custom text (max 50 chars) with an ember Send
// button, rate-limited to one per 2 minutes (the counter turns into a
// cooldown). Cries float up as glass popover bubbles on every online
// warrior's desktop (realtime mode) and fade within 5 s; max 3 are
// visible at once, the rest queue. In local (offline) mode a cry
// reaches this browser's other open tabs only — and the UI says so;
// simulated warriors also send the odd (SIM-tagged) cry.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleCheck, Megaphone, Send, TriangleAlert } from 'lucide-react';
import { Badge, Chip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
            text:
              result.scope === 'global'
                ? 'Sent to every warrior online.'
                : result.scope === 'tabs'
                  ? 'Offline mode: shown on your open Warrior OS tabs.'
                  : 'Offline mode: only this desktop shows it.',
          });
        } else {
          setStatus({ tone: 'error', text: result.message });
        }
      })
      .finally(() => setSending(false));
  };

  const presets = compact ? WARCRY_PRESETS.slice(0, 3) : WARCRY_PRESETS;
  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-fg-muted">
          <Megaphone size={14} strokeWidth={1.75} className="shrink-0 text-ember-400" aria-hidden />
          <span className="truncate">{compact ? 'Anonymous war cry' : 'Send an anonymous war cry'}</span>
        </span>
        <span className="shrink-0 font-mono text-2xs text-fg-subtle tabular" aria-live="polite">
          {cooling ? `Next in ${Math.ceil(remaining / 1000)}s` : `${text.length}/${WARCRY_MAX_LENGTH}`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Chip key={p.label} size="sm" disabled={disabled} onClick={() => send(p.message)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          size="sm"
          wrapperClassName="min-w-0 flex-1"
          type="text"
          value={text}
          maxLength={WARCRY_MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(text);
          }}
          placeholder={offline ? 'Connecting…' : cooling ? 'Cooling down…' : 'Custom war cry…'}
          aria-label="Custom war cry"
        />
        <Button
          variant="ember"
          size="sm"
          leadingIcon={Send}
          loading={sending}
          disabled={!canSend}
          onClick={() => send(text)}
          aria-label="Send war cry"
        >
          Send
        </Button>
      </div>

      {status && (
        <p
          role="status"
          className={cn(
            'flex items-start gap-1.5 text-xs',
            status.tone === 'ok' ? 'text-success' : 'text-warning'
          )}
        >
          {status.tone === 'ok' ? (
            <CircleCheck size={14} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />
          ) : (
            <TriangleAlert size={14} strokeWidth={1.75} className="mt-px shrink-0" aria-hidden />
          )}
          <span className="min-w-0">{status.text}</span>
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
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: [0, 1, 1, 0], y: -140, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
              transition={{
                opacity: { duration: BUBBLE_LIFETIME_MS / 1000, times: [0, 0.08, 0.78, 1], ease: 'linear' },
                y: { duration: BUBBLE_LIFETIME_MS / 1000, ease: [0.22, 0.61, 0.36, 1] },
                scale: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
              }}
            >
              <div
                className={cn(
                  'glass-popover max-w-[260px] rounded-card px-3 py-2',
                  cry.isSelf && 'border-accent/45 shadow-glow'
                )}
              >
                <p className="flex items-center gap-1.5 font-mono text-2xs text-fg-subtle">
                  <Megaphone
                    size={12}
                    strokeWidth={1.75}
                    aria-hidden
                    className={cry.isSelf ? 'text-accent' : 'text-ember-400'}
                  />
                  <span className="truncate">{cry.anonymousId}</span>
                  {cry.isSelf && <span className="text-accent">you</span>}
                </p>
                <p className="mt-0.5 break-words text-sm font-medium text-fg">{cry.message}</p>
                {cry.isSimulated ? (
                  <Badge tone="warning" size="sm" className="mt-1.5">
                    Sim · simulated warrior
                  </Badge>
                ) : (
                  cry.isLocalOnly && (
                    <Badge tone="warning" size="sm" className="mt-1.5">
                      Offline · local tabs only
                    </Badge>
                  )
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
