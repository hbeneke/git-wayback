import * as d3 from 'd3'
import {
  DIAGRAM,
  D3_TRANSITION_DURATION_MS,
  D3_EXIT_TRANSITION_DURATION_MS,
} from '@git-wayback/shared'
import type { TreeNode, TagSnapshot } from './useDiagramTree'
import {
  buildTree,
  getExtensionColor,
  getNodeColor,
  getFileKind,
  darken,
  EXTENSION_COLORS,
} from './useDiagramTree'

const HOVER_TRANSITION_MS = 300
const HOVER_SCALE = 2.2

export function useDiagramRenderer(
  diagramContainer: Ref<HTMLElement | null>,
  currentSnapshot: ComputedRef<TagSnapshot | undefined>,
  repoName: Ref<string>,
  hiddenExtensions: Ref<Set<string>>,
  tooltip: Ref<{ visible: boolean; x: number; y: number; name: string; dir: string; kind: string }>,
  hoveredGraphPath: Ref<string | null>,
  onNodeClick: (path: string) => void,
) {
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  let svgRoot: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  function getNodeRadius(d: d3.HierarchyNode<TreeNode>): number {
    if (d.data.type === 'folder') {
      return d.depth === 0 ? 6 : 3
    }
    return Math.max(2, Math.min(6, Math.sqrt((d.data.size || 100) / 500)))
  }

  function isExtensionHidden(ext: string | null): boolean {
    if (!ext) return hiddenExtensions.value.has('other')
    const normalizedExt = ext.toLowerCase()
    if (EXTENSION_COLORS[normalizedExt]) {
      return hiddenExtensions.value.has(normalizedExt)
    }
    return hiddenExtensions.value.has('other')
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

  function highlightParentLink(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    linksGroup.selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
      .filter((d) => (d.target.data.path || d.target.data.name) === (data.path || data.name))
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('stroke', getNodeColor(data))
      .attr('stroke-width', 1.25)
  }

  function unhighlightParentLink(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    linksGroup.selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
      .filter((d) => (d.target.data.path || d.target.data.name) === (data.path || data.name))
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('stroke', 'rgba(16, 185, 129, 0.15)')
      .attr('stroke-width', 1)
  }

  function highlightNodeCircle(
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    nodesGroup.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .filter((d) => (d.data.path || d.data.name) === (data.path || data.name))
      .select<SVGCircleElement>('circle.main')
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('r', function () {
        const d = d3.select(this).datum() as d3.HierarchyNode<TreeNode>
        return getNodeRadius(d) * HOVER_SCALE
      })
  }

  function unhighlightNodeCircle(
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    nodesGroup.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .filter((d) => (d.data.path || d.data.name) === (data.path || data.name))
      .select<SVGCircleElement>('circle.main')
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('r', function () {
        const d = d3.select(this).datum() as d3.HierarchyNode<TreeNode>
        return getNodeRadius(d)
      })
  }

  function renderTree(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
  ) {
    if (!currentSnapshot.value) return

    const tree = buildTree(currentSnapshot.value.files, repoName.value)
    const root = d3.hierarchy(tree)

    const treeLayout = d3.tree<TreeNode>()
      .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
      .separation((a, b) => (a.parent === b.parent ? 4 : 7) / a.depth)

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

    // --- Links ---
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

    const linkMerged = linkEnter.merge(linkSelection)

    linkMerged
      .transition()
      .duration(D3_TRANSITION_DURATION_MS)
      .attr('opacity', 1)
      .attr('d', (d) => {
        const [sx, sy] = radialPoint(d.source.x!, d.source.y!)
        const [tx, ty] = radialPoint(d.target.x!, d.target.y!)
        return `M${sx},${sy}L${tx},${ty}`
      })

    linkMerged
      .style('cursor', 'pointer')
      .style('pointer-events', 'visibleStroke')
      .on('mouseover', function (event, d) {
        const color = getNodeColor(d.target.data)
        d3.select(this)
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('stroke', color)
          .attr('stroke-width', 1.25)
        highlightNodeCircle(nodesGroup, d.target.data)
        showTooltip(event, d.target.data)
        hoveredGraphPath.value = d.target.data.path || d.target.data.name
      })
      .on('mousemove', function (event, d) {
        showTooltip(event, d.target.data)
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('stroke', 'rgba(16, 185, 129, 0.15)')
          .attr('stroke-width', 1)
        unhighlightNodeCircle(nodesGroup, d.target.data)
        tooltip.value.visible = false
        hoveredGraphPath.value = null
      })

    // --- Nodes ---
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

    nodeEnter.append('circle').attr('class', 'main')

    const nodeUpdate = nodeEnter.merge(nodeSelection)

    nodeUpdate
      .transition()
      .duration(D3_TRANSITION_DURATION_MS)
      .attr('opacity', 1)
      .attr('transform', (d) => {
        const [x, y] = radialPoint(d.x!, d.y!)
        return `translate(${x},${y})`
      })

    nodeUpdate.select('circle.main')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => {
        if (d.data.type === 'folder') {
          return d.depth === 0 ? 'rgb(16, 185, 129)' : 'rgba(16, 185, 129, 0.4)'
        }
        return getExtensionColor(d.data.extension || null)
      })
      .attr('stroke', (d) => darken(getNodeColor(d.data), 0.75))
      .attr('stroke-width', 1)

    nodeUpdate
      .select('circle.main')
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', getNodeRadius(d) * HOVER_SCALE)
        highlightParentLink(linksGroup, d.data)
        showTooltip(event, d.data)
        hoveredGraphPath.value = d.data.path || d.data.name
      })
      .on('mousemove', function (event, d) {
        showTooltip(event, d.data)
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', getNodeRadius(d))
        unhighlightParentLink(linksGroup, d.data)
        tooltip.value.visible = false
        hoveredGraphPath.value = null
      })
      .on('click', function (event, d) {
        event.stopPropagation()
        showTooltip(event, d.data)
        onNodeClick(d.data.path || d.data.name)
      })
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

    zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    svg.call(zoomBehavior)
    svg.style('touch-action', 'none')
    svgRoot = svg

    const linksGroup = g.append('g').attr('class', 'links')
    const nodesGroup = g.append('g').attr('class', 'nodes')

    renderTree(linksGroup, nodesGroup, width, height, centerX, centerY)
  }

  function retryInitGource(attempts = 0) {
    if (!diagramContainer.value || !currentSnapshot.value) return
    if (diagramContainer.value.clientWidth === 0 && attempts < 10) {
      requestAnimationFrame(() => retryInitGource(attempts + 1))
      return
    }
    initGource()
  }

  function updateTree() {
    if (!diagramContainer.value) return

    const svg = d3.select(diagramContainer.value).select('svg')
    if (svg.empty()) {
      initGource()
      return
    }

    const g = svg.select<SVGGElement>('g')
    const linksGroup = g.select<SVGGElement>('.links')
    const nodesGroup = g.select<SVGGElement>('.nodes')

    const width = diagramContainer.value.clientWidth || DIAGRAM.DEFAULT_WIDTH
    const height = DIAGRAM.HEIGHT

    renderTree(linksGroup, nodesGroup, width, height, width / 2, height / 2)
  }

  function getDiagramGroups() {
    if (!diagramContainer.value) return null
    const svg = d3.select(diagramContainer.value).select<SVGSVGElement>('svg')
    if (svg.empty()) return null
    const g = svg.select<SVGGElement>('g')
    const linksGroup = g.select<SVGGElement>('.links')
    const nodesGroup = g.select<SVGGElement>('.nodes')
    if (linksGroup.empty() || nodesGroup.empty()) return null
    return { linksGroup, nodesGroup }
  }

  function highlightByPath(path: string) {
    const groups = getDiagramGroups()
    if (!groups) return
    const { linksGroup, nodesGroup } = groups

    nodesGroup.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .filter((d) => (d.data.path || d.data.name) === path)
      .each(function (d) {
        d3.select(this).select<SVGCircleElement>('circle.main')
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', getNodeRadius(d) * HOVER_SCALE)
        highlightParentLink(linksGroup, d.data)
      })
  }

  function unhighlightByPath(path: string) {
    const groups = getDiagramGroups()
    if (!groups) return
    const { linksGroup, nodesGroup } = groups

    nodesGroup.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .filter((d) => (d.data.path || d.data.name) === path)
      .each(function (d) {
        d3.select(this).select<SVGCircleElement>('circle.main')
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', getNodeRadius(d))
        unhighlightParentLink(linksGroup, d.data)
      })
  }

  function zoomToPath(path: string) {
    if (!svgRoot || !zoomBehavior || !diagramContainer.value) return
    const groups = getDiagramGroups()
    if (!groups) return
    const { nodesGroup } = groups

    let target: { x: number; y: number } | null = null
    nodesGroup.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .filter((d) => (d.data.path || d.data.name) === path)
      .each(function () {
        const t = d3.select(this).attr('transform') || ''
        const m = /translate\(([-\d.eE]+)[ ,]+([-\d.eE]+)\)/.exec(t)
        if (m) target = { x: parseFloat(m[1]), y: parseFloat(m[2]) }
      })

    if (!target) return

    const width = diagramContainer.value.clientWidth || DIAGRAM.DEFAULT_WIDTH
    const height = DIAGRAM.HEIGHT
    const scale = 2.5
    const tx = width / 2 - target.x * scale
    const ty = height / 2 - target.y * scale

    svgRoot.transition()
      .duration(700)
      .ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }

  return {
    initGource,
    retryInitGource,
    updateTree,
    highlightByPath,
    unhighlightByPath,
    zoomToPath,
  }
}
