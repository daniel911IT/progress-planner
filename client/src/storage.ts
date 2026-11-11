import type {
  BackupFile,
  Achievement,
  AchievementPayload,
  HistoryDraft,
  HistoryRecord,
  Project,
  ProjectPayload,
  ProjectRecord,
  Subarea,
  SubareaPayload
} from './types';

const DATABASE_NAME = 'progress-planner';
const DATABASE_VERSION = 3;
const PROJECTS = 'projects';
const SUBAREAS = 'subareas';
const HISTORY = 'history';
const ACHIEVEMENTS = 'achievements';
const BACKUP_FORMAT = 'progress-planner-backup';

type RestorableBackup = Omit<BackupFile, 'history'> & { history: Array<HistoryDraft | HistoryRecord> };
type Fail = (error: Error) => void;

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS)) database.createObjectStore(PROJECTS, { keyPath: 'id', autoIncrement: true });
      if (!database.objectStoreNames.contains(SUBAREAS)) {
        const areas = database.createObjectStore(SUBAREAS, { keyPath: 'id', autoIncrement: true });
        areas.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!database.objectStoreNames.contains(HISTORY)) {
        const history = database.createObjectStore(HISTORY, { keyPath: 'id', autoIncrement: true });
        history.createIndex('projectId', 'projectId', { unique: false });
        history.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(ACHIEVEMENTS)) {
        const achievements = database.createObjectStore(ACHIEVEMENTS, { keyPath: 'id', autoIncrement: true });
        achievements.createIndex('projectId', 'projectId', { unique: false });
        achievements.createIndex('achievedAt', 'achievedAt', { unique: false });
      }

      const achievements = request.transaction?.objectStore(ACHIEVEMENTS);
      if (achievements) {
        const cursorRequest = achievements.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const achievement = cursor.value as Omit<Achievement, 'rarity'> & { rarity: string };
          if (achievement.rarity === 'platinum') cursor.update({ ...achievement, rarity: 'ruby' });
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error('Der lokale Datenspeicher konnte nicht geöffnet werden.'));
    };
    request.onblocked = () => reject(new Error('Schließe andere Progress-Planner-Fenster und versuche es erneut.'));
  });

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Der lokale Datenspeicher konnte nicht gelesen werden.'));
  });
}

function transactionFinished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Die lokale Änderung wurde abgebrochen.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Die lokale Änderung ist fehlgeschlagen.'));
  });
}

async function readWrite(stores: string[], setup: (transaction: IDBTransaction, fail: Fail) => void): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, 'readwrite');
    let failure: Error | undefined;
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Die lokale Änderung wurde abgebrochen.'));
    transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('Die lokale Änderung ist fehlgeschlagen.'));

    const fail: Fail = (error) => {
      failure = error;
      try { transaction.abort(); } catch { reject(error); }
    };

    try { setup(transaction, fail); }
    catch (error) { fail(error instanceof Error ? error : new Error('Die lokale Änderung ist fehlgeschlagen.')); }
  });
}

function now(): string { return new Date().toISOString(); }

function makeChange(
  projectId: number | null,
  projectName: string,
  action: HistoryDraft['action'],
  summary: string,
  subareaId: number | null = null,
  subareaName: string | null = null,
  changes?: HistoryDraft['changes']
): HistoryDraft {
  return { projectId, projectName, subareaId, subareaName, action, summary, createdAt: now(), ...(changes ? { changes } : {}) };
}

function difference(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of fields) {
    if (before[field] !== after[field]) changes[field] = { before: before[field], after: after[field] };
  }
  return changes;
}

function validateProgress(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 100 || value % 5 !== 0) {
    throw new Error('Fortschritt muss in 5-%-Schritten zwischen 0 und 100 liegen.');
  }
}

function validateWeight(value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error('Die Gewichtung muss größer als 0 sein.');
}

