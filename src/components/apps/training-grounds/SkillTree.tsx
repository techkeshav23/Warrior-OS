// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Skill Tree (Deck Mastery Map)
// One node per deck with mastery and a bar per topic
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { computeDeckMastery, computeTopicMastery, deckCards, useLearningStore } from '@/stores/useLearningStore';

function getMasteryColor(mastery: number): string {
  if (mastery >= 80) return 'border-green-400 bg-green-500/20 text-green-300';
  if (mastery >= 50) return 'border-yellow-400 bg-yellow-500/20 text-yellow-300';
  if (mastery >= 20) return 'border-orange-400 bg-orange-500/20 text-orange-300';
  return 'border-red-400 bg-red-500/20 text-red-300';
}

function SkillTreeInner() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);

  const nodes = useMemo(
    () =>
      decks.map((deck) => {
        const mastery = computeDeckMastery(deck, reviews);
        return {
          id: deck.id,
          name: deck.name,
          icon: deck.icon,
          cardCount: deckCards(deck).length,
          mastery: Math.round(mastery.value * 100),
          seen: mastery.seen,
          topics: deck.topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            mastery: Math.round(computeTopicMastery(topic, reviews).value * 100),
          })),
        };
      }),
    [decks, reviews]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">🌳 Skill Tree</h3>
        <p className="text-xs text-white/50">Your mastery across every deck. Quizzes and flashcards level it up.</p>
      </div>

      {nodes.length === 0 && (
        <p className="text-sm text-white/40 text-center mt-12">No decks yet. Create one to grow your skill tree.</p>
      )}

      {/* Deck Grid */}
      <div className="grid grid-cols-3 gap-4">
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'p-4 rounded-xl border-2 transition-all hover:scale-105 cursor-default',
              getMasteryColor(node.mastery)
            )}
          >
            <h4 className="text-sm font-bold">
              <span className="mr-1.5">{node.icon}</span>
              {node.name}
            </h4>
            <p className="text-xs opacity-70 mt-1">
              {node.topics.length} topic{node.topics.length === 1 ? '' : 's'} • {node.cardCount} card
              {node.cardCount === 1 ? '' : 's'}
            </p>
            {/* Mastery bar */}
            <div className="mt-3 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all"
                style={{ width: `${Math.max(node.mastery, 2)}%` }}
              />
            </div>
            <p className="text-[10px] mt-1 opacity-60">
              {node.mastery}% mastery
              {node.seen > 0 ? ` • ${node.seen}/${node.cardCount} seen` : ' • untouched'}
            </p>
            {node.topics.length > 1 && (
              <div className="mt-2 space-y-1">
                {node.topics.map((topic) => (
                  <div key={topic.id} className="flex items-center gap-2 text-[10px] opacity-70">
                    <span className="flex-1 truncate">{topic.name}</span>
                    <span className="w-12 h-1 bg-black/30 rounded-full overflow-hidden">
                      <span className="block h-full bg-current" style={{ width: `${topic.mastery}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="text-center text-xs text-white/30">
        Mastery averages every card: unseen cards count as zero, and a card is mastered after consistent correct
        answers.
      </div>
    </div>
  );
}

export const SkillTree = memo(SkillTreeInner);
