<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Dumbbell, FolderKanban, HeartPulse, LayoutDashboard,
  LogOut, Plus, Search, Settings2, Sparkles, Target, Trash2, X, Plane
} from 'lucide-vue-next';
import { api } from './api';
import type { Project, ProjectPayload, Subarea, SubareaPayload } from './types';
import ProjectCard from './components/ProjectCard.vue';
import ProgressChart from './components/ProgressChart.vue';
import ProgressRing from './components/ProgressRing.vue';
import SubareaRow from './components/SubareaRow.vue';

type ModalMode = 'project' | 'subarea' | null;
const projects = ref<Project[]>([]);
const selectedProjectId = ref<number | null>(null);
const view = ref<'overview' | 'projects'>('overview');
const isLoading = ref(true);
const apiError = ref('');
const toastMessage = ref('');
const search = ref('');
const modalMode = ref<ModalMode>(null);
const projectEditId = ref<number | null>(null);
const subareaEditId = ref<number | null>(null);
const savingIds = ref<Set<number>>(new Set());
const saveTimers = new Map<number, number>();
const projectForm = reactive<ProjectPayload>({ name: '', description: '', color: '#9a8cff', icon: 'sparkles', targetDate: null });
const areaForm = reactive<SubareaPayload>({ name: '', description: '', progress: 0, weight: 1 });

