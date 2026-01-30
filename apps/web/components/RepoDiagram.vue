<template>
  <div class="repo-diagram">
    <!-- Loading State -->
    <div v-if="loading" class="bg-gray-900 rounded-xl p-12 flex items-center justify-center min-h-[600px]">
      <div class="text-center">
        <div class="animate-spin w-10 h-10 border-3 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-white font-medium">Loading repository evolution...</p>
        <p class="text-sm text-gray-400 mt-1">This may take a moment</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <button @click="loadEvolution()" class="mt-3 text-sm text-red-700 underline">Try again</button>
    </div>

    <!-- No Tags State -->
    <div v-else-if="snapshots.length === 0" class="bg-yellow-50 border border-yellow-200 rounded-xl p-12 text-center">
      <p class="text-4xl mb-3">🏷️</p>
      <h3 class="text-lg font-semibold text-yellow-800 mb-2">No version tags found</h3>
      <p class="text-yellow-600 text-sm">This repository doesn't have any release tags yet.</p>
    </div>

    <!-- Main Content -->
    <template v-else>
      <!-- Gource Visualization -->
      <div class="bg-gray-900 rounded-xl overflow-hidden">
        <!-- Header -->
        <div class="p-4 border-b border-gray-800 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h3 class="font-semibold text-white">Repository Evolution</h3>
            <span v-if="currentSnapshot" class="bg-brand-primary text-white text-sm font-semibold px-2 py-0.5 rounded">
              {{ currentSnapshot.tag }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="currentSnapshot" class="text-sm text-gray-400">
              {{ currentSnapshot.stats.totalFiles }} files
            </span>
            <span v-if="currentSnapshot" class="text-xs text-gray-500">
              {{ formatDate(currentSnapshot.date) }}
            </span>
          </div>
        </div>
        
        <!-- Canvas with Legend overlay -->
        <div class="canvas-wrapper">
          <div ref="diagramContainer" class="gource-container"></div>
          
          <!-- Legend overlay (outside gource-container to avoid being removed by D3) -->
          <div class="legend-overlay">
            <h4 class="text-xs font-semibold text-gray-700 mb-2">File Types</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <button
                v-for="(color, ext) in extensionColors"
                :key="ext"
                @click="toggleExtension(ext as string)"
                class="legend-item"
                :class="{ 'opacity-40': hiddenExtensions.has(ext as string) }"
              >
                <span 
                  class="color-dot" 
                  :style="{ backgroundColor: hiddenExtensions.has(ext as string) ? '#d1d5db' : color }"
                ></span>
                <span class="text-xs text-gray-700 font-medium">.{{ ext }}</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Controls -->
        <div class="p-4 border-t border-gray-800">
          <div class="flex items-center gap-4">
            <!-- Play/Pause -->
            <button
              @click="togglePlay"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              :class="isPlaying ? 'bg-brand-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            >
              {{ isPlaying ? '⏸' : '▶' }}
            </button>
            
            <!-- Timeline Slider -->
            <div class="flex-1">
              <input
                type="range"
                v-model.number="currentIndex"
                :min="0"
                :max="snapshots.length - 1"
                class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            
            <!-- Version indicator -->
            <div class="text-sm text-gray-400 min-w-[80px] text-right">
              {{ currentIndex + 1 }} / {{ snapshots.length }}
            </div>
          </div>
          
          <!-- Version labels -->
          <div class="flex justify-between mt-2 text-xs text-gray-500">
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
import { formatDate } from '@git-wayback/shared'

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

// State
const snapshots = ref<TagSnapshot[]>([])
const repoName = ref('')
const currentIndex = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const diagramContainer = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const hiddenExtensions = ref<Set<string>>(new Set())
let playInterval: ReturnType<typeof setInterval> | null = null
let simulation: d3.Simulation<any, any> | null = null

// Extension colors
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

// Load ALL evolution data in one call
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
      // Start at the first version so user sees the diagram immediately
      currentIndex.value = 0
      await nextTick()
      initGource()
    }
  } catch (err: any) {
    console.error('Failed to load evolution:', err)
    error.value = err.message || 'Failed to load repository evolution'
  } finally {
    loading.value = false
  }
}

// Build tree structure from flat files
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

