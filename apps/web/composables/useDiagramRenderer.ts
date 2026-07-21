import * as d3 from 'd3'
import {
  DIAGRAM,
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
// Above this many nodes the enter/exit fades are dropped — the layout itself is
// animated by the simulation, so the fades are pure overhead on big graphs.
const ANIMATE_MAX_NODES = 900

// Simulation tuning. alphaDecay/alphaMin are deliberately faster than d3's
// defaults (~300 ticks): the graph should settle in well under the 2s playback
// interval and then stop burning frames.
const SIM_ALPHA_DECAY = 0.055
const SIM_ALPHA_MIN = 0.02
const SIM_VELOCITY_DECAY = 0.45
/** Alpha injected when a new snapshot arrives — a nudge, not a full reheat. */
const SIM_RESTART_ALPHA = 0.55

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

interface SimNode extends d3.SimulationNodeDatum {
  key: string
  data: TreeNode
  depth: number
  r: number
  parentKey: string | null
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  key: string
  source: SimNode
  target: SimNode
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

  // Simulation state. Nodes are kept in a map keyed by path so a file that
  // survives from one snapshot to the next keeps its position and velocity —
  // that continuity is what makes the graph look like it is growing rather
  // than being redrawn.
  let simulation: d3.Simulation<SimNode, SimLink> | null = null
  const nodeByKey = new Map<string, SimNode>()
  let nodeSel: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | null = null
  let linkSel: d3.Selection<SVGPathElement, SimLink, SVGGElement, unknown> | null = null
  let centerX = DIAGRAM.DEFAULT_WIDTH / 2
  let centerY = DIAGRAM.HEIGHT / 2

  function getNodeRadius(d: { data: TreeNode; depth: number }): number {
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
    linksGroup.selectAll<SVGPathElement, SimLink>('path')
      .filter((d) => d.target.key === (data.path || data.name))
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('stroke', getNodeColor(data))
      .attr('stroke-opacity', 1)
      .attr('stroke-width', 1.5)
  }

  function unhighlightParentLink(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    linksGroup.selectAll<SVGPathElement, SimLink>('path')
      .filter((d) => d.target.key === (data.path || data.name))
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('stroke', getNodeColor(data))
      .attr('stroke-opacity', LINK_BASE_OPACITY)
      .attr('stroke-width', 1)
  }

  function highlightNodeCircle(
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    nodesGroup.selectAll<SVGGElement, SimNode>('g')
      .filter((d) => d.key === (data.path || data.name))
      .select<SVGCircleElement>('circle.main')
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('r', function () {
        const d = d3.select(this).datum() as SimNode
        return d.r * HOVER_SCALE
      })
  }

  function unhighlightNodeCircle(
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TreeNode,
  ) {
    nodesGroup.selectAll<SVGGElement, SimNode>('g')
      .filter((d) => d.key === (data.path || data.name))
      .select<SVGCircleElement>('circle.main')
      .transition().duration(HOVER_TRANSITION_MS)
      .attr('r', function () {
        const d = d3.select(this).datum() as SimNode
        return d.r
      })
  }

  /**
   * Builds the simulation node/link arrays for the current snapshot, reusing
   * (and repositioning) the nodes that already exist. New nodes spawn on top of
   * their parent with a little jitter so they visibly push outwards from it.
   */
  function buildGraph(): { nodes: SimNode[]; links: SimLink[] } {
    if (!currentSnapshot.value) return { nodes: [], links: [] }

    // Thin the tree first: on a big repo most of the cost is simply the number
    // of elements the simulation and the DOM have to carry.
    const tree = collapseTree(
      buildTree(currentSnapshot.value.files, repoName.value),
      RENDER_FILE_BUDGET,
      expandedFolders,
    )
    const root = d3.hierarchy(tree)
    const descendants = root.descendants()

    collapsedFiles.value = descendants.reduce(
      (n, d) => (d.data.type === 'more' ? n + (d.data.count || 0) : n),
      0,
    )

    const visible = descendants.filter((d) => {
      if (d.data.type !== 'file') return true
      return !isExtensionHidden(d.data.extension || null)
    })

    const seen = new Set<string>()
    const nodes: SimNode[] = []

    for (const d of visible) {
      const key = d.data.path || d.data.name
      const parentKey = d.parent ? d.parent.data.path || d.parent.data.name : null
      seen.add(key)

      let node = nodeByKey.get(key)
      if (!node) {
        const parent = parentKey ? nodeByKey.get(parentKey) : null
        node = {
          key,
          data: d.data,
          depth: d.depth,
          r: 1,
          parentKey,
          x: (parent?.x ?? centerX) + (Math.random() - 0.5) * 20,
          y: (parent?.y ?? centerY) + (Math.random() - 0.5) * 20,
        }
        nodeByKey.set(key, node)
      }
      node.data = d.data
      node.depth = d.depth
      node.parentKey = parentKey
      node.r = getNodeRadius(d)
      nodes.push(node)
    }

    // Drop nodes that left the graph, otherwise the map grows across the whole
    // timeline and the simulation keeps ticking bodies nobody can see.
    for (const key of nodeByKey.keys()) {
      if (!seen.has(key)) nodeByKey.delete(key)
    }

    const links: SimLink[] = []
    for (const node of nodes) {
      if (!node.parentKey) continue
      const source = nodeByKey.get(node.parentKey)
      if (!source) continue
      links.push({ key: `${source.key}->${node.key}`, source, target: node })
    }

    // The repo root anchors the whole graph at the center.
    const rootNode = nodes[0]
    if (rootNode && rootNode.depth === 0) {
      rootNode.fx = centerX
      rootNode.fy = centerY
    }

    return { nodes, links }
  }

  function linkDistance(d: SimLink): number {
    // Shorter as we go deeper, so folders spread out and their files cluster
    // tightly around them instead of everything fighting for the same ring.
    return Math.max(12, 70 / Math.max(d.target.depth, 1)) + d.target.r
  }

  function ensureSimulation() {
    if (simulation) return simulation

    simulation = d3.forceSimulation<SimNode, SimLink>()
      .force('link', d3.forceLink<SimNode, SimLink>()
        .id((d) => d.key)
        .distance(linkDistance)
        .strength(0.7))
      .force('charge', d3.forceManyBody<SimNode>()
        .strength(-38)
        // Bounding the range keeps the Barnes-Hut pass cheap on big graphs;
        // distant nodes barely influence each other anyway.
        .distanceMax(420)
        .theta(0.9))
      .force('collide', d3.forceCollide<SimNode>((d) => d.r + 1.5).iterations(1))
      .force('x', d3.forceX<SimNode>(() => centerX).strength(0.015))
      .force('y', d3.forceY<SimNode>(() => centerY).strength(0.015))
      .velocityDecay(SIM_VELOCITY_DECAY)
      .alphaDecay(SIM_ALPHA_DECAY)
      .alphaMin(SIM_ALPHA_MIN)
      .on('tick', ticked)

    return simulation
  }

  // Called once per simulation tick, so it must stay allocation-light: plain
  // attribute writes, no transitions, no selection lookups.
  function ticked() {
    nodeSel?.attr('transform', (d) => `translate(${d.x},${d.y})`)
    linkSel?.attr('d', (d) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`)
  }

  function renderGraph(
    linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  ) {
    const { nodes, links } = buildGraph()
    if (!nodes.length) return

    // Hover/click handlers are delegated once on the two groups (see
    // bindDelegatedEvents), so nothing below attaches per-element listeners.
    const animate = nodes.length <= ANIMATE_MAX_NODES

    // Links
    const linkJoin = linksGroup
      .selectAll<SVGPathElement, SimLink>('path')
      .data(links, (d) => d.key)

    const linkExit = linkJoin.exit()
    if (animate) {
      linkExit.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 0).remove()
    } else {
      linkExit.remove()
    }

    const linkEnter = linkJoin.enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => getNodeColor(d.target.data))
      .attr('stroke-opacity', LINK_BASE_OPACITY)
      .attr('stroke-width', 1)
      .attr('opacity', animate ? 0 : 1)

    if (animate) {
      linkEnter.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 1)
    }

    linkSel = linkEnter.merge(linkJoin)

    // Nodes
    const nodeJoin = nodesGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes, (d) => d.key)

    const nodeExit = nodeJoin.exit()
    if (animate) {
      nodeExit.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 0).remove()
    } else {
      nodeExit.remove()
    }

    const nodeEnter = nodeJoin.enter()
      .append('g')
      .attr('opacity', animate ? 0 : 1)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)

    if (animate) {
      nodeEnter.transition().duration(D3_EXIT_TRANSITION_DURATION_MS).attr('opacity', 1)
    }

    // A node is keyed by path, so fill/stroke never change once it exists —
    // set them on enter rather than rewriting every circle on every snapshot.
    nodeEnter.append('circle')
      .attr('class', 'main')
      .attr('r', (d) => d.r)
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

    nodeSel = nodeEnter.merge(nodeJoin)

    // A 'more' bubble grows as its folder gains files, so its radius does move.
    nodeSel.select<SVGCircleElement>('circle.main')
      .filter((d) => d.data.type === 'more')
      .attr('r', (d) => d.r)
    nodeSel.select<SVGTextElement>('text').text((d) => d.data.name)

    const sim = ensureSimulation()
    sim.nodes(nodes)
    sim.force<d3.ForceLink<SimNode, SimLink>>('link')?.links(links)
    sim.alpha(SIM_RESTART_ALPHA).restart()
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
      return d3.select<SVGPathElement, SimLink>(t as SVGPathElement)
    }
    const circleAt = (event: Event) => {
      const t = event.target as Element | null
      if (!t || t.tagName !== 'circle') return null
      return d3.select<SVGCircleElement, SimNode>(t as SVGCircleElement)
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
        hoveredGraphPath.value = d.target.key
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
        sel.transition().duration(HOVER_TRANSITION_MS).attr('r', d.r * HOVER_SCALE)
        highlightParentLink(linksGroup, d.data)
        showTooltip(event, d.data)
        hoveredGraphPath.value = d.key
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
        sel.transition().duration(HOVER_TRANSITION_MS).attr('r', d.r)
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
          expandedFolders.add(d.parentKey ?? '')
          tooltip.value.visible = false
          updateTree()
          return
        }

        showTooltip(event, d.data)
        onNodeClick(d.key)
      })
  }

  function initGource() {
    if (!diagramContainer.value || !currentSnapshot.value) return

    const container = diagramContainer.value
    const width = container.clientWidth || DIAGRAM.DEFAULT_WIDTH
    const height = resolveHeight(container)
    centerX = width / 2
    centerY = height / 2

    d3.select(container).selectAll('*').remove()
    nodeByKey.clear()
    nodeSel = null
    linkSel = null

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
    renderGraph(linksGroup, nodesGroup)
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
    centerX = width / 2
    centerY = height / 2

    // Keep the svg viewport in sync with the container (resize / expand toggle).
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height].join(' '))

    renderGraph(linksGroup, nodesGroup)
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

    nodesGroup.selectAll<SVGGElement, SimNode>('g')
      .filter((d) => d.key === path)
      .each(function (d) {
        d3.select(this).select<SVGCircleElement>('circle.main')
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', d.r * HOVER_SCALE)
        highlightParentLink(linksGroup, d.data)
      })
  }

  function unhighlightByPath(path: string) {
    const groups = getDiagramGroups()
    if (!groups) return
    const { linksGroup, nodesGroup } = groups

    nodesGroup.selectAll<SVGGElement, SimNode>('g')
      .filter((d) => d.key === path)
      .each(function (d) {
        d3.select(this).select<SVGCircleElement>('circle.main')
          .transition().duration(HOVER_TRANSITION_MS)
          .attr('r', d.r)
        unhighlightParentLink(linksGroup, d.data)
      })
  }

  function zoomToPath(path: string) {
    if (!svgRoot || !zoomBehavior || !diagramContainer.value) return

    const target = nodeByKey.get(path)
    if (!target || target.x === undefined || target.y === undefined) return

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

  /** Stops the simulation loop — the component must call this on unmount. */
  function destroyRenderer() {
    simulation?.stop()
    simulation = null
    nodeByKey.clear()
    nodeSel = null
    linkSel = null
  }

  return {
    collapsedFiles,
    initGource,
    retryInitGource,
    updateTree,
    highlightByPath,
    unhighlightByPath,
    zoomToPath,
    destroyRenderer,
  }
}
