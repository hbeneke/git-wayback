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

          <button
            type="button"
            :disabled="refreshDisabled"
            :title="refreshTitle"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors disabled:cursor-default"
            :class="justUpdated
              ? 'border-emerald-500/50 text-emerald-400'
              : 'border-[rgb(var(--border)/.5)] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))] disabled:opacity-50'"
            @click="refreshData"
          >
            <!-- Checkmark while the confirmation is up, arrow otherwise. -->
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
              :class="refreshing ? 'animate-spin' : ''"
              aria-hidden="true"
            >
              <template v-if="justUpdated">
                <path d="M3 8.5 6.5 12 13 4.5" />
              </template>
              <template v-else>
                <path d="M14 8a6 6 0 1 1-1.76-4.24" />
                <path d="M14 2v4h-4" />
              </template>
            </svg>
            <span class="tabular-nums">{{ refreshLabel }}</span>
          </button>
        </div>

        <p v-if="refreshError" class="text-xs text-amber-400 mt-2">{{ refreshError }}</p>

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
              :force-refresh="diagramNeedsRefresh"
              @refresh-consumed="diagramNeedsRefresh = false"
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
                    <!-- GitHub builds commit pages as <repo>/commit/<sha>, so the
                         link needs no extra field from the API. -->
                    <a
                      :href="`${data.url}/commit/${commit.sha}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      :title="`View ${commit.shortSha} on GitHub`"
                      class="text-primary text-xs font-medium shrink-0 min-w-[60px] hover:underline"
                    >
                      {{ commit.shortSha }}
                    </a>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start gap-1.5">
                        <p class="text-xs flex-1 min-w-0" :class="expandedCommits.has(commit.sha) ? '' : 'truncate'">
                          {{ commit.message }}
                        </p>
                        <!-- Only commits that carry a body get a toggle. -->
                        <button
                          v-if="commit.body"
                          type="button"
                          class="shrink-0 w-4 h-4 leading-none flex items-center justify-center rounded border border-[rgb(var(--border)/.5)] text-[10px] text-[rgb(var(--muted))] transition-colors hover:text-[rgb(var(--foreground))] hover:border-[rgb(var(--border))]"
                          :aria-expanded="expandedCommits.has(commit.sha)"
                          :aria-label="expandedCommits.has(commit.sha) ? 'Collapse commit message' : 'Expand commit message'"
                          @click="toggleCommit(commit.sha)"
                        >
                          {{ expandedCommits.has(commit.sha) ? '−' : '+' }}
                        </button>
                      </div>
                      <pre
                        v-if="commit.body && expandedCommits.has(commit.sha)"
                        class="text-xs text-[rgb(var(--muted))] whitespace-pre-wrap break-words mt-1"
                      >{{ commit.body }}</pre>
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
                <div class="flex items-baseline gap-2 mb-3">
                  <h2 class="section-title">Activity</h2>
                  <!-- Says which commits this covers: it is the fetched page,
                       not the repository's whole history. -->
                  <span class="text-[10px] text-[rgb(var(--muted))]">
                    last {{ data.commitActivity.sampleSize }} commits &middot; UTC
                  </span>
                </div>

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
  FORCE_REFRESH_MIN_AGE_MS,
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
  { id: 'details' as const, label: 'details', icon: 'doc' as const },
  { id: 'evolution' as const, label: 'evolution', icon: 'branch' as const },
  { id: 'screenshots' as const, label: 'screenshots', badge: 'soon', icon: 'image' as const },
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
    body: string
    authorName: string
    authorLogin?: string
    authorAvatar?: string
    date: string
  }>
  fetchedAt: string
  branches: string[]
  branchCount: number
  releases: Array<{ tag: string; name: string; publishedAt: string; url: string; prerelease: boolean }>
  commitActivity: {
    byDayOfWeek: number[]
    byHour: number[]
    sampleSize: number
  }
}

const { data, pending, error, refresh } = await useFetch<RepoData>(
  () => `/api/repos/${owner.value}/${repo.value}`,
  {
    key: `repo-${owner.value}-${repo.value}`,
  }
)

