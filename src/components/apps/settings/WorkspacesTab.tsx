// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspaces Tab
// Manage workspace configurations
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { WorkspaceId } from '@/types/workspace';

function WorkspacesTabInner() {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useWorkspaceStore();

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Workspaces</h3>
      <p className="text-xs text-white/50">
        Organize your apps into separate workspaces. Switch with keyboard shortcuts.
      </p>

      <div className="space-y-2">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => switchWorkspace(ws.id as WorkspaceId)}
            className={cn(
              'w-full p-4 rounded-lg border text-left transition-all',
              activeWorkspaceId === ws.id
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  'text-sm font-medium',
                  activeWorkspaceId === ws.id ? 'text-cyan-300' : 'text-white/80'
                )}>
                  {ws.name}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {ws.openWindowIds?.length || 0} windows
                </p>
              </div>
              {activeWorkspaceId === ws.id && (
                <span className="text-xs text-cyan-400">Active</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export const WorkspacesTab = memo(WorkspacesTabInner);
