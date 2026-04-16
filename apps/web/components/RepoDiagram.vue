<template>
  <div class="repo-diagram">
    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center">
      <div class="inline-block w-4 h-4 border-2 border-[rgb(var(--border))] border-t-primary rounded-full animate-spin" />
      <p class="text-xs text-[rgb(var(--muted))] mt-3">Loading evolution data...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-8">
      <p class="text-xs text-red-400">{{ error }}</p>
      <button @click="loadEvolution()" class="text-xs link-primary mt-2">Try again</button>
    </div>

    <!-- No Tags -->
    <div v-else-if="snapshots.length === 0" class="py-12 text-center">
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

        <!-- Tag message -->
        <div
          v-if="currentSnapshot?.message"
          class="px-4 py-2 border-b border-[rgb(var(--border))] relative z-10"
        >
          <div v-if="messageExpanded" class="flex items-start gap-3">
            <pre class="flex-1 text-[11px] text-[rgb(var(--muted))] whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">{{ currentSnapshot.message.trim() }}</pre>
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
          <div v-else class="flex items-center gap-2 min-w-0">
            <p class="flex-1 text-[11px] text-[rgb(var(--muted))] truncate min-w-0">{{ tagFirstLine }}</p>
            <button
              v-if="tagIsMultiline"
              @click.stop="messageExpanded = true"
              aria-label="Expand message"
              title="Show full message"
              class="shrink-0 inline-flex items-center justify-center px-1.5 h-5 rounded border border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:text-primary hover:border-primary transition-colors"
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

          <!-- Legend -->
          <div class="legend-overlay" @pointerdown.stop @click.stop>
            <h4 class="text-[10px] text-[rgb(var(--muted))] font-semibold uppercase tracking-wider mb-2">File types</h4>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1">
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
import { EXTENSION_COLORS } from '~/composables/useDiagramTree'

const props = defineProps<{
  owner: string
  repo: string
}>()

const snapshots = ref<TagSnapshot[]>([])
const repoName = ref('')
const currentIndex = ref(0)
const loading = ref(true)
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

const { isPlaying, togglePlay, stopPlay } = useDiagramPlayback(currentIndex, totalSnapshots)
const { initGource, retryInitGource, updateTree } = useDiagramRenderer(
  diagramContainer, currentSnapshot, repoName, hiddenExtensions, tooltip,
)

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
      await nextTick()
      await nextTick()
      retryInitGource()
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load repository evolution'
  } finally {
    loading.value = false
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

onMounted(() => {
  loadEvolution()

  const resizeObserver = new ResizeObserver(() => {
    if (snapshots.value.length > 0 && !loading.value) {
      initGource()
    }
  })

  if (diagramContainer.value) {
    resizeObserver.observe(diagramContainer.value)
  }

  onUnmounted(() => {
    resizeObserver.disconnect()
    stopPlay()
  })
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

.legend-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  background: rgb(var(--bg) / 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgb(var(--border));
  border-radius: 4px;
  padding: 8px 10px;
}
</style>
