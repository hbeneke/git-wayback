import { D3_EXIT_TRANSITION_DURATION_MS, DIAGRAM } from '@git-wayback/shared'
import * as d3 from 'd3'
import type { Graph, LinkBatch, SimLink, SimNode } from './diagram/graph'
import { batchLinks, batchNodes, buildGraph, pickAt, restLength } from './diagram/graph'
import type { Scene } from './diagram/paint'
import { paintScene } from './diagram/paint'
import type { TreeNode } from './useDiagramTree'
import { collapseTree, getFileKind, RENDER_FILE_BUDGET } from './useDiagramTree'

const HOVER_SCALE = 2.2
const HOVER_MS = 160
/** Screen-space slack around the cursor when picking a node. */
const HIT_RADIUS_PX = 10
const ZOOM_TO_SCALE = 2.5
const ZOOM_TO_MS = 700

// Faster than d3 defaults so the graph settles well inside the playback interval.
const SIM_ALPHA_DECAY = 0.055
const SIM_ALPHA_MIN = 0.02
const SIM_VELOCITY_DECAY = 0.45
/** Alpha injected when a new snapshot arrives — a nudge, not a full reheat. */
const SIM_RESTART_ALPHA = 0.55
/** Alpha after a resize: enough to drift to the new centre, not to reshuffle. */
const SIM_RESIZE_ALPHA = 0.1
/** A first layout has nothing to grow from, so it gets a full reheat. */
const SIM_FIRST_ALPHA = 1
/** Synchronous ticks before the first paint, capped in time for big repos. */
const SIM_WARMUP_TICKS = 120
const SIM_WARMUP_BUDGET_MS = 60

export interface DiagramTooltip {
  visible: boolean
  x: number
  y: number
  name: string
  dir: string
  kind: string
}

export interface DiagramRendererOptions {
  container: Ref<HTMLElement | null>
  /** Full tree for the current snapshot, built once by the owning component. */
  fileTree: ComputedRef<TreeNode | null>
  hiddenExtensions: Ref<Set<string>>
  tooltip: Ref<DiagramTooltip>
  hoveredGraphPath: Ref<string | null>
  onNodeClick: (path: string) => void
  /** Expanded mode fills the container; normal mode keeps the design height. */
  expanded?: Ref<boolean>
}

function emptyGraph(): Graph {
  return {
    nodes: [],
    links: [],
    fresh: [],
    freshLinks: [],
    moreNodes: [],
    linkByTarget: new Map(),
    maxNodeRadius: 0,
    collapsedFiles: 0,
  }
}

function linkDistance(d: SimLink): number {
  return restLength(d.target.depth, d.target.r)
}

