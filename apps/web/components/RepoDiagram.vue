<template>
  <div class="repo-diagram">
    <!-- Idle (pre-load): config + big play button, like a video before it starts.
         Client-only: interactive config + props from useFetch would otherwise
         drift between SSR and client and trigger hydration mismatches. -->
    <ClientOnly v-if="!started">
      <div class="w-full h-[500px] flex flex-col items-center justify-center border border-[rgb(var(--border))] rounded bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]">
      <div class="min-w-[320px] bg-bg/55 border border-[rgb(var(--border))] rounded-md overflow-hidden" @click.stop>
        <div class="flex flex-col gap-2.5 pt-[18px] px-[18px] pb-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))]">Source</span>
            <div class="inline-flex border border-[rgb(var(--border))] rounded overflow-hidden">
              <button
                type="button"
                class="py-1 px-2.5 text-[11px] text-[rgb(var(--muted))] bg-transparent border-r border-[rgb(var(--border))] last:border-r-0 transition-colors"
                :class="source === 'tags' ? 'bg-primary text-bg' : 'hover:text-fg'"
                @click="source = 'tags'"
              >Tags</button>
              <button
                type="button"
                class="py-1 px-2.5 text-[11px] text-[rgb(var(--muted))] bg-transparent border-r border-[rgb(var(--border))] last:border-r-0 transition-colors"
                :class="source === 'commits' ? 'bg-primary text-bg' : 'hover:text-fg'"
                @click="source = 'commits'"
              >Commits</button>
            </div>
          </div>

          <div v-if="source === 'commits' && branches.length" class="flex items-center justify-between gap-3">
            <span class="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))]">Branch</span>
            <select v-model="branch" class="py-1 px-2 text-[11px] text-fg bg-bg/60 border border-[rgb(var(--border))] rounded max-w-[180px]">
              <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))]">Versions</span>
            <div class="inline-flex border border-[rgb(var(--border))] rounded overflow-hidden">
              <button
                v-for="opt in limitOptions"
                :key="opt"
                type="button"
                class="py-1 px-2.5 text-[11px] text-[rgb(var(--muted))] bg-transparent border-r border-[rgb(var(--border))] last:border-r-0 transition-colors"
                :class="limit === opt ? 'bg-primary text-bg' : 'hover:text-fg'"
                @click="limit = opt"
              >{{ opt }}</button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-[11px] uppercase tracking-wider text-[rgb(var(--muted))]">Sampling</span>
            <div class="inline-flex border border-[rgb(var(--border))] rounded overflow-hidden">
              <button
                type="button"
                class="py-1 px-2.5 text-[11px] text-[rgb(var(--muted))] bg-transparent border-r border-[rgb(var(--border))] last:border-r-0 transition-colors"
                :class="sampling === 'spread' ? 'bg-primary text-bg' : 'hover:text-fg'"
                title="Evenly spaced across history"
                @click="sampling = 'spread'"
              >Spread</button>
              <button
                type="button"
                class="py-1 px-2.5 text-[11px] text-[rgb(var(--muted))] bg-transparent border-r border-[rgb(var(--border))] last:border-r-0 transition-colors"
                :class="sampling === 'latest' ? 'bg-primary text-bg' : 'hover:text-fg'"
                title="Most recent only"
                @click="sampling = 'latest'"
              >Latest</button>
            </div>
          </div>
        </div>

        <div class="flex justify-center py-3 px-[18px] border-t border-[rgb(var(--border))] bg-bg/40">
          <button
            class="inline-flex items-center gap-[7px] py-[7px] px-[18px] text-xs font-semibold rounded border border-primary text-primary bg-transparent cursor-pointer transition-colors hover:bg-primary hover:text-bg"
            type="button"
            aria-label="Load and play evolution"
            @click="start"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Play</span>
          </button>
        </div>
      </div>
      </div>

      <template #fallback>
        <div class="w-full h-[500px] flex flex-col items-center justify-center border border-[rgb(var(--border))] rounded bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]">
          <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin" />
        </div>
      </template>
    </ClientOnly>

    <!-- Loading -->
    <div v-else-if="loading" class="w-full h-[500px] flex flex-col items-center justify-center border border-[rgb(var(--border))] rounded bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]">
      <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin" />
      <p class="text-xs text-[rgb(var(--muted))] mt-3">Loading evolution data...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="w-full h-[500px] flex flex-col items-center justify-center border border-[rgb(var(--border))] rounded bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]">
      <p class="text-xs text-red-400">{{ error }}</p>
      <button @click="loadEvolution()" class="text-xs link-primary mt-2">Try again</button>
    </div>

    <!-- No data -->
    <div v-else-if="snapshots.length === 0" class="w-full h-[500px] flex flex-col items-center justify-center border border-[rgb(var(--border))] rounded bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]">
      <p class="text-xs text-[rgb(var(--muted))]">
        {{ source === 'tags'
          ? 'No version tags found in this repository.'
          : `No commits found on branch "${branch}".` }}
      </p>
      <button @click="reconfigure" class="text-xs link-primary mt-2">Change settings</button>
    </div>

    <!-- Visualization -->
    <template v-else>
      <div
        class="border border-[rgb(var(--border))] overflow-hidden"
        :class="expanded
          ? 'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-none bg-[rgb(var(--bg))]'
          : 'rounded'"
        :style="expanded ? { top: headerOffset + 'px' } : undefined"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-[rgb(var(--border))] flex items-center justify-between relative z-10">
          <div class="flex items-center gap-3">
            <span class="section-title text-xs">Evolution</span>
            <span v-if="currentSnapshot" class="text-primary text-xs font-semibold">
              {{ currentSnapshot.tag }}
            </span>
            <span
              v-if="currentSnapshot?.truncated"
              class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400"
              title="GitHub truncated the recursive tree — this snapshot's file list is incomplete."
            >
              partial
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
            <span class="tabular-nums">
              {{ source }}{{ source === 'commits' ? `@${branch}` : '' }} · {{ snapshots.length }} · {{ sampling }}
            </span>
            <button @click="reconfigure" class="text-xs link-primary">Change</button>
            <span v-if="currentSnapshot">{{ currentSnapshot.stats.totalFiles }} files</span>
            <span v-if="currentSnapshot">{{ formatDate(currentSnapshot.date) }}</span>
            <button
              type="button"
              class="w-4 h-4 rounded-sm inline-flex items-center justify-center text-[rgb(var(--muted))] bg-transparent border-0 cursor-pointer transition-colors hover:text-primary hover:bg-[rgb(var(--border)/0.5)]"
              :aria-label="expanded ? 'Collapse view' : 'Expand view'"
              :title="expanded ? 'Collapse (Esc)' : 'Expand'"
              @click="toggleExpand"
            >
              <svg v-if="!expanded" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 1h4v4 M11 1 7 5 M5 11H1V7 M1 11l4-4" />
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 1 7 5m0 0V1m0 4h4 M1 11l4-4m0 0v4m0-4H1" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Tag message (collapsed bar always in flow) -->
        <div
          v-if="currentSnapshot?.message"
          class="px-4 py-2 border-b border-[rgb(var(--border))] relative z-10"
        >
          <div class="flex items-center gap-2 min-w-0">
            <p class="flex-1 text-[11px] text-[rgb(var(--muted))] truncate min-w-0">{{ tagFirstLine }}</p>
            <button
              v-if="tagIsMultiline"
              @click.stop="messageExpanded = !messageExpanded"
              :aria-label="messageExpanded ? 'Collapse message' : 'Expand message'"
              :title="messageExpanded ? 'Collapse' : 'Show full message'"
              class="shrink-0 inline-flex items-center justify-center px-1.5 h-5 rounded border text-[rgb(var(--muted))] hover:text-primary transition-colors"
              :class="messageExpanded ? 'border-primary text-primary' : 'border-[rgb(var(--border))] hover:border-primary'"
            >
              <svg width="14" height="4" viewBox="0 0 14 4" fill="currentColor">
                <circle cx="2" cy="2" r="1.2" />
                <circle cx="7" cy="2" r="1.2" />
                <circle cx="12" cy="2" r="1.2" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Canvas -->
        <div class="relative" :class="expanded ? 'flex-1 min-h-0' : 'h-[500px]'">
          <div ref="diagramContainer" class="w-full bg-[radial-gradient(ellipse_at_center,rgb(26_27_30)_0%,rgb(15_15_20)_100%)]" :class="expanded ? 'h-full' : 'h-[500px]'"></div>

          <!-- File tooltip -->
          <div
            v-if="tooltip.visible"
            class="absolute z-30 pointer-events-none bg-bg/95 backdrop-blur border border-[rgb(var(--border))] rounded py-1.5 px-2.5 flex flex-col gap-0.5 text-[11px] font-mono max-w-[320px] whitespace-nowrap overflow-hidden text-ellipsis"
            :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
          >
            <span class="text-[rgb(var(--muted))]">{{ tooltip.dir }}<span class="text-[rgb(var(--foreground))] font-semibold">{{ tooltip.name }}</span></span>
            <span class="text-primary text-[10px]">{{ tooltip.kind }}</span>
          </div>

          <!-- Expanded tag message overlay -->
          <div
            v-if="messageExpanded && tagIsMultiline && currentSnapshot?.message"
            class="absolute top-3 left-3 right-3 z-[25] flex items-start gap-3 max-h-[calc(100%-24px)] bg-bg/85 backdrop-blur-[10px] border border-[rgb(var(--border))] rounded py-3 px-3.5 overflow-hidden"
            @pointerdown.stop
            @click.stop
          >
            <pre class="flex-1 text-[11px] text-[rgb(var(--muted))] whitespace-pre-wrap font-mono leading-relaxed max-h-full overflow-y-auto">{{ currentSnapshot.message.trim() }}</pre>
            <button
              @click.stop="messageExpanded = false"
              aria-label="Collapse message"
              title="Collapse"
              class="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[rgb(var(--muted))] hover:text-primary hover:bg-[rgb(var(--border))] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M1 5h8" />
              </svg>
            </button>
          </div>

          <!-- Files panel (left) -->
          <div class="absolute top-3 z-20 bg-bg/90 backdrop-blur border border-[rgb(var(--border))] rounded py-2 px-2.5 left-3 w-[220px] max-h-[calc(100%-24px)] flex flex-col" @pointerdown.stop @click.stop>
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-[10px] text-[rgb(var(--muted))] font-semibold uppercase tracking-wider m-0">Files</h4>
              <button
                type="button"
                class="w-4 h-4 rounded-sm inline-flex items-center justify-center text-[rgb(var(--muted))] bg-transparent border-0 cursor-pointer transition-colors hover:text-primary hover:bg-[rgb(var(--border)/0.5)]"
                :aria-label="filesPanelOpen ? 'Collapse files' : 'Expand files'"
                :title="filesPanelOpen ? 'Collapse' : 'Expand'"
                @click="filesPanelOpen = !filesPanelOpen"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path v-if="filesPanelOpen" d="M1 5h8" />
                  <path v-else d="M1 5h8 M5 1v8" />
                </svg>
              </button>
            </div>
            <div v-if="filesPanelOpen && fileTreeRoot" class="mt-1.5 overflow-y-auto overflow-x-hidden">
              <FileTreePanel
                :nodes="fileTreeRoot.children"
                :open-set="openFolders"
                :highlighted-path="hoveredGraphPath"
                @hover="onTreeHover"
                @toggle="toggleFolder"
                @click="onTreeFileClick"
              />
            </div>
          </div>

          <!-- Legend (right, collapsible) -->
          <div class="absolute top-3 z-20 bg-bg/90 backdrop-blur border border-[rgb(var(--border))] rounded py-2 px-2.5 right-3" @pointerdown.stop @click.stop>
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-[10px] text-[rgb(var(--muted))] font-semibold uppercase tracking-wider m-0">File types</h4>
              <button
                type="button"
                class="w-4 h-4 rounded-sm inline-flex items-center justify-center text-[rgb(var(--muted))] bg-transparent border-0 cursor-pointer transition-colors hover:text-primary hover:bg-[rgb(var(--border)/0.5)]"
                :aria-label="legendPanelOpen ? 'Collapse legend' : 'Expand legend'"
                :title="legendPanelOpen ? 'Collapse' : 'Expand'"
                @click="legendPanelOpen = !legendPanelOpen"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <path v-if="legendPanelOpen" d="M1 5h8" />
                  <path v-else d="M1 5h8 M5 1v8" />
                </svg>
              </button>
            </div>
            <div v-if="legendPanelOpen" class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
              <button
                v-for="(color, ext) in EXTENSION_COLORS"
                :key="ext"
                @click="toggleExtension(ext as string)"
                class="flex items-center gap-1.5 px-1 py-0.5 rounded text-left transition-opacity"
                :class="{ 'opacity-30': hiddenExtensions.has(ext as string) }"
              >
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: hiddenExtensions.has(ext as string) ? 'rgb(var(--muted))' : color }" />
                <span class="text-[10px] text-[rgb(var(--foreground))]">.{{ ext }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="px-4 py-3 border-t border-[rgb(var(--border))] relative z-10">
          <div class="flex items-center gap-3">
            <button
              @click="togglePlay"
              class="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors border"
              :class="isPlaying
                ? 'border-primary text-primary'
                : 'border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]'"
            >
              {{ isPlaying ? '||' : '>' }}
            </button>

            <div class="flex-1 relative">
              <!-- Segmented timeline -->
              <div class="flex h-6 items-end gap-px">
                <button
                  v-for="(snap, i) in snapshots"
                  :key="snap.tag"
                  @click="currentIndex = i"
                  @mouseenter="hoveredIndex = i"
                  @mouseleave="hoveredIndex = null"
                  class="flex-1 rounded-sm transition-all duration-150 cursor-pointer"
                  :class="i <= currentIndex ? 'bg-primary' : 'bg-[rgb(var(--border))]'"
                  :style="{ height: i === currentIndex ? '100%' : i === hoveredIndex ? '80%' : '40%' }"
                />
              </div>
              <!-- Hover tooltip -->
              <div
                v-if="hoveredIndex !== null"
                class="absolute -top-6 bg-[rgb(var(--bg))] border border-[rgb(var(--border))] rounded px-2 py-0.5 text-[10px] text-primary font-semibold whitespace-nowrap pointer-events-none"
                :style="{ left: `${(hoveredIndex / Math.max(snapshots.length - 1, 1)) * 100}%`, transform: 'translateX(-50%)' }"
              >
                {{ snapshots[hoveredIndex].tag }}
              </div>
            </div>

            <span class="text-xs text-[rgb(var(--muted))] min-w-[50px] text-right">
              {{ currentIndex + 1 }}/{{ snapshots.length }}
            </span>
          </div>
          <div class="flex justify-between mt-1.5 text-[10px] text-[rgb(var(--muted))]">
            <span>{{ snapshots[0]?.tag }}</span>
            <span>{{ snapshots[snapshots.length - 1]?.tag }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatDate, EVOLUTION } from '@git-wayback/shared'
import type {
  TagSnapshot,
  EvolutionResponse,
  EvolutionSource,
  EvolutionSampling,
} from '~/composables/useDiagramTree'
import { EXTENSION_COLORS, buildTree } from '~/composables/useDiagramTree'

const props = withDefaults(
  defineProps<{
    owner: string
    repo: string
    branches?: string[]
    defaultBranch?: string
  }>(),
  { branches: () => [], defaultBranch: '' }
)

const limitOptions = EVOLUTION.LIMIT_OPTIONS

const source = ref<EvolutionSource>(EVOLUTION.DEFAULT_SOURCE)
const sampling = ref<EvolutionSampling>(EVOLUTION.DEFAULT_SAMPLING)
const limit = ref<number>(EVOLUTION.DEFAULT_LIMIT)
const branch = ref<string>(props.defaultBranch || props.branches[0] || '')

watch(
  () => props.defaultBranch,
  (b) => {
    if (b && !branch.value) branch.value = b
  }
)

const snapshots = ref<TagSnapshot[]>([])
const repoName = ref('')
const currentIndex = ref(0)
const started = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const diagramContainer = ref<HTMLElement | null>(null)
const hiddenExtensions = ref<Set<string>>(new Set())
const hoveredIndex = ref<number | null>(null)
const messageExpanded = ref(false)
const expanded = ref(false)
const headerOffset = ref(56)
const tooltip = ref<{ visible: boolean; x: number; y: number; name: string; dir: string; kind: string }>({
  visible: false, x: 0, y: 0, name: '', dir: '', kind: '',
})

const currentSnapshot = computed(() => snapshots.value[currentIndex.value])
const tagFirstLine = computed(() => currentSnapshot.value?.message?.trim().split('\n')[0] || '')
const tagIsMultiline = computed(() => (currentSnapshot.value?.message?.trim().split('\n').length || 0) > 1)
const totalSnapshots = computed(() => snapshots.value.length)

const filesPanelOpen = ref(true)
const legendPanelOpen = ref(true)
const openFolders = ref<Set<string>>(new Set())
const hoveredFilePath = ref<string | null>(null)
const hoveredGraphPath = ref<string | null>(null)

const fileTreeRoot = computed(() => {
  if (!currentSnapshot.value) return null
  return buildTree(currentSnapshot.value.files, repoName.value)
})

const { isPlaying, togglePlay, stopPlay } = useDiagramPlayback(currentIndex, totalSnapshots)
const { initGource, retryInitGource, updateTree, highlightByPath, unhighlightByPath, zoomToPath } = useDiagramRenderer(
  diagramContainer, currentSnapshot, repoName, hiddenExtensions, tooltip, hoveredGraphPath,
  onGraphNodeClick, expanded,
)

async function onGraphNodeClick(path: string) {
  if (!path) return
  filesPanelOpen.value = true
  const next = new Set(openFolders.value)
  const parts = path.split('/')
  for (let i = 1; i <= parts.length; i++) {
    next.add(parts.slice(0, i).join('/'))
  }
  openFolders.value = next

  await nextTick()
  const row = document.querySelector(`.files-overlay [data-path="${cssEscape(path)}"]`)
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s)
  return s.replace(/(["\\\[\]:.#])/g, '\\$1')
}

watch(hoveredFilePath, (newPath, oldPath) => {
  if (oldPath) unhighlightByPath(oldPath)
  if (newPath) highlightByPath(newPath)
})

function onTreeHover(path: string | null) {
  hoveredFilePath.value = path
}

function onTreeFileClick(path: string) {
  zoomToPath(path)
}

function toggleFolder(path: string) {
  const next = new Set(openFolders.value)
  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }
  openFolders.value = next
  zoomToPath(path)
}

async function loadEvolution() {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<EvolutionResponse>(`/api/repos/${props.owner}/${props.repo}/evolution`, {
      query: {
        source: source.value,
        sampling: sampling.value,
        limit: limit.value,
        ...(source.value === 'commits' && branch.value ? { branch: branch.value } : {}),
      },
    })

    snapshots.value = response.snapshots
    repoName.value = response.repoName

    if (snapshots.value.length > 0) {
      const firstWithFiles = snapshots.value.findIndex((s) => s.files.length > 0)
      currentIndex.value = firstWithFiles >= 0 ? firstWithFiles : 0
      loading.value = false
      await nextTick()
      await nextTick()
      retryInitGource()
    } else {
      loading.value = false
    }
  } catch (err: unknown) {
    error.value =
      err instanceof Error ? err.message : 'Failed to load repository evolution'
    loading.value = false
  }
}

async function start() {
  started.value = true
  await loadEvolution()
  if (snapshots.value.length > 0 && !error.value) {
    togglePlay()
  }
}

// Back to the config screen, keeping current selections
function reconfigure() {
  stopPlay()
  started.value = false
  error.value = null
  snapshots.value = []
  currentIndex.value = 0
}

// Measure the sticky AppHeader so the expanded overlay starts just below it.
function measureHeader() {
  const h = document.querySelector('header.sticky')?.getBoundingClientRect().height
  if (h) headerOffset.value = Math.round(h)
}

function toggleExpand() {
  expanded.value = !expanded.value
  if (expanded.value) measureHeader()
  // Resize the radial layout to the new container size (ResizeObserver also
  // fires, but call directly so it snaps without the debounce delay).
  nextTick(() => updateTree())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && expanded.value) {
    expanded.value = false
    nextTick(() => updateTree())
  }
}

watch(expanded, (v) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = v ? 'hidden' : ''
  }
})

function toggleExtension(ext: string) {
  const newSet = new Set(hiddenExtensions.value)
  if (newSet.has(ext)) {
    newSet.delete(ext)
  } else {
    newSet.add(ext)
  }
  hiddenExtensions.value = newSet
  updateTree()
}

watch(currentIndex, () => {
  messageExpanded.value = false
  updateTree()
})

// Debounce resize redraws and avoid the full rebuild path — updateTree reuses
// the existing svg/groups and just re-runs the radial layout for the new size.
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const resizeObserver = new ResizeObserver(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (snapshots.value.length > 0 && !loading.value) {
      updateTree()
    }
  }, 150)
})

watch(diagramContainer, (el, prev) => {
  if (prev) resizeObserver.unobserve(prev)
  if (el) resizeObserver.observe(el)
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  resizeObserver.disconnect()
  if (resizeTimer) clearTimeout(resizeTimer)
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  stopPlay()
})
</script>