// Matches the one-second `animate-spin` cycle: the icon stops on a whole turn.
const SPINNER_MIN_MS = 1000

// Below this the server ignores a forced refresh anyway (FORCE_REFRESH_MIN_AGE_MS),
// so the button stays locked for exactly as long as a click would be wasted.
// The real quota guard is server-side: 5/h per IP and 60/h across all callers.
const REFRESH_COOLDOWN_MS = FORCE_REFRESH_MIN_AGE_MS
// How long the green "updated" confirmation stays up before the countdown shows.
const UPDATED_BADGE_MS = 3000

const refreshing = ref(false)
const refreshError = ref<string | null>(null)
const justUpdated = ref(false)
const cooldownLeft = ref(0)

let cooldownTimer: ReturnType<typeof setInterval> | null = null
let updatedTimer: ReturnType<typeof setTimeout> | null = null

function startCooldown(ms: number) {
  cooldownLeft.value = Math.ceil(ms / 1000)

  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldownLeft.value--
    if (cooldownLeft.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
  if (updatedTimer) clearTimeout(updatedTimer)
})

const refreshDisabled = computed(() => refreshing.value || cooldownLeft.value > 0)

const refreshLabel = computed(() => {
  if (refreshing.value) return 'refreshing'
  if (justUpdated.value) return 'updated'
  if (cooldownLeft.value > 0) return `refresh ${cooldownLeft.value}s`
  return 'refresh'
})
// The diagram loads on demand, so a refresh made here is handed to it as a
// pending flag and spent on its next load rather than re-fetching now.
const diagramNeedsRefresh = ref(false)

const refreshTitle = computed(() =>
  data.value ? `Data from ${formatRelativeDate(data.value.fetchedAt)} — fetch again from GitHub` : 'Fetch again from GitHub'
)

async function refreshData() {
  if (refreshDisabled.value) return
  refreshing.value = true
  refreshError.value = null
  justUpdated.value = false

  let succeeded = false

  // A cache hit returns too fast to see, which reads as a dead button. Hold the
  // spinner for one full turn of the animation so the click is acknowledged.
  const spin = new Promise((resolve) => setTimeout(resolve, SPINNER_MIN_MS))

  try {
    // Rebuilds the shared server cache entry; the useFetch call after it then
    // reads the fresh value. `_` stops a CDN from answering the refresh itself.
    await $fetch(`/api/repos/${owner.value}/${repo.value}`, {
      query: { refresh: '1', _: Date.now() },
    })
    diagramNeedsRefresh.value = true
    await refresh()
    succeeded = true
  } catch (err: unknown) {
    // 429 here is the refresh budget, not a failure of the page.
    const status = (err as { statusCode?: number })?.statusCode
    refreshError.value =
      status === 429
        ? 'Refresh limit reached. Try again later.'
        : 'Could not refresh right now.'
  } finally {
    // Held after a failure too — retrying immediately would only burn budget.
    startCooldown(REFRESH_COOLDOWN_MS)

    // In the finally so a 429 does not flash its message either. The success
    // state lands only after the spin: swapping the icon while it is still
    // turning renders a spinning checkmark.
    await spin
    refreshing.value = false

    if (succeeded) {
      justUpdated.value = true
      if (updatedTimer) clearTimeout(updatedTimer)
      updatedTimer = setTimeout(() => {
        justUpdated.value = false
      }, UPDATED_BADGE_MS)
    }
  }
}

const expandedCommits = ref(new Set<string>())

function toggleCommit(sha: string) {
  // New Set so the template re-renders.
  const next = new Set(expandedCommits.value)
  if (!next.delete(sha)) next.add(sha)
  expandedCommits.value = next
}

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
  // The avatar is derived server-side from the owner — sending it from here
  // would just be a URL the server has to distrust anyway.
  $fetch('/api/visits', {
    method: 'POST',
    body: { repoFullName: data.value.fullName },
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
