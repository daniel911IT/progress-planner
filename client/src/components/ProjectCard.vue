<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Dumbbell, HeartPulse, Plane, Sparkles } from 'lucide-vue-next';
import type { Project } from '../types';
import ProgressRing from './ProgressRing.vue';

const props = defineProps<{ project: Project }>();
const emit = defineEmits<{ open: []; edit: [] }>();
const icons = { sparkles: Sparkles, book: BookOpen, work: BriefcaseBusiness, fitness: Dumbbell, health: HeartPulse, travel: Plane };
const Icon = computed(() => icons[props.project.icon as keyof typeof icons] ?? Sparkles);
const areasLabel = computed(() => `${props.project.subareas.length} ${props.project.subareas.length === 1 ? 'Bereich' : 'Bereiche'}`);
</script>

<template>
  <article class="project-card" role="button" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')">
    <div class="project-card-top">
      <div class="project-icon" :style="{ color: project.color, backgroundColor: `${project.color}18` }"><component :is="Icon" :size="19" :stroke-width="1.8" /></div>
      <button class="icon-button card-arrow" aria-label="Projekt öffnen" @click.stop="emit('open')"><ArrowUpRight :size="17" /></button>
    </div>
    <div class="project-card-copy">
      <h3>{{ project.name }}</h3>
      <p>{{ project.description || 'Ein Schritt nach dem anderen.' }}</p>
    </div>
    <div class="project-card-progress">
      <div><span>Fortschritt</span><strong>{{ project.progress }}<small>%</small></strong></div>
      <div class="progress-track"><span :style="{ width: `${project.progress}%`, backgroundColor: project.color }"></span></div>
    </div>
    <div class="project-card-bottom">
      <span>{{ areasLabel }}</span>
      <span class="completed-label"><i :style="{ backgroundColor: project.color }"></i>{{ project.completedCount }} abgeschlossen</span>
    </div>
  </article>
</template>
