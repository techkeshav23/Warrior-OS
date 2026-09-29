// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NotificationCenter Component (FORGE HUD)
// Right-hand glass sheet above the taskbar: notifications grouped by
// day (Today / Yesterday / Earlier), each row with a lucide icon in its
// tone, relative time, unread marker and a dismiss action. Header:
// unread count + mark all read + close; footer: clear all.
//
// Also exports notificationMeta() (icon + tone per notification, shared
// with the toasts) and useNotificationCenterOpen() for the taskbar bell.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Bell,
  BellOff,
  BrainCircuit,
  CheckCheck,
  CircleCheck,
  Cpu,
  Info,
  OctagonAlert,
  Trash2,
  TriangleAlert,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useNow } from '@/components/widgets/hooks';
import { Badge, TONE_SOFT, type Tone } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Notification, NotificationType } from '@/types';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Icon + tone per notification ───

export interface NotificationMeta {
  icon: LucideIcon;
  tone: Tone;
}

const TYPE_META: Record<NotificationType, NotificationMeta> = {
  info: { icon: Info, tone: 'info' },
  success: { icon: CircleCheck, tone: 'success' },
  warning: { icon: TriangleAlert, tone: 'warning' },
  error: { icon: OctagonAlert, tone: 'danger' },
  achievement: { icon: Trophy, tone: 'gold' },
  system: { icon: Cpu, tone: 'neutral' },
};

/** Lucide icon + tone for a notification (NEXUS messages get the NEXUS glyph). */
export function notificationMeta(n: Pick<Notification, 'type' | 'title'>): NotificationMeta {
  if (/^nexus\b/i.test(n.title.trim())) return { icon: BrainCircuit, tone: 'accent' };
  return TYPE_META[n.type] ?? TYPE_META.info;
}

// ─── Open-state signal (read by the taskbar bell) ───

let centerOpen = false;
const centerListeners = new Set<() => void>();

function setCenterSignal(open: boolean): void {
  if (centerOpen === open) return;
  centerOpen = open;
  centerListeners.forEach((listener) => listener());
}

function subscribeCenter(listener: () => void): () => void {
  centerListeners.add(listener);
  return () => {
    centerListeners.delete(listener);
  };
}

/** True while the notification center is open. */
export function useNotificationCenterOpen(): boolean {
  return useSyncExternalStore(
    subscribeCenter,
    () => centerOpen,
    () => false
  );
}

// ─── Time helpers ───

type DayGroup = 'Today' | 'Yesterday' | 'Earlier';
const DAY_MS = 86_400_000;

function dayGroup(ts: number, now: number): DayGroup {
  const d = new Date(now);
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (ts >= startOfToday) return 'Today';
  if (ts >= startOfToday - DAY_MS) return 'Yesterday';
  return 'Earlier';
}

/** "Just now", "5m ago", "3h ago", else "26 Sept". */
export function relativeTime(ts: number, now: number): string {
  if (!Number.isFinite(ts)) return '';
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 45) return 'Just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Row ───

