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
          <div class="flex items-start gap-3">
            <pre v-if="messageExpanded" class="flex-1 text-[11px] text-[rgb(var(--muted))] whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">{{ currentSnapshot.message.trim() }}</pre>
            <p v-else class="flex-1 text-[11px] text-[rgb(var(--muted))] truncate">{{ tagFirstLine }}</p>
            <button
              v-if="tagIsMultiline"
              @click.stop="messageExpanded = !messageExpanded"
              class="text-[10px] text-primary shrink-0 hover:text-[rgb(var(--primary-hovered))]"
            >
              {{ messageExpanded ? 'collapse' : 'expand' }}
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
                v-for="(color, ext) in extensionColors"
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
import * as d3 from 'd3'
import {
  formatDate,
  DIAGRAM,
  D3_TRANSITION_DURATION_MS,
  D3_EXIT_TRANSITION_DURATION_MS,
  TIMELINE_PLAYBACK_INTERVAL_MS,
} from '@git-wayback/shared'

interface FileNode {
  path: string
  name: string
  size: number
  extension: string | null
}

interface TagSnapshot {
  tag: string
  sha: string
  date: string
  message: string
  files: FileNode[]
  stats: {
    totalFiles: number
    totalSize: number
  }
}

interface EvolutionResponse {
  snapshots: TagSnapshot[]
  repoName: string
  cached: boolean
  capturedAt: string
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  extension?: string | null
  size?: number
  children: TreeNode[]
}

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
const isPlaying = ref(false)
const hiddenExtensions = ref<Set<string>>(new Set())
const hoveredIndex = ref<number | null>(null)
const messageExpanded = ref(false)
const tooltip = ref<{ visible: boolean; x: number; y: number; name: string; dir: string; kind: string }>({
  visible: false, x: 0, y: 0, name: '', dir: '', kind: '',
})
let playInterval: ReturnType<typeof setInterval> | null = null

const extensionColors: Record<string, string> = {
  ts: '#3178c6',
  js: '#f1e05a',
  vue: '#41b883',
  json: '#cbcb41',
  md: '#083fa1',
  css: '#563d7c',
  html: '#e34c26',
  py: '#3572A5',
  go: '#00ADD8',
  rs: '#dea584',
  yaml: '#cb171e',
  sh: '#89e051',
  other: '#6b7280',
}

const currentSnapshot = computed(() => snapshots.value[currentIndex.value])
const tagFirstLine = computed(() => currentSnapshot.value?.message?.trim().split('\n')[0] || '')
const tagIsMultiline = computed(() => (currentSnapshot.value?.message?.trim().split('\n').length || 0) > 1)

async function loadEvolution(forceRefresh = false) {
  loading.value = true
  error.value = null

  try {
    const response = await $fetch<EvolutionResponse>(`/api/repos/${props.owner}/${props.repo}/evolution`, {
      query: { limit: 20, refresh: forceRefresh ? 'true' : undefined },
    })

    snapshots.value = response.snapshots
    repoName.value = response.repoName

    if (snapshots.value.length > 0) {
      // Start at the first snapshot that has files
      const firstWithFiles = snapshots.value.findIndex((s) => s.files.length > 0)
      currentIndex.value = firstWithFiles >= 0 ? firstWithFiles : 0
      // Wait for DOM to fully render (v-show conditional + container sizing)
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

function buildTree(files: FileNode[]): TreeNode {
  const root: TreeNode = {
    name: repoName.value,
    path: '',
    type: 'folder',
    children: [],
  }

  for (const file of files) {
    const parts = file.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')

      if (isFile) {
        current.children.push({
          name: part,
          path: file.path,
          type: 'file',
          extension: file.extension,
          size: file.size,
          children: [],
        })
      } else {
        let child = current.children.find((c) => c.name === part && c.type === 'folder')
        if (!child) {
          child = { name: part, path, type: 'folder', children: [] }
          current.children.push(child)
        }
        current = child
      }
    }
  }

  return root
}

function retryInitGource(attempts = 0) {
  if (!diagramContainer.value || !currentSnapshot.value) return
  if (diagramContainer.value.clientWidth === 0 && attempts < 10) {
    requestAnimationFrame(() => retryInitGource(attempts + 1))
    return
  }
  initGource()
}

function initGource() {
  if (!diagramContainer.value || !currentSnapshot.value) return

  const container = diagramContainer.value
  const width = container.clientWidth || DIAGRAM.DEFAULT_WIDTH
  const height = DIAGRAM.HEIGHT
  const centerX = width / 2
  const centerY = height / 2

  d3.select(container).selectAll('*').remove()

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])

  const g = svg.append('g')

  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
  )
  // Prevent d3-zoom from blocking double-click on controls outside the SVG
  svg.style('touch-action', 'none')

  const linksGroup = g.append('g').attr('class', 'links')
  const nodesGroup = g.append('g').attr('class', 'nodes')

  renderTree(linksGroup, nodesGroup, width, height, centerX, centerY)
}

