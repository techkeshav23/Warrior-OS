// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Account Tab
// User profile, auth status
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

function AccountTabInner() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Account</h3>

      {isAuthenticated && user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white"
            >
              {(user.displayName || user.email || 'W').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">
                {user.displayName || 'Warrior'}
              </p>
              <p className="text-xs text-white/50">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs text-white/60">Status</span>
              <span className="text-xs text-green-300">Authenticated</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs text-white/60">UID</span>
              <span className="text-xs text-white/50 font-mono">
                {user.uid?.slice(0, 16)}...
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-3 mt-12">
          <p className="text-4xl">👤</p>
          <p className="text-sm text-white/50">Not signed in</p>
          <p className="text-xs text-white/30">
            Sign in from the lock screen to sync your data across devices.
          </p>
        </div>
      )}
    </div>
  );
}

export const AccountTab = memo(AccountTabInner);
