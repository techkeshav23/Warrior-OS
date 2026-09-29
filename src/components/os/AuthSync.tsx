// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Auth Sync
// Renders nothing. Mounts the Firebase auth listener (useAuth) so a
// sign-in from Settings → Account reaches useAuthStore, which is what
// biometric cloud sync (src/components/biometrics/cloudSync.ts) keys on.
// • No NEXT_PUBLIC_FIREBASE_* config: does nothing — no SDK download,
//   no network, the OS stays local-only.
// • Owner sessions only: a guest session (portfolio visitor, demo data)
//   never picks up a Firebase account remembered in this browser.
// Mounted once on the desktop (src/app/page.tsx), after unlock.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isFirebaseConfigured } from '@/lib/auth';
import { getVisitorMode } from '@/lib/visitor';

export function AuthSync() {
  // Read once on mount: the desktop remounts after every lock-screen unlock.
  const [enabled] = useState(() => isFirebaseConfigured() && getVisitorMode() === 'owner');
  useAuth(enabled);
  return null;
}
