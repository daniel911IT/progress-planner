<script setup lang="ts">
withDefaults(defineProps<{ value: number; color?: string; size?: number; stroke?: number }>(), {
  color: '#a998ff', size: 48, stroke: 4
});
</script>

<template>
  <div class="progress-ring" :style="{ width: `${size}px`, height: `${size}px`, '--ring-color': color, '--ring-value': `${Math.max(0, Math.min(value, 100)) * 3.6}deg`, '--ring-width': `${stroke}px` }">
    <span>{{ value }}<small>%</small></span>
  </div>
</template>