function renderTree(
  linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  width: number,
  height: number,
  centerX: number,
  centerY: number
) {
  if (!currentSnapshot.value) return

  const tree = buildTree(currentSnapshot.value.files)
  const root = d3.hierarchy(tree)

  const treeLayout = d3.tree<TreeNode>()
    .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)

  const treeData = treeLayout(root)
  const nodes = treeData.descendants()
  const links = treeData.links()

  const radialPoint = (x: number, y: number): [number, number] => {
    return [(y) * Math.cos(x - Math.PI / 2) + centerX, (y) * Math.sin(x - Math.PI / 2) + centerY]
  }

  const visibleNodes = nodes.filter(d => {
    if (d.data.type === 'folder') return true
    return !isExtensionHidden(d.data.extension || null)
  })

  const visibleLinks = links.filter(d => {
    if (d.target.data.type === 'folder') return true
    return !isExtensionHidden(d.target.data.extension || null)
  })

  const linkSelection = linksGroup
    .selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
    .data(visibleLinks, (d) => `${d.source.data.path}-${d.target.data.path}`)

  linkSelection.exit()
    .transition()
    .duration(D3_EXIT_TRANSITION_DURATION_MS)
    .attr('opacity', 0)
    .remove()

  const linkEnter = linkSelection.enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(16, 185, 129, 0.15)')
    .attr('stroke-width', 1)
    .attr('opacity', 0)

  linkEnter.merge(linkSelection)
    .transition()
    .duration(D3_TRANSITION_DURATION_MS)
    .attr('opacity', 1)
    .attr('d', (d) => {
      const [sx, sy] = radialPoint(d.source.x!, d.source.y!)
      const [tx, ty] = radialPoint(d.target.x!, d.target.y!)
      return `M${sx},${sy}L${tx},${ty}`
    })

  const nodeSelection = nodesGroup
    .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
    .data(visibleNodes, (d) => d.data.path || d.data.name)

  nodeSelection.exit()
    .transition()
    .duration(D3_EXIT_TRANSITION_DURATION_MS)
    .attr('opacity', 0)
    .remove()

  const nodeEnter = nodeSelection.enter()
    .append('g')
    .attr('opacity', 0)

  nodeEnter.append('circle')
  nodeEnter.append('text')

  const nodeUpdate = nodeEnter.merge(nodeSelection)

  nodeUpdate
    .transition()
    .duration(D3_TRANSITION_DURATION_MS)
    .attr('opacity', 1)
    .attr('transform', (d) => {
      const [x, y] = radialPoint(d.x!, d.y!)
      return `translate(${x},${y})`
    })

  nodeUpdate.select('circle')
    .attr('r', (d) => {
      if (d.data.type === 'folder') {
        return d.depth === 0 ? 6 : 3
      }
      return Math.max(2, Math.min(6, Math.sqrt((d.data.size || 100) / 500)))
    })
    .attr('fill', (d) => {
      if (d.data.type === 'folder') {
        return d.depth === 0 ? 'rgb(16, 185, 129)' : 'rgba(16, 185, 129, 0.4)'
      }
      return getExtensionColor(d.data.extension || null)
    })
    .attr('stroke', (d) => d.data.type === 'folder' ? 'rgba(16, 185, 129, 0.6)' : 'none')
    .attr('stroke-width', 1)

  nodeUpdate.select('text')
    .attr('dy', '0.31em')
    .attr('x', (d) => (d.x! < Math.PI) === !d.children ? 6 : -6)
    .attr('text-anchor', (d) => (d.x! < Math.PI) === !d.children ? 'start' : 'end')
    .attr('transform', (d) => {
      if (d.depth === 0) return ''
      const angle = (d.x! * 180) / Math.PI - 90
      return `rotate(${angle > 90 || angle < -90 ? angle + 180 : angle})`
    })
    .attr('fill', 'rgba(212, 212, 212, 0.7)')
    .attr('font-size', (d) => d.depth === 0 ? 11 : 8)
    .attr('font-family', 'JetBrains Mono, monospace')
    .text((d) => {
      if (d.depth === 0) return d.data.name
      if (d.depth === 1 && d.data.type === 'folder') return d.data.name
      return ''
    })

  nodeUpdate
    .select('circle')
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('stroke', 'rgb(16, 185, 129)').attr('stroke-width', 2)
      showTooltip(event, d.data)
    })
    .on('mousemove', function (event, d) {
      showTooltip(event, d.data)
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', (d: any) => d.data.type === 'folder' ? 'rgba(16, 185, 129, 0.6)' : 'none')
      tooltip.value.visible = false
    })
    .on('click', function (event, d) {
      event.stopPropagation()
      showTooltip(event, d.data)
    })
}

