<template>
  <main class="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-12">
    <p class="text-sm text-[rgb(var(--muted))] mb-8">
      Visualize the evolution of any GitHub repository.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      <section>
        <h2 class="section-title mb-3">Recent repositories</h2>
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
        <p v-else class="text-xs text-[rgb(var(--muted))]">
          Search for a repository to get started.
        </p>
      </section>

      <RepoRankingList
        title="Most popular"
        :repos="rankings?.popular ?? []"
        empty-message="No visits recorded yet."
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <RepoRankingList
        title="Popular this month"
        :repos="rankings?.popularMonth ?? []"
        empty-message="No visits this month."
      />
      <RepoRankingList
        title="Popular this week"
        :repos="rankings?.popularWeek ?? []"
        empty-message="No visits this week."
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { formatRelativeDate } from '@git-wayback/shared'

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

interface HistoryEntry {
  fullName: string
  avatar: string
  visitedAt: string
}

interface RankedRepo {
  repoFullName: string
  repoAvatar: string | null
  visits: number
}

interface Rankings {
  popular: RankedRepo[]
  popularMonth: RankedRepo[]
  popularWeek: RankedRepo[]
}

const HISTORY_KEY = 'git-wayback-history'
const history = ref<HistoryEntry[]>([])

const { data: rankings } = await useFetch<Rankings>('/api/rankings')

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
</script>
