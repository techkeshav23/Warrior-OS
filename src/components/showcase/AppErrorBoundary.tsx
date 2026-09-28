// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Error Boundaries
// Nothing a single app or effect does should take the whole OS down.
//   <AppErrorBoundary>     around each window's app content (Window.tsx):
//                          SYSTEM FAULT panel with Restart app / Close
//   <SystemErrorBoundary>  around the whole OS (page.tsx): cinematic
//                          full-screen recovery, "Reboot" reloads
//   <LayerBoundary>        around optional layers (overlays, effects,
//                          wallpaper): quietly drops just that layer, or
//                          shows a fallback, and keeps the OS running
// ═══════════════════════════════════════════════════════════

'use client';

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { AppFaultPanel, SystemFaultScreen } from './SystemFault';

// ─── Window-level ───

interface AppErrorBoundaryProps {
  /** Shown on the fault panel — the window title. */
  appName: string;
  /** Closes the window hosting the app. */
  onClose: () => void;
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
  error: unknown;
  /** Bumped by "Restart app" so the app subtree remounts from scratch. */
  generation: number;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false, error: null, generation: 0 };

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      `[Warrior OS] ${this.props.appName} crashed; the fault was contained to its window.`,
      error,
      info.componentStack
    );
  }

  private handleRestart = (): void => {
    this.setState((s) => ({ failed: false, error: null, generation: s.generation + 1 }));
  };

  render(): ReactNode {
    const { failed, error, generation } = this.state;
    if (failed) {
      return (
        <AppFaultPanel
          appName={this.props.appName}
          error={error}
          onRestart={this.handleRestart}
          onClose={this.props.onClose}
        />
      );
    }
    return <Fragment key={generation}>{this.props.children}</Fragment>;
  }
}

// ─── Root-level ───

interface SystemErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

export class SystemErrorBoundary extends Component<{ children: ReactNode }, SystemErrorBoundaryState> {
  state: SystemErrorBoundaryState = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): Partial<SystemErrorBoundaryState> {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[Warrior OS] System fault: the OS shell crashed.', error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? <SystemFaultScreen error={this.state.error} /> : this.props.children;
  }
}

// ─── Optional layers ───

interface LayerBoundaryProps {
  /** Named in the console message. */
  name: string;
  /** Rendered instead of the failed layer (default: nothing). */
  fallback?: ReactNode;
  /** Called once when the layer fails (e.g. close the broken window). */
  onError?: (error: unknown) => void;
  children: ReactNode;
}

export class LayerBoundary extends Component<LayerBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      `[Warrior OS] ${this.props.name} failed and was switched off; the OS keeps running.`,
      error,
      info.componentStack
    );
    this.props.onError?.(error);
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
