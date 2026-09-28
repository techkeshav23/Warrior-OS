// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds App
// Learn anything: the deck vault, quizzes, flashcards, skill tree,
// question bank, mock tests and the quest planner over the user's
// own decks.
//
// Visited tabs stay mounted (inactive ones are hidden), so a quiz or
// mock test in progress survives a trip to another tab. A tab only
// remounts when a deep link or launcher points it at a new deck/topic.
// Every tab reads keys from its own root element, so hidden tabs never
// react to the keyboard.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePendingEventListener } from '@/components/achievements/pending-events';
import { useLearningStore } from '@/stores/useLearningStore';
import { DecksPanel } from './decks';
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

const TABS: readonly { id: TrainingGroundsTab; label: string; icon: string }[] = [
  { id: 'decks', label: 'Decks', icon: '🗂️' },
  { id: 'quiz', label: 'Quiz', icon: '📝' },
  { id: 'flashcards', label: 'Review', icon: '🔁' },
  { id: 'skill-tree', label: 'Skill Tree', icon: '🌳' },
  { id: 'bank', label: 'Question Bank', icon: '📚' },
  { id: 'mock', label: 'Mock Test', icon: '⏱️' },
  { id: 'planner', label: 'Quest Planner', icon: '🗺️' },
];

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

function withMount(mounts: TabMounts, tab: TrainingGroundsTab, mount: TabMount): TabMounts {
  const next: TabMounts = { ...mounts };
  next[tab] = mount;
  return next;
}

interface TrainingGroundsAppProps {
  /** Tab to open on (default: the deck vault). */
  initialTab?: TrainingGroundsTab;
}

function TrainingGroundsAppInner({ initialTab = 'decks' }: TrainingGroundsAppProps) {
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

  /** Sidebar: show a tab; its first visit mounts it on the current focus. */
  const showTab = (tab: TrainingGroundsTab) => {
    // Clicking Decks again leaves a deck's detail view for the list.
    if (tab === 'decks' && activeTab === 'decks') setOpenDeckId(null);
    setMounts((m) => (m[tab] ? m : withMount(m, tab, { nonce: 0, target: focus })));
    setActiveTab(tab);
  };

  /**
   * Open `tab` on `target`. A mounted tab keeps its state unless the target
   * is a new deck/topic (a link without a deck just switches to it).
   */
  const openOn = useCallback((tab: TrainingGroundsTab, target: DeckTarget | null) => {
    setFocus(target);
    setMounts((m) => {
      const current = m[tab];
      if (current && (target === null || sameTarget(current.target, target))) return m;
      return withMount(m, tab, { nonce: (current?.nonce ?? 0) + 1, target });
    });
    setActiveTab(tab);
  }, []);

  /** Launcher for tabs that start a mode on a deck/topic (Skill Tree, Quest Planner quests). */
  const launch = useCallback(
    (mode: TrainingLinkMode, target: DeckTarget | null) => {
      setUnmatched(null);
      openOn(tabForMode(mode), target);
    },
    [openOn]
  );

  /** Study buttons in the deck vault. */
  const studyFromDecks = useCallback(
    (target: DeckTarget, tab: TrainingTab) => {
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

  const renderTab = (tab: TrainingGroundsTab, target: DeckTarget | null) => {
    // A target whose deck is gone opens the tab unfocused.
    const deckId = target && decks.some((d) => d.id === target.deckId) ? target.deckId : null;
    const topicId = deckId ? target?.topicId ?? null : null;
    switch (tab) {
      case 'decks':
        return <DecksPanel openDeckId={openDeckId} onOpenDeck={setOpenDeckId} onStudy={studyFromDecks} />;
      case 'quiz':
        return <QuizEngine initialTarget={deckId ? { deckId, topicId } : null} />;
      case 'flashcards':
        return <SpacedRepetition initialDeckId={deckId} initialTopicId={topicId} />;
      case 'skill-tree':
        return <SkillTree onStart={launch} />;
      case 'bank':
        return <QuestionBank initialDeckId={deckId} />;
      case 'mock':
        return <MockTest initialDeckId={deckId} />;
      case 'planner':
        return <StudyPlanner onStart={launch} />;
    }
  };

  return (
    <div className="flex h-full bg-black/30">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0 border-r border-white/10 bg-black/20 p-2 flex flex-col gap-1">
        <h2 className="text-sm font-bold text-cyan-400 px-3 py-2 tracking-wider">
          🎯 TRAINING GROUNDS
        </h2>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => showTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left',
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-white/60 hover:text-white/90 hover:bg-white/5'
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}

        {(focusLabel || unmatched) && (
          <div className="mt-auto flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-[11px] text-purple-200">
            <span className="truncate" title="Picked by a deep link, a deck or the skill tree">
              {focusLabel ? `Focus: ${focusLabel}` : `No deck matches "${unmatched}"`}
            </span>
            <button
              type="button"
              onClick={() => {
                setFocus(null);
                setUnmatched(null);
              }}
              className="text-purple-300/70 hover:text-purple-100"
              aria-label="Clear focus"
            >
              ✕
            </button>
          </div>
        )}
      </nav>

      {/* Content: every visited tab stays mounted; only the active one is shown. */}
      <div className="flex-1 overflow-hidden">
        {TABS.map(({ id }) => {
          const mount = mounts[id];
          if (!mount) return null;
          const active = id === activeTab;
          return (
            <motion.div
              key={`${id}:${mount.nonce}`}
              hidden={!active}
              initial={{ opacity: 0, x: 20 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ duration: active ? 0.2 : 0 }}
              className="h-full overflow-y-auto"
            >
              {renderTab(id, mount.target)}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export const TrainingGroundsApp = memo(TrainingGroundsAppInner);