function getExtensionColor(ext: string | null): string {
  if (!ext) return extensionColors.other
  return extensionColors[ext.toLowerCase()] || extensionColors.other
}

function getFileKind(data: TreeNode): string {
  if (data.type === 'folder') return 'folder'
  if (!data.extension) return 'file'
  const ext = data.extension.toLowerCase()
  const kinds: Record<string, string> = {
    ts: 'typescript', js: 'javascript', vue: 'vue component',
    json: 'json', md: 'markdown', css: 'stylesheet', html: 'html',
    py: 'python', go: 'go', rs: 'rust', yaml: 'yaml config',
    yml: 'yaml config', sh: 'shell script', tsx: 'typescript jsx',
    jsx: 'javascript jsx', svg: 'svg image', png: 'image', jpg: 'image',
    gif: 'image', toml: 'toml config', lock: 'lockfile',
    gitignore: 'git config', env: 'env config', sql: 'sql',
  }
  return kinds[ext] || ext + ' file'
}

function showTooltip(event: MouseEvent, data: TreeNode) {
  const wrapper = diagramContainer.value?.parentElement
  if (!wrapper) return
  const rect = wrapper.getBoundingClientRect()
  const parts = data.path.split('/')
  const dir = parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left + 12,
    y: event.clientY - rect.top - 8,
    name: data.name,
    dir,
    kind: getFileKind(data),
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
  if (diagramContainer.value) {
    const svg = d3.select(diagramContainer.value).select('svg')
    if (!svg.empty()) {
      const g = svg.select<SVGGElement>('g')
      const linksGroup = g.select<SVGGElement>('.links')
      const nodesGroup = g.select<SVGGElement>('.nodes')
      const width = diagramContainer.value.clientWidth || 900
      const height = DIAGRAM.HEIGHT
      renderTree(linksGroup, nodesGroup, width, height, width / 2, height / 2)
    }
  }
}

function isExtensionHidden(ext: string | null): boolean {
  if (!ext) return hiddenExtensions.value.has('other')
  const normalizedExt = ext.toLowerCase()
  if (extensionColors[normalizedExt]) {
    return hiddenExtensions.value.has(normalizedExt)
  }
  return hiddenExtensions.value.has('other')
}

watch(currentIndex, () => {
  messageExpanded.value = false
  if (!diagramContainer.value) return

  const svg = d3.select(diagramContainer.value).select('svg')
  if (svg.empty()) {
    initGource()
    return
  }

  const g = svg.select<SVGGElement>('g')
  const linksGroup = g.select<SVGGElement>('.links')
  const nodesGroup = g.select<SVGGElement>('.nodes')

  const width = diagramContainer.value.clientWidth || 900
  const height = DIAGRAM.HEIGHT

  renderTree(linksGroup, nodesGroup, width, height, width / 2, height / 2)
})

function togglePlay() {
  if (isPlaying.value) {
    stopPlay()
  } else {
    startPlay()
  }
}

function startPlay() {
  isPlaying.value = true
  if (currentIndex.value >= snapshots.value.length - 1) {
    currentIndex.value = 0
  }
  playInterval = setInterval(() => {
    if (currentIndex.value < snapshots.value.length - 1) {
      currentIndex.value++
    } else {
      stopPlay()
    }
  }, TIMELINE_PLAYBACK_INTERVAL_MS)
}

function stopPlay() {
  isPlaying.value = false
  if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
}

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
