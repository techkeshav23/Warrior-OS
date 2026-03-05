// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ToastNotification Component
// Floating toast notifications (bottom-right)
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Check, AlertTriangle, AlertCircle, Trophy, Cpu } from 'lucide-react';
import type { Notification } from '@/types';
import { cn } from '@/lib/utils';

interface ToastNotificationProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  duration?: number;
}

const ICON_MAP = {
  info: <Info className="w-4 h-4" />,
  success: <Check className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  achievement: <Trophy className="w-4 h-4" />,
  system: <Cpu className="w-4 h-4" />,
};

const COLOR_MAP = {
  info: 'text-accent-primary border-accent-primary/30',
  success: 'text-accent-success border-accent-success/30',
  warning: 'text-accent-warning border-accent-warning/30',
  error: 'text-accent-danger border-accent-danger/30',
  achievement: 'text-accent-secondary border-accent-secondary/30',
  system: 'text-text-muted border-white/10',
};

export function ToastNotification({
  notification,
  onDismiss,
  duration = 5000,
}: ToastNotificationProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(notification.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, notification.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'relative w-80 rounded-[var(--radius-md)] overflow-hidden',
        'border',
        COLOR_MAP[notification.type]
      )}
      style={{
        background: 'rgba(12, 12, 20, 0.95)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">{ICON_MAP[notification.type]}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-bold text-text-primary">
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-[10px] font-mono text-text-muted mt-0.5 leading-relaxed">
              {notification.message}
            </p>
          )}
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(notification.id)}
          className="flex-shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-[2px] bg-white/5">
          <div
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              background: 'var(--accent-primary)',
              opacity: 0.5,
            }}
          />
        </div>
      )}
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
      className="fixed bottom-16 right-4 flex flex-col gap-2"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      <AnimatePresence mode="popLayout">
        {visible.map((notif) => (
          <ToastNotification
            key={notif.id}
            notification={notif}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
