<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, MoreHorizontal, Sparkles, Trophy } from 'lucide-vue-next';
import type { Achievement, AchievementRarity } from '../types';

const props = withDefaults(defineProps<{ achievement: Achievement; projectName?: string; saving?: boolean; hallOfFame?: boolean }>(), { saving: false, hallOfFame: false });
const emit = defineEmits<{ edit: []; delete: []; toggle: [achieved: boolean]; progress: [value: number]; hallOfFame: [included: boolean] }>();
const menuOpen = ref(false);

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
  <article class="achievement-card" :class="[`rarity-${achievement.rarity}`, { locked: !achievement.achieved, unlocked: achievement.achieved, 'hall-of-fame-card': hallOfFame }]">
    <div class="achievement-card-top">
      <span class="achievement-icon" :aria-label="achievement.icon ? `Symbol ${achievement.icon}` : 'Achievement-Symbol'">
        <span v-if="achievement.icon">{{ achievement.icon }}</span>
        <Sparkles v-else :size="21" />
      </span>
      <span v-if="hallOfFame" class="achievement-medal-ribbons" aria-hidden="true"><i></i><i></i></span>
      <span class="rarity-badge">{{ rarityLabels[achievement.rarity] }}</span>
      <span v-if="achievement.inHallOfFame" class="hall-of-fame-seal" aria-label="In der Hall of Fame"><Trophy :size="14" /></span>
      <div class="achievement-menu-wrap">
        <button class="icon-button achievement-menu-trigger" :aria-label="`Menü für ${achievement.name}`" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen"><MoreHorizontal :size="18" /></button>
        <div v-if="menuOpen" class="achievement-menu" @click.stop>
          <button v-if="achievement.achieved" @click="emit('hallOfFame', !achievement.inHallOfFame); menuOpen = false">{{ achievement.inHallOfFame ? 'Aus Hall of Fame entfernen' : 'Zur Hall of Fame' }}</button>
          <button @click="emit('edit'); menuOpen = false">Bearbeiten</button>
          <button class="achievement-menu-danger" @click="emit('delete'); menuOpen = false">Löschen</button>
        </div>
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
