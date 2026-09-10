<script setup lang="ts">
interface Step {
  title: string
  description: string
}

const steps: Step[] = [
  {
    title: 'Тикет поступает',
    description: 'Оператор создаёт тикет поддержки в OpsPilot.',
  },
  {
    title: 'Уходит в очередь',
    description:
      'API публикует запрос на анализ в RabbitMQ (routing key agent.analysis.requested).',
  },
  {
    title: 'Агент анализирует',
    description:
      'Воркер берёт задачу; драйвер fake или claude возвращает категорию, приоритет и суть тикета.',
  },
  {
    title: 'Человек решает',
    description: 'Агент оформляет предложение действия, а оператор одобряет или отклоняет его.',
  },
]
</script>

<template>
  <section data-section="how-it-works" class="mx-auto max-w-4xl px-6 py-20">
    <h2 class="text-center text-3xl font-semibold tracking-tight">Как это работает</h2>
    <ol class="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <li v-for="(step, index) in steps" :key="step.title" class="flex flex-col">
        <span
          class="flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
        >
          {{ index + 1 }}
        </span>
        <h3 class="mt-4 text-base font-medium">{{ step.title }}</h3>
        <p class="mt-2 text-sm text-muted-foreground">{{ step.description }}</p>
      </li>
    </ol>
  </section>
</template>
