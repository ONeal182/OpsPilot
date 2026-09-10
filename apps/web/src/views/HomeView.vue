<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useHealthStore } from '@/stores/health'

const healthStore = useHealthStore()
const { status } = storeToRefs(healthStore)

const backendLabel = computed(() => {
  switch (status.value) {
    case 'available':
      return 'Backend: available'
    case 'unavailable':
      return 'Backend: unavailable'
    default:
      return 'Backend: checking…'
  }
})

onMounted(() => {
  healthStore.check()
})
</script>

<template>
  <main class="home">
    <h1>OpsPilot</h1>
    <p class="backend" :data-status="status">{{ backendLabel }}</p>
  </main>
</template>

<style scoped>
.home {
  max-width: 40rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}

h1 {
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}

.backend {
  font-size: 1rem;
  color: var(--color-text);
  opacity: 0.75;
}

.backend[data-status='available'] {
  color: hsl(150, 60%, 40%);
  opacity: 1;
}

.backend[data-status='unavailable'] {
  color: hsl(0, 65%, 55%);
  opacity: 1;
}
</style>
