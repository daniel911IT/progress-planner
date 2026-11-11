import dotenv from 'dotenv';
import { resolve } from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import pool from './db.js';
import type { Project, ProjectInput, Subarea, SubareaInput } from './types.js';

const app = express();
dotenv.config({ path: resolve(process.cwd(), '../.env') });
dotenv.config();
const port = Number(process.env.PORT ?? 3001);
app.use(cors());
app.use(express.json());

const asyncRoute = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => handler(req, res).catch(next);

function validProgress(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 && value % 5 === 0;
}

function normalizeSubarea(row: Record<string, unknown>): Subarea {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    description: String(row.description ?? ''),
    progress: Number(row.progress),
    weight: Number(row.weight),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

async function listProjects(): Promise<Project[]> {
  const projectRows = await pool.query('SELECT * FROM projects ORDER BY updated_at DESC, id DESC');
  const areaRows = await pool.query('SELECT * FROM subareas ORDER BY created_at ASC, id ASC');
  const byProject = new Map<number, Subarea[]>();
  for (const raw of areaRows as Record<string, unknown>[]) {
    const area = normalizeSubarea(raw);
    byProject.set(area.projectId, [...(byProject.get(area.projectId) ?? []), area]);
  }
  return (projectRows as Record<string, unknown>[]).map((row) => {
    const subareas = byProject.get(Number(row.id)) ?? [];
    const weight = subareas.reduce((sum, area) => sum + area.weight, 0);
    const progress = weight ? Math.round(subareas.reduce((sum, area) => sum + area.progress * area.weight, 0) / weight) : 0;
    return {
      id: Number(row.id), name: String(row.name), description: String(row.description ?? ''),
      color: String(row.color), icon: String(row.icon), targetDate: row.target_date ? String(row.target_date).slice(0, 10) : null,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), subareas, progress,
      completedCount: subareas.filter((area) => area.progress === 100).length
    };
  });
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.get('/api/projects', asyncRoute(async (_req, res) => {
  res.json(await listProjects());
}));

app.post('/api/projects', asyncRoute(async (req, res) => {
  const input = req.body as ProjectInput;
  if (!input.name?.trim()) { res.status(400).json({ error: 'Ein Projektname ist erforderlich.' }); return; }
  const result = await pool.query(
    'INSERT INTO projects (name, description, color, icon, target_date) VALUES (?, ?, ?, ?, ?)',
    [input.name.trim(), input.description?.trim() ?? '', input.color ?? '#9a8cff', input.icon ?? 'sparkles', input.targetDate || null]
  );
  const projects = await listProjects();
  res.status(201).json(projects.find((project) => project.id === Number(result.insertId)));
}));

app.put('/api/projects/:id', asyncRoute(async (req, res) => {
  const input = req.body as Partial<ProjectInput>;
  if (input.name !== undefined && !input.name.trim()) { res.status(400).json({ error: 'Ein Projektname ist erforderlich.' }); return; }
  const id = Number(req.params.id);
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { assignments.push('name = ?'); values.push(input.name.trim()); }
  if (input.description !== undefined) { assignments.push('description = ?'); values.push(input.description); }
  if (input.color !== undefined) { assignments.push('color = ?'); values.push(input.color); }
  if (input.icon !== undefined) { assignments.push('icon = ?'); values.push(input.icon); }
  if (input.targetDate !== undefined) { assignments.push('target_date = ?'); values.push(input.targetDate || null); }
  if (assignments.length) await pool.query(`UPDATE projects SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
  const project = (await listProjects()).find((entry) => entry.id === id);
  if (!project) { res.status(404).json({ error: 'Projekt nicht gefunden.' }); return; }
  res.json(project);
}));

app.delete('/api/projects/:id', asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM projects WHERE id = ?', [Number(req.params.id)]);
  if (!result.affectedRows) { res.status(404).json({ error: 'Projekt nicht gefunden.' }); return; }
  res.status(204).end();
}));

app.post('/api/projects/:id/subareas', asyncRoute(async (req, res) => {
  const input = req.body as SubareaInput;
  const projectId = Number(req.params.id);
  if (!input.name?.trim()) { res.status(400).json({ error: 'Ein Bereichsname ist erforderlich.' }); return; }
  if (input.progress !== undefined && !validProgress(input.progress)) { res.status(400).json({ error: 'Fortschritt muss in 5-%-Schritten zwischen 0 und 100 liegen.' }); return; }
  if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight <= 0)) { res.status(400).json({ error: 'Die Gewichtung muss größer als 0 sein.' }); return; }
  const parent = await pool.query('SELECT id FROM projects WHERE id = ?', [projectId]);
  if (!parent.length) { res.status(404).json({ error: 'Projekt nicht gefunden.' }); return; }
  const result = await pool.query(
    'INSERT INTO subareas (project_id, name, description, progress, weight) VALUES (?, ?, ?, ?, ?)',
    [projectId, input.name.trim(), input.description?.trim() ?? '', input.progress ?? 0, input.weight ?? 1]
  );
  const rows = await pool.query('SELECT * FROM subareas WHERE id = ?', [Number(result.insertId)]);
  if (!rows.length) { res.status(404).json({ error: 'Projekt nicht gefunden.' }); return; }
  res.status(201).json(normalizeSubarea(rows[0] as Record<string, unknown>));
}));

app.put('/api/subareas/:id', asyncRoute(async (req, res) => {
  const input = req.body as Partial<SubareaInput>;
  if (input.name !== undefined && !input.name.trim()) { res.status(400).json({ error: 'Ein Bereichsname ist erforderlich.' }); return; }
  if (input.progress !== undefined && !validProgress(input.progress)) { res.status(400).json({ error: 'Fortschritt muss in 5-%-Schritten zwischen 0 und 100 liegen.' }); return; }
  if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight <= 0)) { res.status(400).json({ error: 'Die Gewichtung muss größer als 0 sein.' }); return; }
  const id = Number(req.params.id);
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { assignments.push('name = ?'); values.push(input.name.trim()); }
  if (input.description !== undefined) { assignments.push('description = ?'); values.push(input.description); }
  if (input.progress !== undefined) { assignments.push('progress = ?'); values.push(input.progress); }
  if (input.weight !== undefined) { assignments.push('weight = ?'); values.push(input.weight); }
  if (assignments.length) await pool.query(`UPDATE subareas SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
  const rows = await pool.query('SELECT * FROM subareas WHERE id = ?', [id]);
  if (!rows.length) { res.status(404).json({ error: 'Teilbereich nicht gefunden.' }); return; }
  res.json(normalizeSubarea(rows[0] as Record<string, unknown>));
}));

app.delete('/api/subareas/:id', asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM subareas WHERE id = ?', [Number(req.params.id)]);
  if (!result.affectedRows) { res.status(404).json({ error: 'Teilbereich nicht gefunden.' }); return; }
  res.status(204).end();
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Es ist ein unerwarteter Fehler aufgetreten.' });
});

app.listen(port, () => console.log(`Progress Planner API läuft auf Port ${port}`));
