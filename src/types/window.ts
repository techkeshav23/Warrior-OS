// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Types
// ═══════════════════════════════════════════════════════════

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  title: string;
  icon: string;
  position: Position;
  size: Size;
  minSize: Size;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  zIndex: number;
  appId: string;
  workspaceId: string;
  /** Position/size before maximize, for restore */
  preMaximize?: { position: Position; size: Size };
}

export type WindowSnap = 'left' | 'right' | 'top' | 'full' | null;
