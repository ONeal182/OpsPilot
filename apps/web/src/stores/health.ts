import { ref } from 'vue'
import { defineStore } from 'pinia'
import http from '@/lib/http'

export type HealthStatus = 'checking' | 'available' | 'unavailable'

export const useHealthStore = defineStore('health', () => {
  const status = ref<HealthStatus>('checking')
  const detail = ref<null | Record<string, unknown>>(null)

  async function check() {
    status.value = 'checking'
    try {
      const response = await http.get('/health')
      const data = response.data as Record<string, unknown>
      detail.value = data
      status.value = data?.status === 'ok' ? 'available' : 'unavailable'
    } catch {
      detail.value = null
      status.value = 'unavailable'
    }
  }

  return { status, detail, check }
})
