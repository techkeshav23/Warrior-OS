// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace Manager
// Manages 3 workspaces (Study/Build/Chill) with 3D cube
// rotation transition between them
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { WorkspaceId } from '@/types/workspace';
import { cn } from '@/lib/utils';

interface WorkspaceManagerProps {
  children: (workspaceId: WorkspaceId) => React.ReactNode;
}

// Rotation direction for 3D cube transition
const WORKSPACE_ORDER: WorkspaceId[] = ['study', 'build', 'chill'];

function getRotation(from: WorkspaceId, to: WorkspaceId): number {
  const fromIdx = WORKSPACE_ORDER.indexOf(from);
  const toIdx = WORKSPACE_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return 0;
  const diff = toIdx - fromIdx;
  // Choose shortest path
  if (diff === 0) return 0;
  if (diff === 1 || diff === -2) return -90;
  return 90;
}

function WorkspaceManagerInner({ children }: WorkspaceManagerProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWallpaper = useSettingsStore((s) => s.setWallpaper);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevWorkspaceRef = useRef(activeWorkspaceId);
  const [rotation, setRotation] = useState(0);

  // Update wallpaper and accent color when workspace changes
  useEffect(() => {
    const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!workspace) return;

    // Only apply workspace-specific settings if this is a workspace switch
    if (prevWorkspaceRef.current !== activeWorkspaceId) {
      const rot = getRotation(prevWorkspaceRef.current, activeWorkspaceId);
      setRotation(rot);
      setIsTransitioning(true);

      // Update settings for new workspace
      setWallpaper(workspace.wallpaper);
      setAccentColor(workspace.accentColor);

      prevWorkspaceRef.current = activeWorkspaceId;

      // End transition
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setRotation(0);
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [activeWorkspaceId, workspaces, setWallpaper, setAccentColor]);

  return (
    <div className="relative w-full h-full" style={{ perspective: '1200px' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeWorkspaceId}
          initial={{
            rotateY: rotation !== 0 ? -rotation : 0,
            opacity: 0.7,
            scale: 0.95,
          }}
          animate={{
            rotateY: 0,
            opacity: 1,
            scale: 1,
          }}
          exit={{
            rotateY: rotation,
            opacity: 0.7,
            scale: 0.95,
          }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 25,
            mass: 1,
          }}
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
          }}
        >
          {children(activeWorkspaceId)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Workspace Indicator Dots ───
interface WorkspaceDotsProps {
  className?: string;
}

function WorkspaceDotsInner({ className }: WorkspaceDotsProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const handleSwitch = useCallback(
    (id: WorkspaceId) => {
      switchWorkspace(id);
    },
    [switchWorkspace]
  );

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-black/30 backdrop-blur-sm border border-white/5',
        className
      )}
    >
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        return (
          <button
            key={ws.id}
            onClick={() => handleSwitch(ws.id as WorkspaceId)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
              'transition-all duration-300 font-mono text-[10px]',
              isActive
                ? 'text-white'
                : 'text-white/40 hover:text-white/60'
            )}
            aria-label={`Switch to ${ws.name} workspace`}
            aria-current={isActive ? 'true' : undefined}
          >
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: isActive ? ws.accentColor : 'rgba(255,255,255,0.2)',
                boxShadow: isActive
                  ? `0 0 8px ${ws.accentColor}60`
                  : 'none',
              }}
              animate={{
                scale: isActive ? [1, 1.2, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: isActive ? Infinity : 0,
                ease: 'easeInOut',
              }}
            />
            {isActive && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {ws.name}
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const WorkspaceManager = memo(WorkspaceManagerInner);
export const WorkspaceDots = memo(WorkspaceDotsInner);