const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value) ?? null);
const allAreas = computed(() => projects.value.flatMap((project) => project.subareas));
const completedAreas = computed(() => allAreas.value.filter((area) => area.progress === 100).length);
const overallProgress = computed(() => {
  const weight = allAreas.value.reduce((sum, area) => sum + area.weight, 0);
  return weight ? Math.round(allAreas.value.reduce((sum, area) => sum + area.progress * area.weight, 0) / weight) : 0;
});
const visibleProjects = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('de');
  if (!query) return projects.value;
  return projects.value.filter((project) => `${project.name} ${project.description}`.toLocaleLowerCase('de').includes(query));
});
const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const colorOptions = ['#9a8cff', '#79c7b3', '#f0a46d', '#e77e9b', '#78a8ef', '#d6bd72'];
const iconOptions = [
  { id: 'sparkles', label: 'Stern', icon: Sparkles }, { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  { id: 'book', label: 'Buch', icon: BookOpen }, { id: 'work', label: 'Arbeit', icon: BriefcaseBusiness },
  { id: 'health', label: 'Gesundheit', icon: HeartPulse }, { id: 'travel', label: 'Reisen', icon: Plane }
];

async function loadProjects() {
  isLoading.value = true;
  apiError.value = '';
  try {
    projects.value = await api.projects();
    if (selectedProjectId.value && !projects.value.some((project) => project.id === selectedProjectId.value)) selectedProjectId.value = null;
  } catch (error) {
    apiError.value = error instanceof Error ? error.message : 'Die Verbindung zum Server ist fehlgeschlagen.';
  } finally {
    isLoading.value = false;
  }
}

function openProject(project: Project) {
  selectedProjectId.value = project.id;
  view.value = 'projects';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goTo(viewName: 'overview' | 'projects') {
  selectedProjectId.value = null;
  view.value = viewName;
}

function resetProjectForm(project?: Project) {
  projectForm.name = project?.name ?? '';
  projectForm.description = project?.description ?? '';
  projectForm.color = project?.color ?? '#9a8cff';
  projectForm.icon = project?.icon ?? 'sparkles';
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

function closeModal() { modalMode.value = null; }

async function saveProject() {
  try {
    if (projectEditId.value) await api.updateProject(projectEditId.value, { ...projectForm });
    else {
      const created = await api.createProject({ ...projectForm });
      selectedProjectId.value = created.id;
      view.value = 'projects';
    }
    closeModal();
    await loadProjects();
    showToast(projectEditId.value ? 'Projekt aktualisiert' : 'Projekt erstellt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Projekt konnte nicht gespeichert werden.'); }
}

async function saveSubarea() {
  if (!selectedProject.value) return;
  try {
    if (subareaEditId.value) await api.updateSubarea(subareaEditId.value, { ...areaForm });
    else await api.createSubarea(selectedProject.value.id, { ...areaForm });
    closeModal();
    await loadProjects();
    showToast(subareaEditId.value ? 'Bereich aktualisiert' : 'Bereich hinzugefügt');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Bereich konnte nicht gespeichert werden.'); }
}

async function removeProject(project: Project) {
  if (!window.confirm(`„${project.name}“ und alle zugehörigen Bereiche löschen?`)) return;
  try {
    await api.deleteProject(project.id);
    if (selectedProjectId.value === project.id) selectedProjectId.value = null;
    await loadProjects();
    showToast('Projekt gelöscht');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Projekt konnte nicht gelöscht werden.'); }
}

async function removeArea(area: Subarea) {
  if (!window.confirm(`„${area.name}“ löschen?`)) return;
  try {
    await api.deleteSubarea(area.id);
    await loadProjects();
    showToast('Bereich gelöscht');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Bereich konnte nicht gelöscht werden.'); }
}

function updateLocalProgress(areaId: number, progress: number) {
  projects.value = projects.value.map((project) => {
    const subareas = project.subareas.map((area) => area.id === areaId ? { ...area, progress } : area);
    if (!subareas.some((area) => area.id === areaId)) return project;
    const weight = subareas.reduce((sum, area) => sum + area.weight, 0);
    return { ...project, subareas, progress: weight ? Math.round(subareas.reduce((sum, area) => sum + area.progress * area.weight, 0) / weight) : 0, completedCount: subareas.filter((area) => area.progress === 100).length };
  });

  const oldTimer = saveTimers.get(areaId);
  if (oldTimer) window.clearTimeout(oldTimer);
  saveTimers.set(areaId, window.setTimeout(async () => {
    savingIds.value = new Set([...savingIds.value, areaId]);
    try {
      await api.updateSubarea(areaId, { progress });
      savingIds.value = new Set([...savingIds.value].filter((id) => id !== areaId));
    } catch (error) {
      savingIds.value = new Set([...savingIds.value].filter((id) => id !== areaId));
      await loadProjects();
      showToast(error instanceof Error ? error.message : 'Fortschritt konnte nicht gespeichert werden.');
    } finally { saveTimers.delete(areaId); }
  }, 300));
}

let toastTimer = 0;
function showToast(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastMessage.value = ''; }, 2600);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

onMounted(loadProjects);
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
      </nav>

      <div class="sidebar-projects">
        <div class="sidebar-section-head"><span class="nav-label">DEINE PROJEKTE</span><button class="tiny-icon" aria-label="Projekt erstellen" @click="resetProjectForm()"><Plus :size="15" /></button></div>
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
        <div class="breadcrumbs"><span>Mein Workspace</span><ArrowRight :size="13" /><strong>{{ selectedProject?.name ?? (view === 'projects' ? 'Projekte' : 'Übersicht') }}</strong></div>
        <div class="topbar-right"><span class="today-label"><CalendarDays :size="15" />{{ today }}</span><span class="topbar-avatar">D</span></div>
      </header>

      <div class="page-content">
        <div v-if="apiError" class="connection-banner"><span><CircleHelp :size="18" /></span><div><strong>Verbindung zur Datenbank fehlgeschlagen</strong><p>{{ apiError }} Starte die Datenbank und den API-Server, danach kannst du es erneut versuchen.</p></div><button class="button button-quiet" @click="loadProjects">Erneut versuchen</button></div>

        <template v-if="selectedProject">
          <div class="detail-back-row"><button class="back-button" @click="goTo('projects')"><ArrowLeft :size="16" /> Alle Projekte</button><span class="detail-created"><Clock3 :size="14" /> Erstellt am {{ dateLabel(selectedProject.createdAt) }}</span></div>
          <section class="detail-heading">
            <div class="detail-title-side"><div class="detail-project-icon" :style="{ backgroundColor: `${selectedProject.color}18`, color: selectedProject.color }"><component :is="iconOptions.find((option) => option.id === selectedProject.icon)?.icon ?? Sparkles" :size="26" /></div><div><div class="eyebrow">PROJEKTÜBERSICHT</div><h1>{{ selectedProject.name }}</h1><p>{{ selectedProject.description || 'Ein Schritt nach dem anderen.' }}</p></div></div>
            <div class="detail-actions"><button class="button button-quiet" @click="resetProjectForm(selectedProject)"><Settings2 :size="15" /> Bearbeiten</button><button class="icon-button danger-icon" aria-label="Projekt löschen" @click="removeProject(selectedProject)"><Trash2 :size="16" /></button></div>
          </section>

          <section class="detail-summary-grid">
            <div class="detail-stat-card featured-stat"><span class="detail-stat-label">GESAMTFORTSCHRITT</span><div class="featured-stat-body"><ProgressRing :value="selectedProject.progress" :color="selectedProject.color" :size="58" :stroke="5" /><p>Dein Projekt kommt<br /><strong>{{ selectedProject.progress >= 75 ? 'richtig gut voran.' : 'Schritt für Schritt voran.' }}</strong></p></div></div>
            <div class="detail-stat-card"><span class="detail-stat-label">TEILBEREICHE</span><strong class="detail-stat-number">{{ selectedProject.subareas.length }}</strong><span class="detail-stat-foot">{{ selectedProject.completedCount }} vollständig abgeschlossen</span></div>
            <div class="detail-stat-card"><span class="detail-stat-label">ZIELDATUM</span><strong class="detail-stat-number date-stat">{{ selectedProject.targetDate ? dateLabel(selectedProject.targetDate) : 'Kein Datum' }}</strong><span class="detail-stat-foot">{{ selectedProject.targetDate ? 'Dein nächster Meilenstein' : 'Setze dir einen Zeitrahmen' }}</span></div>
          </section>

          <section class="areas-section">
            <div class="section-heading"><div><div class="eyebrow">DEIN WEG ZUM ZIEL</div><h2>Teilbereiche <span>{{ selectedProject.subareas.length }}</span></h2><p>Jeder Fortschritt zählt. Passe einzelne Bereiche in deinem Tempo an.</p></div><button class="button button-primary" @click="resetAreaForm()"><Plus :size="16" /> Bereich hinzufügen</button></div>
            <div v-if="selectedProject.subareas.length" class="areas-list"><SubareaRow v-for="area in selectedProject.subareas" :key="area.id" :area="area" :color="selectedProject.color" :saving="savingIds.has(area.id)" @progress="updateLocalProgress(area.id, $event)" @edit="resetAreaForm(area)" @delete="removeArea(area)" /></div>
            <div v-else class="empty-areas"><div class="empty-illustration"><Target :size="23" /></div><h3>Der Anfang ist gemacht.</h3><p>Teile dein Projekt in kleine, erreichbare Bereiche auf.</p><button class="button button-quiet" @click="resetAreaForm()"><Plus :size="15" /> Ersten Bereich hinzufügen</button></div>
          </section>
        </template>

        <template v-else>
          <section class="welcome-header">
            <div><span class="eyebrow">{{ view === 'overview' ? 'DEIN PERSÖNLICHER FORTSCHRITT' : 'DEINE ZIELE IM BLICK' }}</span><h1>{{ view === 'overview' ? 'Schön, dass du da bist.' : 'Deine Projekte' }}</h1><p>{{ view === 'overview' ? 'Große Ziele entstehen aus vielen kleinen Schritten.' : 'Alles, woran du gerade arbeitest, an einem Ort.' }}</p></div>
            <button class="button button-primary create-button" @click="resetProjectForm()"><Plus :size="17" /> Neues Projekt</button>
          </section>

          <template v-if="view === 'overview'">
            <section class="overview-grid">
              <div class="progress-overview-card">
                <div class="card-overline"><span class="eyebrow">DEIN ÜBERBLICK</span><button class="icon-button" aria-label="Details"><ArrowUpRight :size="17" /></button></div>
                <div class="overview-chart-layout"><ProgressChart :value="overallProgress" /><div class="overview-chart-copy"><span>Gesamtfortschritt</span><h2>{{ overallProgress }}<small>%</small></h2><p>über alle deine Bereiche</p><div class="chart-legend"><span><i class="legend-dot lavender"></i>Erreicht</span><span><i class="legend-dot gray"></i>Noch vor dir</span></div></div></div>
                <div class="overview-card-footer"><span><CheckCircle2 :size="15" />{{ completedAreas }} von {{ allAreas.length }} Bereichen abgeschlossen</span><span class="overview-footer-icon"><Sparkles :size="14" /></span></div>
              </div>
              <div class="stats-stack">
                <div class="metric-card"><span class="metric-icon violet"><FolderKanban :size="17" /></span><div><small>Aktive Projekte</small><strong>{{ projects.length }}</strong><span>{{ projects.length === 1 ? 'Ein Ziel im Fokus' : 'Ziele im Fokus' }}</span></div><span class="metric-trend"><ArrowUpRight :size="14" /></span></div>
                <div class="metric-card"><span class="metric-icon green"><Target :size="17" /></span><div><small>Teilbereiche</small><strong>{{ allAreas.length }}</strong><span>{{ completedAreas }} erfolgreich abgeschlossen</span></div><span class="metric-trend green-trend"><Check :size="14" /></span></div>
                <div class="focus-card"><div><span class="focus-sparkle"><Sparkles :size="16" /></span><strong>Dein Tempo. Dein Weg.</strong></div><p>Jeder kleine Schritt bringt dich deinen Zielen näher.</p></div>
              </div>
            </section>
          </template>

          <section class="projects-section">
            <div class="section-heading projects-heading"><div><div class="eyebrow">{{ view === 'overview' ? 'WORAN DU ARBEITEST' : 'ALLE ZIELE' }}</div><h2>Deine Projekte <span>{{ projects.length }}</span></h2><p>Deine Ziele, übersichtlich an einem Ort.</p></div><div class="project-controls"><label class="search-box"><Search :size="16" /><input v-model="search" placeholder="Projekt suchen" aria-label="Projekt suchen" /><kbd>⌘ K</kbd></label><button v-if="view === 'overview' && projects.length > 3" class="text-button" @click="goTo('projects')">Alle ansehen <ArrowRight :size="14" /></button></div></div>
            <div v-if="isLoading" class="loading-grid"><div v-for="n in 3" :key="n" class="skeleton-card"></div></div>
            <div v-else-if="visibleProjects.length" class="projects-grid"><ProjectCard v-for="project in (view === 'overview' ? visibleProjects.slice(0, 3) : visibleProjects)" :key="project.id" :project="project" @open="openProject(project)" @edit="resetProjectForm(project)" /></div>
            <div v-else-if="projects.length === 0" class="empty-projects"><div class="empty-illustration"><FolderKanban :size="23" /></div><h3>Womit möchtest du beginnen?</h3><p>Erstelle dein erstes Projekt und mache aus einem großen Ziel kleine, machbare Schritte.</p><button class="button button-primary" @click="resetProjectForm()"><Plus :size="16" /> Erstes Projekt erstellen</button></div>
            <div v-else class="empty-search"><Search :size="18" /><p>Keine Projekte für „{{ search }}“ gefunden.</p><button class="text-button" @click="search = ''">Suche zurücksetzen</button></div>
          </section>
        </template>
        <footer class="page-footer"><span>Mit Ruhe. Mit Absicht. In deinem Tempo.</span><span>Progress Planner <i>·</i> Persönlicher Workspace</span></footer>
      </div>
    </main>

    <div v-if="modalMode" class="modal-backdrop" @click.self="closeModal" @keydown.esc="closeModal">
      <section class="modal-card" role="dialog" aria-modal="true" :aria-labelledby="modalMode === 'project' ? 'project-modal-title' : 'area-modal-title'">
        <div class="modal-header"><div><span class="eyebrow">{{ modalMode === 'project' ? (projectEditId ? 'PROJEKT BEARBEITEN' : 'NEUES ZIEL') : (subareaEditId ? 'BEREICH BEARBEITEN' : 'KLEINER SCHRITT') }}</span><h2 :id="modalMode === 'project' ? 'project-modal-title' : 'area-modal-title'">{{ modalMode === 'project' ? (projectEditId ? 'Projekt anpassen' : 'Neues Projekt') : (subareaEditId ? 'Bereich anpassen' : 'Teilbereich hinzufügen') }}</h2></div><button class="icon-button" aria-label="Schließen" @click="closeModal"><X :size="19" /></button></div>
        <form v-if="modalMode === 'project'" class="modal-form" @submit.prevent="saveProject">
          <label class="form-field"><span>Projektname <b>*</b></span><input v-model="projectForm.name" required maxlength="120" placeholder="z. B. Calisthenics" autofocus /></label>
          <label class="form-field"><span>Beschreibung</span><textarea v-model="projectForm.description" rows="3" placeholder="Worum geht es bei deinem Projekt?"></textarea></label>
          <div class="form-field"><span>Symbol</span><div class="icon-picker"><button v-for="option in iconOptions" :key="option.id" type="button" :aria-label="option.label" :class="{ selected: projectForm.icon === option.id }" @click="projectForm.icon = option.id"><component :is="option.icon" :size="18" /></button></div></div>
          <div class="form-field"><span>Akzentfarbe</span><div class="color-picker"><button v-for="color in colorOptions" :key="color" type="button" :aria-label="`Farbe ${color}`" :class="{ selected: projectForm.color === color }" :style="{ backgroundColor: color }" @click="projectForm.color = color"></button></div></div>
          <label class="form-field"><span>Zieldatum <small>optional</small></span><input v-model="projectForm.targetDate" type="date" /></label>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit">{{ projectEditId ? 'Änderungen speichern' : 'Projekt erstellen' }} <ArrowRight :size="15" /></button></div>
        </form>
        <form v-else class="modal-form" @submit.prevent="saveSubarea">
          <label class="form-field"><span>Name des Bereichs <b>*</b></span><input v-model="areaForm.name" required maxlength="120" placeholder="z. B. Handstand" autofocus /></label>
          <label class="form-field"><span>Beschreibung</span><textarea v-model="areaForm.description" rows="3" placeholder="Was möchtest du hier erreichen?"></textarea></label>
          <label class="form-field"><span>Fortschritt <strong class="form-value">{{ areaForm.progress }}%</strong></span><input v-model.number="areaForm.progress" class="progress-slider modal-slider" type="range" min="0" max="100" step="5" :style="{ '--slider-color': selectedProject?.color ?? '#9a8cff', '--slider-progress': `${areaForm.progress}%` }" /><span class="range-hint"><span>0%</span><span>in 5-%-Schritten</span><span>100%</span></span></label>
          <label class="form-field"><span>Gewichtung</span><input v-model.number="areaForm.weight" type="number" min="0.1" step="0.1" /><small class="field-hint">Standardmäßig zählt jeder Bereich gleich viel.</small></label>
          <div class="modal-actions"><button type="button" class="button button-quiet" @click="closeModal">Abbrechen</button><button class="button button-primary" type="submit">{{ subareaEditId ? 'Änderungen speichern' : 'Bereich hinzufügen' }} <ArrowRight :size="15" /></button></div>
        </form>
      </section>
    </div>

    <Transition name="toast"><div v-if="toastMessage" class="toast-message" role="status"><CheckCircle2 :size="16" />{{ toastMessage }}</div></Transition>
  </div>
</template>
