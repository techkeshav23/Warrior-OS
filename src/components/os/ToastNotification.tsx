// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ToastNotification Component (FORGED ARMOR)
// Compact forged plates (cut top-left + bottom-right) above the taskbar (bottom-right): a tone bar,
// the notification's lucide icon, title, body and a close button.
// A hairline countdown runs along the bottom and pauses while the
// pointer rests on the toast.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Notification } from '@/types';
import { IconButton } from '@/components/ui/Button';
import { TONE_DOT, TONE_SOFT } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { notificationMeta } from './NotificationCenter';

interface ToastNotificationProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  duration?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const TICK_MS = 50;

export function ToastNotification({ notification, onDismiss, duration = 5000 }: ToastNotificationProps) {
  const [progress, setProgress] = useState(100);
  const pausedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const { icon: Icon, tone } = notificationMeta(notification);

  // Count down only while the pointer is away from the toast.
  useEffect(() => {
    if (duration <= 0) return;
    let elapsed = 0;
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (!pausedRef.current) elapsed += now - last;
      last = now;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(notification.id);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [duration, notification.id, onDismiss]);

  return (
    <motion.div
      layout={!reduceMotion}
      role="status"
      aria-live="polite"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.16, ease: EASE } }}
      transition={{ duration: 0.26, ease: EASE }}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      className="armor-drop pointer-events-auto w-[360px] max-w-[calc(100vw-32px)]"
    >
      <div className="armor-popover relative overflow-hidden [--cut-bl:0px] [--cut-tr:0px] [--cut:10px]">
      {/* Tone bar */}
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', TONE_DOT[tone])} />

      <div className="flex items-start gap-3 py-3 pl-4 pr-2">
        <span className={cn('chamfer-xs mt-px flex size-7 shrink-0 items-center justify-center ring-1 ring-inset', TONE_SOFT[tone])}>
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-ui font-semibold text-fg">{notification.title}</p>
          {notification.message && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-[18px] text-fg-muted">{notification.message}</p>
          )}
        </div>

        <IconButton icon={X} size="xs" aria-label="Dismiss notification" onClick={() => onDismiss(notification.id)} />
      </div>

      {/* Countdown hairline */}
      {duration > 0 && (
        <span
          aria-hidden
          className={cn('absolute bottom-0 left-0 h-[2px] opacity-70', TONE_DOT[tone])}
          style={{ width: `${progress}%` }}
        />
      )}
      </div>
    </motion.div>
  );
}

// Toast container for rendering multiple toasts
interface ToastContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ notifications, onDismiss }: ToastContainerProps) {
  // Show only latest 5
  const visible = notifications.filter((n) => !n.read).slice(0, 5);

  return (
    <div
      className="pointer-events-none fixed bottom-16 right-4 flex flex-col items-end gap-2"
      style={{ zIndex: 'var(--z-notification)' }}
    >
      <AnimatePresence mode="popLayout">
        {visible.map((notif) => (
          <ToastNotification key={notif.id} notification={notif} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