function validateAchievementPayload(payload: AchievementPayload): void {
  if (!payload.name.trim()) throw new Error('Ein Achievement benötigt einen Namen.');
  if (!achievementRarities.has(payload.rarity)) throw new Error('Bitte wähle eine gültige Seltenheitsstufe.');
  if (payload.achieved !== Boolean(payload.achievedAt)) throw new Error('Status und Erreichungsdatum passen nicht zusammen.');
  if (payload.achievedAt && Number.isNaN(Date.parse(payload.achievedAt))) throw new Error('Bitte wähle ein gültiges Erreichungsdatum.');
  if (payload.projectId !== null && (!Number.isSafeInteger(payload.projectId) || payload.projectId < 1)) throw new Error('Projektverknüpfung ist ungültig.');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} ist ungültig.`);
  return value as Record<string, unknown>;
}

function readName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} benötigt einen Namen.`);
  return value.trim();
}

function readText(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw new Error('Ein Textfeld in der Sicherung ist ungültig.');
  return value;
}

function readId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} enthält eine ungültige ID.`);
  return value;
}

function readDate(value: unknown, fallback = now()): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('Ein Datum in der Sicherung ist ungültig.');
  return value;
}

function normalizeProject(value: unknown): ProjectRecord {
  const input = asRecord(value, 'Projekt');
  const targetDate = input.targetDate;
  if (targetDate !== undefined && targetDate !== null && typeof targetDate !== 'string') throw new Error('Ein Zieldatum in der Sicherung ist ungültig.');
  return {
    id: readId(input.id, 'Projekt'),
    name: readName(input.name, 'Projekt'),
    description: readText(input.description),
    color: readText(input.color, '#9a8cff'),
    icon: readText(input.icon, 'sparkles'),
    targetDate: targetDate ? String(targetDate) : null,
    createdAt: readDate(input.createdAt),
    updatedAt: readDate(input.updatedAt, readDate(input.createdAt))
  };
}

function normalizeSubarea(value: unknown, projectIdOverride?: number): Subarea {
  const input = asRecord(value, 'Teilbereich');
  const progress = input.progress === undefined ? 0 : Number(input.progress);
  const weight = input.weight === undefined ? 1 : Number(input.weight);
  validateProgress(progress);
  validateWeight(weight);
  return {
    id: readId(input.id, 'Teilbereich'),
    projectId: projectIdOverride ?? readId(input.projectId, 'Teilbereich'),
    name: readName(input.name, 'Teilbereich'),
    description: readText(input.description),
    progress,
    weight,
    createdAt: readDate(input.createdAt),
    updatedAt: readDate(input.updatedAt, readDate(input.createdAt))
  };
}

const historyActions = new Set<HistoryDraft['action']>([
  'project_created', 'project_updated', 'project_deleted', 'subarea_created', 'subarea_updated',
  'subarea_deleted', 'progress_changed', 'backup_restored', 'achievement_created', 'achievement_updated',
  'achievement_deleted', 'achievement_unlocked', 'achievement_linked', 'achievement_unlinked'
]);

const achievementRarities = new Set(['bronze', 'silver', 'gold', 'ruby', 'diamond']);

function normalizeAchievement(value: unknown): Achievement {
  const input = asRecord(value, 'Achievement');
  const rarity = input.rarity === 'platinum' ? 'ruby' : input.rarity;
  if (typeof rarity !== 'string' || !achievementRarities.has(rarity)) throw new Error('Ein Achievement hat eine ungültige Seltenheitsstufe.');
  if (typeof input.achieved !== 'boolean') throw new Error('Der Status eines Achievements ist ungültig.');
  const achievedAt = input.achievedAt === null || input.achievedAt === undefined || input.achievedAt === ''
    ? null
    : readDate(input.achievedAt);
  if (input.achieved !== Boolean(achievedAt)) throw new Error('Status und Erreichungsdatum eines Achievements passen nicht zusammen.');
  return {
    id: readId(input.id, 'Achievement'),
    projectId: input.projectId === null || input.projectId === undefined ? null : readId(input.projectId, 'Achievement'),
    name: readName(input.name, 'Achievement'),
    description: readText(input.description),
    rarity: rarity as Achievement['rarity'],
    achieved: input.achieved,
    achievedAt,
    icon: readText(input.icon),
    createdAt: readDate(input.createdAt),
    updatedAt: readDate(input.updatedAt, readDate(input.createdAt))
  };
}

function normalizeHistory(value: unknown): HistoryDraft | HistoryRecord {
  const input = asRecord(value, 'Verlaufseintrag');
  const action = input.action;
  if (typeof action !== 'string' || !historyActions.has(action as HistoryDraft['action'])) throw new Error('Ein Verlaufseintrag hat einen unbekannten Typ.');
  const projectId = input.projectId === null ? null : readId(input.projectId, 'Verlaufseintrag');
  const subareaId = input.subareaId === null || input.subareaId === undefined ? null : readId(input.subareaId, 'Verlaufseintrag');
  const entry: HistoryDraft = {
    projectId,
    projectName: readText(input.projectName, 'Progress Planner'),
    subareaId,
    subareaName: input.subareaName === null || input.subareaName === undefined ? null : readText(input.subareaName),
    action: action as HistoryDraft['action'],
    summary: readText(input.summary),
    createdAt: readDate(input.createdAt),
    ...(input.changes && typeof input.changes === 'object' && !Array.isArray(input.changes) ? { changes: input.changes as HistoryDraft['changes'] } : {})
  };
  return input.id === undefined ? entry : { ...entry, id: readId(input.id, 'Verlaufseintrag') };
}

function assertUniqueIds(records: Array<{ id: number }>, label: string): void {
  const ids = new Set<number>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Die Sicherung enthält doppelte ${label}-IDs.`);
    ids.add(record.id);
  }
}

