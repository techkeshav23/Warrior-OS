// ═══════════════════════════════════════════════════════════
// WARRIOR OS — StartMenu Component (FORGE HUD)
// Rises from the taskbar: identity (avatar, level title) with the XP
// meter in forge colors, an app search, the app grid (AppIcon tiles)
// and footer actions (Settings, Lock). Enter in the search launches
// the first match; no match offers the command palette instead.
//
// Also exports a tiny open-state signal (useStartMenuOpen) so the
// taskbar's Start button can show a pressed state without extra wiring.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight, Lock, SearchX, Settings, Sparkles } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import { useOSStore } from '@/stores/useOSStore';
import { LEVEL_THRESHOLDS } from '@/lib/constants';
import { getVisitorMode } from '@/lib/visitor';
import { OWNER } from '@/config/owner';
import { BrandMark } from '@/components/showcase/BrandMark';
import { AppIcon } from '@/components/ui/AppIcon';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, Kbd } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { cn } from '@/lib/utils';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Open-state signal (read by the taskbar's Start button) ───

let startMenuOpen = false;
const startMenuListeners = new Set<() => void>();

function setStartMenuSignal(open: boolean): void {
  if (startMenuOpen === open) return;
  startMenuOpen = open;
  startMenuListeners.forEach((listener) => listener());
}

function subscribeStartMenu(listener: () => void): () => void {
  startMenuListeners.add(listener);
  return () => {
    startMenuListeners.delete(listener);
  };
}

/** True while the Start menu is open. */
export function useStartMenuOpen(): boolean {
  return useSyncExternalStore(
    subscribeStartMenu,
    () => startMenuOpen,
    () => false
  );
}

// ─── Helpers ───

/** Opens the command palette the way a person would: Ctrl+K on document. */
function openCommandPalette(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true })
  );
}

function formatXP(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('en-IN');
}

// ─── XP meter: segmented cells, ember → gold ───

const XP_CELLS = 24;