interface NotificationRowProps {
  notification: Notification;
  now: number;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationRow({ notification: n, now, onRead, onRemove }: NotificationRowProps) {
  const { icon: Icon, tone } = notificationMeta(n);
  const ts = Date.parse(n.timestamp);
  return (
    <li className="group relative">
      {/* Whole-row hit area (marks read); content sits above it, pointer-transparent */}
      <button
        type="button"
        onClick={() => onRead(n.id)}
        aria-label={`${n.title}${n.read ? '' : ', unread'}. Mark as read`}
        className="absolute inset-0 rounded-card focus-ring-inset"
      />
      <div
        className={cn(
          'pointer-events-none relative flex gap-3 rounded-card px-3 py-3 transition-colors duration-120 ease-out-quint',
          n.read ? 'group-hover:bg-surface-hover' : 'bg-surface-2 group-hover:bg-surface-hover'
        )}
      >
        <span
          className={cn(
            'mt-px flex size-8 shrink-0 items-center justify-center rounded-control ring-1 ring-inset',
            TONE_SOFT[tone],
            n.read && 'opacity-70'
          )}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn('min-w-0 flex-1 truncate text-ui font-medium', n.read ? 'text-fg-muted' : 'text-fg')}
              title={n.title}
            >
              {n.title}
            </p>
            <span
              className="tabular flex shrink-0 items-center gap-1.5 font-mono text-2xs text-fg-subtle transition-opacity duration-120 group-focus-within:opacity-0 group-hover:opacity-0"
              title={Number.isFinite(ts) ? new Date(ts).toLocaleString('en-IN') : undefined}
            >
              {!n.read && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
              {relativeTime(ts, now)}
            </span>
          </div>
          {n.message && (
            <p className={cn('mt-0.5 line-clamp-3 text-xs leading-[18px]', n.read ? 'text-fg-subtle' : 'text-fg-muted')}>
              {n.message}
            </p>
          )}
        </div>
      </div>
      <span className="absolute right-2 top-2.5 opacity-0 transition-opacity duration-120 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton icon={X} size="xs" aria-label={`Dismiss ${n.title}`} onClick={() => onRemove(n.id)} />
      </span>
    </li>
  );
}

// ─── Panel (mounted only while open) ───

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const now = useNow(30_000);

  const groups = useMemo(() => {
    const order: DayGroup[] = ['Today', 'Yesterday', 'Earlier'];
    const buckets = new Map<DayGroup, Notification[]>();
    for (const n of notifications) {
      const group = dayGroup(Date.parse(n.timestamp), now);
      const list = buckets.get(group);
      if (list) list.push(n);
      else buckets.set(group, [n]);
    }
    return order.filter((g) => buckets.has(g)).map((g) => ({ label: g, items: buckets.get(g) ?? [] }));
  }, [notifications, now]);

  return (
    <>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line pl-5 pr-3">
        <Bell size={18} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
        <h2 className="text-sm font-semibold text-fg">Notifications</h2>
        {unreadCount > 0 && (
          <Badge tone="accent" size="sm">
            {unreadCount} new
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            icon={CheckCheck}
            size="sm"
            aria-label="Mark all as read"
            tooltip
            tooltipSide="bottom"
            disabled={unreadCount === 0}
            onClick={markAllAsRead}
          />
          <IconButton icon={X} size="sm" aria-label="Close notifications" tooltip="Close" tooltipSide="bottom" shortcut="Esc" onClick={onClose} />
        </div>
      </header>

      {/* List */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <EmptyState
            className="h-full"
            icon={BellOff}
            title="You’re all caught up"
            description="Achievements, reminders and NEXUS messages will land here."
          />
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="hud-label px-3 pb-1.5 pt-4">{group.label}</h3>
              <ul className="flex flex-col gap-1">
                {group.items.map((n) => (
                  <NotificationRow key={n.id} notification={n} now={now} onRead={markAsRead} onRemove={removeNotification} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-line bg-ink-950/30 pl-5 pr-3">
        <span className="tabular hud-label">
          {notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}
        </span>
        <Button variant="ghost" size="sm" leadingIcon={Trash2} disabled={notifications.length === 0} onClick={clearAll}>
          Clear all
        </Button>
      </footer>
    </>
  );
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);

  // Let the taskbar bell show its pressed state.
  useEffect(() => {
    setCenterSignal(isOpen);
    return () => setCenterSignal(false);
  }, [isOpen]);

  // Move focus into the sheet so Tab starts there; the opener gets it back on close.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-away layer (no dim: the desktop stays readable) */}
          <motion.div
            key="notification-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-ink-950/25"
            style={{ zIndex: 'var(--z-notification)' }}
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet */}
          <motion.aside
            key="notification-panel"
            ref={panelRef}
            role="dialog"
            aria-label="Notification center"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16, transition: { duration: 0.16, ease: EASE } }}
            transition={{ duration: 0.26, ease: EASE }}
            className="glass-popover fixed bottom-14 right-2 top-2 flex w-[380px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-sheet shadow-e3 outline-none"
            style={{ zIndex: 'var(--z-notification)' }}
          >
            <NotificationPanel onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
