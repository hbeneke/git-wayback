import { D3_EXIT_TRANSITION_DURATION_MS, DIAGRAM } from '@git-wayback/shared'
import * as d3 from 'd3'
import type { TreeNode } from './useDiagramTree'
import {
  collapseTree,
  darken,
  EXTENSION_COLORS,
  getExtensionColor,
  getFileKind,
  getNodeColor,
  RENDER_FILE_BUDGET,
} from './useDiagramTree'

const TAU = Math.PI * 2

const HOVER_SCALE = 2.2
const HOVER_MS = 160
const LINK_BASE_ALPHA = 0.35
/** Screen-space slack around the cursor when picking a node. */
const HIT_RADIUS_PX = 10

// Faster than d3 defaults so the graph settles well inside the playback interval.
const SIM_ALPHA_DECAY = 0.055
const SIM_ALPHA_MIN = 0.02
const SIM_VELOCITY_DECAY = 0.45
/** Alpha injected when a new snapshot arrives — a nudge, not a full reheat. */
const SIM_RESTART_ALPHA = 0.55

const FOLDER_ROOT_FILL = 'rgb(16, 185, 129)'
const FOLDER_FILL = 'rgba(16, 185, 129, 0.4)'
const MORE_FILL = 'rgba(107, 114, 128, 0.35)'

// darken() re-parses the color string on every call; the palette is tiny.
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
  fill: string
  stroke: string
  dashed: boolean
  /** Batch key — nodes sharing one are drawn as a single canvas path. */
  style: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  key: string
  source: SimNode
  target: SimNode
  color: string
}

