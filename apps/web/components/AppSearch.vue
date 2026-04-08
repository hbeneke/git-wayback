<template>
  <div ref="containerRef" class="relative flex-1 max-w-md ml-auto">
    <input
      v-model="query"
      type="text"
      placeholder="Search repositories..."
      class="w-full px-3 py-1.5 text-xs bg-transparent border border-[rgb(var(--border))] rounded outline-none transition-colors focus:border-primary placeholder:text-[rgb(var(--muted))]"
      @input="onInput"
      @focus="isOpen = true"
    />
    <div
      v-if="isLoading"
      class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin"
    />

    <div
      v-if="isOpen && results.length > 0"
      class="absolute top-full left-0 right-0 mt-1 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded shadow-lg max-h-64 overflow-y-auto"
    >
      <NuxtLink
        v-for="repo in results"
        :key="repo.id"
        :to="`/${repo.fullName}`"
        class="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[rgb(var(--border)/.2)] transition-colors"
        @click="onSelect(repo)"
      >
        <img :src="repo.owner.avatar" :alt="repo.owner.login" class="w-4 h-4 rounded" />
        <span class="font-medium link-primary">{{ repo.fullName }}</span>
        <span class="ml-auto text-[rgb(var(--muted))] shrink-0">{{ formatNumber(repo.stars) }} stars</span>
      </NuxtLink>
    </div>
  </div>
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

const containerRef = ref<HTMLElement | null>(null)
const query = ref('')
const results = ref<SearchResult[]>([])
const isLoading = ref(false)
const isOpen = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function search() {
  if (query.value.length < 2) {
    results.value = []
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<{ items: SearchResult[] }>('/api/search', {
      query: { q: query.value },
    })
    results.value = data.items
  } catch {
    results.value = []
  } finally {
    isLoading.value = false
  }
}

function onInput() {
  isOpen.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS)
}

function onSelect(repo: SearchResult) {
  saveToHistory(repo)
  isOpen.value = false
  query.value = ''
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
    // localStorage unavailable
  }
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
