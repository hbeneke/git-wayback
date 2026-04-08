<template>
  <main class="max-w-3xl mx-auto px-4 sm:px-8 pt-8 pb-12">
    <NuxtLink to="/" class="text-xs link-primary mb-4 inline-block">&larr; Back to home</NuxtLink>

    <h1 class="text-lg font-semibold mb-6">Recent repositories</h1>

    <ul v-if="history.length > 0">
      <li v-for="repo in history" :key="repo.fullName" class="flex items-center gap-3 py-2">
        <img :src="repo.avatar" :alt="repo.fullName" class="w-5 h-5 rounded" />
        <NuxtLink :to="`/${repo.fullName}`" class="flex-1 min-w-0">
          <span class="text-xs link-primary truncate block">{{ repo.fullName }}</span>
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
    <p v-else class="text-xs text-[rgb(var(--muted))]">No recent repositories.</p>
  </main>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '@git-wayback/shared'

const HISTORY_KEY = 'git-wayback-history'

interface HistoryEntry {
  fullName: string
  avatar: string
  visitedAt: string
}

const history = ref<HistoryEntry[]>([])

onMounted(() => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) history.value = JSON.parse(raw)
  } catch {
    history.value = []
  }
})

function removeFromHistory(fullName: string) {
  history.value = history.value.filter((h) => h.fullName !== fullName)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

useSeoMeta({ title: 'Recent repositories — git-wayback' })
</script>
