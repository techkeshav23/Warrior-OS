// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Background picker + wallpaper director
//
// BackgroundPicker: an armor drawer that slides up from the bottom of
// the desktop (desktop menu → "Change background…") with a live painted
// preview of every wallpaper in the Settings catalog. The current one
// carries an ember edge. Click / Enter applies (saved to the active
// workspace); ←/→ (and Home/End) move, Esc closes. It also shows the
// slideshow interval and why a background may not stick (adaptive
// wallpaper, lite mode).
//
// WallpaperDirector (mounted once on the desktop): runs the background
// slideshow and Ctrl+Alt+W / Ctrl+Alt+Shift+W, and shows a small plate
// naming the new wallpaper when a shortcut or the slideshow changes it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Clock3, Feather, ImagePlay, Settings2, Shuffle, SunMoon, X } from 'lucide-react';
import { Button, IconButton, Kbd, SegmentedControl } from '@/components/ui';
import { WALLPAPERS, WallpaperThumb, resolveWallpaper, wallpaperLabel } from '@/components/apps/settings/wallpapers';
import { useSettingsStore, SLIDESHOW_INTERVALS, type SlideshowInterval } from '@/stores/useSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  applyWallpaperToWorkspace,
  WALLPAPER_HUD_EVENT,
  type WallpaperHudDetail,
} from '@/lib/wallpaper-cycle';
import {
  NEXT_WALLPAPER_KEYS,
  useSlideshowBlocker,
  useWallpaperShortcuts,
  useWallpaperSlideshow,
} from '@/hooks/useWallpaperSlideshow';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { cn } from '@/lib/utils';

const INTERVAL_OPTIONS = SLIDESHOW_INTERVALS.map((m) => ({
  value: String(m),
  label: m === 0 ? 'Off' : m === 60 ? '1 h' : `${m}m`,
  'aria-label': m === 0 ? 'Slideshow off' : `Every ${m === 60 ? 'hour' : `${m} minutes`}`,
}));

// ─── Picker ───

export interface BackgroundPickerProps {
  open: boolean;
  onClose: () => void;
}

