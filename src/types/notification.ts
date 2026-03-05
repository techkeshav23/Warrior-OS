// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notification Types
// ═══════════════════════════════════════════════════════════

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'achievement' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  timestamp: string;
  read: boolean;
  /** Auto-dismiss after ms (0 = persistent) */
  autoDismiss?: number;
  /** Optional action on click */
  action?: {
    label: string;
    handler: string; // action identifier
  };
}
