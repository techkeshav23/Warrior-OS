// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Account Tab
// Who unlocked this browser, what it keeps, and owner sync: the owner's
// saved data mirrored between their devices through this site's own
// server (src/lib/sync, /api/sync). Sync needs OWNER_PASSWORD on the
// server; unlocking with that password (or entering it here) connects a
// device. Guest sessions never sync.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { CloudOff, HardDrive, KeyRound, Link2, RefreshCw, Unlink, UserRound } from 'lucide-react';
import { Badge, Button, Card, EmptyState, IconButton, Input } from '@/components/ui';
import { getVisitorMode } from '@/lib/visitor';
import {
  changeOwnerPassword,
  describeOwnerError,
  fetchSyncConfigured,
  getServerSyncStatus,
  getSyncStatus,
  getSyncToken,
  resetSyncState,
  ownerSignIn,
  setSyncToken,
  subscribeSyncStatus,
} from '@/lib/sync/client';
import { runOwnerSync } from '@/components/os/OwnerSync';
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

const SYNC_ERRORS: Record<string, string> = {
  wrong_token: 'The server rejected this device. Lock the screen and unlock with your owner password.',
  unreachable: 'Could not reach the server. Changes stay here and sync when it is back.',
};

/** Connected: status, Sync now, Disconnect. */
function SyncStatusCard({ onDisconnect }: { onDisconnect: () => void }) {
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getServerSyncStatus);

  let badge;
  if (sync.state === 'syncing') badge = <Badge tone="accent" dot>Syncing</Badge>;
  else if (sync.state === 'error') badge = <Badge tone="warning" dot>Paused</Badge>;
  else if (sync.lastSync !== null)
    badge = (
      <Badge tone="success" dot>
        Synced {timeFormat.format(sync.lastSync)}
      </Badge>
    );
  else badge = <Badge tone="info">Waiting</Badge>;

  const error = sync.state === 'error' ? SYNC_ERRORS[sync.error ?? ''] ?? `Sync failed (${sync.error}).` : null;

  return (
    <SettingsCard>
      <SettingRow
        label="Sync"
        description={
          error ??
          'Notes, decks, habits, projects, expenses, progress and settings follow you to every device you connect. Syncs every minute and when you switch tabs.'
        }
        control={
          <>
            {badge}
            <IconButton
              icon={RefreshCw}
              aria-label="Sync now"
              size="sm"
              tooltip
              disabled={sync.state === 'syncing'}
              onClick={() => void runOwnerSync()}
            />
          </>
        }
      />
      <SettingRow
        label="This device"
        description="Disconnecting stops syncing here. Data already on this device and on the server stays."
        control={
          <Button size="sm" variant="ghost" leadingIcon={Unlink} onClick={onDisconnect}>
            Disconnect
          </Button>
        }
      />
    </SettingsCard>
  );
}

/** A new password twice; returns the error line, or null when they are fine. */
function checkNewPassword(next: string, confirm: string): string | null {
  if (next.trim().length < 8) return 'Use at least 8 characters.';
  if (next !== confirm) return 'The two new passwords do not match.';
  return null;
}

/**
 * Not connected: sign in with the owner password (a temporary one asks
 * for a new password right here). Connected: change the password.
 */
function PasswordCard({ connected, onConnected }: { connected: boolean; onConnected: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  // Temporary password accepted: the new-password fields are required.
  const [mustChange, setMustChange] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const changing = connected || mustChange;

  const finish = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setMustChange(false);
    setDone(true);
    onConnected();
    void runOwnerSync();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (!current) {
      setError(connected ? 'Enter your current password.' : 'Enter your owner password.');
      return;
    }
    if (changing) {
      const problem = checkNewPassword(next, confirm);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    if (changing) {
      const result = await changeOwnerPassword(current, next);
      setBusy(false);
      if (result === 'ok') finish();
      else setError(describeOwnerError(result));
      return;
    }
    const result = await ownerSignIn(current);
    setBusy(false);
    if (result === 'ok') finish();
    else if (result === 'must-change') setMustChange(true);
    else if (result === 'local') setError(describeOwnerError('unreachable'));
    else setError(describeOwnerError(result));
  };

  return (
    <SettingsCard>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 px-4 py-3.5" aria-label={changing ? 'Change password' : 'Connect sync'}>
        {mustChange && (
          <p className="text-ui text-fg">That was the temporary password. Choose your own password to finish.</p>
        )}
        <Input
          label={connected ? 'Current password' : mustChange ? 'Temporary password' : 'Owner password'}
          type="password"
          autoComplete="current-password"
          leadingIcon={KeyRound}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={busy}
        />
        {changing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              leadingIcon={KeyRound}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={busy}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              leadingIcon={KeyRound}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </div>
        )}
        {!connected && !mustChange && (
          <p className="text-ui text-fg-muted">
            On the first connect, anything the server already holds replaces this device&apos;s copy; everything
            else here is uploaded.
          </p>
        )}
        {connected && (
          <p className="text-ui text-fg-muted">Your other devices ask for the new password at their next unlock.</p>
        )}
        {error && (
          <p role="alert" className="text-ui text-danger">
            {error}
          </p>
        )}
        {done && !error && connected && (
          <p role="status" className="text-ui text-success">
            Password saved.
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" leadingIcon={changing ? KeyRound : Link2} loading={busy}>
            {connected ? 'Change password' : mustChange ? 'Save password and connect' : 'Connect this device'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function SyncSection({ mode }: { mode: ReturnType<typeof getVisitorMode> }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(() => getSyncToken() !== null);

  useEffect(() => {
    let alive = true;
    void fetchSyncConfigured().then((value) => {
      if (alive) setConfigured(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const disconnect = () => {
    setSyncToken(null);
    resetSyncState();
    setConnected(false);
  };

  if (mode !== 'owner') {
    return (
      <Card padding="none">
        <EmptyState
          icon={UserRound}
          title="Local session"
          description="Sync is for the owner session. This session keeps everything in this browser."
        />
      </Card>
    );
  }
  if (configured === false) {
    return (
      <Card padding="none">
        <EmptyState
          icon={CloudOff}
          title="Sync is off on this server"
          description="Everything stays in this browser. To sync between devices, set OWNER_PASSWORD (8+ characters) on the server and give it a persistent data folder (see DEPLOY.md)."
        />
      </Card>
    );
  }
  if (configured === null) {
    return (
      <Card padding="none">
        <EmptyState icon={RefreshCw} title="Checking sync" description="Asking the server whether sync is on." />
      </Card>
    );
  }
  return (
    <SettingsSection
      title="Sync"
      description="Your data, mirrored between your devices through this site's own server. No third-party account."
    >
      {connected && <SyncStatusCard onDisconnect={disconnect} />}
      <PasswordCard connected={connected} onConnected={() => setConnected(true)} />
    </SettingsSection>
  );
}

function AccountTabInner() {
  // Settings only renders client-side, so these are read once here.
  const [mode] = useState(getVisitorMode);
  const [local] = useState(measureLocalData);

  const sessionLabel = mode === 'guest' ? 'Guest' : mode === 'owner' ? `${OWNER.shortName} (owner)` : 'Not remembered';

  return (
    <SettingsPage>
      <SyncSection mode={mode} />

      <SettingsSection title="This browser" description="Warrior OS is offline-first: your data lives here first; sync only mirrors it.">
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
