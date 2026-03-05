// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Wallpaper Types
// Shared interface for all wallpaper components
// ═══════════════════════════════════════════════════════════

export interface WallpaperProps {
  mouseX: number;    // -1 to 1
  mouseY: number;    // -1 to 1
  bassLevel: number; // 0-1 (audio frequency band)
  midsLevel: number; // 0-1
  highsLevel: number; // 0-1
  overallLevel: number; // 0-1
}
