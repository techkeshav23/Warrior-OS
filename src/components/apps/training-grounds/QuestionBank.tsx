// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Question Bank
// Browse every card of a deck with its answer and explanation
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cardAnswerText, listCardLocations, useLearningStore } from '@/stores/useLearningStore';
import type { CardKind } from '@/types/learning';

const KIND_LABELS: Record<CardKind, string> = {
  mcq: 'MCQ',
  'multi-select': 'Multi-select',
  numeric: 'Numeric',
  flashcard: 'Flashcard',
};

interface QuestionBankProps {
  /** Deck to open on, e.g. from a NEXUS deep link. */
  initialDeckId?: string | null;
}

function QuestionBankInner({ initialDeckId = null }: QuestionBankProps) {
  const decks = useLearningStore((s) => s.decks);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const deck = decks.find((d) => d.id === deckId);
  const cards = useMemo(
    () => (deck ? listCardLocations([deck], deck.id, topicId ?? undefined) : []),
    [deck, topicId]
  );

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">📚 Question Bank</h3>

      {/* Deck Filter */}
      <div className="flex flex-wrap gap-2">
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setDeckId(d.id);
              setTopicId(null);
              setExpandedId(null);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs border transition-all',
              deckId === d.id
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            <span className="mr-1">{d.icon}</span>
            {d.name}
          </button>
        ))}
      </div>

      {/* Topic Filter */}
      {deck && deck.topics.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTopicId(null)}
            className={cn(
              'px-3 py-1 rounded text-[11px] border transition-all',
              !topicId
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            )}
          >
            All topics
          </button>
          {deck.topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setTopicId(t.id)}
              className={cn(
                'px-3 py-1 rounded text-[11px] border transition-all',
                topicId === t.id
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Card List */}
      {deck && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">
            {cards.length} card{cards.length === 1 ? '' : 's'} in {deck.name}
          </p>
          {cards.map(({ card, topicName }, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 20) * 0.02 }}
              className="border border-white/10 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
                className="w-full p-3 text-left flex items-start gap-2 hover:bg-white/5 transition-all"
              >
                <span className="text-white/30 text-xs mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{card.prompt}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-white/30">{topicName}</span>
                    <span className="text-[10px] text-cyan-400/70">{KIND_LABELS[card.kind]}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        card.difficulty === 'easy'
                          ? 'text-green-400'
                          : card.difficulty === 'medium'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      )}
                    >
                      {card.difficulty}
                    </span>
                  </div>
                </div>
                <span className="text-white/30 text-xs">{expandedId === card.id ? '▲' : '▼'}</span>
              </button>

              <AnimatePresence>
                {expandedId === card.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 bg-white/5 overflow-hidden"
                  >
                    <div className="p-3 space-y-2 text-xs">
                      {(card.kind === 'mcq' || card.kind === 'multi-select') && (
                        <div className="space-y-1">
                          {card.options.map((opt, oi) => {
                            const right = card.kind === 'mcq' ? oi === card.answer : card.answers.includes(oi);
                            return (
                              <p
                                key={oi}
                                className={cn('p-2 rounded', right ? 'bg-green-500/20 text-green-300' : 'text-white/60')}
                              >
                                {String.fromCharCode(65 + oi)}. {opt}
                                {right && <span className="ml-2">✓</span>}
                              </p>
                            );
                          })}
                        </div>
                      )}
                      {(card.kind === 'numeric' || card.kind === 'flashcard') && (
                        <p className="text-green-300 whitespace-pre-wrap">
                          {card.kind === 'numeric' ? 'Answer: ' : ''}
                          {cardAnswerText(card)}
                        </p>
                      )}
                      {card.explanation && <p className="text-white/50 italic mt-2">{card.explanation}</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {!deck && (
        <p className="text-sm text-white/40 text-center mt-12">
          {decks.length > 0 ? 'Select a deck to browse its cards' : 'No decks yet.'}
        </p>
      )}
    </div>
  );
}

export const QuestionBank = memo(QuestionBankInner);
