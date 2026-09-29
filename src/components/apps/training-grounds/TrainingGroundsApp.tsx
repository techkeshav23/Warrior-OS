// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds App
// Learn anything: the deck vault, quizzes, flashcards, skill tree,
// question bank, mock tests and the quest planner over the user's
// own decks.
//
// Frame: the kit's AppLayout with a sectioned SidebarNav (Library ·
// Practice · Progress). Each tab owns its header and scrolling.
//
// Visited tabs stay mounted (inactive ones are hidden), so a quiz or
// mock test in progress survives a trip to another tab. A tab only
// remounts when a deep link or launcher points it at a deck/topic other
// than the one it shows now (or Review is asked for every deck).
// Every tab reads keys from its own root element, so hidden tabs never
// react to the keyboard.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LocateFixed, TriangleAlert, X } from 'lucide-react';
import { AppIcon, AppLayout, Badge, IconButton, SidebarNav, type NavSection } from '@/components/ui';
import { usePendingEventListener } from '@/components/achievements/pending-events';
import { useLearningStore } from '@/stores/useLearningStore';
import { TRANSITION } from '@/styles/tokens';
import { DecksPanel, TAB_ICONS, countDueCards, useMinuteNow } from './decks';
import { QuizEngine } from './QuizEngine';
import { QuestionBank } from './QuestionBank';
import { MockTest } from './MockTest';
import { StudyPlanner } from './StudyPlanner';
import { SkillTree } from './SkillTree';
import { SpacedRepetition } from './SpacedRepetition';
import {
  TRAINING_APP_IDS,
  TRAINING_START_EVENT,
  parseTrainingStart,
  resolveDeckTarget,
  tabForMode,
  type DeckTarget,
  type TrainingLinkMode,
  type TrainingTab,
} from './deep-link';

/** Every tab of the shell: the deck vault plus the study modes. */
export type TrainingGroundsTab = 'decks' | TrainingTab;

const TABS: readonly { id: TrainingGroundsTab; label: string }[] = [
  { id: 'decks', label: 'Decks' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'flashcards', label: 'Review' },
  { id: 'skill-tree', label: 'Skill Tree' },
  { id: 'bank', label: 'Question Bank' },
  { id: 'mock', label: 'Mock Test' },
  { id: 'planner', label: 'Quest Planner' },
];

const TAB_LABEL = Object.fromEntries(TABS.map((t) => [t.id, t.label])) as Record<TrainingGroundsTab, string>;

function isTab(id: string): id is TrainingGroundsTab {
  return TABS.some((t) => t.id === id);
}

/** A mounted tab. `nonce` is part of its key: bumping it remounts the tab on `target`. */
interface TabMount {
  nonce: number;
  target: DeckTarget | null;
}

type TabMounts = Partial<Record<TrainingGroundsTab, TabMount>>;

function sameTarget(a: DeckTarget | null, b: DeckTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.deckId === b.deckId && (a.topicId ?? null) === (b.topicId ?? null);
}

/** Tabs that pick a whole deck only (a topic in a launch target doesn't apply). */
const DECK_ONLY_TABS: readonly TrainingGroundsTab[] = ['bank', 'mock'];

/** Tabs where a launch without a deck means "every deck" rather than "just show it". */
const ALL_DECKS_TABS: readonly TrainingGroundsTab[] = ['flashcards'];

function scopeFor(tab: TrainingGroundsTab, target: DeckTarget | null): DeckTarget | null {
  return target && DECK_ONLY_TABS.includes(tab) ? { deckId: target.deckId, topicId: null } : target;
}

function withMount(mounts: TabMounts, tab: TrainingGroundsTab, mount: TabMount): TabMounts {
  const next: TabMounts = { ...mounts };
  next[tab] = mount;
  return next;
}

/** Cards due for review right now, on the Review nav item. Ticks on its own, so the shell doesn't. */
function ReviewDueBadge() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const now = useMinuteNow();
  const due = useMemo(() => countDueCards(decks, reviews, now), [decks, reviews, now]);
  if (due === 0) return null;
  return (
    <Badge tone="warning" size="sm" className="tabular" title={`${due} due for review`}>
      {due > 99 ? '99+' : due}
      <span className="sr-only"> due</span>
    </Badge>
  );
}

