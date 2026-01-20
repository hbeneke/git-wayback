<template>
  <main class="max-w-6xl mx-auto px-6 py-8">
    <nav class="mb-6">
      <NuxtLink to="/" class="text-brand-primary text-sm hover:text-brand-secondary transition-colors">
        ← Back to search
      </NuxtLink>
    </nav>

    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center py-20">
      <div class="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-2xl mb-2">😕 Repository not found</p>
      <p class="text-gray-500">{{ error.message }}</p>
    </div>

    <!-- Repository Content -->
    <template v-else-if="data">
      <!-- Header -->
      <header class="mb-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-gradient text-3xl font-bold mb-2">{{ data.fullName }}</h1>
            <p v-if="data.description" class="text-gray-600 text-lg">{{ data.description }}</p>
          </div>
          <a
            :href="data.url"
            target="_blank"
            class="shrink-0 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </div>

        <!-- Topics -->
        <div v-if="data.topics?.length" class="flex flex-wrap gap-2 mt-4">
          <span
            v-for="topic in data.topics"
            :key="topic"
            class="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full"
          >
            {{ topic }}
          </span>
        </div>
      </header>

      <!-- Tabs -->
      <div class="mb-8">
        <nav class="flex border-b border-gray-200">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.badge"
              class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"
            >
              {{ tab.badge }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Tab: Overview -->
      <div v-show="activeTab === 'overview'">
        <!-- Stats Cards -->
        <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-yellow-500">⭐ {{ formatNumber(data.stars) }}</div>
            <div class="text-sm text-gray-500">Stars</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-gray-700">🍴 {{ formatNumber(data.forks) }}</div>
            <div class="text-sm text-gray-500">Forks</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-green-600">👁 {{ formatNumber(data.watchers) }}</div>
            <div class="text-sm text-gray-500">Watchers</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div class="text-2xl font-bold text-orange-500">🔓 {{ data.openIssues }}</div>
            <div class="text-sm text-gray-500">Open Issues</div>
          </div>
        </section>

        <!-- Main Grid -->
        <div class="grid lg:grid-cols-3 gap-6">
        <!-- Left Column (2/3) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Languages -->
          <section class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">Languages</h2>
            <div class="h-4 rounded-full overflow-hidden flex mb-4">
              <div
                v-for="(lang, index) in data.languages"
                :key="lang.name"
                :style="{ width: `${lang.percentage}%`, backgroundColor: getLanguageColor(lang.name, index) }"
                :title="`${lang.name}: ${lang.percentage}%`"
                class="h-full transition-all hover:opacity-80"
              ></div>
            </div>
            <div class="flex flex-wrap gap-4">
              <div
                v-for="(lang, index) in data.languages.slice(0, 6)"
                :key="lang.name"
                class="flex items-center gap-2 text-sm"
              >
                <span
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: getLanguageColor(lang.name, index) }"
                ></span>
                <span class="font-medium">{{ lang.name }}</span>
                <span class="text-gray-400">{{ lang.percentage }}%</span>
              </div>
            </div>
          </section>

          <!-- Recent Commits -->
          <section class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">Recent Commits</h2>
            <div class="space-y-3">
              <div
                v-for="commit in data.recentCommits"
                :key="commit.sha"
                class="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0"
              >
                <img
                  v-if="commit.authorAvatar"
                  :src="commit.authorAvatar"
                  :alt="commit.authorName"
                  class="w-8 h-8 rounded-full"
                />
                <div v-else class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                  {{ commit.authorName.charAt(0).toUpperCase() }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ commit.message }}</p>
                  <div class="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span class="font-mono text-brand-primary">{{ commit.shortSha }}</span>
                    <span>•</span>
                    <span>{{ commit.authorLogin || commit.authorName }}</span>
                    <span>•</span>
                    <span>{{ formatRelativeDate(commit.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Commit Activity Chart -->
          <section class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">Commit Activity (Last 30 commits)</h2>
            
            <!-- By Day of Week -->
            <div class="mb-6">
              <h3 class="text-sm font-medium text-gray-500 mb-2">By Day of Week</h3>
              <div class="flex items-end gap-2 h-20">
                <div
                  v-for="(count, index) in data.commitActivity.byDayOfWeek"
                  :key="index"
                  class="flex-1 flex flex-col items-center"
                >
                  <div
                    class="w-full bg-brand-primary rounded-t transition-all"
                    :style="{ height: `${getBarHeight(count, data.commitActivity.byDayOfWeek)}px` }"
                  ></div>
                  <span class="text-xs text-gray-400 mt-1">{{ ['S', 'M', 'T', 'W', 'T', 'F', 'S'][index] }}</span>
                </div>
              </div>
            </div>

            <!-- By Hour -->
            <div>
              <h3 class="text-sm font-medium text-gray-500 mb-2">By Hour of Day</h3>
              <div class="flex items-end gap-px h-16">
                <div
                  v-for="(count, index) in data.commitActivity.byHour"
                  :key="index"
                  class="flex-1 bg-brand-secondary rounded-t transition-all hover:bg-brand-primary"
                  :style="{ height: `${getBarHeight(count, data.commitActivity.byHour)}px` }"
                  :title="`${index}:00 - ${count} commits`"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>0h</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>24h</span>
              </div>
            </div>
          </section>

        </div>

        <!-- Right Column (1/3) -->
        <div class="space-y-6">
          <!-- Repository Info -->
          <section class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">About</h2>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-gray-500">Created</dt>
                <dd class="font-medium">{{ formatDate(data.createdAt) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Last Push</dt>
                <dd class="font-medium">{{ formatRelativeDate(data.pushedAt) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Default Branch</dt>
                <dd class="font-mono text-brand-primary">{{ data.defaultBranch }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Branches</dt>
                <dd class="font-medium">{{ data.branchCount }}</dd>
              </div>
              <div v-if="data.license" class="flex justify-between">
                <dt class="text-gray-500">License</dt>
                <dd class="font-medium">{{ data.license }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">Size</dt>
                <dd class="font-medium">{{ formatSize(data.size) }}</dd>
              </div>
              <div v-if="data.homepage" class="pt-2 border-t border-gray-100">
                <a
                  :href="data.homepage"
                  target="_blank"
                  class="text-brand-primary hover:underline flex items-center gap-1"
                >
                  🔗 {{ formatUrl(data.homepage) }}
                </a>
              </div>
            </dl>
          </section>

          <!-- Contributors -->
          <section class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">Top Contributors</h2>
            <div class="space-y-3">
              <a
                v-for="contributor in data.contributors"
                :key="contributor.login"
                :href="contributor.url"
                target="_blank"
                class="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors"
              >
                <img
                  :src="contributor.avatarUrl"
                  :alt="contributor.login"
                  class="w-8 h-8 rounded-full"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ contributor.login }}</p>
                  <p class="text-xs text-gray-500">{{ contributor.contributions }} commits</p>
                </div>
              </a>
            </div>
          </section>

          <!-- Releases -->
          <section v-if="data.releases?.length" class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-lg font-semibold mb-4">Recent Releases</h2>
            <div class="space-y-3">
              <a
                v-for="release in data.releases"
                :key="release.tag"
                :href="release.url"
                target="_blank"
                class="block hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm font-medium text-brand-primary">{{ release.tag }}</span>
                  <span
                    v-if="release.prerelease"
                    class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded"
                  >
                    Pre-release
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">{{ formatRelativeDate(release.publishedAt) }}</p>
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Tab: Diagram -->
    <div v-show="activeTab === 'diagram'">
      <section class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
        <div class="max-w-lg mx-auto">
          <p class="text-4xl mb-4">🎬</p>
          <h2 class="text-2xl font-bold mb-3">Code Evolution Timelapse</h2>
          <p class="text-gray-500 mb-6">
            An interactive visualization showing how files and code evolved over time. 
            Drag the slider to travel through the repository's history and see how files 
            were created, modified, and how the codebase grew.
          </p>
          <div class="inline-flex items-center gap-2 text-sm bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full">
            <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            Coming Soon
          </div>
        </div>
      </section>
    </div>

    <!-- Tab: Screenshots -->
    <div v-show="activeTab === 'screenshots'">
      <section class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
        <div class="max-w-lg mx-auto">
          <p class="text-4xl mb-4">📸</p>
          <h2 class="text-2xl font-bold mb-3">Visual Screenshots</h2>
          <p class="text-gray-500 mb-6">
            Capture and browse screenshots of the running application at different points in time.
            See how the UI evolved from the first commit to the latest release.
          </p>
          <div class="inline-flex items-center gap-2 text-sm bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full">
            <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            Coming Soon
          </div>
        </div>
      </section>
    </div>
    </template>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

// Tabs
const activeTab = ref<'overview' | 'diagram' | 'screenshots'>('overview')
const tabs = [
  { id: 'overview' as const, label: 'Overview', icon: '📊' },
  { id: 'diagram' as const, label: 'Diagram', icon: '🎬', badge: 'Soon' },
  { id: 'screenshots' as const, label: 'Screenshots', icon: '📸', badge: 'Soon' },
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

// Fetch repository data
const { data, pending, error } = await useFetch<RepoData>(
  () => `/api/repos/${owner.value}/${repo.value}`,
  {
    key: `repo-${owner.value}-${repo.value}`,
  }
)

// Language colors (simplified palette)
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
  // Fallback colors
  const fallback = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6']
  return fallback[index % fallback.length]
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return String(num)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatSize(sizeKb: number): string {
  if (sizeKb >= 1024 * 1024) return `${(sizeKb / (1024 * 1024)).toFixed(1)} GB`
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1)} MB`
  return `${sizeKb} KB`
}

function formatUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function getBarHeight(value: number, array: number[]): number {
  const max = Math.max(...array, 1)
  return Math.round((value / max) * 60)
}

// Dynamic SEO
useSeoMeta({
  title: () => data.value ? `${data.value.fullName} - git-wayback` : 'Loading...',
  description: () => data.value?.description || `Explore ${owner.value}/${repo.value} on git-wayback`,
  ogTitle: () => data.value ? `${data.value.fullName} - git-wayback` : 'Loading...',
  ogDescription: () => data.value?.description || `Explore ${owner.value}/${repo.value} on git-wayback`,
})
</script>
