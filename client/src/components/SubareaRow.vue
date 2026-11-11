<script setup lang="ts">
import { Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-vue-next';
import { ref } from 'vue';
import type { Subarea } from '../types';

defineProps<{ area: Subarea; color: string; saving?: boolean }>();
const emit = defineEmits<{ progress: [value: number]; edit: []; delete: [] }>();
const menuOpen = ref(false);

function sendProgress(event: Event) {
  emit('progress', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <article class="subarea-row">
    <div class="subarea-head">
      <div class="subarea-title-wrap">
        <span class="subarea-status" :class="{ done: area.progress === 100 }" :style="area.progress === 100 ? {} : { borderColor: `${color}55` }">
          <Check v-if="area.progress === 100" :size="12" />
          <span v-else :style="{ backgroundColor: color, width: `${Math.max(area.progress > 0 ? 6 : 0, area.progress)}%` }"></span>
        </span>
        <div><h3>{{ area.name }}</h3><p v-if="area.description">{{ area.description }}</p></div>
      </div>
      <div class="subarea-actions">
        <span v-if="saving" class="save-state">Speichert …</span>
        <div class="row-menu-wrap">
          <button class="icon-button row-more" aria-label="Bereichsoptionen" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen"><MoreHorizontal :size="18" /></button>
          <div v-if="menuOpen" class="row-menu">
            <button @click="menuOpen = false; emit('edit')"><Pencil :size="14" /> Bearbeiten</button>
            <button class="danger-action" @click="menuOpen = false; emit('delete')"><Trash2 :size="14" /> Löschen</button>
          </div>
        </div>
      </div>
    </div>
    <div class="subarea-slider-line">
      <input class="progress-slider" type="range" min="0" max="100" step="5" :value="area.progress" :aria-label="`${area.name} Fortschritt`" :style="{ '--slider-color': color, '--slider-progress': `${area.progress}%` }" @input="sendProgress" />
      <strong :style="{ color }">{{ area.progress }}<small>%</small></strong>
    </div>
  </article>
</template>
