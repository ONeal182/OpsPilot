<script setup lang="ts">
import { Bot, Lightbulb, UserCheck, ShieldCheck, type LucideIcon } from '@lucide/vue'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Bot,
    title: 'Разбор тикетов агентом',
    description:
      'Claude-агент читает тикет поддержки и определяет категорию, приоритет и краткую суть.',
  },
  {
    icon: Lightbulb,
    title: 'Агент предлагает, не выполняет',
    description:
      'Результат работы агента — предложение действия. Ни одно рискованное изменение не применяется само.',
  },
  {
    icon: UserCheck,
    title: 'Решение за человеком',
    description:
      'Каждое предложение проходит через approve / reject. Оператор одобряет или отклоняет его вручную.',
  },
  {
    icon: ShieldCheck,
    title: 'Доступ к данным только через API',
    description:
      'Агент ходит к бизнес-данным исключительно через MCP-инструменты и Internal API — без прямой БД, шелла и файловой системы.',
  },
]
</script>

<template>
  <section data-section="features" class="mx-auto max-w-5xl px-6 py-20">
    <h2 class="text-center text-3xl font-semibold tracking-tight">Что делает OpsPilot</h2>
    <div class="mt-12 grid gap-6 sm:grid-cols-2">
      <article
        v-for="feature in features"
        :key="feature.title"
        data-card
        class="rounded-lg border bg-card p-6 text-card-foreground"
      >
        <component :is="feature.icon" class="size-6 text-primary" aria-hidden="true" />
        <h3 class="mt-4 text-lg font-medium">{{ feature.title }}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{{ feature.description }}</p>
      </article>
    </div>
  </section>
</template>
