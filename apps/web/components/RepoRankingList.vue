<script setup lang="ts">
import { formatNumber } from '@git-wayback/shared'

interface RankedRepo {
  repoFullName: string
  repoAvatar: string | null
  visits: number
}

const props = defineProps<{
  title: string
  repos: RankedRepo[]
  limit?: number
  viewAllLink?: string
  emptyMessage?: string
}>()

const displayLimit = computed(() => props.limit ?? 5)
const visibleRepos = computed(() => props.repos.slice(0, displayLimit.value))
const hasMore = computed(() => props.repos.length > displayLimit.value)
</script>

<template>
  <section>
    <h2 class="section-title mb-3">{{ title }}</h2>
    <ul v-if="visibleRepos.length > 0">
      <li v-for="(repo, i) in visibleRepos" :key="repo.repoFullName" class="flex items-center gap-3 py-2">
        <span class="text-[10px] text-[rgb(var(--muted))] w-4 text-right shrink-0">{{ i + 1 }}</span>
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
    <p v-else class="text-xs text-[rgb(var(--muted))]">{{ emptyMessage || 'No data yet.' }}</p>
    <NuxtLink
      v-if="hasMore && viewAllLink"
      :to="viewAllLink"
      class="text-xs link-primary mt-2 inline-block"
    >
      View all &rarr;
    </NuxtLink>
  </section>
</template>
