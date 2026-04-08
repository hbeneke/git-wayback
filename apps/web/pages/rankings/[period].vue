<template>
  <main class="max-w-3xl mx-auto px-4 sm:px-8 pt-8 pb-12">
    <NuxtLink to="/" class="text-xs link-primary mb-4 inline-block">&larr; Back to home</NuxtLink>

    <h1 class="text-lg font-semibold mb-6">{{ pageTitle }}</h1>

    <ul v-if="repos.length > 0">
      <li v-for="(repo, i) in repos" :key="repo.repoFullName" class="flex items-center gap-3 py-2">
        <span class="text-[10px] text-[rgb(var(--muted))] w-5 text-right shrink-0">{{ i + 1 }}</span>
        <img
          v-if="repo.repoAvatar"
          :src="repo.repoAvatar"
          :alt="repo.repoFullName"
          class="w-5 h-5 rounded"
        />
        <NuxtLink :to="`/${repo.repoFullName}`" class="flex-1 min-w-0">
          <span class="text-xs link-primary truncate block">{{ repo.repoFullName }}</span>
        </NuxtLink>
        <span class="text-[10px] text-[rgb(var(--muted))] shrink-0">{{ formatNumber(repo.visits) }} visits</span>
      </li>
    </ul>
    <p v-else class="text-xs text-[rgb(var(--muted))]">No data yet.</p>
  </main>
</template>

<script setup lang="ts">
import { formatNumber } from '@git-wayback/shared'

const route = useRoute()
const period = computed(() => route.params.period as string)

const validPeriods: Record<string, string> = {
  popular: 'Most popular',
  month: 'Popular this month',
  week: 'Popular this week',
}

const pageTitle = computed(() => validPeriods[period.value] || 'Rankings')

interface RankedRepo {
  repoFullName: string
  repoAvatar: string | null
  visits: number
}

const { data } = await useFetch<RankedRepo[]>(
  () => `/api/rankings/${period.value}`
)

const repos = computed(() => data.value ?? [])

useSeoMeta({
  title: () => `${pageTitle.value} — git-wayback`,
})
</script>
