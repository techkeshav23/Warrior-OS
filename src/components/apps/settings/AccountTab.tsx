// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Account Tab
// User profile and auth status, plus what this browser keeps.
// Sign-in (Google or email) exists only when the deployment ships the
// Firebase web config (isFirebaseConfigured) and only in an owner
// session: a guest session holds demo data, so it stays local. AuthSync
// (src/components/os/AuthSync.tsx) feeds the signed-in user into
// useAuthStore; biometric cloud sync is the one thing that uses it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Check, CloudOff, Copy, HardDrive, KeyRound, LogIn, LogOut, Mail, RefreshCw, UserPlus, UserRound } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getVisitorMode } from '@/lib/visitor';
import {
  describeAuthError,
  isFirebaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from '@/lib/auth';
import {
  getCloudSyncStatus,
  subscribeCloudSyncStatus,
  syncBiometricHistory,
} from '@/components/biometrics/cloudSync';
import { OWNER } from '@/config/owner';
import { SettingRow, SettingsCard, SettingsPage, SettingsSection } from './parts';

/** Size of everything Warrior OS keeps in this browser (keys start with "warrior"). */
function measureLocalData(): { keys: number; bytes: number } | null {
  try {
    const storage = window.localStorage;
    let keys = 0;
    let bytes = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null || !key.startsWith('warrior')) continue;
      keys += 1;
      bytes += (key.length + (storage.getItem(key)?.length ?? 0)) * 2; // UTF-16
    }
    return { keys, bytes };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** Cloud copy state for the signed-in owner (typing-vitals hourly averages). */
function CloudSyncRow() {
  const biometrics = useSettingsStore((s) => s.biometricsEnabled);
  const sync = useSyncExternalStore(subscribeCloudSyncStatus, getCloudSyncStatus, getCloudSyncStatus);

  let badge;
  if (!biometrics) badge = <Badge>Typing vitals off</Badge>;
  else if (sync.state === 'syncing') badge = <Badge tone="accent" dot>Syncing</Badge>;
  else if (sync.state === 'paused') badge = <Badge tone="warning" dot>Paused</Badge>;
  else if (sync.lastSyncAt !== null)
    badge = (
      <Badge tone="success" dot>
        Synced {timeFormat.format(sync.lastSyncAt)}
      </Badge>
    );
  else badge = <Badge tone="info">Waiting</Badge>;

  return (
    <SettingRow
      label="Cloud sync"
      description={
        sync.state === 'paused'
          ? 'The last upload failed (offline, or the Firestore rules refused it). Local data is untouched.'
          : 'Typing-vitals hourly averages are mirrored to your account every 15 minutes. Everything else stays in this browser.'
      }
      control={
        <>
          {badge}
          <IconButton
            icon={RefreshCw}
            aria-label="Sync now"
            size="sm"
            tooltip
            disabled={!biometrics || sync.state === 'syncing'}
            onClick={() => void syncBiometricHistory(true)}
          />
        </>
      }
    />
  );
}

/** Google + email/password sign-in (owner session, Firebase configured). */
function SignInPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'google' | 'email' | 'create', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      // AuthSync's listener picks the user up and this panel unmounts.
    } catch (e) {
      setError(describeAuthError(e));
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    void run('email', () => signInWithEmail(email.trim(), password));
  };

  const create = () => {
    if (!email.trim() || !password) {
      setError('Enter an email and a password (6+ characters) for the new account.');
      return;
    }
    void run('create', () => signUpWithEmail(email.trim(), password, ''));
  };

  return (
    <SettingsSection
      title="Cloud sync"
      description="Sign in to mirror your typing-vitals history to your own cloud account. Everything else stays in this browser."
    >
      <SettingsCard>
        <SettingRow
          label="Google"
          description="Sign in with a Google account in a pop-up."
          control={
            <Button
              variant="primary"
              leadingIcon={LogIn}
              loading={busy === 'google'}
              disabled={busy !== null}
              onClick={() => void run('google', signInWithGoogle)}
            >
              Sign in with Google
            </Button>
          }
        />
        <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3.5" aria-label="Email sign-in">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              leadingIcon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy !== null}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              leadingIcon={KeyRound}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy !== null}
            />
          </div>
          {error && (
            <p role="alert" className="text-ui text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" leadingIcon={UserPlus} loading={busy === 'create'} disabled={busy !== null} onClick={create}>
              Create account
            </Button>
            <Button type="submit" leadingIcon={LogIn} loading={busy === 'email'} disabled={busy !== null}>
              Sign in
            </Button>
          </div>
        </form>
      </SettingsCard>
    </SettingsSection>
  );
}

function AccountTabInner() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  // Settings only renders client-side, so these are read once here.
  const [mode] = useState(getVisitorMode);
  const [local] = useState(measureLocalData);
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const configured = isFirebaseConfigured();

  const doSignOut = () => {
    setSigningOut(true);
    signOut()
      .catch(() => {})
      .finally(() => setSigningOut(false));
  };

  const copyUid = () => {
    if (!user?.uid) return;
    void navigator.clipboard?.writeText(user.uid).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {}
    );
  };

  const sessionLabel = mode === 'guest' ? 'Guest' : mode === 'owner' ? `${OWNER.shortName} (owner)` : 'Not remembered';

  return (
    <SettingsPage>
      {isAuthenticated && user ? (
        <SettingsSection title="Profile">
          <Card hud className="chamfer-tl-br">
            <p className="engraved mb-3 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent/85">
              Warrior profile
            </p>
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={user.displayName || user.email || 'Warrior'} size="xl" status="online" ring />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-display text-base font-semibold uppercase tracking-[0.06em] text-fg"
                  title={user.displayName || 'Warrior'}
                >
                  {user.displayName || 'Warrior'}
                </p>
                <p className="truncate text-ui text-fg-muted" title={user.email ?? undefined}>
                  {user.email}
                </p>
              </div>
            </div>
          </Card>
          <SettingsCard>
            <SettingRow
              label="Status"
              description="Signed in on this device."
              control={
                <>
                  <span className="text-ui text-success">Authenticated</span>
                  <Button size="sm" leadingIcon={LogOut} loading={signingOut} onClick={doSignOut}>
                    Sign out
                  </Button>
                </>
              }
            />
            <SettingRow
              label="UID"
              description="Your account id."
              control={
                <>
                  <span className="tabular font-mono text-xs text-fg-muted" title={user.uid}>
                    {user.uid?.slice(0, 16)}...
                  </span>
                  <IconButton
                    icon={copied ? Check : Copy}
                    aria-label={copied ? 'Copied' : 'Copy UID'}
                    size="sm"
                    tooltip
                    onClick={copyUid}
                  />
                </>
              }
            />
            <CloudSyncRow />
          </SettingsCard>
        </SettingsSection>
      ) : !configured ? (
        <Card padding="none">
          <EmptyState
            icon={CloudOff}
            title="Cloud sync is off"
            description="This deployment has no sign-in: everything stays in this browser. The site owner can turn on accounts and sync by adding the Firebase web config (NEXT_PUBLIC_FIREBASE_* variables)."
          />
        </Card>
      ) : mode !== 'owner' ? (
        <Card padding="none">
          <EmptyState
            icon={UserRound}
            title="Local session"
            description="Sign-in and cloud sync are for the owner session. This session keeps everything in this browser."
          />
        </Card>
      ) : isLoading ? (
        <Card padding="none">
          <EmptyState icon={UserRound} title="Checking sign-in" description="Looking for a saved account on this device." />
        </Card>
      ) : (
        <SignInPanel />
      )}

      <SettingsSection title="This browser" description="Warrior OS is offline-first: your data lives here, not on a server.">
        <SettingsCard>
          <SettingRow label="Session" description="Who unlocked Warrior OS in this browser." control={<span className="text-ui text-fg">{sessionLabel}</span>} />
          <SettingRow
            label="Local data"
            description="Notes, habits, progress and settings saved on this device."
            control={
              local ? (
                <span className="tabular flex items-center gap-2 font-mono text-ui text-fg">
                  <HardDrive size={14} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                  {formatBytes(local.bytes)}
                  <span className="text-fg-subtle">· {local.keys} keys</span>
                </span>
              ) : (
                <span className="text-ui text-fg-subtle">Storage blocked</span>
              )
            }
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

export const AccountTab = memo(AccountTabInner);
