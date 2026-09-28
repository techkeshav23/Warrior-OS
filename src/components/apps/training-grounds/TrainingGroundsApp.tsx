// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds App
// Learn anything: quizzes, flashcards, skill tree, question bank,
// mock tests and a study planner over the user's own decks
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePendingEventListener } from '@/components/achievements/pending-events';
import { useLearningStore } from '@/stores/useLearningStore';
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
  type TrainingTab,
} from './deep-link';

const TABS: { id: TrainingTab; label: string; icon: string }[] = [
  { id: 'quiz', label: 'Quiz', icon: '📝' },
  { id: 'flashcards', label: 'Flashcards', icon: '🃏' },
  { id: 'skill-tree', label: 'Skill Tree', icon: '🌳' },
  { id: 'bank', label: 'Question Bank', icon: '📚' },
  { id: 'mock', label: 'Mock Test', icon: '⏱️' },
  { id: 'planner', label: 'Planner', icon: '📋' },
];

interface TrainingGroundsAppProps {
  /** Tab to open on, e.g. 'flashcards' for the Flashcards app entry. */
  initialTab?: TrainingTab;
}

function TrainingGroundsAppInner({ initialTab = 'quiz' }: TrainingGroundsAppProps) {
  const [activeTab, setActiveTab] = useState<TrainingTab>(initialTab);
  // Deck/topic a deep link asked for; preselected in Quiz, Flashcards, Question Bank and Mock Test.
  const [focus, setFocus] = useState<DeckTarget | null>(null);
  // Text of a deep link that matched no deck ("dbms" with no such deck).
  const [unmatched, setUnmatched] = useState<string | null>(null);
  // Bumped per deep link so the target tab remounts with the new focus.
  const [linkNonce, setLinkNonce] = useState(0);
  const decks = useLearningStore((s) => s.decks);

  // Start event (NEXUS, terminal, palette): jump to the requested mode + deck.
  usePendingEventListener({
    eventName: TRAINING_START_EVENT,
    parse: parseTrainingStart,
    appIds: TRAINING_APP_IDS,
    onEvent: (detail) => {
      const target = resolveDeckTarget(detail.subject, useLearningStore.getState().decks);
      setFocus(target);
      setUnmatched(detail.subject && !target ? detail.subject : null);
      setActiveTab(tabForMode(detail.mode));
      setLinkNonce((n) => n + 1);
    },
  });

  const focusDeck = focus ? decks.find((d) => d.id === focus.deckId) : undefined;
  const focusTopic = focus?.topicId ? focusDeck?.topics.find((t) => t.id === focus.topicId) : undefined;
  const focusLabel = focusDeck ? `${focusDeck.name}${focusTopic ? ` · ${focusTopic.name}` : ''}` : null;

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
            onClick={() => setActiveTab(tab.id)}
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
            <span className="truncate" title="Picked by a deep link (NEXUS / terminal)">
              {focusLabel ? `Focus: ${focusLabel}` : `No deck matches "${unmatched}"`}
            </span>
            <button
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}:${linkNonce}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-y-auto"
          >
            {activeTab === 'quiz' && <QuizEngine initialTarget={focusDeck ? focus : null} />}
            {activeTab === 'flashcards' && <SpacedRepetition initialDeckId={focusDeck?.id ?? null} />}
            {activeTab === 'skill-tree' && <SkillTree />}
            {activeTab === 'bank' && <QuestionBank initialDeckId={focusDeck?.id ?? null} />}
            {activeTab === 'mock' && <MockTest initialDeckId={focusDeck?.id ?? null} />}
            {activeTab === 'planner' && <StudyPlanner />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const TrainingGroundsApp = memo(TrainingGroundsAppInner);
