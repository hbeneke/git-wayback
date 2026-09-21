import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3'
import type { TreeNode } from '../useDiagramTree'
import {
  darken,
  extensionKey,
  FOLDER_COLOR,
  getExtensionColor,
  getNodeColor,
  mixColors,
  ROOT_COLOR,
} from '../useDiagramTree'

/** Root has an empty path, so it gets a key no file or folder can collide with. */
export const ROOT_KEY = '\0root'

/** Steps a link is split into to fake a gradient while staying batched. */
export const LINK_SEGMENTS = 4

const ROOT_RADIUS = 6
const FOLDER_RADIUS = 3
const FILE_MIN_RADIUS = 2
const FILE_MAX_RADIUS = 6
/** Bytes per unit of squared radius: area tracks file size. */
const FILE_BYTES_PER_AREA = 500
const MORE_MIN_RADIUS = 6
const MORE_MAX_RADIUS = 12
/** Spread of new bubbles around their parent so they push outwards. */
const SPAWN_JITTER = 20
/** Angle a fresh subtree fans across, around its parent's outward direction. */
const SPAWN_FAN = Math.PI * 0.9

/** Near the canvas background, so folders read as hollow rings. */
const FOLDER_FILL = 'rgb(22, 23, 28)'
/** Hollow rings need a firmer rim than filled bubbles to stay visible. */
const FOLDER_RIM = 1
const MORE_FILL = 'rgba(107, 114, 128, 0.35)'

export interface SimNode extends SimulationNodeDatum {
  key: string
  data: TreeNode
  depth: number
  r: number
  parentKey: string | null
  fill: string
  stroke: string
  dashed: boolean
  rim: number
  /** Batch key — nodes sharing one are drawn as a single canvas path. */
  style: string
  x: number
  y: number
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode
  target: SimNode
  from: string
  to: string
}

/** Links sharing an endpoint-color pair, plus the ramp they are drawn with. */
export interface LinkBatch {
  links: SimLink[]
  ramp: string[]
}

export interface Graph {
  nodes: SimNode[]
  links: SimLink[]
  /** Nodes entering with this snapshot, kept apart so they can fade in. */
  fresh: SimNode[]
  freshLinks: SimLink[]
  moreNodes: SimNode[]
  /** Parent link of each node, for the hover highlight. */
  linkByTarget: Map<string, SimLink>
  /** Largest node radius, so the hit test knows how wide to search. */
  maxNodeRadius: number
  /** Files folded into 'more' bubbles; 0 when the whole tree is drawn. */
  collapsedFiles: number
}

export interface BuildGraphOptions {
  tree: TreeNode
  /** Surviving bodies keyed by path — reused so the graph grows instead of resetting. */
  nodeByKey: Map<string, SimNode>
  hiddenExtensions: Set<string>
  centerX: number
  centerY: number
}

/** Thin rims: a flat 1px swallowed most of a 2px-radius file bubble. */
export function rimWidth(r: number): number {
  const w = Math.min(1.1, Math.max(0.4, r * 0.22))
  // Quantized so nodes still share draw batches.
  return Math.round(w * 4) / 4
}

function nodeRadius(data: TreeNode, depth: number): number {
  if (data.type === 'folder') return depth === 0 ? ROOT_RADIUS : FOLDER_RADIUS
  if (data.type === 'more') {
    return Math.max(MORE_MIN_RADIUS, Math.min(MORE_MAX_RADIUS, 4 + Math.sqrt(data.count || 1)))
  }
  const r = Math.sqrt((data.size || 100) / FILE_BYTES_PER_AREA)
  return Math.max(FILE_MIN_RADIUS, Math.min(FILE_MAX_RADIUS, r))
}

function fillFor(data: TreeNode, depth: number): string {
  if (data.type === 'folder') return depth === 0 ? ROOT_COLOR : FOLDER_FILL
  if (data.type === 'more') return MORE_FILL
  return getExtensionColor(data.extension)
}

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

// Folder rings carry the neutral color itself; darkened it would vanish on the canvas.
function rimColorFor(data: TreeNode, depth: number): string {
  if (data.type === 'folder') return depth === 0 ? strokeFor(ROOT_COLOR) : FOLDER_COLOR
  return strokeFor(getNodeColor(data))
}

function isHidden(data: TreeNode, hiddenExtensions: Set<string>): boolean {
  return data.type === 'file' && hiddenExtensions.has(extensionKey(data.extension))
}

function nodeKey(node: TreeNode, depth: number): string {
  return depth === 0 ? ROOT_KEY : node.path
}

export function batchNodes(list: SimNode[]): SimNode[][] {
  const byStyle = new Map<string, SimNode[]>()
  for (const n of list) {
    const bucket = byStyle.get(n.style)
    if (bucket) bucket.push(n)
    else byStyle.set(n.style, [n])
  }
  return [...byStyle.values()]
}

// Grouped by endpoint-color pair: the palette is small, so a few dozen
// batches cover every link and each keeps a single stroke per segment.
export function batchLinks(list: SimLink[]): LinkBatch[] {
  const byPair = new Map<string, LinkBatch>()
  for (const l of list) {
    const key = `${l.from}|${l.to}`
    const bucket = byPair.get(key)
    if (bucket) {
      bucket.links.push(l)
      continue
    }
    const ramp: string[] = []
    for (let i = 0; i < LINK_SEGMENTS; i++) {
      ramp.push(mixColors(l.from, l.to, (i + 0.5) / LINK_SEGMENTS))
    }
    byPair.set(key, { links: [l], ramp })
  }
  return [...byPair.values()]
}

