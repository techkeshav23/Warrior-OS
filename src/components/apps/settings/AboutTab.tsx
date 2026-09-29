// ═══════════════════════════════════════════════════════════
// WARRIOR OS — About Tab
// What Warrior OS is, who built it and what it's built with
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import {
  AudioLines,
  Box,
  Braces,
  Database,
  Eye,
  HardDrive,
  Layers,
  Paintbrush,
  ShieldCheck,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { Card, Chip } from '@/components/ui';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { BrandMark } from '@/components/showcase/BrandMark';
import { OwnerCard } from '@/components/showcase/OwnerCard';
import { SettingsPage, SettingsSection, SpecItem } from './parts';

const STACK: ReadonlyArray<readonly [label: string, value: string, icon: LucideIcon]> = [
  ['Framework', 'Next.js 16 + React 19', Layers],
  ['Language', 'TypeScript', Braces],
  ['State', 'Zustand + Immer', Database],
  ['Styling', 'Tailwind CSS 4', Paintbrush],
  ['Motion', 'Framer Motion', Wind],
  ['3D', 'Three.js + React Three Fiber', Box],
  ['Audio', 'Tone.js', AudioLines],
  ['Data', 'Offline-first, stored in this browser', HardDrive],
];

function AboutTabInner() {
  // Settings only renders client-side, so the stored mode is read once here.
  const [mode] = useState(getVisitorMode);

  return (
    <SettingsPage>
      {/* Hero */}
      <Card hud padding="lg">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <BrandMark size={56} glow />
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold tracking-[0.08em] text-fg">WARRIOR OS</p>
              <p className="hud-label mt-1">v4.0 — The Living World</p>
            </div>
          </div>
          <p className="max-w-prose text-ui text-fg-muted">
            Warrior OS is {OWNER.shortName}&apos;s personal operating system, running entirely in the browser: a
            sci-fi command center for everyday work, a discipline machine that turns habits, focus and streaks into
            XP, and a creative playground for code, music and experiments. It&apos;s offline-first, so your data
            lives only in this browser.
          </p>
          {mode && (
            <div>
              {mode === 'guest' ? (
                <Chip icon={<Eye size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />}>
                  Guest session · your changes stay in this browser
                </Chip>
              ) : (
                <Chip icon={<ShieldCheck size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />}>
                  Owner session
                </Chip>
              )}
            </div>
          )}
        </div>
      </Card>

      <OwnerCard />

      <SettingsSection title="Built with">
        <Card>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-4 @md:grid-cols-2">
            {STACK.map(([label, value, icon]) => (
              <li key={label} className="min-w-0" title={value}>
                <SpecItem icon={icon} label={label}>
                  {value}
                </SpecItem>
              </li>
            ))}
          </ul>
        </Card>
      </SettingsSection>

      <p className="flex items-center justify-center gap-2 pt-1 text-center text-xs text-fg-subtle">
        <BrandMark size={14} tone="mono" className="text-fg-faint" />
        &ldquo;Every warrior was once a beginner who refused to give up.&rdquo;
      </p>
    </SettingsPage>
  );
}

export const AboutTab = memo(AboutTabInner);
