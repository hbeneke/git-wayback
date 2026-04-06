<template>
  <main class="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-12">
    <!-- Loading -->
    <div v-if="pending" class="py-20 text-center">
      <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin" />
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
        <h1 class="text-xl font-semibold">{{ data.fullName }}</h1>
        <p v-if="data.description" class="text-sm text-[rgb(var(--muted))] mt-1">{{ data.description }}</p>
        <div class="flex items-center gap-4 mt-3 text-xs text-[rgb(var(--muted))]">
          <span>{{ formatNumber(data.stars) }} stars</span>
          <span>&middot;</span>
          <span>{{ formatNumber(data.forks) }} forks</span>
          <span>&middot;</span>
          <span>{{ formatNumber(data.watchers) }} watchers</span>
          <span>&middot;</span>
          <a :href="data.url" target="_blank" class="link-primary">github</a>
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

      <!-- Navigation -->
      <nav class="flex divide-x divider mb-8 text-xs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-3 py-1 first:pl-0 transition-colors',
            activeTab === tab.id
              ? 'text-primary font-bold'
              : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]'
          ]"
        >
          {{ tab.label }}
          <span v-if="tab.badge" class="text-secondary ml-1">{{ tab.badge }}</span>
        </button>
      </nav>

      <!-- Tab: Evolution -->
      <div v-show="activeTab === 'evolution'">
        <ErrorBoundary
          title="Visualization Error"
          message="Failed to render the repository evolution diagram."
          icon="!"
        >
          <RepoDiagram :owner="owner" :repo="repo" />
        </ErrorBoundary>
      </div>

      <!-- Tab: Details -->
      <div v-show="activeTab === 'details'" class="space-y-8">

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
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
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

          <div class="mb-4">
            <h3 class="text-xs text-[rgb(var(--muted))] mb-2">By day</h3>
            <div class="flex items-end gap-1 h-12">
              <div
                v-for="(count, index) in data.commitActivity.byDayOfWeek"
                :key="index"
                class="flex-1 flex flex-col items-center"
              >
                <div
                  class="w-full bg-primary rounded-sm transition-all"
                  :style="{ height: `${getBarHeight(count, data.commitActivity.byDayOfWeek)}px` }"
                />
                <span class="text-[10px] text-[rgb(var(--muted))] mt-1">{{ ['S','M','T','W','T','F','S'][index] }}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-xs text-[rgb(var(--muted))] mb-2">By hour</h3>
            <div class="flex items-end gap-px h-10">
              <div
                v-for="(count, index) in data.commitActivity.byHour"
                :key="index"
                class="flex-1 bg-secondary/60 rounded-sm transition-all hover:bg-primary"
                :style="{ height: `${getBarHeight(count, data.commitActivity.byHour)}px` }"
                :title="`${index}:00 — ${count} commits`"
              />
            </div>
            <div class="flex justify-between text-[10px] text-[rgb(var(--muted))] mt-1">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
              <span>18h</span>
              <span>24h</span>
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
              <span class="text-[rgb(var(--muted))]">{{ contributor.contributions }} commits</span>
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
      </div>

      <!-- Tab: Screenshots -->
      <div v-show="activeTab === 'screenshots'">
        <section class="py-12 text-center">
          <p class="text-xs text-[rgb(var(--muted))]">
            Visual screenshots of the application at different points in time.
          </p>
          <p class="text-xs text-secondary mt-2">Coming soon</p>
        </section>
      </div>
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
  getBarHeight,
} from '@git-wayback/shared'

const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

const activeTab = ref<'evolution' | 'details' | 'screenshots'>('evolution')
const tabs = [
  { id: 'evolution' as const, label: 'evolution' },
  { id: 'details' as const, label: 'details' },
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
