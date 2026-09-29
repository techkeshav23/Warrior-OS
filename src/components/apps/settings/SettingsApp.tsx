// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Settings App
// 9 tabs in three groups: Appearance, Living World, Sounds, Workspaces ·
// Performance, Nexus AI, Account · Showcase, About.
// Frame: AppLayout + SidebarNav; narrow windows swap the sidebar for an
// icon rail (container query, no JS measuring). Each tab gets an
// AppHeader with a one-line subtitle and a live status on the right.
// ═══════════════════════════════════════════════════════════

'use client';

import { Fragment, memo, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Gauge,
  Info,
  LayoutGrid,
  Palette,
  Presentation,
  Sprout,
  UserRound,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { AppHeader, AppLayout, IconButton, SidebarNav, type NavSection } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { AppearanceTab } from './AppearanceTab';
import { SoundsTab } from './SoundsTab';
import { AccountTab } from './AccountTab';
import { WorkspacesTab } from './WorkspacesTab';
import { NexusTab } from './NexusTab';
import { AboutTab } from './AboutTab';
import { LivingWorldTab } from './LivingWorldTab';
import { PerformanceTab } from './PerformanceTab';
import { ShowcaseTab } from './ShowcaseTab';
import { HeaderStatus } from './HeaderStatus';
import type { SettingsTabId } from './parts';

interface TabDef {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
  subtitle: string;
}

const GROUPS: { label?: string; tabs: TabDef[] }[] = [
  {
    tabs: [
      { id: 'appearance', label: 'Appearance', icon: Palette, subtitle: 'Wallpaper · accent · glass' },
      { id: 'living', label: 'Living World', icon: Sprout, subtitle: 'Decay · presence · widgets' },
      { id: 'sounds', label: 'Sounds', icon: Volume2, subtitle: 'Effects · music' },
      { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid, subtitle: 'Three desktops · Ctrl+1–3' },
    ],
  },
  {
    label: 'System',
    tabs: [
      { id: 'performance', label: 'Performance', icon: Gauge, subtitle: 'Lite mode · this device' },
      { id: 'nexus', label: 'Nexus AI', icon: Bot, subtitle: 'Companion · brain · privacy' },
      { id: 'account', label: 'Account', icon: UserRound, subtitle: 'Profile · this browser' },
    ],
  },
  {
    label: 'Warrior OS',
    tabs: [
      { id: 'showcase', label: 'Showcase', icon: Presentation, subtitle: 'Session · tour · demo data' },
      { id: 'about', label: 'About', icon: Info, subtitle: 'Story · creator · stack' },
    ],
  },
];

const TABS: Record<SettingsTabId, TabDef> = Object.fromEntries(
  GROUPS.flatMap((g) => g.tabs).map((t) => [t.id, t])
) as Record<SettingsTabId, TabDef>;

const NAV_SECTIONS: NavSection[] = GROUPS.map((g) => ({
  label: g.label,
  items: g.tabs.map(({ id, label, icon }) => ({ id, label, icon })),
}));

function isTabId(id: string): id is SettingsTabId {
  return id in TABS;
}

function SettingsAppInner() {
  const [tab, setTab] = useState<SettingsTabId>('appearance');
  const reduceMotion = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const current = TABS[tab];

  // Each tab opens at its top (the scroller is AppLayout's <main>).
  useLayoutEffect(() => {
    bodyRef.current?.closest('main')?.scrollTo({ top: 0 });
  }, [tab]);

  const openTab = (id: string) => {
    if (isTabId(id)) setTab(id);
  };

  return (
    <div className="@container flex h-full min-h-0 w-full min-w-0">
      {/* Narrow windows: an icon rail replaces the sidebar */}
      <nav
        aria-label="Settings sections"
        className="scrollbar-none hidden w-14 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-line bg-ink-950/35 py-3 @max-[600px]:flex"
      >
        {GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <span aria-hidden className="my-2 h-px w-6 shrink-0 bg-line" />}
            {group.tabs.map((t) => (
              <IconButton
                key={t.id}
                icon={t.icon}
                aria-label={t.label}
                aria-current={tab === t.id ? 'page' : undefined}
                active={tab === t.id}
                tooltip
                tooltipSide="right"
                iconSize={18}
                onClick={() => setTab(t.id)}
              />
            ))}
          </Fragment>
        ))}
      </nav>

      <AppLayout
        className="flex-1 @max-[600px]:[&>aside]:hidden"
        sidebar={
          <SidebarNav aria-label="Settings sections" value={tab} onChange={openTab} sections={NAV_SECTIONS} />
        }
        header={<AppHeader title={current.label} subtitle={current.subtitle} actions={<HeaderStatus tab={tab} />} />}
        bodyClassName="@container"
      >
        <motion.div
          ref={bodyRef}
          key={tab}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.panel}
        >
          {tab === 'appearance' && <AppearanceTab onOpenTab={setTab} />}
          {tab === 'living' && <LivingWorldTab />}
          {tab === 'performance' && <PerformanceTab />}
          {tab === 'sounds' && <SoundsTab />}
          {tab === 'account' && <AccountTab />}
          {tab === 'workspaces' && <WorkspacesTab />}
          {tab === 'nexus' && <NexusTab />}
          {tab === 'showcase' && <ShowcaseTab />}
          {tab === 'about' && <AboutTab />}
        </motion.div>
      </AppLayout>
    </div>
  );
}

export const SettingsApp = memo(SettingsAppInner);
