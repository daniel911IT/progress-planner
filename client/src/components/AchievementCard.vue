<script setup lang="ts">
import { computed } from 'vue';
import { Check, Pencil, Sparkles, Trash2, Trophy } from 'lucide-vue-next';
import type { Achievement, AchievementRarity } from '../types';

const props = withDefaults(defineProps<{ achievement: Achievement; projectName?: string; saving?: boolean }>(), { saving: false });
const emit = defineEmits<{ edit: []; delete: []; toggle: [achieved: boolean]; progress: [value: number] }>();

const rarityLabels: Record<AchievementRarity, string> = {
  bronze: 'Bronze', silver: 'Silber', gold: 'Gold', ruby: 'Rubin', diamond: 'Diamant'
};
const progressStatus = computed(() => props.achievement.progress === 0 ? 'Noch nicht begonnen' : 'Auf dem Weg');

function setProgress(event: Event) {
  emit('progress', Number((event.target as HTMLInputElement).value));
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
</script>

<template>
  <article class="achievement-card" :class="[`rarity-${achievement.rarity}`, { locked: !achievement.achieved, unlocked: achievement.achieved, 'hall-of-fame-card': achievement.achieved }]">
    <div class="achievement-card-top">
      <span class="achievement-icon" :aria-label="achievement.icon ? `Symbol ${achievement.icon}` : 'Achievement-Symbol'">
        <span v-if="achievement.icon">{{ achievement.icon }}</span>
        <Sparkles v-else :size="21" />
      </span>
      <span class="rarity-badge">{{ rarityLabels[achievement.rarity] }}</span>
      <span v-if="achievement.achieved" class="hall-of-fame-seal" aria-label="In der Hall of Fame"><Trophy :size="14" /></span>
      <div class="achievement-actions">
        <button class="icon-button" :aria-label="`„${achievement.name}“ bearbeiten`" @click="emit('edit')"><Pencil :size="15" /></button>
        <button class="icon-button danger-icon" :aria-label="`„${achievement.name}“ löschen`" @click="emit('delete')"><Trash2 :size="15" /></button>
      </div>
    </div>
    <div class="achievement-card-copy">
      <h3>{{ achievement.name }}</h3>
      <p>{{ achievement.description || 'Ein persönlicher Meilenstein.' }}</p>
    </div>

    <div v-if="achievement.achieved" class="achievement-hall-earned"><Trophy :size="14" /><span>Freigeschaltet am {{ achievement.achievedAt ? formatDate(achievement.achievedAt) : '—' }}</span></div>
    <div v-else class="achievement-progress">
      <div class="achievement-progress-heading"><span>Dein Fortschritt</span><strong>{{ achievement.progress }}<small>%</small></strong></div>
      <input
        class="progress-slider achievement-progress-slider"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="achievement.progress"
        :aria-label="`Fortschritt für ${achievement.name}`"
        :style="{ '--slider-color': 'var(--rarity-color)', '--slider-progress': `${achievement.progress}%` }"
        @input="setProgress"
      />
      <div class="achievement-progress-hint"><span>0 %</span><span>In 5-%-Schritten</span><span>100 %</span></div>
    </div>

    <div class="achievement-card-footer">
      <span v-if="achievement.achieved" class="achievement-status reached"><Check :size="14" /> Erreicht</span>
      <span v-else class="achievement-status pending">{{ saving ? 'Wird gespeichert …' : progressStatus }}</span>
      <span v-if="projectName" class="achievement-project">{{ projectName }}</span>
      <button class="achievement-toggle" :class="{ reached: achievement.achieved }" @click="emit('toggle', !achievement.achieved)">
        {{ achievement.achieved ? 'Zurücksetzen' : 'Direkt freischalten' }}
      </button>
    </div>
  </article>
</template>
