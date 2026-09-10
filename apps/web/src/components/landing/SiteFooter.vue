<script setup lang="ts">
const links: string[] = ['Документация', 'Приватность', 'Контакты']
</script>

<template>
  <footer class="border-t">
    <div
      class="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between"
    >
      <p>© 2026 OpsPilot</p>
      <nav class="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
        <a v-for="link in links" :key="link" href="#" class="hover:text-foreground">{{ link }}</a>
      </nav>
    </div>
  </footer>
</template>
