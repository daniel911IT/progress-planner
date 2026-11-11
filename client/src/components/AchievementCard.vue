<script setup lang="ts">
import { Check, Pencil, Sparkles, Trash2 } from 'lucide-vue-next';
import type { Achievement, AchievementRarity } from '../types';

defineProps<{ achievement: Achievement; projectName?: string }>();
const emit = defineEmits<{ edit: []; delete: []; toggle: [achieved: boolean] }>();

const rarityLabels: Record<AchievementRarity, string> = {
  bronze: 'Bronze', silver: 'Silber', gold: 'Gold', platinum: 'Platin', diamond: 'Diamant'
};
</script>

<template>
  <article class="achievement-card" :class="[`rarity-${achievement.rarity}`, { locked: !achievement.achieved, unlocked: achievement.achieved }]">
    <div class="achievement-card-top">
      <span class="achievement-icon" :aria-label="achievement.icon ? `Symbol ${achievement.icon}` : 'Achievement-Symbol'">
        <span v-if="achievement.icon">{{ achievement.icon }}</span>
        <Sparkles v-else :size="21" />
      </span>
      <span class="rarity-badge">{{ rarityLabels[achievement.rarity] }}</span>
      <div class="achievement-actions">
        <button class="icon-button" :aria-label="`„${achievement.name}“ bearbeiten`" @click="emit('edit')"><Pencil :size="15" /></button>
        <button class="icon-button danger-icon" :aria-label="`„${achievement.name}“ löschen`" @click="emit('delete')"><Trash2 :size="15" /></button>
      </div>
    </div>
    <div class="achievement-card-copy">
      <h3>{{ achievement.name }}</h3>
      <p>{{ achievement.description || 'Ein persönlicher Meilenstein.' }}</p>
    </div>
    <div class="achievement-card-footer">
      <span v-if="achievement.achieved" class="achievement-status reached"><Check :size="14" /> Erreicht<span v-if="achievement.achievedAt"> · {{ achievement.achievedAt }}</span></span>
      <span v-else class="achievement-status pending">Noch offen</span>
      <span v-if="projectName" class="achievement-project">{{ projectName }}</span>
      <button class="achievement-toggle" :class="{ reached: achievement.achieved }" @click="emit('toggle', !achievement.achieved)">
        {{ achievement.achieved ? 'Zurücksetzen' : 'Als erreicht markieren' }}
      </button>
    </div>
  </article>
</template>
