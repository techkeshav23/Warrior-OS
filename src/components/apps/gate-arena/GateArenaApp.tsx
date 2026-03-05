// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Arena App
// Main exam prep hub: Quiz, PYQ, Mock Test, Formulas, Planner
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { QuizEngine } from './QuizEngine';
import { PYQBrowser } from './PYQBrowser';
import { MockTest } from './MockTest';
import { FormulaCards } from './FormulaCards';
import { StudyPlanner } from './StudyPlanner';
import { SkillTree } from './SkillTree';
import { SpacedRepetition } from './SpacedRepetition';

type Tab = 'quiz' | 'pyq' | 'mock' | 'formulas' | 'planner' | 'skill-tree' | 'revision';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'quiz', label: 'Quiz', icon: '📝' },
  { id: 'skill-tree', label: 'Skill Tree', icon: '🌳' },
  { id: 'pyq', label: 'PYQ', icon: '📚' },
  { id: 'mock', label: 'Mock Test', icon: '⏱️' },
  { id: 'formulas', label: 'Formulas', icon: '🧮' },
  { id: 'revision', label: 'Revision', icon: '🔄' },
  { id: 'planner', label: 'Planner', icon: '📋' },
];

function GateArenaAppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('quiz');

  return (
    <div className="flex h-full bg-black/30">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0 border-r border-white/10 bg-black/20 p-2 flex flex-col gap-1">
        <h2 className="text-sm font-bold text-cyan-400 px-3 py-2 tracking-wider">
          🎯 GATE ARENA
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
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-y-auto"
          >
            {activeTab === 'quiz' && <QuizEngine />}
            {activeTab === 'skill-tree' && <SkillTree />}
            {activeTab === 'pyq' && <PYQBrowser />}
            {activeTab === 'mock' && <MockTest />}
            {activeTab === 'formulas' && <FormulaCards />}
            {activeTab === 'revision' && <SpacedRepetition />}
            {activeTab === 'planner' && <StudyPlanner />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export const GateArenaApp = memo(GateArenaAppInner);