function BackgroundPickerInner({ open, onClose }: BackgroundPickerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="background-picker"
          data-background-picker=""
          className="armor-drop fixed bottom-14 left-1/2 w-[min(1120px,calc(100vw-32px))] -translate-x-1/2"
          style={{ zIndex: 'var(--z-context-menu)' }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.14, ease: EASE_OUT_QUINT } }}
          transition={{ duration: 0.22, ease: EASE_OUT_QUINT }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <PickerBody onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function PickerBody({ onClose }: { onClose: () => void }) {
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const interval = useSettingsStore((s) => s.slideshowInterval);
  const order = useSettingsStore((s) => s.slideshowOrder);
  const workspaceName = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name ?? 'this'
  );
  const blocker = useSlideshowBlocker();
  const current = resolveWallpaper(wallpaper);
  const stripRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string>(current);
  const [flashId, setFlashId] = useState<string | null>(null);

  // Focus the current wallpaper on open and scroll it into view.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-wallpaper="${current}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc (from anywhere) and a press outside the drawer close it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('[data-background-picker]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  const apply = useCallback((id: string) => {
    setFocusId(id);
    setFlashId(id);
    if (resolveWallpaper(useSettingsStore.getState().wallpaper) !== id) applyWallpaperToWorkspace(id, 'picker');
  }, []);

  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 420);
    return () => window.clearTimeout(t);
  }, [flashId]);

  const onStripKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const ids = WALLPAPERS.map((w) => w.id as string);
    const at = Math.max(0, ids.indexOf(focusId));
    let next: string | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = ids[(at + 1) % ids.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = ids[(at - 1 + ids.length) % ids.length];
    else if (e.key === 'Home') next = ids[0];
    else if (e.key === 'End') next = ids[ids.length - 1];
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      apply(focusId);
      return;
    }
    if (!next) return;
    e.preventDefault();
    setFocusId(next);
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-wallpaper="${next}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };

  const openSettings = () => {
    onClose();
    useAppStore.getState().launchApp('settings', useWorkspaceStore.getState().activeWorkspaceId);
  };

  return (
    <section
      role="dialog"
      aria-label="Change background"
      className="armor-popover rivets relative flex flex-col [--cut-br:14px] [--cut-tl:14px] [--rivet-inset:7px]"
    >
      {/* ─── Header plate ─── */}
      <header className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/50 px-5 pb-2.5 pt-3 shadow-[0_1px_0_rgb(255_255_255/0.04)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <ImagePlay size={18} strokeWidth={1.75} className="shrink-0 text-ember-400" aria-hidden />
          <h2 className="engraved font-display text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
            Background
          </h2>
          <span aria-hidden className="h-4 w-px bg-line-strong" />
          <p className="min-w-0 truncate text-ui text-fg" title={wallpaperLabel(current)}>
            {wallpaperLabel(current)}
            <span className="text-fg-subtle"> · saved to {workspaceName}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-fg-subtle md:flex">
            Next <Kbd keys={NEXT_WALLPAPER_KEYS} size="sm" />
          </span>
          <IconButton icon={Settings2} size="sm" aria-label="Appearance settings" tooltip onClick={openSettings} />
          <IconButton icon={X} size="sm" aria-label="Close" tooltip shortcut="Esc" onClick={onClose} />
        </div>
      </header>

      {/* ─── Wallpaper strip ─── */}
      <div
        ref={stripRef}
        role="listbox"
        aria-label="Wallpapers"
        aria-orientation="horizontal"
        onKeyDown={onStripKeyDown}
        className="flex gap-3 overflow-x-auto px-5 pb-3 pt-3.5 scrollbar-thin [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]"
      >
        {WALLPAPERS.map((w, i) => {
          const selected = w.id === current;
          const flashing = flashId === w.id;
          return (
            <div
              key={w.id}
              role="option"
              aria-selected={selected}
              data-wallpaper={w.id}
              tabIndex={w.id === focusId ? 0 : -1}
              title={`${w.label} · ${w.hint}`}
              onClick={() => apply(w.id)}
              onFocus={() => setFocusId(w.id)}
              className={cn(
                'group relative w-44 shrink-0 cursor-pointer select-none outline-none',
                'chamfer-sm [--cut:8px] bg-steel-950 p-1 bevel',
                'transition-[background-color,transform] duration-180 ease-out-quint',
                'hover:bg-steel-750 focus-visible:bg-steel-750',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'
              )}
            >
              <div className="relative chamfer-sm [--cut:6px] overflow-hidden">
                <WallpaperThumb
                  id={w.id}
                  className={cn(
                    'transition-[transform,filter] duration-260 ease-out-quint group-hover:scale-[1.05]',
                    !selected && 'brightness-[0.82] group-hover:brightness-100 group-focus-visible:brightness-100'
                  )}
                />
                {flashing && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-ember-300"
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE_OUT_QUINT }}
                  />
                )}
                <span className="absolute left-1.5 top-1.5 bg-ink-950/75 px-1 font-mono text-[10px] leading-4 text-fg-muted tabular chamfer-xs [--cut:3px]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {selected && (
                  <span className="absolute right-0 top-0 bg-linear-to-b from-ember-300 to-ember-500 px-2 font-display text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-ink-950 [--cut-bl:6px] chamfer [--cut:0px]">
                    Active
                  </span>
                )}
              </div>
              <div className="flex min-w-0 items-baseline justify-between gap-2 px-1.5 pb-0.5 pt-1.5">
                <span className={cn('truncate text-ui font-medium', selected ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>
                  {w.label}
                </span>
                <span className="shrink-0 truncate font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
                  {w.hint.split(' · ')[0]}
                </span>
              </div>
              {/* Molten edge on the current wallpaper (drawn over the art). */}
              {selected && <span aria-hidden className="ember-edge pointer-events-none absolute inset-0" />}
            </div>
          );
        })}
      </div>

      {/* ─── Footer: slideshow + notes ─── */}
      <footer className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/50 px-5 pb-3 pt-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
        <div className="flex items-center gap-2.5">
          <Clock3 size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
          <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
            Slideshow
          </span>
          <SegmentedControl
            size="sm"
            aria-label="Slideshow interval"
            value={String(interval)}
            onChange={(v) => useSettingsStore.getState().setSlideshowInterval(Number(v) as SlideshowInterval)}
            options={INTERVAL_OPTIONS.map((o) => ({ ...o, disabled: blocker !== null }))}
          />
          <IconButton
            icon={Shuffle}
            size="sm"
            aria-label={order === 'shuffle' ? 'Shuffle on' : 'Shuffle off'}
            tooltip={order === 'shuffle' ? 'Shuffle: on' : 'Shuffle: off (in order)'}
            active={order === 'shuffle'}
            disabled={blocker !== null}
            onClick={() =>
              useSettingsStore.getState().setSlideshowOrder(order === 'shuffle' ? 'order' : 'shuffle')
            }
          />
        </div>
        <PickerNote blocker={blocker} onOpenSettings={openSettings} />
      </footer>
    </section>
  );
}

