// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useContextMenu Hook
// Right-click context menu state management
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';

interface ContextMenuState {
  position: { x: number; y: number } | null;
  isOpen: boolean;
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    position: null,
    isOpen: false,
  });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setState({
      position: { x: e.clientX, y: e.clientY },
      isOpen: true,
    });
  }, []);

  const close = useCallback(() => {
    setState({ position: null, isOpen: false });
  }, []);

  // Close on window blur
  useEffect(() => {
    if (!state.isOpen) return;
    const handleBlur = () => close();
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [state.isOpen, close]);

  return {
    position: state.position,
    isOpen: state.isOpen,
    handleContextMenu,
    close,
  };
}
