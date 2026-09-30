// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Account Tab
// Who unlocked this browser, what it keeps, and owner sync: the owner's
// saved data mirrored between their devices through this site's own
// server (src/lib/sync, /api/sync). Sync needs OWNER_SYNC_TOKEN on the
// server and the same token entered here; guest sessions never sync.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { CloudOff, HardDrive, KeyRound, Link2, RefreshCw, Unlink, UserRound } from 'lucide-react';
import { Badge, Button, Card, EmptyState, IconButton, Input } from '@/components/ui';
import { getVisitorMode } from '@/lib/visitor';
import {
  checkSyncToken,
  fetchSyncConfigured,
  getServerSyncStatus,
  getSyncStatus,
  getSyncToken,
  resetSyncState,
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
  wrong_token: 'The server rejected the sync token. Disconnect and enter it again.',
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

/** Not connected yet: enter the server's OWNER_SYNC_TOKEN. */
function ConnectCard({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = token.trim();
    if (!value) {
      setError('Enter the sync token set on the server.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await checkSyncToken(value);
    setBusy(false);
    if (result === 'ok') {
      setSyncToken(value);
      setToken('');
      onConnected();
      void runOwnerSync();
    } else {
      setError(
        result === 'wrong'
          ? 'That token does not match the server.'
          : 'Could not reach the server. Try again in a moment.'
      );
    }
  };

  return (
    <SettingsCard>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 px-4 py-3.5" aria-label="Connect sync">
        <Input
          label="Sync token"
          type="password"
          autoComplete="off"
          leadingIcon={KeyRound}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={busy}
        />
        <p className="text-ui text-fg-muted">
          On the first connect, anything the server already holds replaces this device&apos;s copy; everything
          else here is uploaded.
        </p>
        {error && (
          <p role="alert" className="text-ui text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" leadingIcon={Link2} loading={busy}>
            Connect this device
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
          description="Everything stays in this browser. To sync between devices, set OWNER_SYNC_TOKEN (16+ characters) on the server and give it a persistent data folder (see DEPLOY.md)."
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
      {connected ? <SyncStatusCard onDisconnect={disconnect} /> : <ConnectCard onConnected={() => setConnected(true)} />}
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
