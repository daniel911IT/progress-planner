<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArcElement, Chart, DoughnutController, Tooltip } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip);
const props = defineProps<{ value: number }>();
const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | undefined;
const valueText = computed(() => `${props.value}%`);

function render() {
  if (!canvas.value) return;
  chart?.destroy();
  chart = new Chart(canvas.value, {
    type: 'doughnut',
    data: {
      datasets: [{ data: [props.value, Math.max(0, 100 - props.value)], backgroundColor: ['#a998ff', '#282d39'], borderWidth: 0, borderRadius: 7, spacing: 3, hoverOffset: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '84%', plugins: { tooltip: { enabled: false } }, animation: { duration: 500 } }
  });
}

onMounted(render);
watch(() => props.value, render);
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="chart-wrap"><canvas ref="canvas"></canvas><div class="chart-center"><strong>{{ valueText }}</strong><span>gesamt</span></div></div>
</template>
