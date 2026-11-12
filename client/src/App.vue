<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ArrowLeft, ArrowRight, Award, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Download, Dumbbell, FolderKanban, HeartPulse, LayoutDashboard,
  Plus, Search, Settings2, Sparkles, Target, Trash2, Trophy, Upload, X, Plane
} from 'lucide-vue-next';
import { dataStore, initializeStorage, validateBackup } from './storage';
import type { Achievement, AchievementPayload, AchievementRarity, Project, ProjectDifficulty, ProjectPayload, Subarea, SubareaPayload } from './types';
import AchievementCard from './components/AchievementCard.vue';
import ProjectCard from './components/ProjectCard.vue';
import ProgressRing from './components/ProgressRing.vue';
import SubareaRow from './components/SubareaRow.vue';

type ModalMode = 'project' | 'subarea' | 'achievement' | 'completion' | 'link-achievement' | null;
const projects = ref<Project[]>([]);
const achievements = ref<Achievement[]>([]);
const selectedProjectId = ref<number | null>(null);
const view = ref<'overview' | 'projects' | 'achievements'>('overview');
const isLoading = ref(true);
const storageError = ref('');
const toastMessage = ref('');
const search = ref('');
const showCompletedProjects = ref(false);
const modalMode = ref<ModalMode>(null);
const projectEditId = ref<number | null>(null);
const subareaEditId = ref<number | null>(null);
const achievementEditId = ref<number | null>(null);
const completionProjectId = ref<number | null>(null);
const linkAchievementId = ref<number | null>(null);
const linkMarkAchieved = ref(false);
const achievementFilter = ref<'all' | AchievementRarity>('all');
const savingIds = ref<Set<number>>(new Set());
const progressWrites = new Map<number, number>();
const backupInput = ref<HTMLInputElement | null>(null);
const projectForm = reactive<ProjectPayload>({ name: '', description: '', color: '#9a8cff', icon: 'sparkles', difficulty: 'medium', targetDate: null });
const areaForm = reactive<SubareaPayload>({ name: '', description: '', progress: 0, weight: 1 });
const achievementForm = reactive<AchievementPayload>({ name: '', description: '', rarity: 'bronze', achieved: false, achievedAt: null, icon: '🏆', projectId: null });