export function useDiagramRenderer(opts: DiagramRendererOptions) {
  const {
    container,
    fileTree,
    hiddenExtensions,
    tooltip,
    hoveredGraphPath,
    onNodeClick,
    expanded,
  } = opts

  // Folders whose 'more' bubble the user clicked — rendered in full from then on.
  const expandedFolders = new Set<string>()
  let expandedVersion = 0
  // Legend toggles re-render without changing the tree; reuse the collapse.
  let collapsed: { src: TreeNode; version: number; out: TreeNode } | null = null
  /** Files currently folded into 'more' bubbles; 0 when the whole tree is drawn. */
  const collapsedFiles = ref(0)

  // Canvas, not SVG: moving thousands of SVG elements per tick is what stalls big repos.
  let canvas: HTMLCanvasElement | null = null
  let canvasSel: d3.Selection<HTMLCanvasElement, unknown, null, undefined> | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let zoomBehavior: d3.ZoomBehavior<HTMLCanvasElement, unknown> | null = null
  let transform = d3.zoomIdentity
  let width: number = DIAGRAM.DEFAULT_WIDTH
  let height: number = DIAGRAM.HEIGHT
  let centerX = width / 2
  let centerY = height / 2

  // Keyed by path so a surviving file keeps its position — that is what makes the graph grow.
  let simulation: d3.Simulation<SimNode, SimLink> | null = null
  const nodeByKey = new Map<string, SimNode>()
  let graph = emptyGraph()

  // Draw batches: one canvas path per color instead of one element per bubble.
  let nodeBatches: SimNode[][] = []
  let linkBatches: LinkBatch[] = []
  let enterNodeBatches: SimNode[][] = []
  let enterLinkBatches: LinkBatch[] = []
  let enterStart = 0
  let entering = false

  let drawFrame: number | null = null
  let hoverFrame: number | null = null
  let pointer: { x: number; y: number } | null = null

  let hovered: SimNode | null = null
  let hoverStart = 0
  let externalKey: string | null = null

  // --- Tooltip -------------------------------------------------------------

  function showTooltip(clientX: number, clientY: number, data: TreeNode) {
    const wrapper = container.value?.parentElement
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

  // --- Graph ---------------------------------------------------------------

  function collapsedTree(src: TreeNode): TreeNode {
    if (!collapsed || collapsed.src !== src || collapsed.version !== expandedVersion) {
      collapsed = {
        src,
        version: expandedVersion,
        out: collapseTree(src, RENDER_FILE_BUDGET, expandedFolders),
      }
    }
    return collapsed.out
  }

  function rebuildGraph() {
    if (!fileTree.value) {
      graph = emptyGraph()
      collapsedFiles.value = 0
      return
    }

    // Thin first: on a big repo the cost is simply the number of bodies carried.
    graph = buildGraph({
      tree: collapsedTree(fileTree.value),
      nodeByKey,
      hiddenExtensions: hiddenExtensions.value,
      centerX,
      centerY,
    })
    collapsedFiles.value = graph.collapsedFiles

    // A hovered bubble that left with this snapshot must not linger as a ghost.
    if (hovered && !nodeByKey.has(hovered.key)) setHovered(null)

    // Everything entering this snapshot shares one fade, so it stays one batch.
    const { nodes, links, fresh, freshLinks } = graph
    entering = fresh.length > 0
    if (entering) {
      const freshKeys = new Set(fresh.map((n) => n.key))
      nodeBatches = batchNodes(nodes.filter((n) => !freshKeys.has(n.key)))
      linkBatches = batchLinks(links.filter((l) => !freshKeys.has(l.target.key)))
      enterNodeBatches = batchNodes(fresh)
      enterLinkBatches = batchLinks(freshLinks)
      enterStart = performance.now()
    } else {
      nodeBatches = batchNodes(nodes)
      linkBatches = batchLinks(links)
      enterNodeBatches = []
      enterLinkBatches = []
    }
  }

  // --- Simulation ----------------------------------------------------------

  function ensureSimulation() {
    if (simulation) return simulation

    simulation = d3
      .forceSimulation<SimNode, SimLink>()
      .force('link', d3.forceLink<SimNode, SimLink>().distance(linkDistance).strength(0.7))
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
      .force('x', d3.forceX<SimNode>(centerX).strength(0.015))
      .force('y', d3.forceY<SimNode>(centerY).strength(0.015))
      .velocityDecay(SIM_VELOCITY_DECAY)
      .alphaDecay(SIM_ALPHA_DECAY)
      .alphaMin(SIM_ALPHA_MIN)
      .on('tick', requestDraw)

    return simulation
  }

  // Forces snapshot their target at init, so a moved centre must be pushed to them.
  function recenter(sim: d3.Simulation<SimNode, SimLink>) {
    sim.force<d3.ForceX<SimNode>>('x')?.x(centerX)
    sim.force<d3.ForceY<SimNode>>('y')?.y(centerY)
    const root = graph.nodes[0]
    if (root) {
      root.fx = centerX
      root.fy = centerY
    }
  }

  // --- Drawing -------------------------------------------------------------

  function requestDraw() {
    if (drawFrame !== null) return
    drawFrame = requestAnimationFrame(draw)
  }

  function draw() {
    drawFrame = null
    if (!ctx) return

    const now = performance.now()
    const enterAlpha = entering
      ? Math.min(1, (now - enterStart) / D3_EXIT_TRANSITION_DURATION_MS)
      : 1
    // Fade done: fold the new bubbles into the main batches so they keep drawing.
    if (entering && enterAlpha >= 1) {
      nodeBatches = batchNodes(graph.nodes)
      linkBatches = batchLinks(graph.links)
      enterNodeBatches = []
      enterLinkBatches = []
      entering = false
    }

    const focusNode = hovered ?? (externalKey ? (nodeByKey.get(externalKey) ?? null) : null)
    let animating = false
    let focus: Scene['focus'] = null
    if (focusNode) {
      const t = hovered ? Math.min(1, (now - hoverStart) / HOVER_MS) : 1
      animating = t < 1
      const eased = t * (2 - t)
      focus = {
        node: focusNode,
        r: focusNode.r * (1 + (HOVER_SCALE - 1) * eased),
        link: graph.linkByTarget.get(focusNode.key),
      }
    }

    paintScene(
      ctx,
      { width, height, dpr: window.devicePixelRatio || 1, transform },
      {
        nodeBatches,
        linkBatches,
        enterNodeBatches,
        enterLinkBatches,
        enterAlpha,
        moreNodes: graph.moreNodes,
        focus,
      },
    )

    if (animating || entering) requestDraw()
  }

  // --- Input ---------------------------------------------------------------

  function pick(clientX: number, clientY: number): SimNode | null {
    if (!canvas || !graph.nodes.length) return null
    const rect = canvas.getBoundingClientRect()
    const [px, py] = transform.invert([clientX - rect.left, clientY - rect.top])
    return pickAt(graph, px, py, HIT_RADIUS_PX / transform.k)
  }

  function setHovered(node: SimNode | null) {
    if (hovered === node) return
    hovered = node
    hoverStart = performance.now()
    hoveredGraphPath.value = node ? node.key : null
    if (!node) hideTooltip()
    requestDraw()
  }

  // Pointer events can outrun frames; one pick per frame is all the eye needs.
  function scheduleHover() {
    if (hoverFrame !== null) return
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = null
      if (!pointer) return
      const node = pick(pointer.x, pointer.y)
      setHovered(node)
      if (node) showTooltip(pointer.x, pointer.y, node.data)
    })
  }

  function bindEvents(el: HTMLCanvasElement) {
    el.style.cursor = 'pointer'

    el.addEventListener('mousemove', (event) => {
      pointer = { x: event.clientX, y: event.clientY }
      scheduleHover()
    })

    el.addEventListener('mouseleave', () => {
      pointer = null
      setHovered(null)
    })

    el.addEventListener('click', (event) => {
      const node = pick(event.clientX, event.clientY)
      if (!node) return
      event.stopPropagation()

      // A 'more' bubble expands its folder, and stays expanded across snapshots.
      if (node.data.type === 'more') {
        const folder = node.parentKey ? nodeByKey.get(node.parentKey) : null
        expandedFolders.add(folder?.data.path ?? '')
        expandedVersion++
        setHovered(null)
        updateTree()
        return
      }

      showTooltip(event.clientX, event.clientY, node.data)
      onNodeClick(node.key)
    })
  }

  // --- Layout --------------------------------------------------------------

  function measure() {
    const el = container.value
    width = el?.clientWidth || DIAGRAM.DEFAULT_WIDTH
    height = expanded?.value && el?.clientHeight ? el.clientHeight : DIAGRAM.HEIGHT
    centerX = width / 2
    centerY = height / 2
  }

  // Assigning canvas.width wipes the bitmap even when unchanged, so only touch it on a real change.
  function resizeCanvas() {
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(width * dpr)
    const h = Math.round(height * dpr)
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  function render() {
    rebuildGraph()
    if (!graph.nodes.length) return

    const sim = ensureSimulation()
    recenter(sim)
    sim.nodes(graph.nodes)
    sim.force<d3.ForceLink<SimNode, SimLink>>('link')?.links(graph.links)

    // Every body new: settle off-screen first so the graph never shows as a pile.
    if (graph.fresh.length === graph.nodes.length) {
      sim.stop().alpha(SIM_FIRST_ALPHA)
      const t0 = performance.now()
      for (let i = 0; i < SIM_WARMUP_TICKS && performance.now() - t0 < SIM_WARMUP_BUDGET_MS; i++) {
        sim.tick()
      }
      sim.restart()
    } else {
      sim.alpha(SIM_RESTART_ALPHA).restart()
    }
    requestDraw()
  }

  function initGource() {
    if (!container.value || !fileTree.value) return

    const host = container.value
    d3.select(host).selectAll('*').remove()
    nodeByKey.clear()
    transform = d3.zoomIdentity
    hovered = null
    externalKey = null

    measure()

    const sel = d3
      .select(host)
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
    if (!container.value || !fileTree.value) return
    if (container.value.clientWidth === 0 && attempts < 10) {
      requestAnimationFrame(() => retryInitGource(attempts + 1))
      return
    }
    initGource()
  }

  /** The tree changed (snapshot, legend, expanded folder): rebuild bodies and reheat. */
  function updateTree() {
    if (!container.value) return
    if (!canvas) {
      initGource()
      return
    }
    measure()
    resizeCanvas()
    render()
  }

  /** The container changed size: keep the bodies, just drift them to the new centre. */
  function resize() {
    if (!canvas) return
    measure()
    resizeCanvas()
    if (!simulation || !graph.nodes.length) {
      requestDraw()
      return
    }
    recenter(simulation)
    simulation.alpha(Math.max(simulation.alpha(), SIM_RESIZE_ALPHA)).restart()
  }

  // --- External highlight / zoom -------------------------------------------

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
    if (!target) return

    const tx = width / 2 - target.x * ZOOM_TO_SCALE
    const ty = height / 2 - target.y * ZOOM_TO_SCALE
    canvasSel
      .transition()
      .duration(ZOOM_TO_MS)
      .ease(d3.easeCubicInOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(ZOOM_TO_SCALE))
  }

  /** Stops the simulation loop — the component must call this on unmount. */
  function destroyRenderer() {
    simulation?.stop()
    simulation = null
    if (drawFrame !== null) cancelAnimationFrame(drawFrame)
    drawFrame = null
    if (hoverFrame !== null) cancelAnimationFrame(hoverFrame)
    hoverFrame = null
    pointer = null
    hovered = null
    externalKey = null
    nodeByKey.clear()
    expandedFolders.clear()
    graph = emptyGraph()
    nodeBatches = []
    linkBatches = []
    enterNodeBatches = []
    enterLinkBatches = []
    entering = false
    collapsed = null
    canvas = null
    canvasSel = null
    ctx = null
  }

  return {
    collapsedFiles,
    initGource,
    retryInitGource,
    updateTree,
    resize,
    highlightByPath,
    unhighlightByPath,
    zoomToPath,
    destroyRenderer,
  }
}
