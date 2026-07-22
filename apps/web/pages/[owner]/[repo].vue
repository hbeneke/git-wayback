<template>
  <main class="max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-12">
    <!-- Loading -->
    <div v-if="pending" class="py-20 text-center">
      <AppSpinner size="sm" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-20">
      <p class="text-sm text-[rgb(var(--muted))]">Repository not found.</p>
      <p class="text-xs text-[rgb(var(--muted))] mt-1">{{ error.message }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <!-- Header -->
      <header class="mb-8">
        <div class="flex items-start gap-3">
          <img
            :src="`https://github.com/${owner}.png`"
            :alt="`${owner} avatar`"
            class="w-10 h-10 rounded shrink-0 mt-0.5 border border-[rgb(var(--border)/.5)]"
            loading="lazy"
            decoding="async"
          />
          <div class="min-w-0">
            <h1 class="text-xl font-semibold leading-tight truncate">
              <span class="text-[rgb(var(--muted))] font-normal">{{ owner }}/</span>{{ data.name }}
            </h1>
            <p v-if="data.description" class="text-sm text-[rgb(var(--muted))] mt-1">{{ data.description }}</p>
          </div>
          <span
            v-if="data.archived"
            class="ml-auto shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400"
          >
            archived
          </span>
        </div>

        <!-- Plain counters, not links: GitHub 404s /stargazers and /watchers
             when the count is 0, which is most repositories. -->
        <div class="flex flex-wrap items-center gap-2 mt-4">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[rgb(var(--border)/.5)] bg-[rgb(var(--border)/.15)] text-xs"
          >
            <svg
              width="12" height="12" viewBox="0 0 16 16"
              :fill="stat.filled ? 'currentColor' : 'none'"
              stroke="currentColor"
              :stroke-width="stat.filled ? 0 : 1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="stat.iconClass"
              aria-hidden="true"
            >
              <path :d="stat.icon" />
              <circle v-for="c in stat.circles || []" :key="c.cx" :cx="c.cx" :cy="c.cy" r="1.8" />
            </svg>
            <span class="font-semibold tabular-nums">{{ formatNumber(stat.value) }}</span>
            <span class="text-[rgb(var(--muted))]">{{ stat.label }}</span>
          </div>

          <a
            :href="data.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-primary/40 text-xs text-primary transition-colors hover:bg-primary hover:text-[rgb(var(--bg))]"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            <span>github</span>
          </a>
        </div>

        <div v-if="data.topics?.length" class="flex flex-wrap gap-1.5 mt-3">
          <span
            v-for="topic in data.topics"
            :key="topic"
            class="text-xs px-1.5 py-0.5 rounded bg-[rgb(var(--border)/.3)] text-[rgb(var(--muted))]"
          >
            {{ topic }}
          </span>
        </div>
      </header>

      <TabPanel v-model="activeTab" :tabs="tabs">
        <template #evolution>
          <ErrorBoundary
            title="Visualization Error"
            message="Failed to render the repository evolution diagram."
          >
            <RepoDiagram
              :owner="owner"
              :repo="repo"
              :branches="data?.branches || []"
              :default-branch="data?.defaultBranch || ''"
            />
          </ErrorBoundary>
        </template>

        <template #details>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Main column: commits + activity -->
            <div class="lg:col-span-2 space-y-8">
              <!-- Recent Commits -->
              <section>
                <h2 class="section-title mb-3">Recent commits</h2>
                <div class="space-y-2">
                  <div
                    v-for="commit in data.recentCommits"
                    :key="commit.sha"
                    class="flex items-start gap-2"
                  >
                    <span class="text-primary text-xs font-medium shrink-0 min-w-[60px]">{{ commit.shortSha }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs truncate">{{ commit.message }}</p>
                      <div class="flex items-center gap-1.5 text-xs text-[rgb(var(--muted))] mt-0.5">
                        <span>{{ commit.authorLogin || commit.authorName }}</span>
                        <span>&middot;</span>
                        <span>{{ formatRelativeDate(commit.date) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <hr class="divider" />

              <!-- Commit Activity -->
              <section>
                <h2 class="section-title mb-3">Activity</h2>

                <div class="mb-5">
                  <h3 class="text-xs text-[rgb(var(--muted))] mb-2">By day</h3>
                  <ActivityChart
                    :points="data.commitActivity.byDayOfWeek"
                    :labels="['Sun','Mon','Tue','Wed','Thu','Fri','Sat']"
                    :tooltip-label="(i) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]"
                    :height="64"
                  />
                </div>

                <div>
                  <h3 class="text-xs text-[rgb(var(--muted))] mb-2">By hour</h3>
                  <ActivityChart
                    :points="data.commitActivity.byHour"
                    :labels="['0h','6h','12h','18h','24h']"
                    :tooltip-label="(i) => `${String(i).padStart(2, '0')}:00`"
                    :height="56"
                  />
                </div>
              </section>
            </div>

            <!-- Sidebar column: about, languages, contributors, releases -->
            <aside class="space-y-8">
              <!-- About -->
              <section>
                <h2 class="section-title mb-3">About</h2>
                <dl class="space-y-1.5 text-xs">
                  <div class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">Created</dt>
                    <dd>{{ formatDate(data.createdAt) }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">Last push</dt>
                    <dd>{{ formatRelativeDate(data.pushedAt) }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">Default branch</dt>
                    <dd class="text-primary">{{ data.defaultBranch }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">Branches</dt>
                    <dd>{{ data.branchCount }}</dd>
                  </div>
                  <div v-if="data.license" class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">License</dt>
                    <dd>{{ data.license }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-[rgb(var(--muted))]">Size</dt>
                    <dd>{{ formatSize(data.size) }}</dd>
                  </div>
                  <div v-if="data.homepage">
                    <a :href="data.homepage" target="_blank" class="link-primary text-xs">
                      {{ formatUrl(data.homepage) }}
                    </a>
                  </div>
                </dl>
              </section>

              <hr class="divider" />

              <!-- Languages -->
              <section>
                <h2 class="section-title mb-3">Languages</h2>
                <div class="h-1.5 rounded-full overflow-hidden flex mb-3">
                  <div
                    v-for="(lang, index) in data.languages"
                    :key="lang.name"
                    :style="{ width: `${lang.percentage}%`, backgroundColor: getLanguageColor(lang.name, index) }"
                    class="h-full"
                  />
                </div>
                <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <div
                    v-for="(lang, index) in data.languages.slice(0, 6)"
                    :key="lang.name"
                    class="flex items-center gap-1.5"
                  >
                    <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: getLanguageColor(lang.name, index) }" />
                    <span>{{ lang.name }}</span>
                    <span class="text-[rgb(var(--muted))]">{{ lang.percentage }}%</span>
                  </div>
                </div>
              </section>

              <hr class="divider" />

              <!-- Contributors -->
              <section>
                <h2 class="section-title mb-3">Contributors</h2>
                <div class="space-y-1.5">
                  <a
                    v-for="contributor in data.contributors"
                    :key="contributor.login"
                    :href="contributor.url"
                    target="_blank"
                    class="flex items-center gap-2 text-xs group"
                  >
                    <img :src="contributor.avatarUrl" :alt="contributor.login" class="w-5 h-5 rounded" />
                    <span class="link-primary">{{ contributor.login }}</span>
                    <span class="text-[rgb(var(--muted))]">{{ contributor.contributions }}</span>
                  </a>
                </div>
              </section>

              <!-- Releases -->
              <template v-if="data.releases?.length">
                <hr class="divider" />
                <section>
                  <h2 class="section-title mb-3">Releases</h2>
                  <div class="space-y-1.5">
                    <a
                      v-for="release in data.releases"
                      :key="release.tag"
                      :href="release.url"
                      target="_blank"
                      class="flex items-center gap-2 text-xs"
                    >
                      <span class="text-primary font-medium">{{ release.tag }}</span>
                      <span v-if="release.prerelease" class="text-secondary">pre</span>
                      <span class="text-[rgb(var(--muted))]">{{ formatRelativeDate(release.publishedAt) }}</span>
                    </a>
                  </div>
                </section>
              </template>
            </aside>
          </div>
        </template>

        <template #screenshots>
          <section class="py-12 text-center">
            <p class="text-xs text-[rgb(var(--muted))]">
              Visual screenshots of the application at different points in time.
            </p>
            <p class="text-xs text-secondary mt-2">Coming soon</p>
          </section>
        </template>
      </TabPanel>
    </template>
  </main>
</template>

<script setup lang="ts">
import {
  formatNumber,
  formatDate,
  formatRelativeDate,
  formatSize,
  formatUrl,
} from '@git-wayback/shared'

const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

const activeTab = ref<'details' | 'evolution' | 'screenshots'>('details')
const tabs = [
  { id: 'details' as const, label: 'details' },
  { id: 'evolution' as const, label: 'evolution' },
  { id: 'screenshots' as const, label: 'screenshots', badge: 'soon' },
]

interface RepoData {
  id: number
  name: string
  fullName: string
  description: string | null
  url: string
  homepage: string | null
  stars: number
  watchers: number
  forks: number
  openIssues: number
  size: number
  defaultBranch: string
  license: string | null
  topics: string[]
  visibility: string
  archived: boolean
  createdAt: string
  updatedAt: string
  pushedAt: string
  languages: Array<{ name: string; bytes: number; percentage: number }>
  contributors: Array<{ login: string; avatarUrl: string; contributions: number; url: string }>
  recentCommits: Array<{
    sha: string
    shortSha: string
    message: string
    authorName: string
    authorLogin?: string
    authorAvatar?: string
    date: string
  }>
  branches: string[]
  branchCount: number
  releases: Array<{ tag: string; name: string; publishedAt: string; url: string; prerelease: boolean }>
  commitActivity: {
    byDayOfWeek: number[]
    byHour: number[]
    byMonth: Record<string, number>
  }
}

const { data, pending, error } = await useFetch<RepoData>(
  () => `/api/repos/${owner.value}/${repo.value}`,
  {
    key: `repo-${owner.value}-${repo.value}`,
  }
)

/** Counter chips in the page header. */
const stats = computed(() => {
  if (!data.value) return []
  return [
    {
      label: 'stars',
      value: data.value.stars,
      filled: true,
      iconClass: 'text-secondary',
      icon: 'M8 .8l2.2 4.46 4.92.72-3.56 3.47.84 4.9L8 12.03l-4.4 2.32.84-4.9L.88 5.98l4.92-.72L8 .8Z',
    },
    {
      label: 'forks',
      value: data.value.forks,
      iconClass: 'text-primary',
      icon: 'M5 4.8v.7A2.5 2.5 0 0 0 7.5 8h1A2.5 2.5 0 0 0 11 5.5v-.7M8 8v3.2',
      circles: [
        { cx: 5, cy: 3 },
        { cx: 11, cy: 3 },
        { cx: 8, cy: 13 },
      ],
    },
    {
      label: 'watchers',
      value: data.value.watchers,
      iconClass: 'text-[rgb(var(--muted))]',
      icon: 'M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z M8 9.8A1.8 1.8 0 1 0 8 6.2a1.8 1.8 0 0 0 0 3.6Z',
    },
  ]
})

onMounted(() => {
  if (!data.value) return
  $fetch('/api/visits', {
    method: 'POST',
    body: {
      repoFullName: data.value.fullName,
      repoAvatar: `https://github.com/${owner.value}.png`,
    },
  }).catch(() => {})
})

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#239120',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Vue: '#41b883',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Shell: '#89e051',
  Dart: '#00B4AB',
}

function getLanguageColor(name: string, index: number): string {
  if (languageColors[name]) return languageColors[name]
  const fallbackColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']
  return fallbackColors[index % fallbackColors.length]
}

useSeoMeta({
  title: () => data.value ? `${data.value.fullName} — git-wayback` : 'Loading...',
  description: () => data.value?.description || `Explore ${owner.value}/${repo.value} on git-wayback`,
  ogTitle: () => data.value ? `${data.value.fullName} — git-wayback` : 'Loading...',
  ogDescription: () => data.value?.description || `Explore ${owner.value}/${repo.value} on git-wayback`,
})
</script>
