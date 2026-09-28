// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour
// First-visit walkthrough voiced by NEXUS: five short stops (welcome,
// the Ctrl+K command bar, desktop apps, the living world, Settings)
// on a glass card, with a spotlight that glides between the real
// elements it talks about. Missing or covered target → centred card.
//
// • Starts on its own once per browser, after the desktop has settled
//   (tour/useTourAutoStart); never again once finished or skipped.
//   useTourStore.getState().startTour() replays it (Settings).
// • Next / Back / Skip, ← → to move, Esc = Skip. Tab stays in the
//   card; focus goes back where it was when the tour ends.
// • Ctrl+K (or "Try it now") steps the tour aside while the command
//   bar is open; it picks up at the following stop afterwards.
// • The rest of the OS is click-blocked while the card is up.
// • prefers-reduced-motion: no glide, pulse, orb spin or slide.
//
// Mount once inside the desktop phase of page.tsx.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Command, Rocket } from 'lucide-react';
import { useOSStore } from '@/stores/useOSStore';
import { useTourStore } from '@/stores/useTourStore';
import { cn } from '@/lib/utils';
import { NexusOrb } from './tour/NexusOrb';
import { useTourAutoStart } from './tour/useTourAutoStart';
import { TOUR_ROOT_SELECTOR, isCommandBarOpen, resolveTarget, sendCommandBarShortcut } from './tour/dom';
import { placeCard, readBox, readViewport, sameBox, type Box, type Size } from './tour/layout';
import {
  COMMAND_EXAMPLES,
  COMMAND_STEP_INDEX,
  TOUR_LAST_STEP,
  TOUR_STEPS,
  commandKeys,
  detectPlatform,
  tourCopy,
  type TourStepId,
} from './tour/steps';

export interface GuidedTourProps {
  /**
   * Opens the Ctrl+K command bar for "Try it now". Without it the tour
   * sends a Ctrl+K key event, which the page's shortcut hook handles.
   */
  onOpenCommandBar?: () => void;
}

// Above windows, taskbar, command bar (800), toasts (900) and modals
// (950); below the boot / lock phases (1000) and the FX layers (1080+).
const TOUR_Z = 960;
/** How often to check whether the command bar is open. */
const WATCH_MS = 250;
/** How often the spotlight re-measures its target (icons animate in, windows move). */
const MEASURE_MS = 400;
/** Stepped aside but the command bar never showed up: come back after this long. */
const ASIDE_GRACE_MS = 1200;
/** Target lookups per stop before settling for a centred card. */
const RESOLVE_ATTEMPTS = 4;
/** Card size until the first measurement. */
const CARD_ESTIMATE: Size = { w: 360, h: 260 };

const DIM = 'rgba(2, 3, 10, 0.72)';
// Same shape in both states so framer-motion can interpolate between them.
const SPOT_RING = `0px 0px 0px 9999px ${DIM}, 0px 0px 0px 1.5px rgba(0, 240, 255, 0.8), 0px 0px 28px 4px rgba(0, 240, 255, 0.3)`;
const SPOT_PLAIN = `0px 0px 0px 9999px ${DIM}, 0px 0px 0px 0px rgba(0, 240, 255, 0), 0px 0px 0px 0px rgba(0, 240, 255, 0)`;

const GLIDE = { type: 'spring', stiffness: 170, damping: 26, mass: 0.9 } as const;
const INSTANT = { duration: 0 } as const;

const CARD_STYLE = {
  background: 'linear-gradient(160deg, rgba(14, 16, 28, 0.95), rgba(8, 9, 16, 0.95))',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(0, 240, 255, 0.18)',
  boxShadow:
    '0 18px 60px rgba(0, 0, 0, 0.55), 0 0 32px rgba(0, 240, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
} as const;

const BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-xs font-mono transition-colors duration-150 focus-ring';
const BUTTON_GHOST = cn(
  BUTTON,
  'border border-white/10 bg-white/5 text-text-secondary hover:border-white/20 hover:text-text-primary'
);
const BUTTON_PRIMARY = cn(
  BUTTON,
  'border border-accent-primary/50 bg-accent-primary/15 font-semibold text-accent-primary',
  'hover:bg-accent-primary/25 hover:shadow-[0_0_18px_rgba(0,240,255,0.25)]'
);
const CORNER = 'pointer-events-none absolute h-2.5 w-2.5 border-accent-primary/60';

