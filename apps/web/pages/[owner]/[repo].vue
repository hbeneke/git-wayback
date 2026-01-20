<template>
  <main class="max-w-4xl mx-auto px-6 py-8">
    <nav class="mb-8">
      <NuxtLink to="/" class="text-brand-primary text-sm hover:text-brand-secondary transition-colors">
        ← Back to search
      </NuxtLink>
    </nav>

    <header class="mb-8">
      <h1 class="text-gradient text-3xl font-bold mb-2">{{ owner }}/{{ repo }}</h1>
      <p class="text-gray-500">Visual history of this repository</p>
    </header>

    <!-- Analysis Not Started -->
    <section
      v-if="analysisStatus === 'not_found'"
      class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center"
    >
      <p class="text-2xl mb-4">� Coming Soon</p>
      <p class="text-gray-500 mb-6">
        We're working on a feature to capture visual snapshots of this repository at different points in time.
      </p>
      <button
        disabled
        class="bg-gray-300 text-gray-500 px-6 py-3 rounded-lg cursor-not-allowed"
      >
        Start Analysis (Coming Soon)
      </button>
    </section>

    <!-- Analysis In Progress -->
    <section
      v-else-if="isAnalyzing"
      class="bg-gray-50 border-2 border-gray-200 rounded-xl p-8"
    >
      <div class="flex items-center gap-4 mb-4">
        <div class="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full"></div>
        <p class="text-lg font-medium">{{ statusMessage }}</p>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          class="bg-gradient-to-r from-brand-primary to-brand-secondary h-full transition-all duration-500"
          :style="{ width: `${analysisProgress}%` }"
        ></div>
      </div>
      <p class="text-sm text-gray-500 mt-2">{{ analysisProgress }}% complete</p>
    </section>

    <!-- Analysis Failed -->
    <section
      v-else-if="analysisStatus === 'failed'"
      class="bg-red-50 border-2 border-red-200 rounded-xl p-8 text-center"
    >
      <p class="text-2xl mb-2">❌ Analysis Failed</p>
      <p class="text-red-600 mb-4">{{ statusMessage }}</p>
      <button
        @click="startAnalysis"
        class="bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-brand-secondary transition-colors"
      >
        Retry Analysis
      </button>
    </section>

    <!-- Analysis Completed - Show Screenshots -->
    <section v-else-if="analysisStatus === 'completed' && screenshots.length > 0">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-semibold">Repository Evolution</h2>
        <span class="text-sm text-gray-500">{{ screenshots.length }} snapshots</span>
      </div>

      <div class="grid gap-6">
        <div
          v-for="(screenshot, index) in screenshots"
          :key="screenshot.id"
          class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <div class="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span class="font-mono text-sm text-brand-primary">{{ screenshot.commitSha.substring(0, 7) }}</span>
              <span v-if="commits[index]" class="text-gray-600 ml-2 text-sm">
                {{ truncateMessage(commits[index].message) }}
              </span>
            </div>
            <span v-if="commits[index]" class="text-xs text-gray-400">
              {{ formatDate(commits[index].authorDate) }}
            </span>
          </div>
          <img
            :src="screenshot.url"
            :alt="`Screenshot at commit ${screenshot.commitSha.substring(0, 7)}`"
            class="w-full"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

// Analysis state
const analysisStatus = ref<string>('not_found')
const analysisProgress = ref(0)
const statusMessage = ref('')
const isStarting = ref(false)

// Results
const screenshots = ref<Array<{ id: string; commitSha: string; url: string }>>([])
const commits = ref<Array<{ message: string; authorDate: string }>>([])

const isAnalyzing = computed(() =>
  ['pending', 'cloning', 'analyzing', 'screenshots'].includes(analysisStatus.value)
)

// Polling interval
let pollInterval: ReturnType<typeof setInterval> | null = null

// Check analysis status
async function checkStatus() {
  try {
    const response = await $fetch('/api/analysis/status', {
      query: { owner: owner.value, repo: repo.value },
    })

    analysisStatus.value = response.status
    analysisProgress.value = response.progress
    statusMessage.value = response.message

    if ('result' in response && response.result) {
      const result = response.result as { screenshots?: Array<{ id: string; commitSha: string; url: string }>; commits?: Array<{ message: string; authorDate: string }> }
      screenshots.value = result.screenshots || []
      commits.value = result.commits || []
    }

    // Stop polling if analysis is complete or failed
    if (response.status === 'completed' || response.status === 'failed') {
      stopPolling()
    }
  } catch (error) {
    console.error('Failed to check status:', error)
  }
}

// Start analysis
async function startAnalysis() {
  isStarting.value = true
  try {
    await $fetch('/api/analysis/start', {
      method: 'POST',
      body: { owner: owner.value, repo: repo.value },
    })
    analysisStatus.value = 'pending'
    startPolling()
  } catch (error) {
    console.error('Failed to start analysis:', error)
    analysisStatus.value = 'failed'
    statusMessage.value = 'Failed to start analysis'
  } finally {
    isStarting.value = false
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(checkStatus, 2000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Helpers
function truncateMessage(message: string, maxLength = 60) {
  const firstLine = message.split('\n')[0]
  return firstLine.length > maxLength
    ? firstLine.substring(0, maxLength) + '...'
    : firstLine
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Initial check and cleanup
onMounted(() => {
  checkStatus()
})

onUnmounted(() => {
  stopPolling()
})

// If analysis is in progress when page loads, start polling
watch(analysisStatus, (status) => {
  if (['pending', 'cloning', 'analyzing', 'screenshots'].includes(status)) {
    startPolling()
  }
})

// Dynamic SEO
useSeoMeta({
  title: () => `${owner.value}/${repo.value} - git-wayback`,
  description: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
  ogTitle: () => `${owner.value}/${repo.value} - git-wayback`,
  ogDescription: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
  twitterTitle: () => `${owner.value}/${repo.value} - git-wayback`,
  twitterDescription: () =>
    `Explore the evolution of ${owner.value}/${repo.value} on GitHub. Visualize commits, contributors, and project history.`,
})
</script>
