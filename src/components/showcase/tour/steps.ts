// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour: the five stops
// What each stop spotlights (tried in order: the first target that is
// on screen and uncovered wins; none → centred card) and what NEXUS
// says there. Copy adapts to the visitor (guest / owner / unknown) and
// the platform (⌘ vs Ctrl, click vs tap).
//
// `data-tour="<stop>"` on any element takes priority over the built-in
// selectors, e.g. data-tour="command-bar" on a future taskbar button.
// ═══════════════════════════════════════════════════════════

import { OWNER } from '@/config/owner';
import type { VisitorMode } from '@/lib/visitor';
import { findCreature, type TargetSpec } from './dom';
import type { Placement } from './layout';

export type TourStepId = 'welcome' | 'command' | 'apps' | 'world' | 'settings';

export interface TourStepDef {
  id: TourStepId;
  targets: readonly TargetSpec[];
  /** Card sides to try around the spotlight, in order. */
  placement: readonly Placement[];
  /** Spotlight padding around the target (px). */
  pad: number;
}

/**
 * Desktop icons worth pointing a first-time visitor at: self-contained
 * apps that work offline. The first one on screen gets the spotlight.
 */
const SHOWCASE_APPS: ReadonlyArray<readonly [appId: string, pitch: string]> = [
  ['algo-lab', 'Start with Algo Lab: sorting, graph and tree algorithms, animated step by step.'],
  ['terminal', 'Start with Terminal: it has its own commands and a few easter eggs.'],
  ['code-editor', 'Start with Code Lab: a full code editor with live preview.'],
  ['notes', 'Start with Notes: markdown that saves as you type.'],
];

const APP_PITCH: ReadonlyMap<string, string> = new Map(SHOWCASE_APPS);

export const TOUR_STEPS: readonly TourStepDef[] = [
  { id: 'welcome', targets: [], placement: [], pad: 0 },
  {
    id: 'command',
    targets: ['[data-tour="command-bar"]'],
    placement: ['bottom', 'top', 'right', 'left'],
    pad: 6,
  },
  {
    id: 'apps',
    targets: [
      '[data-tour="apps"]',
      ...SHOWCASE_APPS.map(([id]) => `[data-desktop-icon="${id}"]`),
      '[data-desktop-icon]',
    ],
    placement: ['right', 'bottom', 'top', 'left'],
    pad: 8,
  },
  {
    id: 'world',
    targets: ['[data-tour="creature"]', findCreature, '[data-warrior-taskbar]'],
    placement: ['top', 'left', 'right'],
    pad: 6,
  },
  {
    id: 'settings',
    targets: ['[data-tour="settings"]', '[data-desktop-icon="settings"]'],
    placement: ['right', 'bottom', 'top', 'left'],
    pad: 8,
  },
];

export const TOUR_LAST_STEP = TOUR_STEPS.length - 1;
export const COMMAND_STEP_INDEX = TOUR_STEPS.findIndex((s) => s.id === 'command');

/** Phrases the command bar understands (lib/nexus-intent), shown as chips. */
export const COMMAND_EXAMPLES = ['study mode', 'open notes', 'notes kholo', 'wallpaper aurora'] as const;

export interface TourPlatform {
  /** ⌘ instead of Ctrl in shortcut hints. */
  isMac: boolean;
  /** Coarse pointer: "tap" wording, no keycaps. */
  touch: boolean;
}

/** Browser-only details for the copy; SSR-safe (plain desktop defaults). */
export function detectPlatform(): TourPlatform {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { isMac: false, touch: false };
  }
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform || navigator.platform || navigator.userAgent;
  return {
    isMac: /mac|iphone|ipad|ipod/i.test(platform),
    touch: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  };
}

/** Keycaps for the command bar shortcut. */
export function commandKeys(platform: TourPlatform): readonly string[] {
  return platform.isMac ? ['⌘', 'K'] : ['Ctrl', 'K'];
}

export interface TourCopyContext {
  mode: VisitorMode | null;
  platform: TourPlatform;
  /** `data-desktop-icon` of the spotlit icon on the apps stop, if any. */
  appId: string | null;
}

export interface TourCopy {
  title: string;
  body: string;
}

/** What NEXUS says at each stop. */
export function tourCopy(id: TourStepId, { mode, platform, appId }: TourCopyContext): TourCopy {
  const owner = OWNER.shortName;

  switch (id) {
    case 'welcome':
      if (mode === 'owner') {
        return {
          title: `Welcome back, ${owner}`,
          body: "NEXUS online, sab set hai. A 30-second refresher on what your OS can do, then it's all yours.",
        };
      }
      if (mode === 'guest') {
        return {
          title: 'Welcome, warrior',
          body: `I'm NEXUS, the mind of this machine. ${owner} built Warrior OS as a personal operating system; you're exploring it as a guest, and your changes stay in this browser. Five quick stops, under a minute.`,
        };
      }
      return {
        title: 'Welcome to Warrior OS',
        body: `I'm NEXUS, the mind of this machine. Warrior OS is ${owner}'s personal operating system, running right here in your browser. Five quick stops, under a minute.`,
      };

    case 'command': {
      const open = platform.touch
        ? 'Open the command bar'
        : `Press ${platform.isMac ? '⌘K' : 'Ctrl+K'} anywhere`;
      return {
        title: 'Command bar',
        body: `${open} and type what you want, in plain English or Hinglish. I turn it into action:`,
      };
    }

    case 'apps': {
      const pitch = appId ? APP_PITCH.get(appId) : undefined;
      return {
        title: 'Every icon is a real app',
        body: `${platform.touch ? 'Double-tap' : 'Double-click'} any icon to launch it. Windows drag and resize like a real desktop, across three workspaces.${pitch ? ` ${pitch}` : ''}`,
      };
    }

    case 'world':
      return {
        title: 'This world is alive',
        body: 'The creature on the taskbar is a companion that grows as you work. Notes become a walkable 3D Memory Palace, closed apps linger as phantom windows, and if you work too long without a break, reality itself starts to decay.',
      };

    case 'settings':
      return {
        title: 'Make it yours',
        body: 'Settings holds the controls: Lite mode for lighter machines, showcase options, wallpapers and sound. You can replay this tour from there anytime.',
      };
  }
}
