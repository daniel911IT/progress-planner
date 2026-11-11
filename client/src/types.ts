export interface Subarea {
  id: number;
  projectId: number;
  name: string;
  description: string;
  progress: number;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project extends ProjectRecord {
  subareas: Subarea[];
  progress: number;
  completedCount: number;
}

export interface ProjectPayload {
  name: string;
  description: string;
  color: string;
  icon: string;
  targetDate: string | null;
}

export interface SubareaPayload {
  name: string;
  description: string;
  progress: number;
  weight: number;
}

export type AchievementRarity = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Achievement {
  id: number;
  projectId: number | null;
  name: string;
  description: string;
  rarity: AchievementRarity;
  achieved: boolean;
  achievedAt: string | null;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export type AchievementPayload = Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>;

export interface HistoryDraft {
  projectId: number | null;
  projectName: string;
  subareaId: number | null;
  subareaName: string | null;
  action: 'project_created' | 'project_updated' | 'project_deleted' | 'subarea_created' | 'subarea_updated' | 'subarea_deleted' | 'progress_changed' | 'backup_restored' | 'achievement_created' | 'achievement_updated' | 'achievement_deleted' | 'achievement_unlocked' | 'achievement_linked' | 'achievement_unlinked';
  summary: string;
  createdAt: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface HistoryRecord extends HistoryDraft {
  id: number;
}

export interface BackupFile {
  format: 'progress-planner-backup';
  version: 2;
  exportedAt: string;
  projects: ProjectRecord[];
  subareas: Subarea[];
  history: HistoryRecord[];
  achievements: Achievement[];
}
