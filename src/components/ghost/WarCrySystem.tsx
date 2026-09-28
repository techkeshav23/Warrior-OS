// ═══════════════════════════════════════════════════════════
// WARRIOR OS — War Cry System
// Anonymous war cries: floating glass bubbles drift up + fade.
// Local simulation only — max 3 visible, rest queued. Composer with
// presets + custom text (max 50 chars) and a 1-per-2-min rate limit.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Send } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import type { WarCry, WarCryPreset } from '@/types/ghost';
import { generateId, cn } from '@/lib/utils';

const MAX_LEN = 50;
const BUBBLE_LIFETIME_MS = 5000;
const MAX_VISIBLE = 3;

const PRESETS: WarCryPreset[] = [
  { label: "LET'S GO! 🔥", message: "LET'S GO! 🔥" },
  { label: 'Never give up! ⚔️', message: 'Never give up! ⚔️' },
  { label: 'OS done! 📚', message: 'OS done! 📚' },
  { label: 'Grinding hard 💪', message: 'Grinding hard 💪' },
  { label: 'Focus mode 🎯', message: 'Focus mode 🎯' },
];

// ─────────────────────────────────────────────────────────────
// Composer (embedded in leaderboard / campfire)
// ─────────────────────────────────────────────────────────────

export function WarCryComposer({ compact = false }: { compact?: boolean }) {
  const addWarCry = useGhostStore((s) => s.addWarCry);
  const canSend = useGhostStore((s) => s.canSendWarCry());
  const selfId = useGhostStore((s) => s.selfId);
  const cooldownFn = useGhostStore((s) => s.getWarCryCooldownRemaining);

  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(cooldownFn());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownFn]);

  const disabled = !canSend || remaining > 0;

  const send = (message: string) => {
    const trimmed = message.trim().slice(0, MAX_LEN);
    if (!trimmed || disabled) return;
    const cry: WarCry = {
      id: generateId('cry'),
      message: trimmed,
      timestamp: new Date().toISOString(),
      anonymousId: selfId ?? 'Warrior#0000',
      isSelf: true,
    };
    addWarCry(cry);
    setText('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Megaphone size={13} className="text-accent-secondary" />
        <span className="text-[11px] font-medium text-text-secondary">Send a war cry</span>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              disabled={disabled}
              onClick={() => send(p.message)}
              className={cn(
                'rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-text-primary transition-all',
                disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-accent-secondary/50 hover:bg-accent-secondary/10'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {compact && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.slice(0, 3).map((p) => (
            <button
              key={p.label}
              disabled={disabled}
              onClick={() => send(p.message)}
              className={cn(
                'rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-text-primary transition-all',
                disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-accent-secondary/50 hover:bg-accent-secondary/10'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          maxLength={MAX_LEN}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(text)}
          placeholder={disabled ? 'Cooling down…' : 'Custom war cry…'}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus-ring disabled:opacity-40"
        />
        <button
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

      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <span>{text.length}/{MAX_LEN}</span>
        {remaining > 0 && <span>Next in {Math.ceil(remaining / 1000)}s</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating bubbles overlay (desktop-wide)
// ─────────────────────────────────────────────────────────────

interface Bubble extends WarCry {
  x: number; // vw offset
}

function WarCryBubblesInner() {
  const warCries = useGhostStore((s) => s.warCries);
  const dismissWarCry = useGhostStore((s) => s.dismissWarCry);

  // Visible = most recent up to MAX_VISIBLE.
  const visible = useMemo<Bubble[]>(() => {
    return warCries.slice(0, MAX_VISIBLE).map((c, i) => ({
      ...c,
      x: 12 + i * 26, // spread horizontally so they don't overlap
    }));
  }, [warCries]);

  // Auto-dismiss each bubble after its lifetime.
  useEffect(() => {
    if (visible.length === 0) return;
    const timers = visible.map((b) => {
      const age = Date.now() - new Date(b.timestamp).getTime();
      const remaining = Math.max(0, BUBBLE_LIFETIME_MS - age);
      return setTimeout(() => dismissWarCry(b.id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [visible, dismissWarCry]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 top-0 overflow-hidden"
      style={{ zIndex: 'var(--z-notification)' }}
      aria-hidden
    >
      <AnimatePresence>
        {visible.map((b) => (
          <motion.div
            key={b.id}
            className="absolute"
            style={{ left: `${b.x}vw`, bottom: '18%' }}
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: BUBBLE_LIFETIME_MS / 1000, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
          >
            <div
              className={cn(
                'glass-dark glass-border max-w-[240px] rounded-2xl px-3.5 py-2 shadow-xl',
                b.isSelf ? 'border-accent-primary/40 glass-glow' : 'border-accent-secondary/30'
              )}
            >
              <p className="text-[10px] font-mono text-text-muted">{b.anonymousId}</p>
              <p className="text-sm text-text-primary text-glow-sm">{b.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const WarCryBubbles = memo(WarCryBubblesInner);

/** Default export retained for convenience: the full desktop overlay. */
export const WarCrySystem = WarCryBubbles;
