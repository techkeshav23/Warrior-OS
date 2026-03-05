// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Forge App
// Daily habit tracking with grid visualization + routines
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { HabitGrid } from './HabitGrid';
import { RoutineChecklist } from './RoutineChecklist';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[]; // ISO date strings
}

export interface RoutineItem {
  id: string;
  text: string;
  time: string;
  category: 'morning' | 'study' | 'night';
}

function loadHabits(): Habit[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('warrior-habits') || '[]'); }
  catch { return []; }
}

function saveHabits(habits: Habit[]) {
  localStorage.setItem('warrior-habits', JSON.stringify(habits));
}

const DEFAULT_ROUTINES: RoutineItem[] = [
  { id: 'r1', text: 'Wake up early', time: '6:00', category: 'morning' },
  { id: 'r2', text: 'Exercise / Walk', time: '6:30', category: 'morning' },
  { id: 'r3', text: 'Cold shower', time: '7:00', category: 'morning' },
  { id: 'r4', text: 'Study Session 1', time: '8:00', category: 'study' },
  { id: 'r5', text: 'Revise notes', time: '10:00', category: 'study' },
  { id: 'r6', text: 'Practice problems', time: '11:00', category: 'study' },
  { id: 'r7', text: 'Study Session 2', time: '14:00', category: 'study' },
  { id: 'r8', text: 'Mock test / PYQs', time: '16:00', category: 'study' },
  { id: 'r9', text: 'Light reading', time: '21:00', category: 'night' },
  { id: 'r10', text: 'Plan tomorrow', time: '22:00', category: 'night' },
];

const PRESET_HABITS: { name: string; icon: string; color: string }[] = [
  { name: 'Study 4h+', icon: '📚', color: 'cyan' },
  { name: 'Exercise', icon: '💪', color: 'green' },
  { name: 'No social media', icon: '📵', color: 'red' },
  { name: 'Solved PYQs', icon: '✏️', color: 'purple' },
  { name: 'Read 20 pages', icon: '📖', color: 'amber' },
  { name: 'Early wake up', icon: '🌅', color: 'orange' },
  { name: 'Meditate', icon: '🧘', color: 'blue' },
  { name: 'Drank 3L water', icon: '💧', color: 'sky' },
];

type Tab = 'habits' | 'routine';

function HabitForgeAppInner() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [activeTab, setActiveTab] = useState<Tab>('habits');

  const addHabit = useCallback((preset: typeof PRESET_HABITS[0]) => {
    const habit: Habit = {
      id: `habit-${Date.now()}`,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      completions: [],
    };
    const updated = [...habits, habit];
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const toggleHabitToday = useCallback((habitId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = habits.map((h) => {
      if (h.id !== habitId) return h;
      const has = h.completions.includes(today);
      return {
        ...h,
        completions: has
          ? h.completions.filter((d) => d !== today)
          : [...h.completions, today],
      };
    });
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  const removeHabit = useCallback((habitId: string) => {
    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);
    saveHabits(updated);
  }, [habits]);

  return (
    <div className="flex flex-col h-full bg-black/30">
      {/* Tab bar */}
      <div className="flex border-b border-white/10 bg-black/20">
        {(['habits', 'routine'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-3 text-sm font-medium capitalize transition-all',
              activeTab === tab
                ? 'text-orange-300 border-b-2 border-orange-400'
                : 'text-white/50 hover:text-white/70'
            )}
          >
            {tab === 'habits' ? '🔥 Habits' : '📋 Routine'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'habits' && (
          <>
            {/* Today's habits */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white">Today&apos;s Habits</h3>
              {habits.length === 0 && (
                <p className="text-xs text-white/40">
                  Add some habits to track!
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {habits.map((habit) => {
                  const today = new Date().toISOString().split('T')[0];
                  const done = habit.completions.includes(today);
                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabitToday(habit.id)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all group relative',
                        done
                          ? 'bg-green-500/20 border-green-500/30'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      )}
                    >
                      <span className="text-lg">{habit.icon}</span>
                      <p className={cn('text-xs mt-1', done ? 'text-green-300' : 'text-white/70')}>
                        {habit.name}
                      </p>
                      {done && <span className="absolute top-2 right-2 text-green-400 text-xs">✓</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeHabit(habit.id); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs"
                      >
                        ×
                      </button>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add preset habits */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-white/60">Add Habit</h4>
              <div className="flex flex-wrap gap-2">
                {PRESET_HABITS.filter(
                  (p) => !habits.some((h) => h.name === p.name)
                ).map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addHabit(preset)}
                    className="px-3 py-1.5 rounded text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-all"
                  >
                    {preset.icon} {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Habit Grid Visualization */}
            {habits.length > 0 && <HabitGrid habits={habits} />}
          </>
        )}

        {activeTab === 'routine' && (
          <RoutineChecklist routines={DEFAULT_ROUTINES} />
        )}
      </div>
    </div>
  );
}

export const HabitForgeApp = memo(HabitForgeAppInner);
