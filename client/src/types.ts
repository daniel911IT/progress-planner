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

export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
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
