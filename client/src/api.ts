import type { Project, ProjectPayload, Subarea, SubareaPayload } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Die Anfrage konnte nicht abgeschlossen werden.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  projects: () => request<Project[]>('/projects'),
  createProject: (payload: ProjectPayload) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  updateProject: (id: number, payload: ProjectPayload) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  createSubarea: (projectId: number, payload: SubareaPayload) => request<Subarea>(`/projects/${projectId}/subareas`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSubarea: (id: number, payload: Partial<SubareaPayload>) => request<Subarea>(`/subareas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSubarea: (id: number) => request<void>(`/subareas/${id}`, { method: 'DELETE' })
};
