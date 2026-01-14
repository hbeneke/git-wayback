<template>
  <main class="max-w-3xl mx-auto px-6 py-8">
    <nav class="mb-8">
      <NuxtLink to="/" class="text-brand-primary text-sm hover:text-brand-secondary transition-colors">
        ← Back to search
      </NuxtLink>
    </nav>

    <header class="mb-8">
      <h1 class="text-gradient text-3xl font-bold mb-2">{{ owner }}/{{ repo }}</h1>
      <p class="text-gray-500">Repository analysis coming soon.</p>
    </header>

    <section class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-500">
      <p class="text-2xl mb-2">🚧 We're building something amazing here...</p>
      <p>Soon you'll be able to visualize the complete evolution of this repository.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

// Dynamic SEO
useSeoMeta({
  title: () => `${owner.value}/${repo.value} - git-wayback`,
  description: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
  ogTitle: () => `${owner.value}/${repo.value} - git-wayback`,
  ogDescription: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
  twitterTitle: () => `${owner.value}/${repo.value} - git-wayback`,
  twitterDescription: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
})
</script>
