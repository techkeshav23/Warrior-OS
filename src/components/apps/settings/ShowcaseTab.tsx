// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Showcase Tab
// The portfolio side of Settings: who is using this browser (owner or
// guest), the guided tour replay, the guest demo data, a full reset of
// this browser's Warrior OS, and the creator card.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Database, Eye, RotateCcw, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { getVisitorMode, type VisitorMode } from '@/lib/visitor';
import { cn } from '@/lib/utils';
import type { DemoSeedArea, DemoSeedReport } from '@/lib/demo-seed';
import { Modal } from '@/components/ui/Modal';
import { OwnerCard } from '@/components/showcase/OwnerCard';
import { ReplayTourButton } from '@/components/showcase/tour/ReplayTourButton';

const BUTTON = cn(
  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-ring',
  'disabled:cursor-wait disabled:opacity-60'
);
const BUTTON_ACCENT = cn(
  BUTTON,
  'border-purple-400/30 bg-purple-400/10 text-purple-200 hover:border-purple-400/50 hover:bg-purple-400/20'
);
const BUTTON_DANGER = cn(
  BUTTON,
  'border-red-400/30 bg-red-500/10 text-red-200 hover:border-red-400/50 hover:bg-red-500/20'
);
const BUTTON_GHOST = cn(BUTTON, 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white');

const SESSION_ICON_CLASS = 'w-4 h-4 mt-0.5 shrink-0 text-cyan-300';

const SESSION_COPY: Record<VisitorMode | 'unknown', { icon: ReactNode; title: string; body: string }> = {
  guest: {
    icon: <Eye className={SESSION_ICON_CLASS} aria-hidden />,
    title: 'Guest session',
    body: `You're exploring ${OWNER.shortName}'s Warrior OS as a guest. Everything you change stays in this browser.`,
  },
  owner: {
    icon: <ShieldCheck className={SESSION_ICON_CLASS} aria-hidden />,
    title: 'Owner session',
    body: 'Your data lives only in this browser. Guests on other browsers never see it.',
  },
  unknown: {
    icon: <UserRound className={SESSION_ICON_CLASS} aria-hidden />,
    title: 'Session not remembered',
    body: "This browser blocks site storage, so Warrior OS can't remember who unlocked it, or keep changes after a reload.",
  },
};

const AREA_LABEL: Record<DemoSeedArea, string> = {
  notes: 'notes',
  habits: 'habits',
  projects: 'projects',
  expenses: 'expenses',
  calendar: 'calendar events',
  learning: 'learning progress',
  progress: 'XP and achievements',
};

/** "a", "a and b", "a, b and c" */
function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function describeReport(report: DemoSeedReport): string {
  if (report.blocked === 'not-guest') return 'Demo data is only added in guest sessions.';
  if (report.seeded.length === 0) {
    return 'Nothing to add: every app already has data. Empty an app, then re-seed to refill it.';
  }
  const added = joinList(report.seeded.map((a) => AREA_LABEL[a]));
  return `Added sample ${added}. An app that was already open shows them once reopened.`;
}

// ─── Reset ───

/** Every key Warrior OS writes starts with "warrior" (warrior-os-*, warrior-*, warrior:*). */
function isWarriorKey(key: string): boolean {
  return key.startsWith('warrior');
}

/**
 * Erase this browser's Warrior OS and reload into a first boot. Saving is
 * switched off first for Warrior OS keys, so nothing still running (timers,
 * page-hide handlers) writes the old state back before the reload.
 */
function resetWarriorOS(): void {
  try {
    const storage = window.localStorage;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (this === storage && isWarriorKey(String(key))) return;
      setItem.call(this, key, value);
    };
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && isWarriorKey(key)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage blocked: there is nothing saved to erase.
  }
  window.location.reload();
}

// ─── Tab ───

type SeedState = { status: 'idle' } | { status: 'busy' } | { status: 'done'; message: string };

function ShowcaseTabInner() {
  // Settings only renders client-side, so the stored mode is read once here.
  const [mode] = useState(getVisitorMode);
  const [seed, setSeed] = useState<SeedState>({ status: 'idle' });
  const [confirmingReset, setConfirmingReset] = useState(false);

  const session = SESSION_COPY[mode ?? 'unknown'];

  const reseed = useCallback(async () => {
    setSeed({ status: 'busy' });
    try {
      const { seedDemoData } = await import('@/lib/demo-seed');
      setSeed({ status: 'done', message: describeReport(seedDemoData({ mode: 'guest', force: true })) });
    } catch {
      setSeed({ status: 'done', message: "Demo data couldn't be loaded. Check the connection and try again." });
    }
  }, []);

  const closeReset = useCallback(() => setConfirmingReset(false), []);

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Showcase</h3>

      {/* Session */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">This session</label>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
          {session.icon}
          <div className="space-y-0.5">
            <p className="text-sm text-white/90">{session.title}</p>
            <p className="text-[11px] text-white/50">{session.body}</p>
          </div>
        </div>
      </section>

      {/* Guided tour */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Guided tour</label>
        <p className="text-[11px] text-white/40">
          Five quick stops with NEXUS: the command bar, the apps, the living world and Settings.
        </p>
        <ReplayTourButton />
      </section>

      {/* Demo data */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Demo data</label>
        {mode === 'guest' ? (
          <>
            <p className="text-[11px] text-white/40">
              Guest sessions start with sample notes, habits, projects, expenses, calendar events,
              learning progress and XP, so every app has something to show. Re-seeding refills the
              apps that are empty and never touches anything you&apos;ve added.
            </p>
            <button
              type="button"
              onClick={reseed}
              disabled={seed.status === 'busy'}
              className={BUTTON_ACCENT}
            >
              <Database className="h-4 w-4" aria-hidden />
              {seed.status === 'busy' ? 'Seeding…' : 'Re-seed demo data'}
            </button>
            <p role="status" className="text-[11px] text-white/60 min-h-4">
              {seed.status === 'done' ? seed.message : ''}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-white/40">
            Guests exploring Warrior OS get sample data in their own browser, so every app has
            something to show. Owner sessions never do.
          </p>
        )}
      </section>

      {/* Reset */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Reset</label>
        <div className="space-y-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <p className="text-[11px] text-white/50">
            Erase everything Warrior OS keeps in this browser and start over from the first boot.
          </p>
          <button type="button" onClick={() => setConfirmingReset(true)} className={BUTTON_DANGER}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset this browser&apos;s Warrior OS
          </button>
        </div>
      </section>

      {/* Creator */}
      <OwnerCard className="max-w-md" />

      {/* A window can be transformed, so the dialog is portalled to <body>. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <Modal isOpen={confirmingReset} onClose={closeReset} title="Reset Warrior OS?" size="sm">
            <div className="space-y-4">
              <div className="flex gap-3">
                <TriangleAlert className="w-5 h-5 shrink-0 text-red-300" aria-hidden />
                <p className="text-sm text-white/70">
                  This erases the notes, habits, projects, expenses, events, learning progress,
                  XP, achievements and settings Warrior OS keeps in this browser, then restarts
                  from the first boot. It can&apos;t be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                {/* Cancel is focused first: Enter never erases by accident. */}
                <button type="button" autoFocus onClick={closeReset} className={BUTTON_GHOST}>
                  Cancel
                </button>
                <button type="button" onClick={resetWarriorOS} className={BUTTON_DANGER}>
                  Erase and restart
                </button>
              </div>
            </div>
          </Modal>,
          document.body
        )}
    </div>
  );
}

export const ShowcaseTab = memo(ShowcaseTabInner);
