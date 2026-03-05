// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NotificationCenter Component
// Slide-out panel showing all notifications
// ═══════════════════════════════════════════════════════════

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, CheckCheck, Bell } from 'lucide-react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_COLORS = {
  info: 'border-accent-primary',
  success: 'border-accent-success',
  warning: 'border-accent-warning',
  error: 'border-accent-danger',
  achievement: 'border-accent-secondary',
  system: 'border-text-muted',
};

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30"
            style={{ zIndex: 'var(--z-notification)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-80 overflow-hidden flex flex-col"
            style={{
              zIndex: 'var(--z-notification)',
              background: 'rgba(8, 8, 16, 0.95)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-accent-primary" />
                <h3 className="text-sm font-display font-bold text-text-primary">
                  Notifications
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                  title="Mark all read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-accent-danger hover:bg-accent-danger/5 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-mono">No notifications</p>
                </div>
              ) : (
                <div className="py-2">
                  {notifications.map((notif, i) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => markAsRead(notif.id)}
                      className={cn(
                        'group relative mx-2 mb-1 p-3 rounded-[var(--radius-md)]',
                        'border-l-2 cursor-pointer',
                        'transition-colors duration-150',
                        TYPE_COLORS[notif.type],
                        notif.read
                          ? 'bg-transparent hover:bg-white/[0.03]'
                          : 'bg-white/[0.03] hover:bg-white/5'
                      )}
                    >
                      {/* Unread dot */}
                      {!notif.read && (
                        <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-accent-primary" />
                      )}

                      <p className="text-xs font-mono text-text-primary pr-4">
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-[10px] font-mono text-text-muted mt-1 leading-relaxed">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-[9px] font-mono text-text-muted/50 mt-1.5">
                        {formatDate(notif.timestamp)}
                      </p>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notif.id);
                        }}
                        className="absolute top-2 right-2 p-0.5 rounded text-text-muted/30 hover:text-accent-danger transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