export function validateBackup(input: unknown): RestorableBackup {
  if (Array.isArray(input)) {
    const projects: ProjectRecord[] = [];
    const subareas: Subarea[] = [];
    for (const rawProject of input) {
      const record = asRecord(rawProject, 'Projekt');
      const project = normalizeProject(record);
      projects.push(project);
      const areas = record.subareas === undefined ? [] : record.subareas;
      if (!Array.isArray(areas)) throw new Error('Die Teilbereiche in der alten Sicherung sind ungültig.');
      for (const area of areas) subareas.push(normalizeSubarea(area, project.id));
    }
    assertUniqueIds(projects, 'Projekt');
    assertUniqueIds(subareas, 'Teilbereich');
    return { format: BACKUP_FORMAT, version: 3, exportedAt: now(), projects, subareas, history: [], achievements: [] };
  }

  const backup = asRecord(input, 'JSON-Sicherung');
  if (backup.format !== BACKUP_FORMAT || (backup.version !== 1 && backup.version !== 2 && backup.version !== 3)) throw new Error('Dieses Sicherungsformat wird nicht unterstützt.');
  if (!Array.isArray(backup.projects) || !Array.isArray(backup.subareas) || !Array.isArray(backup.history)) {
    throw new Error('Die Sicherung benötigt Projekte, Teilbereiche und Verlaufseinträge.');
  }
  if (backup.version >= 2 && !Array.isArray(backup.achievements)) throw new Error('Die Sicherung benötigt eine Achievement-Liste.');

  const projects = backup.projects.map(normalizeProject);
  const subareas = backup.subareas.map((area) => normalizeSubarea(area));
  const history = backup.history.map(normalizeHistory);
  const achievements = backup.version >= 2 ? (backup.achievements as unknown[]).map(normalizeAchievement) : [];
  assertUniqueIds(projects, 'Projekt');
  assertUniqueIds(subareas, 'Teilbereich');
  assertUniqueIds(achievements, 'Achievement');
  const projectIds = new Set(projects.map((project) => project.id));
  if (subareas.some((area) => !projectIds.has(area.projectId))) throw new Error('Mindestens ein Teilbereich verweist auf ein fehlendes Projekt.');
  if (achievements.some((achievement) => achievement.projectId !== null && !projectIds.has(achievement.projectId))) throw new Error('Mindestens ein Achievement verweist auf ein fehlendes Projekt.');
  const historyIds = history.filter((entry): entry is HistoryRecord => 'id' in entry);
  assertUniqueIds(historyIds, 'Verlaufseintrag');

  return {
    format: BACKUP_FORMAT,
    version: 3,
    exportedAt: readDate(backup.exportedAt),
    projects,
    subareas,
    history,
    achievements
  };
}

