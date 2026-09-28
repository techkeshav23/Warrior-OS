// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Flashcards (Spaced Repetition)
// Review due cards: flip, rate Again / Hard / Good / Easy, and the
// learning store schedules the next review
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cardAnswerText, collectDueCards, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import type { CardLocation, ReviewGrade } from '@/types/learning';

/** Cards per review session. */
const SESSION_SIZE = 30;

const GRADES: { grade: ReviewGrade; label: string; className: string }[] = [
  { grade: 'again', label: 'Again', className: 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25' },
  { grade: 'hard', label: 'Hard', className: 'bg-orange-500/15 border-orange-500/30 text-orange-300 hover:bg-orange-500/25' },
  { grade: 'good', label: 'Good', className: 'bg-green-500/15 border-green-500/30 text-green-300 hover:bg-green-500/25' },
  { grade: 'easy', label: 'Easy', className: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25' },
];

interface SpacedRepetitionProps {
  /** Deck to review, e.g. from a NEXUS deep link; all decks otherwise. */
  initialDeckId?: string | null;
}

interface Session {
  cards: CardLocation[];
  index: number;
  flipped: boolean;
  reviewed: number;
  remembered: number;
}

function SpacedRepetitionInner({ initialDeckId = null }: SpacedRepetitionProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const recordAttempt = useLearningStore((s) => s.recordAttempt);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId);
  const [session, setSession] = useState<Session | null>(null);
  const [studyMarked, setStudyMarked] = useState(false);

  // `now` ticks once per minute: enough for due dates, and it keeps render pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const scopeDeckId = deckId && decks.some((d) => d.id === deckId) ? deckId : undefined;
  const queue = useMemo(
    () => collectDueCards(decks, reviews, { deckId: scopeDeckId, now }),
    [decks, reviews, scopeDeckId, now]
  );
  const dueCount = queue.filter((c) => c.review !== null).length;
  const newCount = queue.length - dueCount;
  const totalCards = useMemo(() => listCardLocations(decks, scopeDeckId).length, [decks, scopeDeckId]);

  const startSession = useCallback(
    (practiceAll: boolean) => {
      const cards = practiceAll
        ? listCardLocations(decks, scopeDeckId).sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
        : queue.slice(0, SESSION_SIZE);
      if (cards.length === 0) return;
      setSession({ cards, index: 0, flipped: false, reviewed: 0, remembered: 0 });
    },
    [decks, scopeDeckId, queue]
  );

  const rate = useCallback(
    (grade: ReviewGrade) => {
      if (!session) return;
      const current = session.cards[session.index];
      recordAttempt({ cardId: current.card.id, correct: grade !== 'again', grade, source: 'flashcards' });
      // Reviewing is study activity for today's streak (once per visit is enough).
      if (!studyMarked) {
        recordStudyAction();
        setStudyMarked(true);
      }
      setSession({
        ...session,
        index: session.index + 1,
        flipped: false,
        reviewed: session.reviewed + 1,
        remembered: session.remembered + (grade === 'again' ? 0 : 1),
      });
    },
    [session, recordAttempt, studyMarked]
  );

  // ─── Review session ───
  if (session && session.index < session.cards.length) {
    const { card, deckName, topicName } = session.cards[session.index];
    return (
      <div className="p-6 space-y-4 flex flex-col items-center">
        <div className="w-full flex items-center justify-between text-xs text-white/40">
          <span>
            Card {session.index + 1} / {session.cards.length}
          </span>
          <button onClick={() => setSession(null)} className="hover:text-white/70">
            End session
          </button>
        </div>

        <div
          className="w-full max-w-md cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={() => setSession({ ...session, flipped: !session.flipped })}
        >
          <motion.div
            animate={{ rotateY: session.flipped ? 180 : 0 }}
            transition={{ duration: 0.4 }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative w-full min-h-[220px]"
          >
            {/* Front */}
            <div
              className="absolute inset-0 p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex flex-col justify-center items-center text-center overflow-y-auto"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-[10px] text-cyan-400/60 mb-2">
                {deckName} • {topicName}
              </span>
              <p className="text-base text-cyan-200 font-semibold leading-relaxed whitespace-pre-wrap">{card.prompt}</p>
              {(card.kind === 'mcq' || card.kind === 'multi-select') && (
                <ul className="mt-3 text-xs text-white/50 space-y-0.5 text-left">
                  {card.options.map((opt, i) => (
                    <li key={i}>
                      {String.fromCharCode(65 + i)}. {opt}
                    </li>
                  ))}
                </ul>
              )}
              <span className="text-[10px] text-white/30 mt-4">tap to flip</span>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 p-6 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex flex-col justify-center items-center text-center overflow-y-auto"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <span className="text-[10px] text-purple-400/60 mb-2">Answer</span>
              <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{cardAnswerText(card)}</p>
              {card.explanation && (
                <p className="text-xs text-white/50 leading-relaxed mt-3 whitespace-pre-wrap">{card.explanation}</p>
              )}
            </div>
          </motion.div>
        </div>

        {session.flipped ? (
          <div className="flex gap-2">
            {GRADES.map((g) => (
              <button
                key={g.grade}
                onClick={() => rate(g.grade)}
                className={cn('px-4 py-2 rounded-lg text-sm border transition-all', g.className)}
              >
                {g.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setSession({ ...session, flipped: true })}
            className="px-4 py-2 rounded-lg text-sm text-white/70 bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Show answer
          </button>
        )}
      </div>
    );
  }

  // ─── Overview (and session summary) ───
  return (
    <div className="p-6 space-y-5">
      <h3 className="text-lg font-bold text-white">🃏 Flashcards</h3>
      <p className="text-xs text-white/50">
        Flip a card, rate how well you knew it, and the next review is scheduled for you: misses come back soon, easy
        cards drift further out.
      </p>

      {session && (
        <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/10 text-sm text-green-200">
          Session done: {session.reviewed} card{session.reviewed === 1 ? '' : 's'} reviewed, {session.remembered}{' '}
          remembered.
        </div>
      )}

      {/* Deck filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setDeckId(null)}
          className={cn(
            'px-3 py-1 rounded text-xs border transition-all',
            !scopeDeckId
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          )}
        >
          All decks
        </button>
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => setDeckId(d.id)}
            className={cn(
              'px-3 py-1 rounded text-xs border transition-all',
              scopeDeckId === d.id
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            <span className="mr-1">{d.icon}</span>
            {d.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-2xl font-bold text-yellow-300">{dueCount}</p>
          <p className="text-xs text-yellow-400/60">Due now</p>
        </div>
        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <p className="text-2xl font-bold text-cyan-300">{newCount}</p>
          <p className="text-xs text-cyan-400/60">New</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-2xl font-bold text-white/70">{totalCards}</p>
          <p className="text-xs text-white/40">Cards</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => startSession(false)}
          disabled={queue.length === 0}
          className="flex-1 p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold disabled:opacity-30"
        >
          {queue.length > 0 ? `Review ${Math.min(queue.length, SESSION_SIZE)} cards` : 'All caught up'}
        </button>
        <button
          onClick={() => startSession(true)}
          disabled={totalCards === 0}
          className="px-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 text-sm disabled:opacity-30"
          title="Practice any cards; only answers that are due move the schedule"
        >
          Practice all
        </button>
      </div>
    </div>
  );
}

export const SpacedRepetition = memo(SpacedRepetitionInner);
