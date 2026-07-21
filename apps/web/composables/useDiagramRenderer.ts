import * as d3 from 'd3'
import {
  DIAGRAM,
  D3_TRANSITION_DURATION_MS,
  D3_EXIT_TRANSITION_DURATION_MS,
} from '@git-wayback/shared'
import type { TreeNode, TagSnapshot } from './useDiagramTree'
import {
  buildTree,
  collapseTree,
  RENDER_FILE_BUDGET,
  getExtensionColor,
  getNodeColor,
  getFileKind,
  darken,
  EXTENSION_COLORS,
} from './useDiagramTree'

const HOVER_TRANSITION_MS = 300
const HOVER_SCALE = 2.2
// Links inherit the connected (target) node's color; this keeps them subtle
// at rest while hover bumps the opacity to full.
const LINK_BASE_OPACITY = 0.35
// Above this many visible nodes the enter/update transitions are dropped.
// Interpolating attributes on thousands of SVG elements at 60fps is what makes
// large repos crawl; past the threshold snapshots swap instantly instead.
const ANIMATE_MAX_NODES = 900

// darken() re-parses the color string on every call. The palette is tiny, so
// cache the derived stroke colors across renders.
const strokeCache = new Map<string, string>()
function strokeFor(color: string): string {
  let s = strokeCache.get(color)
  if (!s) {
    s = darken(color, 0.75)
    strokeCache.set(color, s)
  }
  return s
}

