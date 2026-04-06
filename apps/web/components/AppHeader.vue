<template>
  <header class="sticky top-0 z-50 bg-[rgb(var(--bg))]/95 backdrop-blur-sm border-b border-[rgb(var(--border)/.3)]">
    <div class="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center gap-6">
      <!-- Logo + Title -->
      <NuxtLink to="/" class="shrink-0 flex items-center gap-3 group">
        <!-- Logo placeholder -->
        <div class="w-8 h-8 rounded bg-[rgb(var(--secondary)/.15)] border border-[rgb(var(--secondary)/.3)] flex items-center justify-center text-secondary text-xs font-bold">
          gw
        </div>
        <div class="leading-tight">
          <span class="text-sm font-semibold text-secondary">
            git-wayback<span class="animate-blink">_</span>
          </span>
          <!-- Nav slot for future use -->
        </div>
      </NuxtLink>

      <!-- Search -->
      <div ref="searchContainer" class="relative flex-1 max-w-md ml-auto">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search repositories..."
          class="w-full px-3 py-1.5 text-xs bg-transparent border border-[rgb(var(--border))] rounded outline-none transition-colors focus:border-primary placeholder:text-[rgb(var(--muted))]"
          @input="debouncedSearch"
          @focus="showDropdown = true"
        />
        <div
          v-if="isLoading"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin"
        />

        <!-- Results dropdown -->
        <div
          v-if="showDropdown && results.length > 0"
          class="absolute top-full left-0 right-0 mt-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded shadow-lg max-h-64 overflow-y-auto"
        >
          <NuxtLink
            v-for="repo in results"
            :key="repo.id"
            :to="`/${repo.fullName}`"
            class="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[rgb(var(--border)/.2)] transition-colors"
            @click="onResultClick(repo)"
          >
            <img :src="repo.owner.avatar" :alt="repo.owner.login" class="w-4 h-4 rounded" />
            <span class="font-medium link-primary">{{ repo.fullName }}</span>
            <span class="ml-auto text-[rgb(var(--muted))] shrink-0">{{ formatNumber(repo.stars) }} stars</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { formatNumber, SEARCH_DEBOUNCE_MS } from '@git-wayback/shared'

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

const HISTORY_KEY = 'git-wayback-history'
const MAX_HISTORY = 10

const searchContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const results = ref<SearchResult[]>([])
const isLoading = ref(false)
const showDropdown = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function search() {
  if (searchQuery.value.length < 2) {
    results.value = []
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<{ items: SearchResult[] }>('/api/search', {
      query: { q: searchQuery.value },
    })
    results.value = data.items
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function debouncedSearch() {
  showDropdown.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS)
}

function onResultClick(repo: SearchResult) {
  saveToHistory(repo)
  showDropdown.value = false
  searchQuery.value = ''
  results.value = []
}

function saveToHistory(repo: SearchResult) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: Array<{ fullName: string; avatar: string; visitedAt: string }> = raw ? JSON.parse(raw) : []
    const filtered = history.filter((h) => h.fullName !== repo.fullName)
    filtered.unshift({
      fullName: repo.fullName,
      avatar: repo.owner.avatar,
      visitedAt: new Date().toISOString(),
    })
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
  } catch {
    // ignore localStorage errors
  }
}

function onClickOutside(e: MouseEvent) {
  if (searchContainer.value && !searchContainer.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>
