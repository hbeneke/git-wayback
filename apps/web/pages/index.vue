<template>
  <main class="max-w-3xl mx-auto px-4 sm:px-8 pt-16 pb-12">
    <header class="mb-8">
      <h1 class="text-xl font-semibold">
        git-wayback<span class="animate-blink">_</span>
      </h1>
      <p class="text-sm text-[rgb(var(--muted))] mt-1">
        Visualize the evolution of any GitHub repository.
      </p>
    </header>

    <div class="w-full">
      <div class="relative mb-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search repositories..."
          class="w-full px-3 py-2 text-sm bg-transparent border-b-2 border-[rgb(var(--border))] outline-none transition-colors focus:border-primary placeholder:text-[rgb(var(--muted))]"
          @input="debouncedSearch"
        />
        <div
          v-if="isLoading"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin"
        />
      </div>

      <ul v-if="results.length > 0" class="divide-y divider">
        <li v-for="repo in results" :key="repo.id">
          <NuxtLink
            :to="`/${repo.fullName}`"
            class="flex items-center gap-3 py-3 group"
            @click="saveToHistory(repo)"
          >
            <img
              :src="repo.owner.avatar"
              :alt="repo.owner.login"
              class="w-6 h-6 rounded"
            />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium link-primary group-hover:text-primary">
                {{ repo.fullName }}
              </span>
              <span
                v-if="repo.description"
                class="block text-xs text-[rgb(var(--muted))] truncate mt-0.5"
              >
                {{ repo.description }}
              </span>
            </div>
            <div class="flex gap-3 text-xs text-[rgb(var(--muted))]">
              <span>{{ formatNumber(repo.stars) }} stars</span>
              <span>{{ formatNumber(repo.forks) }} forks</span>
            </div>
          </NuxtLink>
        </li>
      </ul>

      <p
        v-else-if="searchQuery && !isLoading && hasSearched"
        class="text-xs text-[rgb(var(--muted))] py-8"
      >
        No repositories found for "{{ searchQuery }}"
      </p>
    </div>

    <!-- Recent history -->
    <section v-if="!searchQuery && history.length > 0" class="mt-8">
      <h2 class="section-title mb-3">Recent</h2>
      <ul class="divide-y divider">
        <li v-for="repo in history" :key="repo.fullName" class="flex items-center gap-3 py-2">
          <img
            :src="repo.avatar"
            :alt="repo.fullName"
            class="w-5 h-5 rounded"
          />
          <NuxtLink :to="`/${repo.fullName}`" class="flex-1 min-w-0">
            <span class="text-xs link-primary">{{ repo.fullName }}</span>
          </NuxtLink>
          <span class="text-[10px] text-[rgb(var(--muted))]">{{ formatRelativeDate(repo.visitedAt) }}</span>
          <button
            @click="removeFromHistory(repo.fullName)"
            class="text-[10px] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] transition-colors"
            title="Remove"
          >
            &times;
          </button>
        </li>
      </ul>
    </section>

    <footer class="mt-16 pt-4 border-t divider text-center">
      <p class="text-xs text-[rgb(var(--muted))]">
        <a href="https://github.com/hbeneke/git-wayback" target="_blank" class="link-primary">git-wayback</a>
      </p>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { formatNumber, formatRelativeDate, SEARCH_DEBOUNCE_MS } from '@git-wayback/shared'

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

interface HistoryEntry {
  fullName: string
  avatar: string
  visitedAt: string
}

const HISTORY_KEY = 'git-wayback-history'
const MAX_HISTORY = 10

const searchQuery = ref('')
const results = ref<SearchResult[]>([])
const isLoading = ref(false)
const hasSearched = ref(false)
const history = ref<HistoryEntry[]>([])

onMounted(() => {
  loadHistory()
})

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) history.value = JSON.parse(raw)
  } catch {
    history.value = []
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

function saveToHistory(repo: SearchResult) {
  const filtered = history.value.filter((h) => h.fullName !== repo.fullName)
  filtered.unshift({
    fullName: repo.fullName,
    avatar: repo.owner.avatar,
    visitedAt: new Date().toISOString(),
  })
  history.value = filtered.slice(0, MAX_HISTORY)
  persistHistory()
}

function removeFromHistory(fullName: string) {
  history.value = history.value.filter((h) => h.fullName !== fullName)
  persistHistory()
}

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
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function debouncedSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS)
}
</script>
