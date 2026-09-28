// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit Forge App
// Daily habit tracking with grid visualization + routines
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import { utcDayKey } from '@/components/achievements/award';
import { currentStreak } from '@/components/achievements/day-streak';
import { collectStudyDays } from '@/components/achievements/study-streak';
import { HabitGrid } from './HabitGrid';
import { RoutineChecklist } from './RoutineChecklist';
import { rewardHabitCompletion } from './streak';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completions: string[]; // UTC day keys ('YYYY-MM-DD')
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
  { id: 'r8', text: 'Quiz or mock test', time: '16:00', category: 'study' },
  { id: 'r9', text: 'Light reading', time: '21:00', category: 'night' },
  { id: 'r10', text: 'Plan tomorrow', time: '22:00', category: 'night' },
];

const PRESET_HABITS: { name: string; icon: string; color: string }[] = [
  { name: 'Study 4h+', icon: '📚', color: 'cyan' },
  { name: 'Exercise', icon: '💪', color: 'green' },
  { name: 'No social media', icon: '📵', color: 'red' },
  { name: 'Daily quiz', icon: '✏️', color: 'purple' },
  { name: 'Read 20 pages', icon: '📖', color: 'amber' },
  { name: 'Early wake up', icon: '🌅', color: 'orange' },
  { name: 'Meditate', icon: '🧘', color: 'blue' },
  { name: 'Drank 3L water', icon: '💧', color: 'sky' },
];

/** How long the "+XP" line stays visible after checking a habit. */
const REWARD_VISIBLE_MS = 3500;

type Tab = 'habits' | 'routine';

interface RewardNotice {
  text: string;
  nonce: number;
}

function HabitForgeAppInner() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [activeTab, setActiveTab] = useState<Tab>('habits');
  const [reward, setReward] = useState<RewardNotice | null>(null);
  // Study streak (habits, routines, quizzes, notes, study time) — refreshed on each check-off.
  const [streak, setStreak] = useState(() => currentStreak(collectStudyDays()));

  // Hide the reward line after a moment (cleared from a timer, never synchronously).
  useEffect(() => {
    if (!reward) return;
    const id = setTimeout(() => setReward(null), REWARD_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [reward]);

  const refreshStreak = useCallback(() => {
    setStreak(currentStreak(collectStudyDays()));
  }, []);

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
    const today = utcDayKey();
    const target = habits.find((h) => h.id === habitId);
    if (!target) return;
    const wasDone = target.completions.includes(today);
    const updated = habits.map((h) =>
      h.id !== habitId
        ? h
        : {
            ...h,
            completions: wasDone
              ? h.completions.filter((d) => d !== today)
              : [...h.completions, today],
          }
    );
    setHabits(updated);
    saveHabits(updated);

    if (wasDone) {
      refreshStreak();
      return;
    }
    // Habit XP (once per habit per day), then the study streak: streak
    // achievements + the once-a-day streak bonus.
    const result = rewardHabitCompletion(habitId);
    setStreak(result.streak);
    const parts: string[] = [];
    if (result.habitXp > 0) parts.push(`+${result.habitXp} XP`);
    if (result.streakBonus > 0) {
      parts.push(`🔥 ${result.streak}-day streak bonus +${result.streakBonus} XP`);
    }
    if (parts.length > 0) {
      setReward((prev) => ({ text: parts.join(' · '), nonce: (prev?.nonce ?? 0) + 1 }));
    }
  }, [habits, refreshStreak]);

  const removeHabit = useCallback((habitId: string) => {
    const updated = habits.filter((h) => h.id !== habitId);
    setHabits(updated);
    saveHabits(updated);
    refreshStreak();
  }, [habits, refreshStreak]);

  const today = utcDayKey();

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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Today&apos;s Habits</h3>
                {streak > 0 && (
                  <span
                    className="text-xs font-semibold text-orange-300"
                    title="Days in a row with study activity: quizzes, revisions, planner tasks, habits, routines, notes or 10+ minutes in study apps"
                  >
                    🔥 {streak}-day streak
                  </span>
                )}
              </div>
              {reward && (
                <p key={reward.nonce} role="status" className="text-xs text-green-300">
                  {reward.text}
                </p>
              )}
              {habits.length === 0 && (
                <p className="text-xs text-white/40">
                  Add some habits to track!
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {habits.map((habit) => {
                  const done = habit.completions.includes(today);
                  return (
                    <div key={habit.id} className="relative group">
                      <button
                        onClick={() => toggleHabitToday(habit.id)}
                        className={cn(
                          'w-full p-3 rounded-lg border text-left transition-all',
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
                      </button>
                      <button
                        onClick={() => removeHabit(habit.id)}
                        aria-label={`Remove ${habit.name}`}
                        className="absolute top-1 right-1 w-5 h-5 rounded bg-black/60 opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 text-xs"
                      >
                        ×
                      </button>
                    </div>
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
          <RoutineChecklist routines={DEFAULT_ROUTINES} onProgress={refreshStreak} />
        )}
      </div>
    </div>
  );
}

export const HabitForgeApp = memo(HabitForgeAppInner);