export function useDiagramRenderer(
  diagramContainer: Ref<HTMLElement | null>,
  /** Full tree for the current snapshot, built once by the owning component. */
  fileTree: ComputedRef<TreeNode | null>,
  hiddenExtensions: Ref<Set<string>>,
  tooltip: Ref<{ visible: boolean; x: number; y: number; name: string; dir: string; kind: string }>,
  hoveredGraphPath: Ref<string | null>,
  onNodeClick: (path: string) => void,
  expanded?: Ref<boolean>,
) {
  // Expanded mode fills the container; normal mode keeps the design height.
  const resolveHeight = (el: HTMLElement | null) =>
    expanded?.value && el?.clientHeight ? el.clientHeight : DIAGRAM.HEIGHT

  // Folders whose 'more' bubble the user clicked — rendered in full from then on.
  const expandedFolders = new Set<string>()
  /** Files currently folded into 'more' bubbles; 0 when the whole tree is drawn. */
  const collapsedFiles = ref(0)

  // Canvas, not SVG: moving thousands of SVG elements per tick is what stalls big repos.
  let canvas: HTMLCanvasElement | null = null
  let canvasSel: d3.Selection<HTMLCanvasElement, unknown, null, undefined> | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let zoomBehavior: d3.ZoomBehavior<HTMLCanvasElement, unknown> | null = null
  let transform = d3.zoomIdentity
  let width = DIAGRAM.DEFAULT_WIDTH
  let height = DIAGRAM.HEIGHT
  let centerX = width / 2
  let centerY = height / 2

  // Keyed by path so a surviving file keeps its position — that is what makes the graph grow.
  let simulation: d3.Simulation<SimNode, SimLink> | null = null
  const nodeByKey = new Map<string, SimNode>()
  let nodes: SimNode[] = []
  let links: SimLink[] = []
  /** Parent link of each node, for the hover highlight. */
  const linkByTarget = new Map<string, SimLink>()
  let moreNodes: SimNode[] = []

  // Draw batches: one canvas path per color instead of one element per bubble.
  let nodeBatches: SimNode[][] = []
  let linkBatches: SimLink[][] = []
  let enterNodeBatches: SimNode[][] = []
  let enterLinkBatches: SimLink[][] = []
  let enterStart = 0
  let entering = false

  let drawFrame: number | null = null
  let quadtree: d3.Quadtree<SimNode> | null = null

  let hovered: SimNode | null = null
  let hoverStart = 0
  let externalKey: string | null = null

  function getNodeRadius(d: { data: TreeNode; depth: number }): number {
    if (d.data.type === 'folder') {
      return d.depth === 0 ? 6 : 3
    }
    if (d.data.type === 'more') {
      return Math.max(6, Math.min(12, 4 + Math.sqrt(d.data.count || 1)))
    }
    return Math.max(2, Math.min(6, Math.sqrt((d.data.size || 100) / 500)))
  }

  function fillFor(data: TreeNode, depth: number): string {
    if (data.type === 'folder') return depth === 0 ? FOLDER_ROOT_FILL : FOLDER_FILL
    if (data.type === 'more') return MORE_FILL
    return getExtensionColor(data.extension || null)
  }

  function isExtensionHidden(ext: string | null): boolean {
    if (!ext) return hiddenExtensions.value.has('other')
    const normalizedExt = ext.toLowerCase()
    if (EXTENSION_COLORS[normalizedExt]) {
      return hiddenExtensions.value.has(normalizedExt)
    }
    return hiddenExtensions.value.has('other')
  }

  function showTooltip(clientX: number, clientY: number, data: TreeNode) {
    const wrapper = diagramContainer.value?.parentElement
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const parts = data.path.split('/')
    const dir = parts.length > 1 ? `${parts.slice(0, -1).join('/')}/` : ''
    tooltip.value = {
      visible: true,
      x: clientX - rect.left + 12,
      y: clientY - rect.top - 8,
      name: data.name,
      dir,
      kind: getFileKind(data),
    }
  }

  function hideTooltip() {
    if (!tooltip.value.visible) return
    tooltip.value = { ...tooltip.value, visible: false }
  }

  function batchNodes(list: SimNode[]): SimNode[][] {
    const byStyle = new Map<string, SimNode[]>()
    for (const n of list) {
      const bucket = byStyle.get(n.style)
      if (bucket) bucket.push(n)
      else byStyle.set(n.style, [n])
    }
    return [...byStyle.values()]
  }

  function batchLinks(list: SimLink[]): SimLink[][] {
    const byColor = new Map<string, SimLink[]>()
    for (const l of list) {
      const bucket = byColor.get(l.color)
      if (bucket) bucket.push(l)
      else byColor.set(l.color, [l])
    }
    return [...byColor.values()]
  }

  /** Rebuilds nodes/links for the current snapshot, reusing surviving bodies. */
  function buildGraph() {
    if (!fileTree.value) {
      nodes = []
      links = []
      return
    }

    // Thin first: on a big repo the cost is simply the number of bodies carried.
    const tree = collapseTree(fileTree.value, RENDER_FILE_BUDGET, expandedFolders)
    const root = d3.hierarchy(tree)
    const descendants = root.descendants()

    collapsedFiles.value = descendants.reduce(
      (n, d) => (d.data.type === 'more' ? n + (d.data.count || 0) : n),
      0,
    )

    const seen = new Set<string>()
    const next: SimNode[] = []
    const fresh: SimNode[] = []
    const freshKeys = new Set<string>()
    moreNodes = []

    for (const d of descendants) {
      if (d.data.type === 'file' && isExtensionHidden(d.data.extension || null)) continue

      const key = d.data.path || d.data.name
      const parentKey = d.parent ? d.parent.data.path || d.parent.data.name : null
      seen.add(key)

      let node = nodeByKey.get(key)
      if (!node) {
        // New bubbles spawn on their parent with jitter so they push outwards.
        const parent = parentKey ? nodeByKey.get(parentKey) : null
        const fill = fillFor(d.data, d.depth)
        const stroke = strokeFor(getNodeColor(d.data))
        const dashed = d.data.type === 'more'
        node = {
          key,
          data: d.data,
          depth: d.depth,
          r: 1,
          parentKey,
          fill,
          stroke,
          dashed,
          style: `${fill}|${stroke}|${dashed ? 1 : 0}`,
          x: (parent?.x ?? centerX) + (Math.random() - 0.5) * 20,
          y: (parent?.y ?? centerY) + (Math.random() - 0.5) * 20,
        }
        nodeByKey.set(key, node)
        fresh.push(node)
        freshKeys.add(key)
      }
      node.data = d.data
      node.depth = d.depth
      node.parentKey = parentKey
      node.r = getNodeRadius(d)
      next.push(node)
      if (d.data.type === 'more') moreNodes.push(node)
    }

    // Drop departed nodes, else the simulation keeps ticking invisible bodies.
    for (const key of nodeByKey.keys()) {
      if (!seen.has(key)) nodeByKey.delete(key)
    }

    const nextLinks: SimLink[] = []
    const freshLinks: SimLink[] = []
    linkByTarget.clear()

    for (const node of next) {
      if (!node.parentKey) continue
      const source = nodeByKey.get(node.parentKey)
      if (!source) continue
      const link: SimLink = {
        key: `${source.key}->${node.key}`,
        source,
        target: node,
        color: getNodeColor(node.data),
      }
      nextLinks.push(link)
      linkByTarget.set(node.key, link)
      if (freshKeys.has(node.key)) freshLinks.push(link)
    }

    // The repo root anchors the whole graph at the center.
    const rootNode = next[0]
    if (rootNode && rootNode.depth === 0) {
      rootNode.fx = centerX
      rootNode.fy = centerY
    }

    nodes = next
    links = nextLinks

    // Everything entering this snapshot shares one fade, so it stays one batch.
    entering = fresh.length > 0
    nodeBatches = batchNodes(entering ? next.filter((n) => !freshKeys.has(n.key)) : next)
    linkBatches = batchLinks(
      entering ? nextLinks.filter((l) => !freshKeys.has(l.target.key)) : nextLinks,
    )
    enterNodeBatches = batchNodes(fresh)
    enterLinkBatches = batchLinks(freshLinks)
    enterStart = performance.now()
    quadtree = null
  }

  function linkDistance(d: SimLink): number {
    // Shorter with depth so files cluster around their folder.
    return Math.max(12, 70 / Math.max(d.target.depth, 1)) + d.target.r
  }

  function ensureSimulation() {
    if (simulation) return simulation

    simulation = d3
      .forceSimulation<SimNode, SimLink>()
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>()
          .id((d) => d.key)
          .distance(linkDistance)
          .strength(0.7),
      )
      .force(
        'charge',
        d3
          .forceManyBody<SimNode>()
          .strength(-38)
          // Bounding the range keeps the Barnes-Hut pass cheap on big graphs.
          .distanceMax(420)
          .theta(0.9),
      )
      .force('collide', d3.forceCollide<SimNode>((d) => d.r + 1.5).iterations(1))
      .force('x', d3.forceX<SimNode>(() => centerX).strength(0.015))
      .force('y', d3.forceY<SimNode>(() => centerY).strength(0.015))
      .velocityDecay(SIM_VELOCITY_DECAY)
      .alphaDecay(SIM_ALPHA_DECAY)
      .alphaMin(SIM_ALPHA_MIN)
      .on('tick', onTick)

    return simulation
  }

  // Positions moved: picking index is stale and the canvas needs one repaint.
  function onTick() {
    quadtree = null
    requestDraw()
  }

  function requestDraw() {
    if (drawFrame !== null) return
    drawFrame = requestAnimationFrame(draw)
  }

  function paintNodeBatch(c: CanvasRenderingContext2D, batch: SimNode[]) {
    const first = batch[0]
    c.beginPath()
    for (const n of batch) {
      c.moveTo((n.x ?? 0) + n.r, n.y ?? 0)
      c.arc(n.x ?? 0, n.y ?? 0, n.r, 0, TAU)
    }
    c.fillStyle = first.fill
    c.fill()
    c.strokeStyle = first.stroke
    c.lineWidth = first.dashed ? 1.2 : 1
    if (first.dashed) c.setLineDash([2, 2])
    c.stroke()
    if (first.dashed) c.setLineDash([])
  }

  function paintLinkBatch(c: CanvasRenderingContext2D, batch: SimLink[]) {
    c.beginPath()
    for (const l of batch) {
      c.moveTo(l.source.x ?? 0, l.source.y ?? 0)
      c.lineTo(l.target.x ?? 0, l.target.y ?? 0)
    }
    c.strokeStyle = batch[0].color
    c.lineWidth = 1
    c.stroke()
  }

  function draw() {
    drawFrame = null
    const c = ctx
    if (!c) return

    const now = performance.now()
    const enterAlpha = entering
      ? Math.min(1, (now - enterStart) / D3_EXIT_TRANSITION_DURATION_MS)
      : 1
    // Fade done: fold the new bubbles into the main batches so they keep drawing.
    if (entering && enterAlpha >= 1) {
      nodeBatches = batchNodes(nodes)
      linkBatches = batchLinks(links)
      enterNodeBatches = []
      enterLinkBatches = []
      entering = false
    }

    const dpr = window.devicePixelRatio || 1
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, width, height)
    c.translate(transform.x, transform.y)
    c.scale(transform.k, transform.k)

    c.globalAlpha = LINK_BASE_ALPHA
    for (const batch of linkBatches) paintLinkBatch(c, batch)
    if (enterAlpha < 1) {
      c.globalAlpha = LINK_BASE_ALPHA * enterAlpha
      for (const batch of enterLinkBatches) paintLinkBatch(c, batch)
    }

    c.globalAlpha = 1
    for (const batch of nodeBatches) paintNodeBatch(c, batch)
    if (enterAlpha < 1) {
      c.globalAlpha = enterAlpha
      for (const batch of enterNodeBatches) paintNodeBatch(c, batch)
      c.globalAlpha = 1
    }

    if (moreNodes.length) {
      c.fillStyle = '#d4d4d4'
      c.font = '8px ui-monospace, monospace'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      for (const n of moreNodes) c.fillText(n.data.name, n.x ?? 0, n.y ?? 0)
    }

    // Highlight is redrawn on top of its batch — one extra circle, no re-batch.
    const focus = hovered ?? (externalKey ? (nodeByKey.get(externalKey) ?? null) : null)
    let animating = false
    if (focus) {
      const t = hovered ? Math.min(1, (now - hoverStart) / HOVER_MS) : 1
      animating = t < 1
      const eased = t * (2 - t)
      const r = focus.r * (1 + (HOVER_SCALE - 1) * eased)

      const link = linkByTarget.get(focus.key)
      if (link) {
        c.beginPath()
        c.moveTo(link.source.x ?? 0, link.source.y ?? 0)
        c.lineTo(link.target.x ?? 0, link.target.y ?? 0)
        c.strokeStyle = link.color
        c.lineWidth = 1.5
        c.stroke()
      }

      c.beginPath()
      c.moveTo((focus.x ?? 0) + r, focus.y ?? 0)
      c.arc(focus.x ?? 0, focus.y ?? 0, r, 0, TAU)
      c.fillStyle = focus.fill
      c.fill()
      c.strokeStyle = focus.stroke
      c.lineWidth = 1
      c.stroke()
    }

    c.setTransform(1, 0, 0, 1, 0, 0)
    if (animating || entering) requestDraw()
  }

  // Rebuilt lazily: ticks invalidate it far more often than the cursor uses it.
  function getQuadtree(): d3.Quadtree<SimNode> {
    if (!quadtree) {
      quadtree = d3
        .quadtree<SimNode>()
        .x((d) => d.x ?? 0)
        .y((d) => d.y ?? 0)
        .addAll(nodes)
    }
    return quadtree
  }

  function pick(event: MouseEvent): SimNode | null {
    if (!canvas || !nodes.length) return null
    const [mx, my] = d3.pointer(event, canvas)
    const [px, py] = transform.invert([mx, my])
    return getQuadtree().find(px, py, HIT_RADIUS_PX / transform.k) ?? null
  }

  function setHovered(node: SimNode | null) {
    if (hovered === node) return
    hovered = node
    hoverStart = performance.now()
    hoveredGraphPath.value = node ? node.key : null
    if (!node) hideTooltip()
    requestDraw()
  }

  function bindEvents(el: HTMLCanvasElement) {
    el.style.cursor = 'pointer'

    el.addEventListener('mousemove', (event) => {
      const node = pick(event)
      setHovered(node)
      if (node) showTooltip(event.clientX, event.clientY, node.data)
    })

    el.addEventListener('mouseleave', () => setHovered(null))

    el.addEventListener('click', (event) => {
      const node = pick(event)
      if (!node) return
      event.stopPropagation()

      // A 'more' bubble expands its folder, and stays expanded across snapshots.
      if (node.data.type === 'more') {
        expandedFolders.add(node.parentKey ?? '')
        setHovered(null)
        hideTooltip()
        updateTree()
        return
      }

      showTooltip(event.clientX, event.clientY, node.data)
      onNodeClick(node.key)
    })
  }

  function resizeCanvas() {
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  function measure() {
    const el = diagramContainer.value
    width = el?.clientWidth || DIAGRAM.DEFAULT_WIDTH
    height = resolveHeight(el)
    centerX = width / 2
    centerY = height / 2
  }

  function render() {
    buildGraph()
    if (!nodes.length) return

    const sim = ensureSimulation()
    sim.nodes(nodes)
    sim.force<d3.ForceLink<SimNode, SimLink>>('link')?.links(links)
    sim.alpha(SIM_RESTART_ALPHA).restart()
    requestDraw()
  }

  function initGource() {
    if (!diagramContainer.value || !fileTree.value) return

    const container = diagramContainer.value
    d3.select(container).selectAll('*').remove()
    nodeByKey.clear()
    transform = d3.zoomIdentity
    hovered = null
    externalKey = null

    measure()

    const sel = d3
      .select(container)
      .append('canvas')
      .style('display', 'block')
      .style('touch-action', 'none')

    canvas = sel.node() as HTMLCanvasElement
    canvasSel = sel as d3.Selection<HTMLCanvasElement, unknown, null, undefined>
    ctx = canvas.getContext('2d')
    resizeCanvas()

    zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 10])
      .on('zoom', (event) => {
        transform = event.transform
        requestDraw()
      })
    canvasSel.call(zoomBehavior)

    bindEvents(canvas)
    render()
  }

  function retryInitGource(attempts = 0) {
    if (!diagramContainer.value || !fileTree.value) return
    if (diagramContainer.value.clientWidth === 0 && attempts < 10) {
      requestAnimationFrame(() => retryInitGource(attempts + 1))
      return
    }
    initGource()
  }

  function updateTree() {
    if (!diagramContainer.value) return
    if (!canvas) {
      initGource()
      return
    }

    measure()
    resizeCanvas()
    render()
  }

  function highlightByPath(path: string) {
    externalKey = path
    requestDraw()
  }

  function unhighlightByPath(path: string) {
    if (externalKey !== path) return
    externalKey = null
    requestDraw()
  }

  function zoomToPath(path: string) {
    if (!canvasSel || !zoomBehavior) return

    const target = nodeByKey.get(path)
    if (!target || target.x === undefined || target.y === undefined) return

    const scale = 2.5
    const tx = width / 2 - target.x * scale
    const ty = height / 2 - target.y * scale

    canvasSel
      .transition()
      .duration(700)
      .ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }

  /** Stops the simulation loop — the component must call this on unmount. */
  function destroyRenderer() {
    simulation?.stop()
    simulation = null
    if (drawFrame !== null) cancelAnimationFrame(drawFrame)
    drawFrame = null
    nodeByKey.clear()
    linkByTarget.clear()
    nodes = []
    links = []
    moreNodes = []
    nodeBatches = []
    linkBatches = []
    enterNodeBatches = []
    enterLinkBatches = []
    quadtree = null
    canvas = null
    canvasSel = null
    ctx = null
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
