// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useAuth Hook
// Firebase auth state management hook
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { onAuthChange } from '@/lib/auth';

/**
 * Subscribes to Firebase auth state and syncs with Zustand store.
 * Call once at the app root level.
 */
export function useAuth() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Warrior',
          email: firebaseUser.email || '',
          avatar: firebaseUser.photoURL || '',
          level: 1,
          xp: 0,
          totalXP: 0,
          streak: 0,
          lastActiveDate: new Date().toISOString(),
          joinedAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          preferences: {
            accentColor: '#00f0ff',
            wallpaper: 'default',
            soundEnabled: true,
            soundVolume: 0.7,
            crtEffect: true,
            cursorTrail: true,
            glassOpacity: 0.1,
          },
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return { user, isAuthenticated, isLoading };
}
