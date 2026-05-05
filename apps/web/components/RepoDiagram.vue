<template>
  <div class="repo-diagram">
    <!-- Idle (pre-load): big play button, like a video before it starts -->
    <button
      v-if="!started"
      class="evolution-stage evolution-idle"
      type="button"
      aria-label="Load and play evolution"
      @click="start"
    >
      <span class="play-button">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span class="text-xs text-[rgb(var(--muted))] mt-3">Click to load evolution</span>
    </button>

    <!-- Loading -->
    <div v-else-if="loading" class="evolution-stage">
      <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin" />
      <p class="text-xs text-[rgb(var(--muted))] mt-3">Loading evolution data...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="evolution-stage">
      <p class="text-xs text-red-400">{{ error }}</p>
      <button @click="loadEvolution()" class="text-xs link-primary mt-2">Try again</button>
    </div>

    <!-- No Tags -->
    <div v-else-if="snapshots.length === 0" class="evolution-stage">
      <p class="text-xs text-[rgb(var(--muted))]">No version tags found in this repository.</p>
    </div>

    <!-- Visualization -->
    <template v-else>
      <div class="border border-[rgb(var(--border))] rounded overflow-hidden">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-[rgb(var(--border))] flex items-center justify-between relative z-10">
          <div class="flex items-center gap-3">
            <span class="section-title text-xs">Evolution</span>
            <span v-if="currentSnapshot" class="text-primary text-xs font-semibold">
              {{ currentSnapshot.tag }}
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
            <span v-if="currentSnapshot">{{ currentSnapshot.stats.totalFiles }} files</span>
            <span v-if="currentSnapshot">{{ formatDate(currentSnapshot.date) }}</span>
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
        <div class="canvas-wrapper">
          <div ref="diagramContainer" class="gource-container"></div>

          <!-- File tooltip -->
          <div
            v-if="tooltip.visible"
            class="file-tooltip"
            :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
          >
            <span class="text-[rgb(var(--muted))]">{{ tooltip.dir }}<span class="text-[rgb(var(--foreground))] font-semibold">{{ tooltip.name }}</span></span>
            <span class="text-primary text-[10px]">{{ tooltip.kind }}</span>
          </div>

          <!-- Expanded tag message overlay -->
          <div
            v-if="messageExpanded && tagIsMultiline && currentSnapshot?.message"
            class="message-overlay"
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
          <div class="files-overlay" @pointerdown.stop @click.stop>
            <div class="overlay-header">
              <h4 class="overlay-title">Files</h4>
              <button
                type="button"
                class="overlay-toggle"
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
            <div v-if="filesPanelOpen && fileTreeRoot" class="files-body">
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
          <div class="legend-overlay" @pointerdown.stop @click.stop>
            <div class="overlay-header">
              <h4 class="overlay-title">File types</h4>
              <button
                type="button"
                class="overlay-toggle"
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
import { formatDate } from '@git-wayback/shared'
import type { TagSnapshot, EvolutionResponse } from '~/composables/useDiagramTree'
import { EXTENSION_COLORS, buildTree } from '~/composables/useDiagramTree'

const props = defineProps<{
  owner: string
  repo: string
}>()

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
  onGraphNodeClick,
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
      query: { limit: 20 },
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
  } catch (err: any) {
    error.value = err.message || 'Failed to load repository evolution'
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

const resizeObserver = new ResizeObserver(() => {
  if (snapshots.value.length > 0 && !loading.value) {
    initGource()
  }
})

watch(diagramContainer, (el, prev) => {
  if (prev) resizeObserver.unobserve(prev)
  if (el) resizeObserver.observe(el)
})

onUnmounted(() => {
  resizeObserver.disconnect()
  stopPlay()
})
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  height: 500px;
}

.gource-container {
  width: 100%;
  height: 500px;
  background: rgb(var(--bg));
  background: radial-gradient(ellipse at center, rgb(26 27 30) 0%, rgb(15 15 20) 100%);
}

.file-tooltip {
  position: absolute;
  z-index: 30;
  pointer-events: none;
  background: rgb(var(--bg) / 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid rgb(var(--border));
  border-radius: 4px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-overlay,
.files-overlay {
  position: absolute;
  top: 12px;
  z-index: 20;
  background: rgb(var(--bg) / 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgb(var(--border));
  border-radius: 4px;
  padding: 8px 10px;
}

.legend-overlay {
  right: 12px;
}

.files-overlay {
  left: 12px;
  width: 220px;
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
}

.files-body {
  margin-top: 6px;
  overflow-y: auto;
  overflow-x: hidden;
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.overlay-title {
  font-size: 10px;
  color: rgb(var(--muted));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.overlay-toggle {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--muted));
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color 0.12s, background-color 0.12s;
}

.overlay-toggle:hover {
  color: rgb(var(--primary));
  background: rgb(var(--border) / 0.5);
}

.message-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 25;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-height: calc(100% - 24px);
  background: rgb(var(--bg) / 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(var(--border));
  border-radius: 4px;
  padding: 12px 14px;
  overflow: hidden;
}

.evolution-stage {
  width: 100%;
  height: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgb(26 27 30) 0%, rgb(15 15 20) 100%);
  border: 1px solid rgb(var(--border));
  border-radius: 4px;
}

.evolution-idle {
  cursor: pointer;
  transition: filter 0.15s;
}

.evolution-idle:hover {
  filter: brightness(1.1);
}

.evolution-idle .play-button {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid rgb(var(--primary));
  color: rgb(var(--primary));
  background: rgb(var(--bg) / 0.55);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
  transition: transform 0.15s, background-color 0.15s;
}

.evolution-idle:hover .play-button {
  transform: scale(1.06);
  background: rgb(var(--bg) / 0.8);
}
</style>
