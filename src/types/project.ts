// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Types
// ═══════════════════════════════════════════════════════════

export type ProjectStatus = 'planning' | 'in-progress' | 'completed' | 'paused';

export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  status: ProjectStatus;
  progress: number; // 0-100
  tasks: ProjectTask[];
  githubUrl?: string;
  deployUrl?: string;
  createdAt: string;
  updatedAt: string;
}