// Initialize Gource-style visualization
function initGource() {
  if (!diagramContainer.value || !currentSnapshot.value) return

  const container = diagramContainer.value
  const width = container.clientWidth || 900
  const height = 600
  const centerX = width / 2
  const centerY = height / 2

  // Clear previous
  d3.select(container).selectAll('*').remove()

  // Create SVG
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])

  // Add zoom
  const g = svg.append('g')
  
  svg.call(
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
  )

  // Create layers
  const linksGroup = g.append('g').attr('class', 'links')
  const nodesGroup = g.append('g').attr('class', 'nodes')

  // Build hierarchy and render
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

  // Create radial tree layout
  const treeLayout = d3.tree<TreeNode>()
    .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)

  const treeData = treeLayout(root)
  const nodes = treeData.descendants()
  const links = treeData.links()

  // Radial point function
  const radialPoint = (x: number, y: number): [number, number] => {
    return [(y) * Math.cos(x - Math.PI / 2) + centerX, (y) * Math.sin(x - Math.PI / 2) + centerY]
  }

  // Filter out hidden extensions from nodes and links
  const visibleNodes = nodes.filter(d => {
    if (d.data.type === 'folder') return true
    return !isExtensionHidden(d.data.extension || null)
  })
  
  const visibleLinks = links.filter(d => {
    // Keep link if target is folder or visible file
    if (d.target.data.type === 'folder') return true
    return !isExtensionHidden(d.target.data.extension || null)
  })

  // Update links
  const linkSelection = linksGroup
    .selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
    .data(visibleLinks, (d) => `${d.source.data.path}-${d.target.data.path}`)

  linkSelection.exit()
    .transition()
    .duration(300)
    .attr('opacity', 0)
    .remove()

  const linkEnter = linkSelection.enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(100, 120, 180, 0.3)')
    .attr('stroke-width', 1)
    .attr('opacity', 0)

  linkEnter.merge(linkSelection)
    .transition()
    .duration(500)
    .attr('opacity', 1)
    .attr('d', (d) => {
      const [sx, sy] = radialPoint(d.source.x!, d.source.y!)
      const [tx, ty] = radialPoint(d.target.x!, d.target.y!)
      return `M${sx},${sy}L${tx},${ty}`
    })

  // Update nodes
  const nodeSelection = nodesGroup
    .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
    .data(visibleNodes, (d) => d.data.path || d.data.name)

  nodeSelection.exit()
    .transition()
    .duration(300)
    .attr('opacity', 0)
    .remove()

  const nodeEnter = nodeSelection.enter()
    .append('g')
    .attr('opacity', 0)

  // Add circles to new nodes
  nodeEnter.append('circle')

  // Add labels to folders
  nodeEnter.append('text')

  // Merge and update all nodes
  const nodeUpdate = nodeEnter.merge(nodeSelection)

  nodeUpdate
    .transition()
    .duration(500)
    .attr('opacity', 1)
    .attr('transform', (d) => {
      const [x, y] = radialPoint(d.x!, d.y!)
      return `translate(${x},${y})`
    })

  // Update circles
  nodeUpdate.select('circle')
    .attr('r', (d) => {
      if (d.data.type === 'folder') {
        return d.depth === 0 ? 8 : 4
      }
      return Math.max(3, Math.min(8, Math.sqrt((d.data.size || 100) / 500)))
    })
    .attr('fill', (d) => {
      if (d.data.type === 'folder') {
        return d.depth === 0 ? '#fff' : 'rgba(255,255,255,0.5)'
      }
      return getExtensionColor(d.data.extension || null)
    })
    .attr('stroke', (d) => d.data.type === 'folder' ? 'rgba(255,255,255,0.8)' : 'none')
    .attr('stroke-width', 1)

  // Update labels (only for root and top-level folders)
  nodeUpdate.select('text')
    .attr('dy', '0.31em')
    .attr('x', (d) => (d.x! < Math.PI) === !d.children ? 6 : -6)
    .attr('text-anchor', (d) => (d.x! < Math.PI) === !d.children ? 'start' : 'end')
    .attr('transform', (d) => {
      if (d.depth === 0) return ''
      const angle = (d.x! * 180) / Math.PI - 90
      return `rotate(${angle > 90 || angle < -90 ? angle + 180 : angle})`
    })
    .attr('fill', 'rgba(255,255,255,0.7)')
    .attr('font-size', (d) => d.depth === 0 ? 12 : 9)
    .text((d) => {
      if (d.depth === 0) return d.data.name
      if (d.depth === 1 && d.data.type === 'folder') return d.data.name
      return ''
    })

  // Tooltips for files
  nodeUpdate
    .filter((d) => d.data.type === 'file')
    .select('circle')
    .style('cursor', 'pointer')
    .on('mouseover', function () {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2)
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', 'none')
    })

  nodeUpdate.selectAll('title').remove()
  nodeUpdate
    .filter((d) => d.data.type === 'file')
    .append('title')
    .text((d) => `${d.data.name}\n${d.data.path}`)
}

function getExtensionColor(ext: string | null): string {
  if (!ext) return extensionColors.other
  return extensionColors[ext.toLowerCase()] || extensionColors.other
}

function toggleExtension(ext: string) {
  const newSet = new Set(hiddenExtensions.value)
  if (newSet.has(ext)) {
    newSet.delete(ext)
  } else {
    newSet.add(ext)
  }
  hiddenExtensions.value = newSet
  // Re-render to apply filter
  if (diagramContainer.value) {
    const svg = d3.select(diagramContainer.value).select('svg')
    if (!svg.empty()) {
      const g = svg.select<SVGGElement>('g')
      const linksGroup = g.select<SVGGElement>('.links')
      const nodesGroup = g.select<SVGGElement>('.nodes')
      const width = diagramContainer.value.clientWidth || 900
      const height = 600
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

// Watch for index changes - re-render with same SVG
watch(currentIndex, () => {
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
  const height = 600
  
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
  }, 2000)
}

function stopPlay() {
  isPlaying.value = false
  if (playInterval) {
    clearInterval(playInterval)
    playInterval = null
  }
}

// Initialize
onMounted(() => {
  loadEvolution()
})

// Handle resize
onMounted(() => {
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
.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.canvas-wrapper {
  position: relative;
  height: 600px;
}

.gource-container {
  width: 100%;
  height: 600px;
  background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%);
}

.legend-overlay {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.legend-item:hover {
  background: #f3f4f6;
}

.color-dot {
  width: 14px;
  height: 14px;
  min-width: 14px;
  min-height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
