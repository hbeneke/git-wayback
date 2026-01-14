<template>
  <main class="container">
    <nav class="breadcrumb">
      <NuxtLink to="/" class="back-link">← Back to search</NuxtLink>
    </nav>

    <header class="repo-header">
      <h1 class="text-gradient">{{ owner }}/{{ repo }}</h1>
      <p class="text-muted">Repository analysis coming soon.</p>
    </header>

    <section class="placeholder">
      <p>🚧 We're building something amazing here...</p>
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

<style scoped>
.breadcrumb {
  margin-bottom: 2rem;
}

.back-link {
  color: #667eea;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: #764ba2;
}

.repo-header {
  margin-bottom: 2rem;
}

.repo-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.placeholder {
  background: #f8f9fa;
  border: 2px dashed #e0e0e0;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  color: #666;
}

.placeholder p {
  margin: 0.5rem 0;
}

.placeholder p:first-child {
  font-size: 1.5rem;
}
</style>
