<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import HeroSection from '@/components/landing/HeroSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur"
    >
      <RouterLink to="/" class="text-lg font-semibold tracking-tight">OpsPilot</RouterLink>
      <Button as-child>
        <RouterLink to="/login">Войти</RouterLink>
      </Button>
    </header>

    <main>
      <HeroSection />
      <FeaturesSection />
      <section data-section="how-it-works" class="px-6 py-16"></section>
    </main>

    <footer class="border-t px-6 py-8"></footer>
  </div>
</template>
