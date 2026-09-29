// ═══════════════════════════════════════════════════════════
// WARRIOR OS — System Fault UI
// What the error boundaries (AppErrorBoundary.tsx) show:
//   <AppFaultPanel/>      inside a crashed app's own window
//   <SystemFaultScreen/>  full-screen recovery when the OS shell itself
//                         crashes ("Reboot" reloads the page)
// Deliberately plain React + CSS (no stores, no framer-motion) so the
// fault screens keep working when the rest of the OS does not.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, X } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { BEVEL_PRESSED, BEVEL_RAISED, EMBER_PLATE, STEEL_PLATE, STEEL_PLATE_HOT } from '@/components/ui/armor';

// ─── Error helpers ───

/** One-line, length-capped description of whatever was thrown. */
export function describeError(error: unknown, max = 180): string {
  let text: string | undefined;
  if (error instanceof Error) {
    text = error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  } else if (typeof error === 'string') {
    text = error;
  } else {
    try {
      text = JSON.stringify(error);
    } catch {
      text = String(error);
    }
  }
  const line = (text || 'Unknown error').split('\n')[0].trim() || 'Unknown error';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

const CHUNK_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk|Failed to load chunk|dynamically imported module|Importing a module script failed/i;

/**
 * A code-split module failed to download (offline, or the site was
 * redeployed under an open tab). Remounting cannot fix that — the
 * failed import is cached — only a reload can.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return CHUNK_ERROR.test(`${String(name ?? '')} ${String(message ?? '')}`);
}

/** Short stable code for an error (same error → same code), e.g. WOS-3F2A9C. */
export function faultCode(error: unknown): string {
  const source = describeError(error, 400);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `WOS-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6)}`;
}

function reloadOS(): void {
  window.location.reload();
}

// Kit button recipes (Button primary / secondary, md + lg), inlined so
// the fault screens depend on nothing but React, the stylesheet and the
// armor class-string recipes (no components).
const BTN =
  'chamfer-sm inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-[background-color,color,box-shadow,filter] duration-120 ease-out-quint focus-ring';
const BTN_PRIMARY = `${BTN} ${EMBER_PLATE} ${BEVEL_PRESSED} hover:brightness-110 active:brightness-95`;
const BTN_SECONDARY = `${BTN} ${STEEL_PLATE} ${STEEL_PLATE_HOT} ${BEVEL_RAISED} ${BEVEL_PRESSED}`;
/** Hazard stripes: danger on dark steel, for fault plates. */
const HAZARD =
  'bg-[repeating-linear-gradient(-45deg,color-mix(in_oklab,var(--color-danger)_70%,transparent)_0_6px,var(--color-steel-900)_6px_12px)]';
const ENGRAVED_DANGER = 'engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-danger';

// ─── In-window fault panel ───

interface AppFaultPanelProps {
  appName: string;
  error: unknown;
  onRestart: () => void;
  onClose: () => void;
}

export function AppFaultPanel({ appName, error, onRestart, onClose }: AppFaultPanelProps) {
  const chunkError = isChunkLoadError(error);

  return (
    <div
      role="alert"
      data-app-fault=""
      className="relative flex h-full min-h-[240px] w-full flex-col items-center justify-center overflow-hidden p-6 text-center"
    >
      {/* Faint emergency light behind the icon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 32%, color-mix(in oklab, var(--color-danger) 9%, transparent), transparent 70%)',
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="chamfer-sm bevel flex size-12 items-center justify-center bg-danger/12 text-danger">
          <AlertTriangle className="size-6" strokeWidth={1.75} aria-hidden />
        </div>

        <p className={`mt-4 ${ENGRAVED_DANGER}`}>System fault</p>
        <h2 className="mt-1.5 text-lg font-semibold text-fg">{appName} stopped working</h2>
        <p className="mt-1.5 text-ui text-fg-muted">
          {chunkError
            ? 'Part of this app failed to download: you may be offline, or Warrior OS was just updated. Reloading fetches it again.'
            : 'The fault was contained to this window. The rest of Warrior OS is still running.'}
        </p>

        <div className="mt-4 w-full chamfer-sm bg-steel-950 px-3 py-2 text-left font-mono text-xs shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_2px_6px_rgb(0_0_0/0.45),inset_0_-1px_0_rgb(255_255_255/0.07)]">
          <p className="flex items-center justify-between gap-3">
            <span className="text-2xs uppercase tracking-[0.14em] text-fg-subtle">Fault code</span>
            <span className="text-danger tabular">{faultCode(error)}</span>
          </p>
          <p className="mt-1 break-words text-fg-muted" title={describeError(error, 400)}>
            {describeError(error)}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {chunkError ? (
            <button type="button" onClick={reloadOS} className={`${BTN_PRIMARY} h-8 px-3 text-ui`}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              Reload OS
            </button>
          ) : (
            <button type="button" onClick={onRestart} className={`${BTN_PRIMARY} h-8 px-3 text-ui`}>
              <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
              Restart app
            </button>
          )}
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY} h-8 px-3 text-ui`}>
            <X className="size-4" strokeWidth={1.75} aria-hidden />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Full-screen recovery ───

const FAULT_CSS = `
@keyframes wos-fault-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes wos-fault-sweep { from { transform: translateY(-30vh); } to { transform: translateY(130vh); } }
@keyframes wos-fault-slice-a {
  0%, 100% { clip-path: inset(0 0 100% 0); transform: translate(0, 0); }
  8% { clip-path: inset(38% 0 42% 0); transform: translate(3px, 0); }
  10% { clip-path: inset(72% 0 8% 0); transform: translate(-2px, 0); }
  12% { clip-path: inset(0 0 100% 0); transform: translate(0, 0); }
}
@keyframes wos-fault-slice-b {
  0%, 100% { clip-path: inset(0 0 100% 0); transform: translate(0, 0); }
  54% { clip-path: inset(8% 0 78% 0); transform: translate(-3px, 0); }
  56% { clip-path: inset(44% 0 36% 0); transform: translate(2px, 0); }
  58% { clip-path: inset(0 0 100% 0); transform: translate(0, 0); }
}
.wos-fault-reveal { animation: wos-fault-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
.wos-fault-title { position: relative; }
.wos-fault-title::before, .wos-fault-title::after {
  content: attr(data-text); position: absolute; inset: 0; pointer-events: none;
}
.wos-fault-title::before { color: var(--color-danger); opacity: 0.7; animation: wos-fault-slice-a 4.2s steps(1) infinite; }
.wos-fault-title::after { color: var(--color-plasma-400); opacity: 0.45; animation: wos-fault-slice-b 5.3s steps(1) infinite; }
.wos-fault-sweep { animation: wos-fault-sweep 9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .wos-fault *, .wos-fault *::before, .wos-fault *::after { animation: none !important; }
}
`;

export function SystemFaultScreen({ error }: { error: unknown }) {
  const code = faultCode(error);

  // Enter reboots too — nothing else is mounted to receive it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') reloadOS();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="wos-fault-title"
      aria-describedby="wos-fault-desc"
      className="wos-fault fixed inset-0 flex items-center justify-center overflow-hidden bg-ink-950 p-6 text-fg"
      style={{ zIndex: 2147483000, cursor: 'auto' }}
    >
      <style>{FAULT_CSS}</style>

      {/* Emergency lighting, a faint HUD grid and a slow scan sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 42%, color-mix(in oklab, var(--color-danger) 11%, transparent), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 60% 55% at 50% 45%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 45%, black, transparent 80%)',
        }}
      />
      <div
        aria-hidden
        className="wos-fault-sweep pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: 'linear-gradient(180deg, transparent, color-mix(in oklab, var(--color-danger) 5%, transparent), transparent)',
        }}
      />

      <div className="relative w-full max-w-xl">
        <div className="wos-fault-reveal flex items-center gap-3">
          <span className="chamfer-xs bevel flex size-9 items-center justify-center bg-danger/12 text-danger">
            <AlertTriangle className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <p className={ENGRAVED_DANGER}>
            Kernel panic <span className="text-fg-faint">·</span> <span className="tabular">{code}</span>
          </p>
        </div>

        <h1
          id="wos-fault-title"
          data-text="SYSTEM FAULT"
          className="wos-fault-title wos-fault-reveal mt-5 font-display text-4xl font-semibold tracking-[0.1em] text-fg sm:text-5xl"
          style={{ animationDelay: '0.08s' }}
        >
          SYSTEM FAULT
        </h1>

        <p
          id="wos-fault-desc"
          className="wos-fault-reveal mt-4 max-w-md text-sm text-fg-muted"
          style={{ animationDelay: '0.16s' }}
        >
          Warrior OS hit an unexpected error and halted. Your saved data stays in
          this browser, and a reboot brings everything back.
        </p>

        <dl
          className="wos-fault-reveal armor-panel rivets relative mt-6 overflow-hidden pt-2 font-mono text-xs [--cut-bl:0px] [--cut-tr:0px] [--cut:12px] [--rivet-inset:6px]"
          style={{ animationDelay: '0.24s' }}
        >
          <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 opacity-80 ${HAZARD}`} />
          {[
            ['Fault', describeError(error, 240), 'text-fg'],
            ['Status', 'Core halted · saved data intact', 'text-fg-muted'],
            ['Action', 'Reboot required', 'text-warning'],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex gap-4 border-b border-line px-4 py-2.5 last:border-b-0">
              <dt className="w-16 shrink-0 text-2xs uppercase leading-5 tracking-[0.14em] text-fg-subtle">{label}</dt>
              <dd className={`min-w-0 break-words leading-5 ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="wos-fault-reveal mt-6 flex flex-wrap items-center gap-4" style={{ animationDelay: '0.32s' }}>
          <button type="button" onClick={reloadOS} className={`${BTN_PRIMARY} h-10 px-4 text-sm`}>
            <RefreshCw className="size-[18px]" strokeWidth={1.75} aria-hidden />
            Reboot
          </button>
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            or press
            <kbd className="armor-plate chamfer-xs inline-flex h-5 items-center px-1.5 font-mono text-2xs text-fg-muted">
              Enter
            </kbd>
          </span>
        </div>

        <p
          className="wos-fault-reveal mt-12 flex items-center gap-2 hud-label text-fg-faint"
          style={{ animationDelay: '0.4s' }}
        >
          <span className="h-px w-6 bg-line-strong" aria-hidden />
          Warrior OS · {OWNER.name}
        </p>
      </div>
    </div>
  );
}