function PickerNote({
  blocker,
  onOpenSettings,
}: {
  blocker: ReturnType<typeof useSlideshowBlocker>;
  onOpenSettings: () => void;
}) {
  if (blocker === 'adaptive') {
    return (
      <p className="flex min-w-0 flex-1 items-center justify-end gap-2 text-xs text-fg-subtle">
        <SunMoon size={14} strokeWidth={1.75} className="shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 truncate" title="Adaptive wallpaper follows the time of day and replaces your pick at the next shift. The slideshow is off while it is on.">
          Adaptive wallpaper is on: it changes the background by time of day, so the slideshow is paused.
        </span>
        <Button size="sm" variant="ghost" onClick={() => useSettingsStore.getState().toggleAdaptiveWallpaper()}>
          Turn off
        </Button>
      </p>
    );
  }
  if (blocker === 'lite') {
    return (
      <p className="flex min-w-0 flex-1 items-center justify-end gap-2 text-xs text-fg-subtle">
        <Feather size={14} strokeWidth={1.75} className="shrink-0 text-info" aria-hidden />
        <span className="min-w-0 truncate">Lite mode shows the still Forge Night background; your pick applies when it is off.</span>
        <Button size="sm" variant="ghost" onClick={onOpenSettings}>
          Settings
        </Button>
      </p>
    );
  }
  return (
    <p className="min-w-0 flex-1 truncate text-right text-xs text-fg-subtle">
      Click or press Enter to apply · ← → to browse · Esc to close
    </p>
  );
}

export const BackgroundPicker = memo(BackgroundPickerInner);

// ─── Director: slideshow, shortcuts and the change plate ───

const HUD_CAPTION: Record<WallpaperHudDetail['source'], string> = {
  shortcut: 'Wallpaper',
  slideshow: 'Slideshow',
  menu: 'Wallpaper',
  picker: 'Wallpaper',
  nexus: 'NEXUS',
};

function WallpaperDirectorInner() {
  useWallpaperSlideshow();
  useWallpaperShortcuts();
  const reduceMotion = useReducedMotion() ?? false;
  const [hud, setHud] = useState<(WallpaperHudDetail & { key: number }) | null>(null);

  useEffect(() => {
    let timer = 0;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<WallpaperHudDetail>).detail;
      // The picker shows the change itself.
      if (!detail || detail.source === 'picker') return;
      setHud({ ...detail, key: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHud(null), 1800);
    };
    window.addEventListener(WALLPAPER_HUD_EVENT, onChange);
    return () => {
      window.removeEventListener(WALLPAPER_HUD_EVENT, onChange);
      window.clearTimeout(timer);
    };
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-16 -translate-x-1/2"
      style={{ zIndex: 'var(--z-notification)' }}
    >
      <AnimatePresence>
        {hud && (
          <motion.div
            key="wallpaper-hud"
            className="armor-drop"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.2, ease: EASE_OUT_QUINT }}
          >
            <div className="armor-popover flex items-center gap-3 py-1.5 pl-1.5 pr-4 [--cut:8px]">
              <div className="w-16 shrink-0 chamfer-xs overflow-hidden">
                <WallpaperThumb id={hud.id} />
              </div>
              <div className="min-w-0">
                <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
                  {HUD_CAPTION[hud.source]}
                </p>
                <p className="truncate text-ui font-medium text-fg">
                  {hud.label}
                  <span className="ml-2 font-mono text-2xs text-fg-subtle tabular">
                    {hud.index}/{hud.total}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

export const WallpaperDirector = memo(WallpaperDirectorInner);