interface TrainingGroundsAppProps {
  /** Tab to open on (default: the deck vault). */
  initialTab?: TrainingGroundsTab;
}

function TrainingGroundsAppInner({ initialTab = 'decks' }: TrainingGroundsAppProps) {
  const reduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TrainingGroundsTab>(initialTab);
  // Deck/topic the last deep link or launcher asked for; a tab visited for
  // the first time opens on it too.
  const [focus, setFocus] = useState<DeckTarget | null>(null);
  // Text of a deep link that matched no deck ("dbms" with no such deck).
  const [unmatched, setUnmatched] = useState<string | null>(null);
  const [mounts, setMounts] = useState<TabMounts>(() => withMount({}, initialTab, { nonce: 0, target: null }));
  // Deck open in the vault's detail view (kept here so it survives tab switches).
  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const decks = useLearningStore((s) => s.decks);
  // Deck/topic each mounted tab shows right now (the user can switch it in-tab).
  const scopes = useRef<Partial<Record<TrainingGroundsTab, DeckTarget | null>>>({});
  const scopeReporters = useMemo(() => {
    const report = (tab: TrainingGroundsTab) => (target: DeckTarget | null) => {
      scopes.current[tab] = target;
    };
    return { quiz: report('quiz'), flashcards: report('flashcards'), bank: report('bank'), mock: report('mock') };
  }, [scopes]);

  /** Sidebar: show a tab; its first visit mounts it on the current focus. */
  const showTab = (tab: TrainingGroundsTab) => {
    // Clicking Decks again leaves a deck's detail view for the list.
    if (tab === 'decks' && activeTab === 'decks') setOpenDeckId(null);
    setMounts((m) => (m[tab] ? m : withMount(m, tab, { nonce: 0, target: focus })));
    setActiveTab(tab);
  };

  /**
   * Open `tab` on `target`. A mounted tab keeps its state (and any run in
   * progress) when it already shows that deck/topic; otherwise it remounts
   * on it. A link without a deck just switches to the tab, except Review,
   * where it means every deck.
   */
  const openOn = useCallback((tab: TrainingGroundsTab, target: DeckTarget | null) => {
    setFocus(target);
    setMounts((m) => {
      const current = m[tab];
      if (current) {
        const shown = tab in scopes.current ? (scopes.current[tab] ?? null) : current.target;
        if (target === null ? !ALL_DECKS_TABS.includes(tab) || shown === null : sameTarget(scopeFor(tab, shown), scopeFor(tab, target))) {
          return m;
        }
      }
      return withMount(m, tab, { nonce: (current?.nonce ?? 0) + 1, target });
    });
    setActiveTab(tab);
  }, [scopes]);

  /** Launcher for tabs that start a mode on a deck/topic (Skill Tree, Quest Planner quests). */
  const launch = useCallback(
    (mode: TrainingLinkMode, target: DeckTarget | null) => {
      setUnmatched(null);
      openOn(tabForMode(mode), target);
    },
    [openOn]
  );

  /** Study buttons in the deck vault (null = no particular deck, e.g. "review everything due"). */
  const studyFromDecks = useCallback(
    (target: DeckTarget | null, tab: TrainingTab) => {
      setUnmatched(null);
      openOn(tab, target);
    },
    [openOn]
  );

  // Start event (NEXUS, terminal, palette): jump to the requested mode + deck.
  usePendingEventListener({
    eventName: TRAINING_START_EVENT,
    parse: parseTrainingStart,
    appIds: TRAINING_APP_IDS,
    onEvent: (detail) => {
      const target = resolveDeckTarget(detail.subject, useLearningStore.getState().decks);
      setUnmatched(detail.subject && !target ? detail.subject : null);
      openOn(tabForMode(detail.mode), target);
    },
  });

  const focusDeck = focus ? decks.find((d) => d.id === focus.deckId) : undefined;
  const focusTopic = focus?.topicId ? focusDeck?.topics.find((t) => t.id === focus.topicId) : undefined;
  const focusLabel = focusDeck ? `${focusDeck.name}${focusTopic ? ` · ${focusTopic.name}` : ''}` : null;

  const navItem = (id: TrainingGroundsTab) => ({ id, label: TAB_LABEL[id], icon: TAB_ICONS[id] });
  const sections: NavSection[] = [
    {
      items: [{ ...navItem('decks'), count: decks.length }, navItem('bank')],
    },
    {
      label: 'Practice',
      items: [navItem('quiz'), { ...navItem('flashcards'), badge: <ReviewDueBadge /> }, navItem('mock')],
    },
    {
      label: 'Progress',
      items: [navItem('skill-tree'), navItem('planner')],
    },
  ];

  const clearFocus = () => {
    setFocus(null);
    setUnmatched(null);
  };

  const focusCard =
    focusLabel || unmatched ? (
      <div className="relative flex items-start gap-2.5 chamfer-sm bg-steel-950/60 bevel py-2 pl-3 pr-1.5">
        {focusLabel ? (
          <LocateFixed size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-accent" />
        ) : (
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-warning" />
        )}
        <div className="min-w-0 flex-1" title="Picked by a deep link, a deck or the skill tree">
          <div className="hud-label">{focusLabel ? 'Focus' : 'No match'}</div>
          <div className="mt-0.5 truncate text-xs text-fg">
            {focusLabel ?? `No deck matches “${unmatched}”`}
          </div>
        </div>
        <IconButton icon={X} size="xs" aria-label="Clear focus" onClick={clearFocus} />
      </div>
    ) : undefined;

  const renderTab = (tab: TrainingGroundsTab, target: DeckTarget | null) => {
    // A target whose deck is gone opens the tab unfocused.
    const deckId = target && decks.some((d) => d.id === target.deckId) ? target.deckId : null;
    const topicId = deckId ? target?.topicId ?? null : null;
    switch (tab) {
      case 'decks':
        return <DecksPanel openDeckId={openDeckId} onOpenDeck={setOpenDeckId} onStudy={studyFromDecks} />;
      case 'quiz':
        return <QuizEngine initialTarget={deckId ? { deckId, topicId } : null} onScopeChange={scopeReporters.quiz} />;
      case 'flashcards':
        return (
          <SpacedRepetition initialDeckId={deckId} initialTopicId={topicId} onScopeChange={scopeReporters.flashcards} />
        );
      case 'skill-tree':
        return <SkillTree onStart={launch} />;
      case 'bank':
        return <QuestionBank initialDeckId={deckId} onScopeChange={scopeReporters.bank} />;
      case 'mock':
        return <MockTest initialDeckId={deckId} onScopeChange={scopeReporters.mock} />;
      case 'planner':
        return <StudyPlanner onStart={launch} />;
    }
  };

  return (
    <AppLayout
      sidebarWidth={208}
      padded={false}
      scroll={false}
      sidebar={
        <SidebarNav
          aria-label="Training Grounds"
          header={
            <div className="flex items-center gap-2.5">
              <AppIcon appId="training-grounds" size={28} active />
              <div className="min-w-0">
                <div className="truncate text-ui font-semibold text-fg">Training Grounds</div>
                <div className="hud-label truncate">Learn anything</div>
              </div>
            </div>
          }
          sections={sections}
          value={activeTab}
          onChange={(id) => {
            if (isTab(id)) showTab(id);
          }}
          footer={focusCard}
        />
      }
    >
      {/* Every visited tab stays mounted; only the active one is shown. */}
      {TABS.map(({ id }) => {
        const mount = mounts[id];
        if (!mount) return null;
        const active = id === activeTab;
        return (
          <motion.div
            key={`${id}:${mount.nonce}`}
            hidden={!active}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 6 }}
            transition={active ? TRANSITION.panel : { duration: 0 }}
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
          >
            {renderTab(id, mount.target)}
          </motion.div>
        );
      })}
    </AppLayout>
  );
}

export const TrainingGroundsApp = memo(TrainingGroundsAppInner);