function XpMeter({ pct }: { pct: number }) {
  const filled = (Math.min(Math.max(pct, 0), 100) / 100) * XP_CELLS;
  const lead = Math.ceil(filled) - 1;
  return (
    <div
      role="progressbar"
      aria-label="Level progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="flex h-1.5 gap-[3px]"
    >
      {Array.from({ length: XP_CELLS }, (_, i) => {
        const cell = Math.min(Math.max(filled - i, 0), 1);
        const t = XP_CELLS > 1 ? i / (XP_CELLS - 1) : 1;
        const color = `color-mix(in oklab, var(--color-ember-500) ${Math.round((1 - t) * 100)}%, var(--color-gold))`;
        return (
          <span key={i} className="relative h-full flex-1 -skew-x-[24deg] overflow-hidden bg-white/[0.06] shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]">
            {cell > 0 && (
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${cell * 100}%`,
                  background: color,
                  boxShadow: i === lead ? `0 0 8px ${color}` : undefined,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Start menu ───

export function StartMenu({ isOpen, onClose }: StartMenuProps) {
  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const levelTitle = useXPStore((s) => s.getLevelTitle());
  const levelProgress = useXPStore((s) => s.getLevelProgress());
  const reduceMotion = useReducedMotion();

  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Fresh search every time the menu opens (snapshot pattern, no effect).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) setQuery('');
  }

  // Let the taskbar know (pressed Start button).
  useEffect(() => {
    setStartMenuSignal(isOpen);
    return () => setStartMenuSignal(false);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    let listenerAdded = false;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close on open click
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      listenerAdded = true;
    }, 100);
    return () => {
      clearTimeout(timerId);
      if (listenerAdded) {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleLaunch = useCallback(
    (appId: string) => {
      launchApp(appId, activeWorkspaceId);
      onClose();
    },
    [launchApp, activeWorkspaceId, onClose]
  );

  const lockScreen = useCallback(() => {
    onClose();
    useOSStore.getState().setPhase('lock');
  }, [onClose]);

  const searchEverywhere = useCallback(() => {
    onClose();
    openCommandPalette();
  }, [onClose]);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registeredApps;
    return registeredApps.filter(
      (app) => app.name.toLowerCase().includes(q) || (app.description ?? '').toLowerCase().includes(q)
    );
  }, [registeredApps, query]);

  // Identity + level numbers (read at render; the menu only renders while open)
  const isGuest = isOpen && getVisitorMode() === 'guest';
  const displayName = isGuest ? 'Guest Warrior' : OWNER.name;
  const levelInfo = LEVEL_THRESHOLDS.find((l) => l.level === level);
  const maxed = !levelInfo || !Number.isFinite(levelInfo.maxXP);
  const into = levelInfo ? xp - levelInfo.minXP : xp;
  const span = levelInfo && !maxed ? levelInfo.maxXP - levelInfo.minXP : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          role="dialog"
          aria-label="Start menu"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.14, ease: EASE } }}
          transition={{ duration: 0.26, ease: EASE }}
          // Unclipped wrapper casts the plate's shadow (clip-path eats box-shadows).
          className="armor-drop fixed bottom-14 left-2 h-[min(700px,calc(100vh-72px))] w-[460px] max-w-[calc(100vw-16px)]"
          style={{ zIndex: 'var(--z-start-menu)', transformOrigin: 'bottom left' }}
        >
          <div
            className="armor-popover chamfer-tl-br rivets relative flex h-full w-full flex-col overflow-hidden"
            style={{ ['--cut' as string]: '16px' }}
          >
            {/* Forge hairline */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-4 right-24 top-0 h-0.5 bg-linear-to-r from-ember-600 via-ember-400 to-transparent"
            />

            {/* ─── Brand strip ─── */}
            <div className="flex h-10 shrink-0 items-center gap-2 bg-linear-to-b from-white/[0.04] to-black/20 px-5 shadow-[inset_0_-1px_0_rgb(0_0_0/0.65),inset_0_-2px_0_rgb(255_255_255/0.04)]">
              <BrandMark size={20} />
              <span className="engraved font-display text-[11px] font-bold tracking-[0.28em] text-fg-muted">WARRIOR OS</span>
              <Badge tone={isGuest ? 'neutral' : 'accent'} size="sm" className="ml-auto">
                {isGuest ? 'Guest session' : 'Owner'}
              </Badge>
            </div>

            {/* ─── Identity + XP ─── */}
            <div className="shrink-0 px-5 pb-4 pt-3">
              <button
                type="button"
                onClick={() => handleLaunch('warrior-profile')}
                className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 chamfer [--cut:8px] px-2 py-1.5 text-left transition-colors duration-120 ease-out-quint hover:bg-white/[0.05] active:bg-white/[0.08] focus-ring-inset"
                aria-label={`${displayName}, level ${level} ${levelTitle}. Open profile`}
              >
                <Avatar name={displayName} size="lg" ring status="online" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-sm font-bold uppercase tracking-[0.06em] text-fg">{displayName}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className="tabular">Level {level}</span>
                    <span aria-hidden className="text-fg-faint">
                      ·
                    </span>
                    <span className="truncate font-medium text-gold">{levelTitle}</span>
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className="shrink-0 text-fg-faint transition-[color,transform] duration-120 group-hover:translate-x-0.5 group-hover:text-fg-muted"
                />
              </button>

              <div className="mt-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">{maxed ? 'Max level' : `XP to level ${level + 1}`}</span>
                  <span className="tabular font-mono text-2xs text-fg-subtle">
                    {maxed ? (
                      <span className="text-gold">{formatXP(xp)} XP</span>
                    ) : (
                      <>
                        <span className="text-gold">{formatXP(into)}</span> / {formatXP(span)}
                      </>
                    )}
                  </span>
                </div>
                <XpMeter pct={levelProgress} />
              </div>
            </div>

            {/* ─── Search ─── */}
            <div className="shrink-0 px-5 pb-3">
              <SearchField
                value={query}
                onValueChange={setQuery}
                placeholder="Search apps"
                aria-label="Search apps"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (apps[0]) handleLaunch(apps[0].id);
                    else if (query.trim()) searchEverywhere();
                  }
                }}
              />
            </div>

            {/* ─── App grid ─── */}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">{query.trim() ? 'Results' : 'All apps'}</span>
                <span className="tabular font-mono text-2xs text-fg-faint">{apps.length}</span>
              </div>

              {apps.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No apps match"
                  description={`Nothing called “${query.trim()}”. The command palette searches notes, decks and actions too.`}
                  actions={
                    <Button size="sm" variant="secondary" leadingIcon={Sparkles} onClick={searchEverywhere}>
                      Search everywhere
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-5 gap-1">
                  {apps.map((app, index) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleLaunch(app.id)}
                      title={app.description ?? app.name}
                      className={cn(
                        'group flex min-w-0 flex-col items-center gap-2 chamfer [--cut:8px] px-1 pb-2.5 pt-3 text-center',
                        'transition-colors duration-120 ease-out-quint hover:bg-white/[0.05] active:bg-white/[0.08] focus-ring-inset',
                        index === 0 && query.trim() && 'bg-white/[0.06] shadow-[inset_0_-2px_0_var(--color-ember-400,#ff8a3d)]',
                        !reduceMotion && 'animate-rise-in'
                      )}
                      style={reduceMotion ? undefined : ({ animationDelay: `${Math.min(index, 24) * 10}ms` } as CSSProperties)}
                    >
                      <AppIcon appId={app.id} size={40} />
                      <span className="line-clamp-2 min-h-8 w-full text-xs leading-4 text-fg-muted transition-colors duration-120 group-hover:text-fg">
                        {app.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Footer ─── */}
            <div className="flex shrink-0 items-center gap-2 bg-black/25 px-3 py-2.5 shadow-[inset_0_1px_0_rgb(0_0_0/0.65),inset_0_2px_0_rgb(255_255_255/0.04)]">
              <Button variant="ghost" leadingIcon={Settings} onClick={() => handleLaunch('settings')}>
                Settings
              </Button>
              <Button
                variant="ghost"
                leadingIcon={Lock}
                onClick={lockScreen}
                className="ml-auto"
                aria-label="Lock screen"
                trailingIcon={<Kbd size="sm" keys={['Ctrl', 'L']} className="ml-1" />}
              >
                Lock
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
