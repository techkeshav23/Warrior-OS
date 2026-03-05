// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notification Store
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Notification, NotificationType } from '@/types/notification';
import { generateId } from '@/lib/utils';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;

  // Actions
  addNotification: (config: {
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    autoDismiss?: number;
  }) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  immer((set, get) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (config) => {
      const id = generateId('notif');
      set((state) => {
        state.notifications.unshift({
          id,
          type: config.type,
          title: config.title,
          message: config.message,
          icon: config.icon,
          timestamp: new Date().toISOString(),
          read: false,
          autoDismiss: config.autoDismiss ?? 5000,
        });
        // Keep only last 50 notifications
        if (state.notifications.length > 50) {
          state.notifications = state.notifications.slice(0, 50);
        }
        state.unreadCount = state.notifications.filter((n) => !n.read).length;
      });
      return id;
    },

    removeNotification: (id) =>
      set((state) => {
        state.notifications = state.notifications.filter((n) => n.id !== id);
        state.unreadCount = state.notifications.filter((n) => !n.read).length;
      }),

    markAsRead: (id) =>
      set((state) => {
        const notif = state.notifications.find((n) => n.id === id);
        if (notif) {
          notif.read = true;
          state.unreadCount = state.notifications.filter((n) => !n.read).length;
        }
      }),

    markAllAsRead: () =>
      set((state) => {
        state.notifications.forEach((n) => { n.read = true; });
        state.unreadCount = 0;
      }),

    clearAll: () =>
      set((state) => {
        state.notifications = [];
        state.unreadCount = 0;
      }),
  }))
);