async function readAllStores(): Promise<{ projects: ProjectRecord[]; subareas: Subarea[]; history: HistoryRecord[]; achievements: Achievement[] }> {
  const database = await openDatabase();
  const transaction = database.transaction([PROJECTS, SUBAREAS, HISTORY, ACHIEVEMENTS], 'readonly');
  const done = transactionFinished(transaction);
  const projectsRequest = transaction.objectStore(PROJECTS).getAll() as IDBRequest<ProjectRecord[]>;
  const subareasRequest = transaction.objectStore(SUBAREAS).getAll() as IDBRequest<Subarea[]>;
  const historyRequest = transaction.objectStore(HISTORY).getAll() as IDBRequest<HistoryRecord[]>;
  const achievementsRequest = transaction.objectStore(ACHIEVEMENTS).getAll() as IDBRequest<Achievement[]>;
  const [projects, subareas, history, achievements] = await Promise.all([
    requestResult(projectsRequest), requestResult(subareasRequest), requestResult(historyRequest), requestResult(achievementsRequest)
  ]);
  await done;
  return { projects, subareas, history, achievements };
}

export async function initializeStorage(): Promise<boolean> {
  await openDatabase();
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch {
    return false;
  }
}

export const dataStore = {
  async projects(): Promise<Project[]> {
    const records = await readAllStores();
    const areasByProject = new Map<number, Subarea[]>();
    for (const area of records.subareas) areasByProject.set(area.projectId, [...(areasByProject.get(area.projectId) ?? []), area]);
    return records.projects
      .map((project) => {
        const subareas = (areasByProject.get(project.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
        const weight = subareas.reduce((total, area) => total + area.weight, 0);
        const progress = weight ? Math.round(subareas.reduce((total, area) => total + area.progress * area.weight, 0) / weight) : 0;
        return { ...project, subareas, progress, completedCount: subareas.filter((area) => area.progress === 100).length };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
  },

  async historyForProject(projectId: number): Promise<HistoryRecord[]> {
    const database = await openDatabase();
    const transaction = database.transaction(HISTORY, 'readonly');
    const done = transactionFinished(transaction);
    const request = transaction.objectStore(HISTORY).index('projectId').getAll(projectId) as IDBRequest<HistoryRecord[]>;
    const records = await requestResult(request);
    await done;
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  },

  async achievements(): Promise<Achievement[]> {
    const database = await openDatabase();
    const transaction = database.transaction(ACHIEVEMENTS, 'readonly');
    const done = transactionFinished(transaction);
    const request = transaction.objectStore(ACHIEVEMENTS).getAll() as IDBRequest<Achievement[]>;
    const records = await requestResult(request);
    await done;
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
  },

  async createAchievement(payload: AchievementPayload): Promise<number> {
    validateAchievementPayload(payload);
    const timestamp = now();
    let achievementId = 0;
    await readWrite([PROJECTS, ACHIEVEMENTS, HISTORY], (transaction, fail) => {
      const save = (projectName: string) => {
        const record: Omit<Achievement, 'id'> = {
          ...payload,
          projectId: payload.projectId,
          name: payload.name.trim(),
          description: payload.description.trim(),
          icon: payload.icon.trim(),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        const request = transaction.objectStore(ACHIEVEMENTS).add(record);
        request.onsuccess = () => {
          achievementId = Number(request.result);
          transaction.objectStore(HISTORY).add(makeChange(
            payload.projectId, projectName, payload.achieved ? 'achievement_unlocked' : 'achievement_created',
            payload.achieved ? `„${record.name}“ erreicht` : `„${record.name}“ erstellt`
          ));
        };
      };
      if (payload.projectId === null) { save('Achievements'); return; }
      const projectRequest = transaction.objectStore(PROJECTS).get(payload.projectId);
      projectRequest.onsuccess = () => {
        const project = projectRequest.result as ProjectRecord | undefined;
        if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
        save(project.name);
      };
    });
    return achievementId;
  },

  async updateAchievement(id: number, payload: AchievementPayload): Promise<void> {
    validateAchievementPayload(payload);
    const timestamp = now();
    await readWrite([PROJECTS, ACHIEVEMENTS, HISTORY], (transaction, fail) => {
      const achievements = transaction.objectStore(ACHIEVEMENTS);
      const achievementRequest = achievements.get(id);
      achievementRequest.onsuccess = () => {
        const before = achievementRequest.result as Achievement | undefined;
        if (!before) { fail(new Error('Achievement nicht gefunden.')); return; }
        const save = (projectName: string) => {
          const after: Achievement = {
            ...before,
            ...payload,
            name: payload.name.trim(),
            description: payload.description.trim(),
            icon: payload.icon.trim(),
            updatedAt: timestamp
          };
          const changes = difference(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, ['name', 'description', 'rarity', 'achieved', 'achievedAt', 'icon', 'projectId']);
          if (!Object.keys(changes).length) return;
          achievements.put(after);
          let action: HistoryDraft['action'] = 'achievement_updated';
          let summary = `„${after.name}“ angepasst`;
          if (!before.achieved && after.achieved) { action = 'achievement_unlocked'; summary = `„${after.name}“ erreicht`; }
          else if (before.projectId !== after.projectId) {
            action = after.projectId === null ? 'achievement_unlinked' : 'achievement_linked';
            summary = after.projectId === null ? `„${after.name}“ von einem Projekt gelöst` : `„${after.name}“ mit Projekt verknüpft`;
          }
          transaction.objectStore(HISTORY).add(makeChange(after.projectId ?? before.projectId, projectName, action, summary, null, null, changes));
        };
        if (payload.projectId === null) {
          const existingProjectId = before.projectId;
          if (existingProjectId === null) { save('Achievements'); return; }
          const oldProjectRequest = transaction.objectStore(PROJECTS).get(existingProjectId);
          oldProjectRequest.onsuccess = () => save((oldProjectRequest.result as ProjectRecord | undefined)?.name ?? 'Achievements');
          return;
        }
        const projectRequest = transaction.objectStore(PROJECTS).get(payload.projectId);
        projectRequest.onsuccess = () => {
          const project = projectRequest.result as ProjectRecord | undefined;
          if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
          save(project.name);
        };
      };
    });
  },

  async deleteAchievement(id: number): Promise<void> {
    await readWrite([PROJECTS, ACHIEVEMENTS, HISTORY], (transaction, fail) => {
      const store = transaction.objectStore(ACHIEVEMENTS);
      const request = store.get(id);
      request.onsuccess = () => {
        const achievement = request.result as Achievement | undefined;
        if (!achievement) { fail(new Error('Achievement nicht gefunden.')); return; }
        const remove = (projectName: string) => {
          transaction.objectStore(HISTORY).add(makeChange(achievement.projectId, projectName, 'achievement_deleted', `„${achievement.name}“ gelöscht`, null, null, { achievement: { before: achievement, after: null } }));
          store.delete(id);
        };
        if (achievement.projectId === null) { remove('Achievements'); return; }
        const projectRequest = transaction.objectStore(PROJECTS).get(achievement.projectId);
        projectRequest.onsuccess = () => remove((projectRequest.result as ProjectRecord | undefined)?.name ?? 'Achievements');
      };
    });
  },

  async createProject(payload: ProjectPayload): Promise<number> {
    const timestamp = now();
    let projectId = 0;
    await readWrite([PROJECTS, HISTORY], (transaction) => {
      const record: Omit<ProjectRecord, 'id'> = { ...payload, name: payload.name.trim(), description: payload.description.trim(), createdAt: timestamp, updatedAt: timestamp };
      const request = transaction.objectStore(PROJECTS).add(record);
      request.onsuccess = () => {
        projectId = Number(request.result);
        transaction.objectStore(HISTORY).add(makeChange(projectId, record.name, 'project_created', `„${record.name}“ erstellt`));
      };
    });
    return projectId;
  },

  async updateProject(id: number, payload: ProjectPayload): Promise<void> {
    const timestamp = now();
    await readWrite([PROJECTS, HISTORY], (transaction, fail) => {
      const projects = transaction.objectStore(PROJECTS);
      const request = projects.get(id);
      request.onsuccess = () => {
        const before = request.result as ProjectRecord | undefined;
        if (!before) { fail(new Error('Projekt nicht gefunden.')); return; }
        const after: ProjectRecord = { ...before, ...payload, name: payload.name.trim(), description: payload.description.trim(), updatedAt: timestamp };
        const changes = difference(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, ['name', 'description', 'color', 'icon', 'targetDate']);
        if (!Object.keys(changes).length) return;
        projects.put(after);
        transaction.objectStore(HISTORY).add(makeChange(id, after.name, 'project_updated', `„${after.name}“ angepasst`, null, null, changes));
      };
    });
  },

  async deleteProject(id: number): Promise<void> {
    await readWrite([PROJECTS, SUBAREAS, HISTORY, ACHIEVEMENTS], (transaction, fail) => {
      const projects = transaction.objectStore(PROJECTS);
      const projectRequest = projects.get(id);
      projectRequest.onsuccess = () => {
        const project = projectRequest.result as ProjectRecord | undefined;
        if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
        const areas = transaction.objectStore(SUBAREAS);
        const areasRequest = areas.index('projectId').getAll(id) as IDBRequest<Subarea[]>;
        areasRequest.onsuccess = () => {
          const history = transaction.objectStore(HISTORY);
          history.add(makeChange(id, project.name, 'project_deleted', `„${project.name}“ gelöscht`, null, null, { project: { before: project, after: null } }));
          for (const area of areasRequest.result) {
            history.add(makeChange(id, project.name, 'subarea_deleted', `„${area.name}“ mit Projekt gelöscht`, area.id, area.name, { subarea: { before: area, after: null } }));
            areas.delete(area.id);
          }
          const achievementStore = transaction.objectStore(ACHIEVEMENTS);
          const linkedRequest = achievementStore.index('projectId').getAll(id) as IDBRequest<Achievement[]>;
          linkedRequest.onsuccess = () => {
            for (const achievement of linkedRequest.result) {
              achievementStore.put({ ...achievement, projectId: null, updatedAt: now() });
              history.add(makeChange(null, 'Achievements', 'achievement_unlinked', `„${achievement.name}“ von „${project.name}“ gelöst`));
            }
          };
          projects.delete(id);
        };
      };
    });
  },

  async createSubarea(projectId: number, payload: SubareaPayload): Promise<void> {
    validateProgress(payload.progress);
    validateWeight(payload.weight);
    const timestamp = now();
    await readWrite([PROJECTS, SUBAREAS, HISTORY], (transaction, fail) => {
      const projectRequest = transaction.objectStore(PROJECTS).get(projectId);
      projectRequest.onsuccess = () => {
        const project = projectRequest.result as ProjectRecord | undefined;
        if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
        const record: Omit<Subarea, 'id'> = {
          projectId, name: payload.name.trim(), description: payload.description.trim(),
          progress: payload.progress, weight: payload.weight, createdAt: timestamp, updatedAt: timestamp
        };
        const request = transaction.objectStore(SUBAREAS).add(record);
        request.onsuccess = () => {
          const id = Number(request.result);
          transaction.objectStore(HISTORY).add(makeChange(projectId, project.name, 'subarea_created', `„${record.name}“ hinzugefügt`, id, record.name));
        };
      };
    });
  },

  async updateSubarea(id: number, payload: Partial<SubareaPayload>): Promise<void> {
    if (payload.progress !== undefined) validateProgress(payload.progress);
    if (payload.weight !== undefined) validateWeight(payload.weight);
    const timestamp = now();
    await readWrite([PROJECTS, SUBAREAS, HISTORY], (transaction, fail) => {
      const areas = transaction.objectStore(SUBAREAS);
      const areaRequest = areas.get(id);
      areaRequest.onsuccess = () => {
        const before = areaRequest.result as Subarea | undefined;
        if (!before) { fail(new Error('Teilbereich nicht gefunden.')); return; }
        const projectRequest = transaction.objectStore(PROJECTS).get(before.projectId);
        projectRequest.onsuccess = () => {
          const project = projectRequest.result as ProjectRecord | undefined;
          if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
          const after: Subarea = { ...before, ...payload, name: payload.name?.trim() ?? before.name, description: payload.description ?? before.description, updatedAt: timestamp };
          const changes = difference(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, ['name', 'description', 'progress', 'weight']);
          if (!Object.keys(changes).length) return;
          areas.put(after);
          const progressChanged = Object.prototype.hasOwnProperty.call(changes, 'progress');
          const action: HistoryDraft['action'] = progressChanged ? 'progress_changed' : 'subarea_updated';
          const summary = progressChanged
            ? `„${after.name}“: ${before.progress} % → ${after.progress} %`
            : `„${after.name}“ angepasst`;
          transaction.objectStore(HISTORY).add(makeChange(project.id, project.name, action, summary, id, after.name, changes));
        };
      };
    });
  },

  async deleteSubarea(id: number): Promise<void> {
    await readWrite([PROJECTS, SUBAREAS, HISTORY], (transaction, fail) => {
      const areas = transaction.objectStore(SUBAREAS);
      const areaRequest = areas.get(id);
      areaRequest.onsuccess = () => {
        const area = areaRequest.result as Subarea | undefined;
        if (!area) { fail(new Error('Teilbereich nicht gefunden.')); return; }
        const projectRequest = transaction.objectStore(PROJECTS).get(area.projectId);
        projectRequest.onsuccess = () => {
          const project = projectRequest.result as ProjectRecord | undefined;
          if (!project) { fail(new Error('Projekt nicht gefunden.')); return; }
          transaction.objectStore(HISTORY).add(makeChange(project.id, project.name, 'subarea_deleted', `„${area.name}“ gelöscht`, area.id, area.name, { subarea: { before: area, after: null } }));
          areas.delete(id);
        };
      };
    });
  },

  async exportBackup(): Promise<BackupFile> {
    const records = await readAllStores();
    return { format: BACKUP_FORMAT, version: 3, exportedAt: now(), ...records };
  },

  async importBackup(backup: RestorableBackup): Promise<{ projects: number; subareas: number; achievements: number }> {
    await readWrite([PROJECTS, SUBAREAS, HISTORY, ACHIEVEMENTS], (transaction) => {
      const projects = transaction.objectStore(PROJECTS);
      const subareas = transaction.objectStore(SUBAREAS);
      const history = transaction.objectStore(HISTORY);
      const achievements = transaction.objectStore(ACHIEVEMENTS);
      projects.clear();
      subareas.clear();
      history.clear();
      achievements.clear();
      for (const project of backup.projects) projects.put(project);
      for (const area of backup.subareas) subareas.put(area);
      for (const entry of backup.history) history.put(entry);
      for (const achievement of backup.achievements) achievements.put(achievement);
      history.add(makeChange(null, 'Progress Planner', 'backup_restored', `Sicherung wiederhergestellt: ${backup.projects.length} Projekte, ${backup.subareas.length} Teilbereiche und ${backup.achievements.length} Achievements`));
    });
    return { projects: backup.projects.length, subareas: backup.subareas.length, achievements: backup.achievements.length };
  }
};