interface Spot {
  stepId: TourStepId | null;
  box: Box | null;
  /** `data-desktop-icon` of the spotlit element, when it is a desktop icon. */
  appId: string | null;
}

const NO_SPOT: Spot = { stepId: null, box: null, appId: null };

// ─── Navigation (store-driven: buttons and the key listener share it) ───

function goNext(): void {
  const tour = useTourStore.getState();
  if (tour.step >= TOUR_LAST_STEP) tour.finish();
  else tour.goTo(tour.step + 1);
}

function goBack(): void {
  const tour = useTourStore.getState();
  if (tour.step > 0) tour.goTo(tour.step - 1);
}

function skipTour(): void {
  useTourStore.getState().skip();
}

/** Hide while the command bar is open; resume past the command-bar stop, else at the same stop. */
function stepAsideForCommandBar(): void {
  const tour = useTourStore.getState();
  const resumeStep =
    tour.step === COMMAND_STEP_INDEX ? Math.min(tour.step + 1, TOUR_LAST_STEP) : tour.step;
  tour.stepAside(resumeStep);
}

/** The click shield eats every press outside the card (and keeps focus in it). */
function swallow(e: SyntheticEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

// ─── Pieces ───

function HudCorners() {
  return (
    <>
      <span aria-hidden="true" className={cn(CORNER, 'left-2 top-2 border-l border-t')} />
      <span aria-hidden="true" className={cn(CORNER, 'right-2 top-2 border-r border-t')} />
      <span aria-hidden="true" className={cn(CORNER, 'bottom-2 left-2 border-b border-l')} />
      <span aria-hidden="true" className={cn(CORNER, 'bottom-2 right-2 border-b border-r')} />
    </>
  );
}

interface CommandBarDemoProps {
  /** Keycaps to show; null on touch screens. */
  keys: readonly string[] | null;
  onTry: () => void;
}

function CommandBarDemo({ keys, onTry }: CommandBarDemoProps) {
  return (
    <div className="mt-3 space-y-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Things you can type">
        {COMMAND_EXAMPLES.map((phrase) => (
          <li
            key={phrase}
            className="rounded-full border border-accent-primary/25 bg-accent-primary/5 px-2.5 py-1 font-mono text-[11px] text-accent-primary"
          >
            &ldquo;{phrase}&rdquo;
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        {keys && (
          <span className="flex items-center gap-1" aria-hidden="true">
            {keys.map((key) => (
              <kbd
                key={key}
                className="min-w-7 rounded-[var(--radius-sm)] border border-white/15 bg-white/5 px-1.5 py-0.5 text-center font-mono text-[11px] text-text-primary shadow-[inset_0_-2px_0_rgba(255,255,255,0.08)]"
              >
                {key}
              </kbd>
            ))}
          </span>
        )}
        <button type="button" onClick={onTry} className={cn(BUTTON_GHOST, 'ml-auto')}>
          <Command className="h-3.5 w-3.5" aria-hidden="true" />
          Try it now
        </button>
      </div>
    </div>
  );
}

// ─── Tour ───

function GuidedTourInner({ onOpenCommandBar }: GuidedTourProps) {
  useTourAutoStart();

  const phase = useOSStore((s) => s.phase);
  const active = useTourStore((s) => s.active);
  const aside = useTourStore((s) => s.aside !== null);
  const rawStep = useTourStore((s) => s.step);
  const mode = useTourStore((s) => s.mode);
  const reduced = useReducedMotion() ?? false;
  const [platform] = useState(detectPlatform);
  const uid = useId();

  const onDesktop = phase === 'desktop';
  const visible = active && !aside && onDesktop;
  const index = Math.min(Math.max(rawStep, 0), TOUR_LAST_STEP);
  const step = TOUR_STEPS[index];
  const stepId = step.id;
  const isLast = index === TOUR_LAST_STEP;

  const [spot, setSpot] = useState<Spot>(NO_SPOT);
  const [view, setView] = useState<Size>(readViewport);
  const [card, setCard] = useState<Size>(CARD_ESTIMATE);

  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Step aside while the command bar is open (however it was opened), come back after.
  useEffect(() => {
    if (!active || !onDesktop) return;
    const timer = window.setInterval(() => {
      const tour = useTourStore.getState();
      if (!tour.active) return;
      if (isCommandBarOpen()) {
        if (!tour.aside) stepAsideForCommandBar();
        else if (!tour.aside.seen) tour.markAsideSeen();
      } else if (tour.aside && (tour.aside.seen || Date.now() - tour.aside.since > ASIDE_GRACE_MS)) {
        tour.resume();
      }
    }, WATCH_MS);
    return () => window.clearInterval(timer);
  }, [active, onDesktop]);

  // Find and follow the current stop's spotlight target.
  useEffect(() => {
    if (!visible) return;
    const def = TOUR_STEPS.find((s) => s.id === stepId);
    if (!def) return;
    let target: Element | null = null;
    let attempts = 0;

    const measure = () => {
      // Look again if the target went away, or briefly while nothing was found yet.
      if (!target?.isConnected && (target || attempts < RESOLVE_ATTEMPTS)) {
        target = resolveTarget(def.targets);
        attempts += 1;
      }
      const box = target ? readBox(target, def.pad) : null;
      const appId = target?.getAttribute('data-desktop-icon') ?? null;
      setSpot((prev) =>
        prev.stepId === stepId && prev.appId === appId && sameBox(prev.box, box) ? prev : { stepId, box, appId }
      );
      setView((prev) => {
        const next = readViewport();
        return prev.w === next.w && prev.h === next.h ? prev : next;
      });
    };

    const frame = window.requestAnimationFrame(measure);
    const timer = window.setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [visible, stepId]);

  // Card size, for placement next to the spotlight.
  useEffect(() => {
    if (!visible) return;
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = { w: el.offsetWidth, h: el.offsetHeight };
      setCard((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  // Remember where focus was and hand it back when the tour ends (not while
  // stepped aside: the command bar takes focus then).
  useEffect(() => {
    if (!visible) return;
    if (!returnFocusRef.current) {
      const current = document.activeElement;
      returnFocusRef.current =
        current instanceof HTMLElement && current !== document.body && !current.closest(TOUR_ROOT_SELECTOR)
          ? current
          : null;
    }
    return () => {
      if (useTourStore.getState().active) return;
      const back = returnFocusRef.current;
      returnFocusRef.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [visible]);

  // Keep focus in the card: on show, and when a stop change removes the focused button.
  useEffect(() => {
    if (!visible) return;
    const refocus = () => {
      const el = cardRef.current;
      if (el && !el.contains(document.activeElement)) primaryRef.current?.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(refocus);
    const timer = window.setTimeout(refocus, 320); // after the content cross-fade
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visible, index]);

  // Keyboard: ← → move, Esc skips, Tab is trapped, OS shortcuts stay quiet.
  // Capture phase on window, so this runs before the OS's own listeners.
  useEffect(() => {
    if (!visible) return;

    const trapTab = (e: KeyboardEvent) => {
      const el = cardRef.current;
      if (!el) return;
      const items = Array.from(
        el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!el.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = typeof e.key === 'string' ? e.key : '';
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.altKey && !e.shiftKey && key.toLowerCase() === 'k') {
        stepAsideForCommandBar(); // the page opens the bar; the tour waits for it to close
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        skipTour();
        return;
      }
      if (key === 'Tab') {
        e.stopPropagation();
        trapTab(e);
        return;
      }
      if (mod || e.altKey) {
        e.stopPropagation(); // no lock / Settings / app launchers underneath the tour
        return;
      }
      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        if (key === 'ArrowRight') goNext();
        else goBack();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [visible]);

  const tryCommandBar = () => {
    stepAsideForCommandBar();
    if (onOpenCommandBar) onOpenCommandBar();
    else sendCommandBarShortcut();
  };

  const box = spot.box;
  const spotBox = box ?? { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };
  const cardPos = placeCard(box, card, step.placement, view);
  const measured = spot.stepId === stepId;
  const copy = tourCopy(stepId, { mode, platform, appId: measured ? spot.appId : null });
  const glide = reduced ? INSTANT : GLIDE;
  const total = TOUR_STEPS.length;
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;

  return (
    <MotionConfig reducedMotion="user">
      {/* Click shield: unmounts at once on close, so nothing waits on the fade-out */}
      {visible && (
        <div
          data-guided-tour=""
          data-fx-ignore=""
          aria-hidden="true"
          className="fixed inset-0"
          style={{ zIndex: TOUR_Z }}
          onMouseDown={swallow}
          onClick={swallow}
          onDoubleClick={swallow}
          onContextMenu={swallow}
        />
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            key="guided-tour"
            data-guided-tour=""
            data-fx-ignore=""
            className="pointer-events-none fixed inset-0"
            style={{ zIndex: TOUR_Z }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
          >
            {/* Spotlight: a ringed hole in the dim; a point at the centre when there's no target */}
            <motion.div
              aria-hidden="true"
              className="absolute left-0 top-0"
              initial={false}
              animate={{
                x: spotBox.x,
                y: spotBox.y,
                width: spotBox.w,
                height: spotBox.h,
                borderRadius: box ? 14 : 999,
                boxShadow: box ? SPOT_RING : SPOT_PLAIN,
              }}
              transition={
                reduced ? INSTANT : { ...GLIDE, borderRadius: { duration: 0.3 }, boxShadow: { duration: 0.35 } }
              }
            >
              {box && !reduced && (
                <motion.span
                  className="absolute inset-0 rounded-[inherit] border border-accent-primary/70"
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.12 }}
                  transition={{ duration: 1.6, ease: 'easeOut', repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* NEXUS card */}
            <motion.div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              className="pointer-events-auto absolute left-0 top-0 w-[min(360px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto rounded-[var(--radius-lg)] p-5"
              style={CARD_STYLE}
              initial={{ opacity: 0, scale: 0.96, x: cardPos.x, y: cardPos.y + 10 }}
              animate={{ opacity: 1, scale: 1, x: cardPos.x, y: cardPos.y }}
              // pointer-events can't be tweened, so it switches off at once: the fading card never eats clicks
              exit={{ opacity: 0, scale: 0.97, pointerEvents: 'none' }}
              transition={glide}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent-primary/80 to-transparent"
              />
              <HudCorners />

              <header className="flex items-center gap-3">
                <NexusOrb still={reduced} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[11px] font-bold tracking-[0.3em] text-accent-primary">NEXUS</p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-text-secondary">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-accent-success shadow-[0_0_6px_rgba(0,230,118,0.8)]"
                    />
                    System AI · online
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-text-secondary" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
                </span>
              </header>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepId}
                  className="mt-4"
                  initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                  transition={{ duration: reduced ? 0 : 0.18 }}
                >
                  <h2 id={titleId} className="font-display text-base font-bold tracking-wide text-text-primary">
                    {copy.title}
                  </h2>
                  <p id={bodyId} className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {copy.body}
                  </p>
                  {stepId === 'command' && (
                    <CommandBarDemo keys={platform.touch ? null : commandKeys(platform)} onTry={tryCommandBar} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Progress */}
              <div className="mt-5 flex gap-1.5" aria-hidden="true">
                {TOUR_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-300',
                      i < index && 'bg-accent-primary/45',
                      i === index && 'bg-accent-primary shadow-[0_0_8px_rgba(0,240,255,0.6)]',
                      i > index && 'bg-white/10'
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={skipTour}
                  className="rounded-[var(--radius-sm)] px-2 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary focus-ring"
                >
                  Skip
                </button>
                <div className="flex items-center gap-2">
                  {index > 0 && (
                    <button type="button" onClick={goBack} className={BUTTON_GHOST}>
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Back
                    </button>
                  )}
                  <button ref={primaryRef} type="button" onClick={goNext} className={BUTTON_PRIMARY}>
                    {isLast ? "Let's go" : 'Next'}
                    {isLast ? (
                      <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Screen readers hear each stop as it arrives */}
            <p className="sr-only" aria-live="polite">
              {measured ? `Step ${index + 1} of ${total}. ${copy.title}. ${copy.body}` : ''}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

export const GuidedTour = memo(GuidedTourInner);
