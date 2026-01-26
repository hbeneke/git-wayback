<template>
  <main class="max-w-3xl mx-auto px-6 py-8">
    <header class="text-center mb-12">
      <h1 class="text-gradient text-4xl font-bold mb-2">git-wayback</h1>
      <p class="text-gray-500 text-lg">Visualize the evolution of any GitHub repository.</p>
    </header>

    <div class="w-full">
      <div class="relative mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search GitHub repositories... (e.g. vue, react, nuxt)"
          class="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-xl outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
          @input="debouncedSearch"
        />
        <div
          v-if="isLoading"
          class="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-gray-200 border-t-brand-primary rounded-full animate-spin"
        />
      </div>

      <ul v-if="results.length > 0" class="border border-gray-200 rounded-xl overflow-hidden">
        <li
          v-for="repo in results"
          :key="repo.id"
          class="border-b border-gray-200 last:border-b-0"
        >
          <NuxtLink
            :to="`/${repo.fullName}`"
            class="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
          >
            <img
              :src="repo.owner.avatar"
              :alt="repo.owner.login"
              class="w-10 h-10 rounded-lg"
            />
            <div class="flex-1 min-w-0">
              <span class="block font-semibold text-gray-800">{{ repo.fullName }}</span>
              <span
                v-if="repo.description"
                class="block text-sm text-gray-500 truncate"
              >
                {{ repo.description }}
              </span>
            </div>
            <div class="flex gap-3 text-sm text-gray-500">
              <span class="whitespace-nowrap">⭐ {{ formatNumber(repo.stars) }}</span>
              <span class="whitespace-nowrap">🍴 {{ formatNumber(repo.forks) }}</span>
            </div>
          </NuxtLink>
        </li>
      </ul>

      <p
        v-else-if="searchQuery && !isLoading && hasSearched"
        class="text-center text-gray-500 py-8"
      >
        No repositories found for "{{ searchQuery }}"
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { formatNumber } from '@git-wayback/shared'

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
</script>
