// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Formula Cards
// Swipeable/filterable quick-reference cards
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FORMULA_CARDS, getFormulaSubjects, getFormulasBySubject } from '@/data/formulas';

interface FormulaCardsProps {
  /** Subject to filter by on open, e.g. from a NEXUS deep link (ignored if it has no cards). */
  initialSubject?: string | null;
}

function FormulaCardsInner({ initialSubject = null }: FormulaCardsProps) {
  const [subject, setSubject] = useState<string | null>(() =>
    initialSubject && getFormulasBySubject(initialSubject).length > 0 ? initialSubject : null
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const subjects = useMemo(() => getFormulaSubjects(), []);
  const cards = useMemo(
    () => (subject ? getFormulasBySubject(subject) : FORMULA_CARDS),
    [subject]
  );

  const currentCard = cards[cardIndex];

  const goNext = () => {
    setFlipped(false);
    setCardIndex((i) => (i + 1) % cards.length);
  };

  const goPrev = () => {
    setFlipped(false);
    setCardIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-white">🧮 Formula Cards</h3>

      {/* Subject Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSubject(null); setCardIndex(0); }}
          className={cn(
            'px-3 py-1 rounded text-xs border transition-all',
            !subject
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
          )}
        >
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s}
            onClick={() => { setSubject(s); setCardIndex(0); }}
            className={cn(
              'px-3 py-1 rounded text-xs border transition-all',
              subject === s
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Card */}
      {currentCard && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-white/40">
            Card {cardIndex + 1} / {cards.length} — Click card to flip
          </p>

          <div
            className="w-full max-w-md cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={() => setFlipped(!flipped)}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.4 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative w-full min-h-[200px]"
            >
              {/* Front */}
              <div
                className="absolute inset-0 p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex flex-col justify-center items-center text-center"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="text-[10px] text-cyan-400/60 mb-2">
                  {currentCard.subject} • {currentCard.topic}
                </span>
                <p className="text-lg font-mono text-cyan-300 font-bold leading-relaxed">
                  {currentCard.formula}
                </p>
                <span className="text-[10px] text-white/30 mt-4">tap to flip</span>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 p-6 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex flex-col justify-center items-center text-center"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <span className="text-[10px] text-purple-400/60 mb-2">Explanation</span>
                <p className="text-sm text-white/80 leading-relaxed">
                  {currentCard.explanation}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4">
            <button
              onClick={goPrev}
              className="px-4 py-2 rounded text-sm text-white/60 hover:text-white bg-white/5 border border-white/10"
            >
              ← Prev
            </button>
            <button
              onClick={goNext}
              className="px-4 py-2 rounded text-sm text-white/60 hover:text-white bg-white/5 border border-white/10"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const FormulaCards = memo(FormulaCardsInner);
