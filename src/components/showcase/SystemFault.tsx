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

const DISPLAY_FONT = 'var(--font-orbitron), "Orbitron", var(--font-inter), system-ui, sans-serif';
const MONO_FONT = 'var(--font-jetbrains), "JetBrains Mono", ui-monospace, monospace';

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
      className="relative flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center"
    >
      {/* Red emergency glow + faint scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 38%, rgba(255,23,68,0.12), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,0.025) 3px 4px)',
        }}
      />

      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-accent-danger/40 bg-accent-danger/10 text-accent-danger shadow-[0_0_24px_rgba(255,23,68,0.25)]">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>

      <div className="relative space-y-1.5">
        <p
          className="text-[11px] uppercase tracking-[0.35em] text-accent-danger"
          style={{ fontFamily: MONO_FONT }}
        >
          System fault
        </p>
        <h2 className="text-base font-semibold text-text-primary">{appName} stopped working</h2>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-text-secondary">
          {chunkError
            ? 'Part of this app failed to download: you may be offline, or Warrior OS was just updated. Reloading fetches it again.'
            : 'The fault was contained to this window. The rest of Warrior OS is still running.'}
        </p>
      </div>

      <p
        className="relative max-w-md break-words rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/60"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className="text-accent-danger/80">{faultCode(error)}</span>
        <span className="text-white/30"> · </span>
        {describeError(error)}
      </p>

      <div className="relative flex flex-wrap items-center justify-center gap-2">
        {chunkError ? (
          <button
            type="button"
            onClick={reloadOS}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Reload OS
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restart app
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Full-screen recovery ───

const FAULT_CSS = `
@keyframes wos-fault-in { from { opacity: 0; transform: translateY(10px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes wos-fault-sweep { from { transform: translateY(-30vh); } to { transform: translateY(130vh); } }
@keyframes wos-fault-flicker { 0%, 100% { opacity: 1; } 92% { opacity: 1; } 93% { opacity: 0.35; } 94% { opacity: 1; } 97% { opacity: 0.6; } }
@keyframes wos-fault-slice-a {
  0%, 100% { clip-path: inset(0 0 86% 0); transform: translate(-3px, 0); }
  20% { clip-path: inset(38% 0 42% 0); transform: translate(3px, 0); }
  40% { clip-path: inset(72% 0 8% 0); transform: translate(-2px, 0); }
  60% { clip-path: inset(12% 0 64% 0); transform: translate(4px, 0); }
  80% { clip-path: inset(54% 0 26% 0); transform: translate(-4px, 0); }
}
@keyframes wos-fault-slice-b {
  0%, 100% { clip-path: inset(62% 0 18% 0); transform: translate(3px, 0); }
  25% { clip-path: inset(8% 0 78% 0); transform: translate(-3px, 0); }
  50% { clip-path: inset(44% 0 36% 0); transform: translate(2px, 0); }
  75% { clip-path: inset(80% 0 4% 0); transform: translate(-2px, 0); }
}
.wos-fault-reveal { animation: wos-fault-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
.wos-fault-title { position: relative; animation: wos-fault-flicker 4s linear infinite; }
.wos-fault-title::before, .wos-fault-title::after {
  content: attr(data-text); position: absolute; inset: 0; pointer-events: none;
}
.wos-fault-title::before { color: #ff1744; opacity: 0.75; animation: wos-fault-slice-a 2.6s steps(1) infinite; }
.wos-fault-title::after { color: #00f0ff; opacity: 0.5; animation: wos-fault-slice-b 3.3s steps(1) infinite; }
.wos-fault-sweep { animation: wos-fault-sweep 7s linear infinite; }
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
      className="wos-fault fixed inset-0 flex items-center justify-center overflow-hidden p-6 text-text-primary"
      style={{ zIndex: 2147483000, background: '#050508', cursor: 'auto' }}
    >
      <style>{FAULT_CSS}</style>

      {/* Emergency lighting, grid, scanlines and a slow scan sweep */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(255,23,68,0.14), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 90%, rgba(0,240,255,0.05), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 80%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.35) 2px 4px)',
        }}
      />
      <div
        aria-hidden
        className="wos-fault-sweep pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: 'linear-gradient(180deg, transparent, rgba(255,23,68,0.06), transparent)',
        }}
      />

      <div className="relative w-full max-w-xl">
        <p
          className="wos-fault-reveal text-[11px] uppercase tracking-[0.4em] text-accent-danger"
          style={{ fontFamily: MONO_FONT }}
        >
          Kernel panic · {code}
        </p>

        <h1
          id="wos-fault-title"
          data-text="SYSTEM FAULT"
          className="wos-fault-title wos-fault-reveal mt-3 text-4xl font-black tracking-[0.12em] sm:text-5xl"
          style={{
            fontFamily: DISPLAY_FONT,
            textShadow: '0 0 24px rgba(255,23,68,0.35)',
            animationDelay: '0.1s',
          }}
        >
          SYSTEM FAULT
        </h1>

        <p
          id="wos-fault-desc"
          className="wos-fault-reveal mt-4 max-w-md text-sm leading-relaxed text-text-secondary"
          style={{ animationDelay: '0.2s' }}
        >
          Warrior OS hit an unexpected error and halted. Your saved data stays in
          this browser, and a reboot brings everything back.
        </p>

        <pre
          className="wos-fault-reveal mt-6 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-accent-danger/20 bg-black/60 p-4 text-left text-[11px] leading-relaxed text-white/60"
          style={{ fontFamily: MONO_FONT, animationDelay: '0.3s' }}
        >
          <span className="text-accent-danger/80">{'> fault   '}</span>
          {describeError(error, 240)}
          {'\n'}
          <span className="text-accent-danger/80">{'> status  '}</span>
          core halted · saved data intact
          {'\n'}
          <span className="text-accent-danger/80">{'> action  '}</span>
          reboot required
        </pre>

        <div
          className="wos-fault-reveal mt-6 flex flex-wrap items-center gap-4"
          style={{ animationDelay: '0.4s' }}
        >
          <button
            type="button"
            onClick={reloadOS}
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-accent-primary/40 bg-accent-primary/10 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-accent-primary shadow-[0_0_24px_rgba(0,240,255,0.15)] transition-colors hover:bg-accent-primary/20"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Reboot
          </button>
          <span className="text-[11px] text-text-muted" style={{ fontFamily: MONO_FONT }}>
            or press Enter
          </span>
        </div>

        <p
          className="wos-fault-reveal mt-12 text-[10px] uppercase tracking-[0.3em] text-white/25"
          style={{ fontFamily: MONO_FONT, animationDelay: '0.5s' }}
        >
          Warrior OS · {OWNER.name}
        </p>
      </div>
    </div>
  );
}