export function useDiagramRenderer(
  diagramContainer: Ref<HTMLElement | null>,
  currentSnapshot: ComputedRef<TagSnapshot | undefined>,
  repoName: Ref<string>,
  hiddenExtensions: Ref<Set<string>>,
  tooltip: Ref<{ visible: boolean; x: number; y: number; name: string; dir: string; kind: string }>,
  hoveredGraphPath: Ref<string | null>,
  onNodeClick: (path: string) => void,
  expanded?: Ref<boolean>,
) {
  // Normal mode keeps the fixed design height; expanded mode fills the
  // container vertically (overlay below the app header).
  const resolveHeight = (el: HTMLElement | null) =>
    expanded?.value && el?.clientHeight ? el.clientHeight : DIAGRAM.HEIGHT

  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
  let svgRoot: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
  // Folders whose 'more' bubble the user clicked — rendered in full from then on.
  const expandedFolders = new Set<string>()
  /** Files currently folded into 'more' bubbles; 0 when the whole tree is drawn. */
  const collapsedFiles = ref(0)

  function getNodeRadius(d: d3.HierarchyNode<TreeNode>): number {
    if (d.data.type === 'folder') {
      return d.depth === 0 ? 6 : 3
    }
    if (d.data.type === 'more') {
      return Math.max(6, Math.min(12, 4 + Math.sqrt(d.data.count || 1)))
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
      .attr('stroke-opacity', 1)
      .attr('stroke-width', 1.5)
  }

  function unhighlightParentLink(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    linksGroup.selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
      .filter((d) => (d.target.data.path || d.target.data.name) === (data.path || data.name))
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('stroke', getNodeColor(data))
      .attr('stroke-opacity', LINK_BASE_OPACITY)
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

    // Thin the tree before laying it out: on a big repo most of the cost is
    // simply the number of SVG elements, so cap files per folder and stand the
    // remainder up as one clickable 'more' bubble.
    const tree = collapseTree(
      buildTree(currentSnapshot.value.files, repoName.value),
      RENDER_FILE_BUDGET,
      expandedFolders,
    )
    const root = d3.hierarchy(tree)

    const treeLayout = d3.tree<TreeNode>()
      .size([2 * Math.PI, Math.min(width, height) / 2 - 100])
      .separation((a, b) => (a.parent === b.parent ? 4 : 7) / a.depth)

    const treeData = treeLayout(root)
    const nodes = treeData.descendants()
    const links = treeData.links()

    collapsedFiles.value = nodes.reduce(
      (n, d) => (d.data.type === 'more' ? n + (d.data.count || 0) : n),
      0,
    )

    const radialPoint = (x: number, y: number): [number, number] => {
      return [(y) * Math.cos(x - Math.PI / 2) + centerX, (y) * Math.sin(x - Math.PI / 2) + centerY]
    }

    const visibleNodes = nodes.filter(d => {
      if (d.data.type !== 'file') return true
      return !isExtensionHidden(d.data.extension || null)
    })

    const visibleLinks = links.filter(d => {
      if (d.target.data.type !== 'file') return true
      return !isExtensionHidden(d.target.data.extension || null)
    })

    // Hover/click handlers are delegated once on the two groups (see
    // bindDelegatedEvents), so nothing below attaches per-element listeners:
    // on a big repo that alone meant tens of thousands of closures per render.
    const animate = visibleNodes.length <= ANIMATE_MAX_NODES

    // Links
    const linkSelection = linksGroup
      .selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path')
      .data(visibleLinks, (d) => `${d.source.data.path}-${d.target.data.path}`)

    const linkExit = linkSelection.exit()
    if (animate) {
      linkExit.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 0).remove()
    } else {
      linkExit.remove()
    }

    const linkEnter = linkSelection.enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => getNodeColor(d.target.data))
      .attr('stroke-opacity', LINK_BASE_OPACITY)
      .attr('stroke-width', 1)
      .attr('opacity', animate ? 0 : 1)

    const linkMerged = linkEnter.merge(linkSelection)

    const linkPath = (d: d3.HierarchyLink<TreeNode>) => {
      const [sx, sy] = radialPoint(d.source.x!, d.source.y!)
      const [tx, ty] = radialPoint(d.target.x!, d.target.y!)
      return `M${sx},${sy}L${tx},${ty}`
    }

    if (animate) {
      linkMerged
        .transition()
        .duration(D3_TRANSITION_DURATION_MS)
        .attr('opacity', 1)
        .attr('d', linkPath)
    } else {
      linkMerged.attr('opacity', 1).attr('d', linkPath)
    }

    // Nodes
    const nodeSelection = nodesGroup
      .selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g')
      .data(visibleNodes, (d) => d.data.path || d.data.name)

    const nodeExit = nodeSelection.exit()
    if (animate) {
      nodeExit.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 0).remove()
    } else {
      nodeExit.remove()
    }

    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('opacity', animate ? 0 : 1)

    // Nodes are keyed by path, so radius/fill/stroke never change once the
    // element exists — set them on enter instead of rewriting every attribute
    // of every circle on every snapshot.
    nodeEnter.append('circle')
      .attr('class', 'main')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => {
        if (d.data.type === 'folder') {
          return d.depth === 0 ? 'rgb(16, 185, 129)' : 'rgba(16, 185, 129, 0.4)'
        }
        if (d.data.type === 'more') return 'rgba(107, 114, 128, 0.35)'
        return getExtensionColor(d.data.extension || null)
      })
      .attr('stroke', (d) => strokeFor(getNodeColor(d.data)))
      .attr('stroke-width', (d) => (d.data.type === 'more' ? 1.2 : 1))
      .attr('stroke-dasharray', (d) => (d.data.type === 'more' ? '2 2' : null))

    // Count label, only on the handful of 'more' bubbles.
    nodeEnter.filter((d) => d.data.type === 'more')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.34em')
      .attr('font-size', 8)
      .attr('fill', '#d4d4d4')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text((d) => d.data.name)

    const nodeUpdate = nodeEnter.merge(nodeSelection)

    const nodeTransform = (d: d3.HierarchyNode<TreeNode>) => {
      const [x, y] = radialPoint(d.x!, d.y!)
      return `translate(${x},${y})`
    }

    if (animate) {
      nodeUpdate
        .transition()
        .duration(D3_TRANSITION_DURATION_MS)
        .attr('opacity', 1)
        .attr('transform', nodeTransform)
    } else {
      nodeUpdate.attr('opacity', 1).attr('transform', nodeTransform)
    }
  }

  // One listener per group rather than per element. Events bubble up from the
  // circles/paths, so the datum is read off event.target.
  function bindDelegatedEvents(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  ) {
    linksGroup.style('cursor', 'pointer').style('pointer-events', 'visibleStroke')
    nodesGroup.style('cursor', 'pointer')

    const linkAt = (event: Event) => {
      const t = event.target as Element | null
      if (!t || t.tagName !== 'path') return null
      return d3.select<SVGPathElement, d3.HierarchyLink<TreeNode>>(t as SVGPathElement)
    }
    const circleAt = (event: Event) => {
      const t = event.target as Element | null
      if (!t || t.tagName !== 'circle') return null
      return d3.select<SVGCircleElement, d3.HierarchyNode<TreeNode>>(t as SVGCircleElement)
    }

    linksGroup
      .on('mouseover', (event: MouseEvent) => {
        const sel = linkAt(event)
        if (!sel) return
        const d = sel.datum()
        sel.transition().duration(HOVER_TRANSITION_MS)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 1.5)
        highlightNodeCircle(nodesGroup, d.target.data)
        showTooltip(event, d.target.data)
        hoveredGraphPath.value = d.target.data.path || d.target.data.name
      })
      .on('mousemove', (event: MouseEvent) => {
        const sel = linkAt(event)
        if (!sel) return
        showTooltip(event, sel.datum().target.data)
      })
      .on('mouseout', (event: MouseEvent) => {
        const sel = linkAt(event)
        if (!sel) return
        const d = sel.datum()
        sel.transition().duration(HOVER_TRANSITION_MS)
          .attr('stroke-opacity', LINK_BASE_OPACITY)
          .attr('stroke-width', 1)
        unhighlightNodeCircle(nodesGroup, d.target.data)
        tooltip.value.visible = false
        hoveredGraphPath.value = null
      })

    nodesGroup
      .on('mouseover', (event: MouseEvent) => {
        const sel = circleAt(event)
        if (!sel) return
        const d = sel.datum()
        sel.transition().duration(HOVER_TRANSITION_MS).attr('r', getNodeRadius(d) * HOVER_SCALE)
        highlightParentLink(linksGroup, d.data)
        showTooltip(event, d.data)
        hoveredGraphPath.value = d.data.path || d.data.name
      })
      .on('mousemove', (event: MouseEvent) => {
        const sel = circleAt(event)
        if (!sel) return
        showTooltip(event, sel.datum().data)
      })
      .on('mouseout', (event: MouseEvent) => {
        const sel = circleAt(event)
        if (!sel) return
        const d = sel.datum()
        sel.transition().duration(HOVER_TRANSITION_MS).attr('r', getNodeRadius(d))
        unhighlightParentLink(linksGroup, d.data)
        tooltip.value.visible = false
        hoveredGraphPath.value = null
      })
      .on('click', (event: MouseEvent) => {
        const sel = circleAt(event)
        if (!sel) return
        event.stopPropagation()
        const d = sel.datum()

        // Clicking a 'more' bubble reveals the folder it stands for, and keeps
        // it revealed across snapshots.
        if (d.data.type === 'more') {
          expandedFolders.add(d.parent?.data.path ?? '')
          tooltip.value.visible = false
          updateTree()
          return
        }

        showTooltip(event, d.data)
        onNodeClick(d.data.path || d.data.name)
      })
  }

  function initGource() {
    if (!diagramContainer.value || !currentSnapshot.value) return

    const container = diagramContainer.value
    const width = container.clientWidth || DIAGRAM.DEFAULT_WIDTH
    const height = resolveHeight(container)
    const centerX = width / 2
    const centerY = height / 2

    d3.select(container).selectAll('*').remove()

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      // Cheaper rasterization for thousands of small circles.
      .style('shape-rendering', 'optimizeSpeed')

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

    bindDelegatedEvents(linksGroup, nodesGroup)
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
    const height = resolveHeight(diagramContainer.value)

    // Keep the svg viewport in sync with the container (resize / expand toggle).
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height].join(' '))

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
    const height = resolveHeight(diagramContainer.value)
    const scale = 2.5
    const tx = width / 2 - target.x * scale
    const ty = height / 2 - target.y * scale

    svgRoot.transition()
      .duration(700)
      .ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }

  return {
    collapsedFiles,
    initGource,
    retryInitGource,
    updateTree,
    highlightByPath,
    unhighlightByPath,
    zoomToPath,
  }
}