/** Resting parent-child distance; the link force and the spawn seed share it. */
export function restLength(depth: number, r: number): number {
  // Shorter with depth so files cluster around their folder.
  return Math.max(12, 70 / Math.max(depth, 1)) + r
}

/**
 * A child of a settled parent sprouts right next to it, so the graph grows.
 * A child of a parent that is itself new (first build) is placed at rest length,
 * fanned outwards, so the first layout does not start as one overlapping blob.
 */
function spawnPoint(
  parent: SimNode | null,
  parentIsFresh: boolean,
  depth: number,
  r: number,
  centerX: number,
  centerY: number,
): { x: number; y: number } {
  const px = parent?.x ?? centerX
  const py = parent?.y ?? centerY
  if (!parent || !parentIsFresh) {
    return {
      x: px + (Math.random() - 0.5) * SPAWN_JITTER,
      y: py + (Math.random() - 0.5) * SPAWN_JITTER,
    }
  }
  // The root's children spread all round; deeper ones keep heading outwards.
  const angle = parent.depth === 0
    ? Math.random() * Math.PI * 2
    : Math.atan2(py - centerY, px - centerX) + (Math.random() - 0.5) * SPAWN_FAN
  const dist = restLength(depth, r) * (0.8 + Math.random() * 0.4)
  return { x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist }
}

/** Rebuilds nodes/links for a snapshot tree, reusing surviving bodies from `nodeByKey`. */
export function buildGraph(opts: BuildGraphOptions): Graph {
  const { tree, nodeByKey, hiddenExtensions, centerX, centerY } = opts

  const seen = new Set<string>()
  const nodes: SimNode[] = []
  const fresh: SimNode[] = []
  const freshKeys = new Set<string>()
  const moreNodes: SimNode[] = []
  let collapsedFiles = 0
  let maxNodeRadius = 0

  // Pre-order walk without d3.hierarchy: only depth and parent are needed.
  const stack: { data: TreeNode; depth: number; parentKey: string | null }[] = [
    { data: tree, depth: 0, parentKey: null },
  ]
  while (stack.length) {
    const { data, depth, parentKey } = stack.pop()!
    if (isHidden(data, hiddenExtensions)) continue

    const key = nodeKey(data, depth)
    seen.add(key)
    for (let i = data.children.length - 1; i >= 0; i--) {
      stack.push({ data: data.children[i], depth: depth + 1, parentKey: key })
    }

    let node = nodeByKey.get(key)
    if (!node) {
      const parent = parentKey ? nodeByKey.get(parentKey) : null
      const parentIsFresh = parentKey ? freshKeys.has(parentKey) : false
      const { x, y } = spawnPoint(
        parent ?? null, parentIsFresh, depth, nodeRadius(data, depth), centerX, centerY,
      )
      node = {
        key,
        data,
        depth,
        r: 1,
        parentKey,
        fill: fillFor(data, depth),
        stroke: rimColorFor(data, depth),
        dashed: data.type === 'more',
        rim: 0.5,
        style: '',
        x,
        y,
      }
      nodeByKey.set(key, node)
      fresh.push(node)
      freshKeys.add(key)
    }
    node.data = data
    node.depth = depth
    node.parentKey = parentKey
    // Radius tracks file size and 'more' counts, so the rim follows it.
    node.r = nodeRadius(data, depth)
    node.rim = data.type === 'folder' && depth > 0 ? FOLDER_RIM : rimWidth(node.r)
    node.style = `${node.fill}|${node.stroke}|${node.dashed ? 1 : 0}|${node.rim}`
    nodes.push(node)
    if (node.r > maxNodeRadius) maxNodeRadius = node.r
    if (data.type === 'more') {
      moreNodes.push(node)
      collapsedFiles += data.count || 0
    }
  }

  // Drop departed nodes, else the simulation keeps ticking invisible bodies.
  for (const key of nodeByKey.keys()) {
    if (!seen.has(key)) nodeByKey.delete(key)
  }

  const links: SimLink[] = []
  const freshLinks: SimLink[] = []
  const linkByTarget = new Map<string, SimLink>()
  for (const node of nodes) {
    if (!node.parentKey) continue
    const source = nodeByKey.get(node.parentKey)
    if (!source) continue
    const link: SimLink = {
      source,
      target: node,
      from: getNodeColor(source.data),
      to: getNodeColor(node.data),
    }
    links.push(link)
    linkByTarget.set(node.key, link)
    if (freshKeys.has(node.key)) freshLinks.push(link)
  }

  // The repo root anchors the whole graph at the center.
  const root = nodes[0]
  if (root) {
    root.fx = centerX
    root.fy = centerY
  }

  return { nodes, links, fresh, freshLinks, moreNodes, linkByTarget, maxNodeRadius, collapsedFiles }
}

/** Closest node whose surface is within `slack` of the point, else the node fed by the closest link. */
export function pickAt(graph: Graph, px: number, py: number, slack: number): SimNode | null {
  let best: SimNode | null = null
  let bestScore = slack
  for (const n of graph.nodes) {
    const dx = n.x - px
    const dy = n.y - py
    const score = Math.sqrt(dx * dx + dy * dy) - n.r
    if (score < bestScore) {
      best = n
      bestScore = score
    }
  }
  if (best) return best

  for (const link of graph.links) {
    const sx = link.source.x
    const sy = link.source.y
    const dx = link.target.x - sx
    const dy = link.target.y - sy
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / len2)) : 0
    const ox = px - (sx + t * dx)
    const oy = py - (sy + t * dy)
    const dist = Math.sqrt(ox * ox + oy * oy)
    if (dist < bestScore) {
      best = link.target
      bestScore = dist
    }
  }
  return best
}
