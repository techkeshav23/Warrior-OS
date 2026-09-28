// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Account Tab
// User profile and auth status, plus what this browser keeps.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { Check, Copy, HardDrive, UserRound } from 'lucide-react';
import { Avatar, Card, EmptyState, IconButton } from '@/components/ui';
import { useAuthStore } from '@/stores/useAuthStore';
import { getVisitorMode } from '@/lib/visitor';
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

function AccountTabInner() {
  const { user, isAuthenticated } = useAuthStore();
  // Settings only renders client-side, so these are read once here.
  const [mode] = useState(getVisitorMode);
  const [local] = useState(measureLocalData);
  const [copied, setCopied] = useState(false);

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
          <Card hud>
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={user.displayName || user.email || 'Warrior'} size="xl" status="online" ring />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-fg" title={user.displayName || 'Warrior'}>
                  {user.displayName || 'Warrior'}
                </p>
                <p className="truncate text-ui text-fg-muted" title={user.email ?? undefined}>
                  {user.email}
                </p>
              </div>
            </div>
          </Card>
          <SettingsCard>
            <SettingRow label="Status" description="Signed in on this device." control={<span className="text-ui text-success">Authenticated</span>} />
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
          </SettingsCard>
        </SettingsSection>
      ) : (
        <Card padding="none">
          <EmptyState
            icon={UserRound}
            title="Not signed in"
            description="Sign in from the lock screen to sync your data across devices. Until then everything stays in this browser."
          />
        </Card>
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
