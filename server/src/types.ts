export interface ProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  targetDate?: string | null;
}

export interface SubareaInput {
  name: string;
  description?: string;
  progress?: number;
  weight?: number;
}

export interface Subarea extends SubareaInput {
  id: number;
  projectId: number;
  progress: number;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project extends ProjectInput {
  id: number;
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
