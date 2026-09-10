<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
</script>

<template>
  <section data-section="hero" class="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
    <h1 class="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      Операционный ассистент, который предлагает — а решаете вы
    </h1>
    <p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
      OpsPilot разбирает тикеты поддержки с помощью Claude-агента и предлагает действия. Каждое
      предложение одобряет или отклоняет человек — ничего не выполняется автоматически.
    </p>
    <div class="mt-10 flex justify-center">
      <Button as-child size="lg">
        <RouterLink to="/login">Войти в личный кабинет</RouterLink>
      </Button>
    </div>
  </section>
</template>
