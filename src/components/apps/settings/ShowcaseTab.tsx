// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Showcase Tab
// The portfolio side of Settings: who is using this browser (owner or
// guest), the guided tour replay, the guest demo data, a full reset of
// this browser's Warrior OS, and the creator card.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useState, type ReactNode } from 'react';
import { CircleCheck, Compass, Database, Eye, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { getVisitorMode, type VisitorMode } from '@/lib/visitor';
import type { DemoSeedArea, DemoSeedReport } from '@/lib/demo-seed';
import { useTourStore } from '@/stores/useTourStore';
import { Badge, Button, ConfirmDialog, type IconLike } from '@/components/ui';
import { OwnerCard } from '@/components/showcase/OwnerCard';
import { EngravedHeader, ForgedPlaque, SettingRow, SettingsCard, SettingsPage, SettingsSection } from './parts';

const SESSION_COPY: Record<VisitorMode | 'unknown', { icon: IconLike; title: string; body: string }> = {
  guest: {
    icon: Eye,
    title: 'Guest session',
    body: `You're exploring ${OWNER.shortName}'s Warrior OS as a guest. Everything you change stays in this browser.`,
  },
  owner: {
    icon: ShieldCheck,
    title: 'Owner session',
    body: 'Your data lives only in this browser. Guests on other browsers never see it.',
  },
  unknown: {
    icon: UserRound,
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

/** Start the NEXUS tour again from the first stop; focus returns here when it ends. */
function replayTour(): void {
  useTourStore.getState().startTour();
}

/** The danger zone: a scorched plate behind hazard stripes, soot and a danger-hot edge. */
function ScorchedPlate({ children }: { children: ReactNode }) {
  return (
    <div className="armor-panel chamfer-tl-br chamfer-md relative isolate flex flex-col pt-2">
      {/* Soot and heat rising from the bottom-right, like metal that has been in the fire */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_140%_at_100%_100%,color-mix(in_oklab,var(--color-danger)_16%,transparent),transparent_60%),radial-gradient(70%_120%_at_0%_100%,rgb(0_0_0/0.35),transparent_70%)]"
      />
      {/* Hazard stripes along the top edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(-45deg,color-mix(in_oklab,var(--color-danger)_70%,transparent)_0_7px,rgb(0_0_0/0.55)_7px_14px)] shadow-[0_1px_0_rgb(0_0_0/0.6)]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-3 left-0 w-0.5 bg-danger/70" />
      {children}
    </div>
  );
}

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
    <SettingsPage>
      {/* Session */}
      <ForgedPlaque
        icon={session.icon}
        tone={mode ? 'accent' : 'neutral'}
        eyebrow="Session"
        stamp={mode === 'owner' ? 'OWNER' : mode === 'guest' ? 'GUEST' : '—'}
        title={session.title}
      >
        {session.body}
      </ForgedPlaque>

      {/* Tour + demo data */}
      <SettingsSection title="Explore" description="Show Warrior OS off, or get your bearings again.">
        <SettingsCard>
          <SettingRow
            label="Guided tour"
            description="Five quick stops with NEXUS: the command bar, the apps, the living world and Settings."
            control={
              <Button leadingIcon={Compass} onClick={replayTour}>
                Replay tour
              </Button>
            }
          />
          {mode === 'guest' ? (
            <SettingRow
              label="Demo data"
              stack
              description="Guest sessions start with sample notes, habits, projects, expenses, calendar events, learning progress and XP, so every app has something to show. Re-seeding refills the apps that are empty and never touches anything you've added."
              control={
                <Button leadingIcon={Database} loading={seed.status === 'busy'} onClick={reseed}>
                  {seed.status === 'busy' ? 'Seeding…' : 'Re-seed demo data'}
                </Button>
              }
            >
              <p role="status" className="flex min-h-4 items-start gap-2 text-xs text-fg-muted">
                {seed.status === 'done' && (
                  <>
                    <CircleCheck size={14} strokeWidth={1.75} className="mt-px shrink-0 text-success" aria-hidden />
                    {seed.message}
                  </>
                )}
              </p>
            </SettingRow>
          ) : (
            <SettingRow
              label="Demo data"
              description="Guests exploring Warrior OS get sample data in their own browser, so every app has something to show. Owner sessions never do."
              control={<Badge>Guests only</Badge>}
            />
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Reset */}
      <section aria-label="Danger zone" className="flex flex-col gap-3">
        <EngravedHeader title="Danger zone" tone="danger" />
        <ScorchedPlate>
          <SettingRow
            label="Reset this browser's Warrior OS"
            description="Erase everything Warrior OS keeps in this browser and start over from the first boot."
            control={
              <Button variant="danger" leadingIcon={RotateCcw} onClick={() => setConfirmingReset(true)}>
                Reset
              </Button>
            }
          />
        </ScorchedPlate>
      </section>

      {/* Creator */}
      <OwnerCard />

      {/* Portalled to <body> by the kit (a window can be transformed). Cancel is focused first. */}
      <ConfirmDialog
        open={confirmingReset}
        onClose={closeReset}
        onConfirm={resetWarriorOS}
        tone="danger"
        icon={RotateCcw}
        title="Reset Warrior OS?"
        description="This erases the notes, habits, projects, expenses, events, learning progress, XP, achievements and settings Warrior OS keeps in this browser, then restarts from the first boot. It can't be undone."
        confirmLabel="Erase and restart"
      />
    </SettingsPage>
  );
}

export const ShowcaseTab = memo(ShowcaseTabInner);
