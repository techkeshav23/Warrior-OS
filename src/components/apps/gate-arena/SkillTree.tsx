// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Skill Tree (Subject Mastery Map)
// Canvas-based node graph showing subject-wise mastery
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getAvailableSubjects, getQuestionsBySubject } from '@/data/gate-questions';
import { getTopicsForSubject } from '@/data/gate-questions';

interface SubjectNode {
  subject: string;
  topicCount: number;
  questionCount: number;
  // Mastery 0-100 (placeholder — will be driven by quiz results later)
  mastery: number;
}

function getMasteryColor(mastery: number): string {
  if (mastery >= 80) return 'border-green-400 bg-green-500/20 text-green-300';
  if (mastery >= 50) return 'border-yellow-400 bg-yellow-500/20 text-yellow-300';
  if (mastery >= 20) return 'border-orange-400 bg-orange-500/20 text-orange-300';
  return 'border-red-400 bg-red-500/20 text-red-300';
}

function SkillTreeInner() {
  const nodes = useMemo<SubjectNode[]>(() => {
    return getAvailableSubjects().map((subject) => ({
      subject,
      topicCount: getTopicsForSubject(subject).length,
      questionCount: getQuestionsBySubject(subject).length,
      mastery: 0, // Will be computed from Firestore quiz history
    }));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">🌳 Skill Tree</h3>
        <p className="text-xs text-white/50">
          Your mastery across GATE subjects. Take quizzes to level up!
        </p>
      </div>

      {/* Subject Grid */}
      <div className="grid grid-cols-3 gap-4">
        {nodes.map((node, i) => (
          <motion.div
            key={node.subject}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              'p-4 rounded-xl border-2 transition-all hover:scale-105 cursor-default',
              getMasteryColor(node.mastery)
            )}
          >
            <h4 className="text-sm font-bold">{node.subject}</h4>
            <p className="text-xs opacity-70 mt-1">
              {node.topicCount} topics • {node.questionCount} questions
            </p>
            {/* Mastery bar */}
            <div className="mt-3 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-current rounded-full transition-all"
                style={{ width: `${Math.max(node.mastery, 2)}%` }}
              />
            </div>
            <p className="text-[10px] mt-1 opacity-60">{node.mastery}% mastery</p>
          </motion.div>
        ))}
      </div>

      <div className="text-center text-xs text-white/30">
        Mastery is calculated from quiz accuracy per subject.
        <br />
        Complete quizzes to see your skill tree grow!
      </div>
    </div>
  );
}

export const SkillTree = memo(SkillTreeInner);
