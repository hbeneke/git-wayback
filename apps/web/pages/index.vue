<template>
  <main class="container">
    <header class="hero">
      <h1 class="text-gradient">git-wayback</h1>
      <p class="text-muted">Visualize the evolution of any GitHub repository.</p>
    </header>

    <div class="search-container">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search GitHub repositories... (e.g. vue, react, nuxt)"
          class="search-input"
          @input="debouncedSearch"
        />
        <div v-if="isLoading" class="search-spinner" />
      </div>

      <ul v-if="results.length > 0" class="results-list">
        <li v-for="repo in results" :key="repo.id" class="result-item">
          <NuxtLink :to="`/${repo.fullName}`" class="result-link">
            <img :src="repo.owner.avatar" :alt="repo.owner.login" class="avatar" />
            <div class="result-info">
              <span class="repo-name">{{ repo.fullName }}</span>
              <span v-if="repo.description" class="repo-description">
                {{ repo.description }}
              </span>
            </div>
            <div class="repo-stats">
              <span class="stat">⭐ {{ formatNumber(repo.stars) }}</span>
              <span class="stat">🍴 {{ formatNumber(repo.forks) }}</span>
            </div>
          </NuxtLink>
        </li>
      </ul>

      <p v-else-if="searchQuery && !isLoading && hasSearched" class="no-results">
        No repositories found for "{{ searchQuery }}"
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
// SEO Meta
useSeoMeta({
  title: 'git-wayback - Visualize GitHub Repository Evolution',
  description:
    'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
  ogTitle: 'git-wayback - Visualize GitHub Repository Evolution',
  ogDescription:
    'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
  twitterTitle: 'git-wayback - Visualize GitHub Repository Evolution',
  twitterDescription:
    'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
})

interface SearchResult {
  id: number
  fullName: string
  description: string | null
  stars: number
  forks: number
  owner: {
    login: string
    avatar: string
  }
}

const searchQuery = ref('')
const results = ref<SearchResult[]>([])
const isLoading = ref(false)
const hasSearched = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function search() {
  if (searchQuery.value.length < 2) {
    results.value = []
    hasSearched.value = false
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<{ items: SearchResult[] }>('/api/search', {
      query: { q: searchQuery.value },
    })
    results.value = data.items
    hasSearched.value = true
  } catch (error) {
    console.error('Search failed:', error)
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function debouncedSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, 300)
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}
</script>

<style scoped>
.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.hero p {
  font-size: 1.1rem;
}

.search-container {
  width: 100%;
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 1rem 1.25rem;
  font-size: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-spinner {
  position: absolute;
  right: 1rem;
  top: 50%;
  translate: 0 -50%;
  width: 20px;
  height: 20px;
  border: 2px solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.results-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
}

.result-item {
  border-bottom: 1px solid #e0e0e0;
}

.result-item:last-child {
  border-bottom: none;
}

.result-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.2s;
}

.result-link:hover {
  background-color: #f8f9fa;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.repo-name {
  display: block;
  font-weight: 600;
  color: #333;
}

.repo-description {
  display: block;
  font-size: 0.875rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.repo-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #666;
}

.stat {
  white-space: nowrap;
}

.no-results {
  text-align: center;
  color: #666;
  padding: 2rem;
}
</style>