const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value) ?? null);
const selectedProjectColor = computed(() => selectedProject.value?.color ?? '#9a8cff');
const projectNames = computed(() => new Map(projects.value.map((project) => [project.id, project.name])));
const achievedAchievements = computed(() => achievements.value.filter((achievement) => achievement.achieved));
const achievedByRarity = computed(() => Object.fromEntries(rarityOptions.map((option) => [option.id, achievedAchievements.value.filter((achievement) => achievement.rarity === option.id).length])) as Record<AchievementRarity, number>);
const visibleAchievements = computed(() => achievements.value.filter((achievement) => achievementFilter.value === 'all' || achievement.rarity === achievementFilter.value).sort((a, b) => Number(b.achieved) - Number(a.achieved) || (b.achievedAt ?? '').localeCompare(a.achievedAt ?? '') || a.name.localeCompare(b.name, 'de')));
const overviewProjects = computed(() => [...projects.value].sort((a, b) => {
  const statusOrder = (project: Project) => project.progress >= 100 ? 2 : project.progress === 0 ? 1 : 0;
  const aStatus = statusOrder(a);
  const bStatus = statusOrder(b);
  if (aStatus !== bStatus) return aStatus - bStatus;
  if (aStatus === 0 && a.progress !== b.progress) return b.progress - a.progress;
  return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'de');
}));
const activeProjects = computed(() => projects.value.filter((project) => project.progress < 100));
const completedProjects = computed(() => projects.value.filter((project) => project.progress >= 100).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const filterProjects = (items: Project[]) => {
  const query = search.value.trim().toLocaleLowerCase('de');
  if (!query) return items;
  return items.filter((project) => `${project.name} ${project.description}`.toLocaleLowerCase('de').includes(query));
};
const visibleProjects = computed(() => filterProjects(activeProjects.value));
const visibleCompletedProjects = computed(() => filterProjects(completedProjects.value));
const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const colorOptions = ['#9a8cff', '#79c7b3', '#f0a46d', '#e77e9b', '#78a8ef', '#d6bd72'];
const iconOptions = [
  { id: 'sparkles', label: 'Stern', icon: Sparkles }, { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'book', label: 'Buch', icon: BookOpen }, { id: 'work', label: 'Arbeit', icon: BriefcaseBusiness },
  { id: 'health', label: 'Gesundheit', icon: HeartPulse }, { id: 'travel', label: 'Reisen', icon: Plane }
];
const rarityOptions: Array<{ id: AchievementRarity; label: string }> = [
  { id: 'bronze', label: 'Bronze' }, { id: 'silver', label: 'Silber' }, { id: 'gold', label: 'Gold' },
  { id: 'ruby', label: 'Rubin' }, { id: 'diamond', label: 'Diamant' }
];
const difficultyOptions: Array<{ id: ProjectDifficulty; label: string }> = [
  { id: 'very-easy', label: 'Sehr leicht' }, { id: 'easy', label: 'Leicht' }, { id: 'medium', label: 'Mittel' },
  { id: 'hard', label: 'Schwer' }, { id: 'very-hard', label: 'Sehr schwer' }
];
const difficultyLabels = Object.fromEntries(difficultyOptions.map((option) => [option.id, option.label])) as Record<ProjectDifficulty, string>;
const selectedProjectIcon = computed(() => {
  const project = selectedProject.value;
  return iconOptions.find((option) => option.id === project?.icon)?.icon ?? Sparkles;
});

async function loadProjects() {
  isLoading.value = true;
  storageError.value = '';
  try {
    projects.value = await dataStore.projects();
    achievements.value = await dataStore.achievements();
    if (selectedProjectId.value && !projects.value.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = null;
    }
  } catch (error) {
    storageError.value = error instanceof Error ? error.message : 'Der lokale Datenspeicher konnte nicht geöffnet werden.';
  } finally {
    isLoading.value = false;
  }
}

async function openProject(project: Project) {
  selectedProjectId.value = project.id;
  view.value = 'projects';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goTo(viewName: 'overview' | 'projects' | 'achievements') {
  selectedProjectId.value = null;
  view.value = viewName;
}

function resetProjectForm(project?: Project) {
  projectForm.name = project?.name ?? '';
  projectForm.description = project?.description ?? '';
  projectForm.color = project?.color ?? '#9a8cff';
  projectForm.icon = project?.icon ?? 'sparkles';
  projectForm.difficulty = project?.difficulty ?? 'medium';
  projectForm.targetDate = project?.targetDate ?? null;
  projectEditId.value = project?.id ?? null;
  modalMode.value = 'project';
}

function resetAreaForm(area?: Subarea) {
  areaForm.name = area?.name ?? '';
  areaForm.description = area?.description ?? '';
  areaForm.progress = area?.progress ?? 0;
  areaForm.weight = area?.weight ?? 1;
  subareaEditId.value = area?.id ?? null;
  modalMode.value = 'subarea';
}

function localDateToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function resetAchievementForm(achievement?: Achievement, projectId: number | null = null) {
  achievementForm.name = achievement?.name ?? '';
  achievementForm.description = achievement?.description ?? '';
  achievementForm.rarity = achievement?.rarity ?? 'bronze';
  achievementForm.achieved = achievement?.achieved ?? false;
  achievementForm.achievedAt = achievement?.achievedAt ?? null;
  achievementForm.icon = achievement?.icon ?? '🏆';
  achievementForm.projectId = achievement?.projectId ?? projectId;
  achievementEditId.value = achievement?.id ?? null;
  modalMode.value = 'achievement';
}

function closeModal() {
  modalMode.value = null;
  completionProjectId.value = null;
}

async function saveProject() {
  const editing = projectEditId.value !== null;
  try {
    if (projectEditId.value !== null) await dataStore.updateProject(projectEditId.value, { ...projectForm });
    else {
      selectedProjectId.value = await dataStore.createProject({ ...projectForm });
      view.value = 'projects';
    }
    closeModal();
    await loadProjects();
    showToast(editing ? 'Projekt aktualisiert' : 'Projekt erstellt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Projekt konnte nicht gespeichert werden.'); }
}

async function saveSubarea() {
  if (!selectedProject.value) return;
  const editing = subareaEditId.value !== null;
  try {
    if (subareaEditId.value !== null) await dataStore.updateSubarea(subareaEditId.value, { ...areaForm });
    else await dataStore.createSubarea(selectedProject.value.id, { ...areaForm });
    closeModal();
    await loadProjects();
    showToast(editing ? 'Bereich aktualisiert' : 'Bereich hinzugefügt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Bereich konnte nicht gespeichert werden.'); }
}

async function saveAchievement() {
  const editing = achievementEditId.value !== null;
  try {
    const payload = { ...achievementForm, name: achievementForm.name.trim(), achievedAt: achievementForm.achieved ? (achievementForm.achievedAt || localDateToday()) : null };
    if (achievementEditId.value !== null) await dataStore.updateAchievement(achievementEditId.value, payload);
    else await dataStore.createAchievement(payload);
    modalMode.value = null;
    completionProjectId.value = null;
    await loadProjects();
    showToast(editing ? 'Achievement aktualisiert' : 'Achievement erstellt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Achievement konnte nicht gespeichert werden.'); }
}

async function toggleAchievement(achievement: Achievement, achieved: boolean) {
  try {
    await dataStore.updateAchievement(achievement.id, {
      name: achievement.name, description: achievement.description, rarity: achievement.rarity,
      achieved, achievedAt: achieved ? localDateToday() : null, icon: achievement.icon, projectId: achievement.projectId
    });
    await loadProjects();
    showToast(achieved ? 'Achievement freigeschaltet' : 'Achievement zurückgesetzt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Achievement konnte nicht aktualisiert werden.'); }
}

async function removeAchievement(achievement: Achievement) {
  if (!window.confirm(`„${achievement.name}“ wirklich löschen?`)) return;
  try {
    await dataStore.deleteAchievement(achievement.id);
    await loadProjects();
    showToast('Achievement gelöscht');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Achievement konnte nicht gelöscht werden.'); }
}

function promptForProjectAchievement(projectId: number) {
  completionProjectId.value = projectId;
  modalMode.value = 'completion';
}

function createAchievementForProject(projectId: number | null = completionProjectId.value) {
  resetAchievementForm(undefined, projectId);
}

function openAchievementLink(projectId: number | null = completionProjectId.value) {
  if (projectId === null) return;
  completionProjectId.value = projectId;
  linkAchievementId.value = null;
  linkMarkAchieved.value = false;
  modalMode.value = 'link-achievement';
}

async function linkExistingAchievement() {
  const projectId = completionProjectId.value;
  const achievement = achievements.value.find((item) => item.id === linkAchievementId.value);
  if (projectId === null || !achievement) { showToast('Bitte wähle ein Achievement aus.'); return; }
  try {
    const markAchieved = linkMarkAchieved.value && !achievement.achieved;
    await dataStore.updateAchievement(achievement.id, {
      name: achievement.name, description: achievement.description, rarity: achievement.rarity,
      achieved: achievement.achieved || markAchieved,
      achievedAt: achievement.achievedAt ?? (markAchieved ? localDateToday() : null),
      icon: achievement.icon, projectId
    });
    modalMode.value = null;
    completionProjectId.value = null;
    await loadProjects();
    showToast('Achievement mit Projekt verknüpft');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Achievement konnte nicht verknüpft werden.'); }
}

async function removeProject(project: Project) {
  if (!window.confirm(`„${project.name}“ und alle zugehörigen Bereiche löschen?`)) return;
  try {
    await dataStore.deleteProject(project.id);
    if (selectedProjectId.value === project.id) {
      selectedProjectId.value = null;
    }
    await loadProjects();
    showToast('Projekt gelöscht');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Projekt konnte nicht gelöscht werden.'); }
}

async function removeArea(area: Subarea) {
  if (!window.confirm(`„${area.name}“ löschen?`)) return;
  try {
    await dataStore.deleteSubarea(area.id);
    await loadProjects();
    showToast('Bereich gelöscht');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Bereich konnte nicht gelöscht werden.'); }
}

function updateLocalProgress(areaId: number, progress: number) {
  const previousProject = projects.value.find((project) => project.subareas.some((area) => area.id === areaId));
  const previousProgress = previousProject?.progress ?? 0;
  projects.value = projects.value.map((project) => {
    const subareas = project.subareas.map((area) => area.id === areaId ? { ...area, progress } : area);
    if (!subareas.some((area) => area.id === areaId)) return project;
    const weight = subareas.reduce((sum, area) => sum + area.weight, 0);
    return { ...project, subareas, progress: weight ? Math.round(subareas.reduce((sum, area) => sum + area.progress * area.weight, 0) / weight) : 0, completedCount: subareas.filter((area) => area.progress === 100).length };
  });
  const updatedProject = previousProject ? projects.value.find((project) => project.id === previousProject.id) : undefined;
  const reachedCompletion = Boolean(updatedProject && previousProgress < 100 && updatedProject.progress === 100);

  progressWrites.set(areaId, (progressWrites.get(areaId) ?? 0) + 1);
  savingIds.value = new Set([...savingIds.value, areaId]);
  void dataStore.updateSubarea(areaId, { progress }).then(async () => {
    if (reachedCompletion && updatedProject) promptForProjectAchievement(updatedProject.id);
  }).catch(async (error: unknown) => {
    await loadProjects();
    showToast(error instanceof Error ? error.message : 'Fortschritt konnte nicht gespeichert werden.');
  }).finally(() => {
    const pending = (progressWrites.get(areaId) ?? 1) - 1;
    if (pending > 0) progressWrites.set(areaId, pending);
    else {
      progressWrites.delete(areaId);
      savingIds.value = new Set([...savingIds.value].filter((id) => id !== areaId));
    }
  });
}

async function exportBackup() {
  try {
    const backup = await dataStore.exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    const file = new File([JSON.stringify(backup, null, 2)], `progress-planner-${date}.json`, { type: 'application/json' });
    const share = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title: string }) => Promise<void>;
    };
    if (share.share && share.canShare?.({ files: [file] })) {
      await share.share({ files: [file], title: 'Progress Planner Sicherung' });
    } else {
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    showToast('JSON-Sicherung erstellt');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    showToast(error instanceof Error ? error.message : 'Sicherung konnte nicht erstellt werden.');
  }
}

function chooseBackup() { backupInput.value?.click(); }

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const backup = validateBackup(JSON.parse(await file.text()) as unknown);
    const shouldReplace = window.confirm(
      `Diese Sicherung enthält ${backup.projects.length} Projekte, ${backup.subareas.length} Teilbereiche und ${backup.achievements.length} Achievements.\n\nSie ersetzt alle aktuell auf diesem iPhone gespeicherten Daten. Fortfahren?`
    );
    if (!shouldReplace) return;
    const counts = await dataStore.importBackup(backup);
    selectedProjectId.value = null;
    search.value = '';
    showCompletedProjects.value = false;
    view.value = 'overview';
    await loadProjects();
    showToast(`${counts.projects} Projekte und ${counts.achievements} Achievements wiederhergestellt`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Datei konnte nicht importiert werden.');
  } finally {
    input.value = '';
  }
}

let toastTimer = 0;
function showToast(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastMessage.value = ''; }, 2600);
}

function dateLabel(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

onMounted(async () => {
  try { await initializeStorage(); }
  catch { /* loadProjects displays the local-storage error in the page */ }
  await loadProjects();
});
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="goTo('overview')">
        <span class="brand-mark"><Sparkles :size="19" /></span>
        <span>progress<span class="brand-light">planner</span></span>
      </a>

      <div class="workspace-select">
        <span class="workspace-avatar">M</span>
        <span class="workspace-copy"><strong>Mein Workspace</strong><small>Persönlich</small></span>
        <ChevronDown :size="15" class="workspace-chevron" />
      </div>

      <span class="nav-label">MENÜ</span>
      <nav class="side-nav" aria-label="Hauptnavigation">
        <button :class="{ active: view === 'overview' && !selectedProject }" @click="goTo('overview')"><LayoutDashboard :size="17" /><span>Übersicht</span></button>
        <button :class="{ active: view === 'projects' }" @click="goTo('projects')"><FolderKanban :size="17" /><span>Projekte</span><span class="nav-count">{{ projects.length }}</span></button>
        <button :class="{ active: view === 'achievements' }" @click="goTo('achievements')"><Trophy :size="17" /><span>Achievements</span><span class="nav-count">{{ achievedAchievements.length }}</span></button>
      </nav>

      <div class="sidebar-projects">
        <div class="sidebar-section-head"><span class="nav-label">DEINE PROJEKTE</span><button v-if="view === 'projects'" class="tiny-icon" aria-label="Projekt erstellen" @click="resetProjectForm()"><Plus :size="15" /></button></div>
        <button v-for="project in projects.slice(0, 5)" :key="project.id" class="sidebar-project" :class="{ selected: selectedProjectId === project.id }" @click="openProject(project)">
          <i :style="{ backgroundColor: project.color }"></i><span>{{ project.name }}</span><small>{{ project.progress }}%</small>
        </button>
        <p v-if="projects.length === 0" class="sidebar-empty">Hier erscheinen deine Projekte.</p>
      </div>

      <div class="sidebar-bottom">
        <div class="sidebar-tip"><span><Target :size="15" /></span><div><strong>Kleine Schritte zählen.</strong><small>Bleib in deinem Tempo dran.</small></div></div>
        <button class="side-bottom-link"><CircleHelp :size="16" /><span>Hilfe &amp; Feedback</span></button>
        <div class="profile-row"><span class="profile-avatar">D</span><span><strong>Dein Profil</strong><small>Persönlicher Bereich</small></span><button class="tiny-icon" aria-label="Einstellungen"><Settings2 :size="16" /></button></div>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="mobile-brand"><span class="brand-mark"><Sparkles :size="17" /></span><b>progress<span>planner</span></b></div>
        <div class="breadcrumbs"><span>Mein Workspace</span><ArrowRight :size="13" /><strong>{{ selectedProject?.name ?? (view === 'projects' ? 'Projekte' : view === 'achievements' ? 'Achievements' : 'Übersicht') }}</strong></div>
        <div class="topbar-right">
          <span class="today-label"><CalendarDays :size="15" />{{ today }}</span>
          <button class="icon-button data-action" aria-label="Alle Daten als JSON sichern" title="JSON-Sicherung exportieren" @click="exportBackup"><Download :size="16" /></button>
          <button class="icon-button data-action" aria-label="JSON-Sicherung importieren" title="JSON-Sicherung importieren" @click="chooseBackup"><Upload :size="16" /></button>
          <input ref="backupInput" class="visually-hidden-input" type="file" accept="application/json,.json" aria-label="JSON-Sicherungsdatei auswählen" @change="importBackup" />
          <span class="topbar-avatar">D</span>
        </div>
      </header>

      <div class="page-content">
        <div v-if="storageError" class="connection-banner"><span><CircleHelp :size="18" /></span><div><strong>Lokaler Speicher nicht verfügbar</strong><p>{{ storageError }}</p></div><button class="button button-quiet" @click="loadProjects">Erneut versuchen</button></div>

        <template v-if="selectedProject">
          <div class="detail-back-row"><button class="back-button" @click="goTo('projects')"><ArrowLeft :size="16" /> Alle Projekte</button><span class="detail-created"><Clock3 :size="14" /> Erstellt am {{ dateLabel(selectedProject.createdAt) }}</span></div>
          <section class="detail-heading">
            <div class="detail-title-side"><div class="detail-project-icon" :style="{ backgroundColor: `${selectedProjectColor}18`, color: selectedProjectColor }"><component :is="selectedProjectIcon" :size="26" /></div><div><div class="eyebrow">PROJEKTÜBERSICHT</div><h1>{{ selectedProject.name }}</h1><p>{{ selectedProject.description || 'Ein Schritt nach dem anderen.' }}</p><div class="detail-project-meta"><span class="project-difficulty-badge" :class="`difficulty-${selectedProject.difficulty}`">{{ difficultyLabels[selectedProject.difficulty] }}</span><span v-if="selectedProject.targetDate" class="detail-target-date"><CalendarDays :size="13" /> Zieldatum {{ dateLabel(selectedProject.targetDate) }}</span></div></div></div>
            <div class="detail-actions"><button class="button button-quiet" @click="resetProjectForm(selectedProject)"><Settings2 :size="15" /> Bearbeiten</button><button class="icon-button danger-icon" aria-label="Projekt löschen" @click="removeProject(selectedProject)"><Trash2 :size="16" /></button></div>
          </section>

          <section class="detail-summary-grid">
            <div class="detail-stat-card featured-stat"><span class="detail-stat-label">GESAMTFORTSCHRITT</span><div class="featured-stat-body"><ProgressRing :value="selectedProject.progress" :color="selectedProject.color" :size="58" :stroke="5" /><p>Dein Projekt kommt<br /><strong>{{ selectedProject.progress >= 75 ? 'richtig gut voran.' : 'Schritt für Schritt voran.' }}</strong></p></div></div>
          </section>

          <section v-if="selectedProject.progress === 100" class="project-achievement-prompt">
            <span class="project-achievement-icon"><Trophy :size="18" /></span>
            <div><strong>Projekt abgeschlossen</strong><p>Wenn du möchtest, kannst du jetzt ein Achievement erstellen oder verknüpfen.</p></div>
            <div class="project-achievement-actions"><button class="button button-quiet" @click="createAchievementForProject(selectedProject.id)"><Plus :size="14" /> Erstellen</button><button class="button button-quiet" @click="openAchievementLink(selectedProject.id)"><Award :size="14" /> Verknüpfen</button></div>
          </section>

          <section class="areas-section">
            <div class="section-heading"><div><div class="eyebrow">DEIN WEG ZUM ZIEL</div><h2>Teilbereiche</h2><p>Jeder Fortschritt zählt. Passe einzelne Bereiche in deinem Tempo an.</p></div><button class="button button-primary" @click="resetAreaForm()"><Plus :size="16" /> Bereich hinzufügen</button></div>
            <div v-if="selectedProject.subareas.length" class="areas-list"><SubareaRow v-for="area in selectedProject.subareas" :key="area.id" :area="area" :color="selectedProject.color" :saving="savingIds.has(area.id)" @progress="updateLocalProgress(area.id, $event)" @edit="resetAreaForm(area)" @delete="removeArea(area)" /></div>
            <div v-else class="empty-areas"><div class="empty-illustration"><Target :size="23" /></div><h3>Der Anfang ist gemacht.</h3><p>Teile dein Projekt in kleine, erreichbare Bereiche auf.</p><button class="button button-quiet" @click="resetAreaForm()"><Plus :size="15" /> Ersten Bereich hinzufügen</button></div>
          </section>

        </template>

        <template v-else-if="view === 'achievements'">
          <section class="welcome-header achievement-welcome">
            <div><span class="eyebrow">DEINE PERSÖNLICHE SAMMLUNG</span><h1>Achievements</h1><p>Halte fest, was dir wichtig ist. Seltenheit und Status bestimmst du selbst.</p></div>
            <button class="button button-primary create-button" @click="resetAchievementForm()"><Plus :size="17" /> Neues Achievement</button>
          </section>

          <section class="achievement-overview">
            <div class="achievement-total-card"><span class="achievement-total-icon rarity-gold"><Trophy :size="19" /></span><div><small>ERREICHTE ACHIEVEMENTS</small><strong>{{ achievedAchievements.length }}<span> / {{ achievements.length }}</span></strong></div></div>
            <div class="rarity-counts"><div v-for="rarity in rarityOptions" :key="rarity.id" class="rarity-count" :class="`rarity-${rarity.id}`"><i></i><span>{{ rarity.label }}</span><strong>{{ achievedByRarity[rarity.id] }}</strong></div></div>
          </section>

          <section class="achievements-section">
            <div class="section-heading achievements-heading"><div><div class="eyebrow">DEINE ERFOLGE</div><h2>Sammlung <span>{{ visibleAchievements.length }}</span></h2><p>Unabhängig von Projekten oder mit einem Projekt verbunden.</p></div><div class="achievement-filters" role="group" aria-label="Nach Seltenheit filtern"><button :class="{ selected: achievementFilter === 'all' }" @click="achievementFilter = 'all'">Alle</button><button v-for="rarity in rarityOptions" :key="rarity.id" :class="[`rarity-${rarity.id}`, { selected: achievementFilter === rarity.id }]" @click="achievementFilter = rarity.id">{{ rarity.label }}</button></div></div>
            <div v-if="visibleAchievements.length" class="achievements-grid"><AchievementCard v-for="achievement in visibleAchievements" :key="achievement.id" :achievement="achievement" :project-name="achievement.projectId ? projectNames.get(achievement.projectId) : undefined" @edit="resetAchievementForm(achievement)" @delete="removeAchievement(achievement)" @toggle="toggleAchievement(achievement, $event)" /></div>
            <div v-else class="empty-achievements"><div class="empty-illustration"><Trophy :size="23" /></div><h3>{{ achievements.length ? 'Keine Achievements in dieser Stufe.' : 'Deine Sammlung beginnt hier.' }}</h3><p>{{ achievements.length ? 'Wähle einen anderen Filter, um weitere Erfolge zu sehen.' : 'Erstelle eigene Meilensteine und entscheide selbst, wann du sie freischaltest.' }}</p><button v-if="!achievements.length" class="button button-primary" @click="resetAchievementForm()"><Plus :size="16" /> Erstes Achievement erstellen</button></div>
          </section>
        </template>

        <template v-else-if="view === 'overview'">
          <section class="welcome-header overview-welcome">
            <div><span class="eyebrow">FORTSCHRITT DEINER PROJEKTE</span><h1>Übersicht</h1><p>Der aktuelle Stand aller deiner Projekte auf einen Blick.</p></div>
          </section>
          <section class="projects-section overview-projects-section" aria-label="Fortschritt aller Projekte">
            <div v-if="isLoading" class="loading-grid"><div v-for="n in 3" :key="n" class="skeleton-card"></div></div>
            <div v-else-if="overviewProjects.length" class="projects-grid"><ProjectCard v-for="project in overviewProjects" :key="project.id" :project="project" layout="overview" @open="openProject(project)" /></div>
            <div v-else class="empty-projects"><div class="empty-illustration"><FolderKanban :size="23" /></div><h3>Noch keine Projekte</h3><p>Erstelle ein Projekt im Bereich „Projekte“, um hier den Fortschritt zu sehen.</p><button class="button button-quiet" @click="goTo('projects')">Zur Projektverwaltung <ArrowRight :size="15" /></button></div>
          </section>
        </template>

        <template v-else>
          <section class="welcome-header">
            <div><span class="eyebrow">DEINE ZIELE IM BLICK</span><h1>Deine Projekte</h1><p>Alles, woran du gerade arbeitest, an einem Ort.</p></div>
            <button class="button button-primary create-button" @click="resetProjectForm()"><Plus :size="17" /> Neues Projekt</button>
          </section>
          <section class="projects-section">
            <div class="section-heading projects-heading"><div><div class="eyebrow">AKTIVE ZIELE</div><h2>Deine Projekte <span>{{ activeProjects.length }}</span></h2><p>Deine offenen Ziele, übersichtlich an einem Ort.</p></div><div class="project-controls"><label class="search-box"><Search :size="16" /><input v-model="search" placeholder="Projekt suchen" aria-label="Projekt suchen" /><kbd>⌘ K</kbd></label></div></div>
            <div v-if="isLoading" class="loading-grid"><div v-for="n in 3" :key="n" class="skeleton-card"></div></div>
            <div v-else-if="visibleProjects.length" class="projects-grid"><ProjectCard v-for="project in visibleProjects" :key="project.id" :project="project" @open="openProject(project)" @edit="resetProjectForm(project)" /></div>
            <div v-else-if="projects.length === 0" class="empty-projects"><div class="empty-illustration"><FolderKanban :size="23" /></div><h3>Womit möchtest du beginnen?</h3><p>Erstelle dein erstes Projekt und mache aus einem großen Ziel kleine, machbare Schritte.</p><button class="button button-primary" @click="resetProjectForm()"><Plus :size="16" /> Erstes Projekt erstellen</button></div>
            <div v-else-if="activeProjects.length" class="empty-search"><Search :size="18" /><p>Keine offenen Projekte für „{{ search }}“ gefunden.</p><button class="text-button" @click="search = ''">Suche zurücksetzen</button></div>
            <div v-else class="empty-projects active-projects-empty"><div class="empty-illustration"><CheckCircle2 :size="23" /></div><h3>Keine offenen Projekte</h3><p>Alle Projekte sind abgeschlossen. Du findest sie unten in der separaten Übersicht.</p></div>
          </section>
          <section v-if="completedProjects.length" class="completed-projects-section">
            <button class="completed-projects-toggle button button-quiet" :aria-expanded="showCompletedProjects" @click="showCompletedProjects = !showCompletedProjects"><span>{{ showCompletedProjects ? 'Abgeschlossene Projekte ausblenden' : 'Abgeschlossene Projekte anzeigen' }} <small>{{ completedProjects.length }}</small></span><ChevronDown :size="16" :class="{ rotated: showCompletedProjects }" /></button>
            <div v-if="showCompletedProjects" class="completed-projects-content">
              <div v-if="visibleCompletedProjects.length" class="projects-grid"><ProjectCard v-for="project in visibleCompletedProjects" :key="project.id" :project="project" @open="openProject(project)" @edit="resetProjectForm(project)" /></div>
              <div v-else class="empty-search"><Search :size="18" /><p>Keine abgeschlossenen Projekte für „{{ search }}“ gefunden.</p><button class="text-button" @click="search = ''">Suche zurücksetzen</button></div>
            </div>
          </section>
        </template>
        <footer class="page-footer"><span>Mit Ruhe. Mit Absicht. In deinem Tempo.</span><span>Nur auf diesem iPhone gespeichert <i>·</i> JSON-Sicherung empfohlen</span></footer>
      </div>
      <nav class="mobile-nav" aria-label="Hauptnavigation">
        <button :class="{ active: view === 'overview' && !selectedProject }" @click="goTo('overview')"><LayoutDashboard :size="18" /><span>Übersicht</span></button>
        <button :class="{ active: view === 'projects' || Boolean(selectedProject) }" @click="goTo('projects')"><FolderKanban :size="18" /><span>Projekte</span></button>
        <button :class="{ active: view === 'achievements' }" @click="goTo('achievements')"><Trophy :size="18" /><span>Erfolge</span></button>
      </nav>
    </main>

    <div v-if="modalMode" class="modal-backdrop" @click.self="closeModal" @keydown.esc="closeModal">
      <section class="modal-card" role="dialog" aria-modal="true" :aria-labelledby="modalMode === 'project' ? 'project-modal-title' : modalMode === 'subarea' ? 'area-modal-title' : modalMode === 'achievement' ? 'achievement-modal-title' : 'project-achievement-title'">
        <div class="modal-header"><div><span class="eyebrow">{{ modalMode === 'project' ? (projectEditId ? 'PROJEKT BEARBEITEN' : 'NEUES ZIEL') : modalMode === 'subarea' ? (subareaEditId ? 'BEREICH BEARBEITEN' : 'KLEINER SCHRITT') : modalMode === 'achievement' ? (achievementEditId ? 'ACHIEVEMENT BEARBEITEN' : 'NEUER ERFOLG') : modalMode === 'completion' ? 'MEILENSTEIN ERREICHT' : 'ACHIEVEMENT VERKNÜPFEN' }}</span><h2 :id="modalMode === 'project' ? 'project-modal-title' : modalMode === 'subarea' ? 'area-modal-title' : modalMode === 'achievement' ? 'achievement-modal-title' : 'project-achievement-title'">{{ modalMode === 'project' ? (projectEditId ? 'Projekt anpassen' : 'Neues Projekt') : modalMode === 'subarea' ? (subareaEditId ? 'Bereich anpassen' : 'Teilbereich hinzufügen') : modalMode === 'achievement' ? (achievementEditId ? 'Achievement anpassen' : 'Achievement erstellen') : modalMode === 'completion' ? 'Dein Projekt ist fertig' : 'Erfolg mit Projekt verbinden' }}</h2></div><button class="icon-button" aria-label="Schließen" @click="closeModal"><X :size="19" /></button></div>
        <form v-if="modalMode === 'project'" class="modal-form" @submit.prevent="saveProject">
          <label class="form-field"><span>Projektname <b>*</b></span><input v-model="projectForm.name" required maxlength="120" placeholder="z. B. Calisthenics" autofocus /></label>
          <label class="form-field"><span>Beschreibung</span><textarea v-model="projectForm.description" rows="3" placeholder="Worum geht es bei deinem Projekt?"></textarea></label>
          <label class="form-field"><span>Schwierigkeit</span><select v-model="projectForm.difficulty" class="rarity-select"><option v-for="difficulty in difficultyOptions" :key="difficulty.id" :value="difficulty.id">{{ difficulty.label }}</option></select></label>
          <div class="form-field"><span>Symbol</span><div class="icon-picker"><button v-for="option in iconOptions" :key="option.id" type="button" :aria-label="option.label" :class="{ selected: projectForm.icon === option.id }" @click="projectForm.icon = option.id"><component :is="option.icon" :size="18" /></button></div></div>
          <div class="form-field"><span>Akzentfarbe</span><div class="color-picker"><button v-for="color in colorOptions" :key="color" type="button" :aria-label="`Farbe ${color}`" :class="{ selected: projectForm.color === color }" :style="{ backgroundColor: color }" @click="projectForm.color = color"></button></div></div>
          <label class="form-field"><span>Zieldatum <small>optional</small></span><input v-model="projectForm.targetDate" type="date" /></label>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit">{{ projectEditId ? 'Änderungen speichern' : 'Projekt erstellen' }} <ArrowRight :size="15" /></button></div>
        </form>
        <form v-else-if="modalMode === 'subarea'" class="modal-form" @submit.prevent="saveSubarea">
          <label class="form-field"><span>Name des Bereichs <b>*</b></span><input v-model="areaForm.name" required maxlength="120" placeholder="z. B. Handstand" autofocus /></label>
          <label class="form-field"><span>Beschreibung</span><textarea v-model="areaForm.description" rows="3" placeholder="Was möchtest du hier erreichen?"></textarea></label>
          <label class="form-field"><span>Fortschritt <strong class="form-value">{{ areaForm.progress }}%</strong></span><input v-model.number="areaForm.progress" class="progress-slider modal-slider" type="range" min="0" max="100" step="5" :style="{ '--slider-color': selectedProject?.color ?? '#9a8cff', '--slider-progress': `${areaForm.progress}%` }" /><span class="range-hint"><span>0%</span><span>in 5-%-Schritten</span><span>100%</span></span></label>
          <label class="form-field"><span>Gewichtung</span><input v-model.number="areaForm.weight" type="number" min="0.1" step="0.1" /><small class="field-hint">Standardmäßig zählt jeder Bereich gleich viel.</small></label>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit">{{ subareaEditId ? 'Änderungen speichern' : 'Bereich hinzufügen' }} <ArrowRight :size="15" /></button></div>
        </form>
        <form v-else-if="modalMode === 'achievement'" class="modal-form" @submit.prevent="saveAchievement">
          <label class="form-field"><span>Name <b>*</b></span><input v-model="achievementForm.name" required maxlength="120" placeholder="z. B. Erster Halbmarathon" autofocus /></label>
          <label class="form-field"><span>Beschreibung</span><textarea v-model="achievementForm.description" rows="3" maxlength="500" placeholder="Was macht diesen Erfolg für dich besonders?"></textarea></label>
          <label class="form-field"><span>Seltenheitsstufe</span><select v-model="achievementForm.rarity" class="rarity-select"><option v-for="rarity in rarityOptions" :key="rarity.id" :value="rarity.id">{{ rarity.label }}</option></select></label>
          <label class="form-field"><span>Symbol <small>optional</small></span><input v-model="achievementForm.icon" maxlength="8" placeholder="🏆" aria-label="Achievement-Symbol" /></label>
          <label class="form-field"><span>Projekt <small>optional</small></span><select v-model="achievementForm.projectId" class="rarity-select"><option :value="null">Unabhängig von Projekten</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option></select></label>
          <label class="achievement-reached-control"><input v-model="achievementForm.achieved" type="checkbox" @change="achievementForm.achievedAt = achievementForm.achieved ? (achievementForm.achievedAt || localDateToday()) : null" /><span>Dieses Achievement ist erreicht</span></label>
          <label v-if="achievementForm.achieved" class="form-field"><span>Erreichungsdatum <b>*</b></span><input v-model="achievementForm.achievedAt" type="date" required /></label>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit">{{ achievementEditId ? 'Änderungen speichern' : 'Achievement erstellen' }} <ArrowRight :size="15" /></button></div>
        </form>
        <div v-else-if="modalMode === 'completion'" class="completion-modal-copy"><div class="completion-modal-icon"><Trophy :size="24" /></div><p>Du hast <strong>{{ projects.find((project) => project.id === completionProjectId)?.name }}</strong> abgeschlossen. Möchtest du diesen Erfolg in deiner Sammlung festhalten?</p><div class="completion-actions"><button class="button button-primary" @click="createAchievementForProject()"><Plus :size="15" /> Achievement erstellen</button><button class="button button-quiet" :disabled="!achievements.length" @click="openAchievementLink()"><Award :size="15" /> Vorhandenes verknüpfen</button><button class="text-button" @click="closeModal">Vielleicht später</button></div></div>
        <form v-else class="modal-form" @submit.prevent="linkExistingAchievement">
          <label class="form-field"><span>Achievement auswählen <b>*</b></span><select v-model.number="linkAchievementId" class="rarity-select" required><option :value="null" disabled>Bitte auswählen</option><option v-for="achievement in achievements" :key="achievement.id" :value="achievement.id">{{ achievement.name }} · {{ rarityOptions.find((rarity) => rarity.id === achievement.rarity)?.label }}{{ achievement.projectId ? ` · ${projectNames.get(achievement.projectId) ?? 'Projekt'}` : '' }}</option></select></label>
          <label v-if="linkAchievementId && !achievements.find((achievement) => achievement.id === linkAchievementId)?.achieved" class="achievement-reached-control"><input v-model="linkMarkAchieved" type="checkbox" /><span>Bei dieser Zuordnung auch als erreicht markieren</span></label>
          <p class="field-hint">Die bisherige Seltenheit und der Status bleiben erhalten, sofern du den Erfolg nicht ausdrücklich als erreicht markierst.</p>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit" :disabled="!linkAchievementId">Verknüpfen <ArrowRight :size="15" /></button></div>
        </form>
      </section>
    </div>

    <Transition name="toast"><div v-if="toastMessage" class="toast-message" role="status"><CheckCircle2 :size="16" />{{ toastMessage }}</div></Transition>
  </div>
</template>
