// ═══════════════════════════════════════════════════════════
// WARRIOR OS — User Types
// ═══════════════════════════════════════════════════════════

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  avatar: string;
  level: number;
  xp: number;
  totalXP: number;
  streak: number;
  lastActiveDate: string; // ISO date
  joinedAt: string; // ISO date
  preferences: UserPreferences;
}

export interface UserPreferences {
  wallpaper: string;
  accentColor: string;
  soundEnabled: boolean;
  soundVolume: number;
  crtEffect: boolean;
  cursorTrail: boolean;
  glassOpacity: number;
}

export interface UserStats {
  totalStudyHours: number;
  totalQuizzes: number;
  averageScore: number;
  strongSubjects: string[];
  weakSubjects: string[];
  longestStreak: number;
}
