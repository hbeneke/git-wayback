import type { ZoomTransform } from 'd3'
import type { LinkBatch, SimLink, SimNode } from './graph'
import { LINK_SEGMENTS, rimWidth } from './graph'

const TAU = Math.PI * 2
const LINK_BASE_ALPHA = 0.35
const MORE_LABEL_FILL = '#d4d4d4'
const MORE_LABEL_FONT = '8px ui-monospace, monospace'

export interface Viewport {
  width: number
  height: number
  dpr: number
  transform: ZoomTransform
}

export interface Scene {
  nodeBatches: SimNode[][]
  linkBatches: LinkBatch[]
  /** Bubbles fading in this snapshot, drawn with `enterAlpha`. */
  enterNodeBatches: SimNode[][]
  enterLinkBatches: LinkBatch[]
  enterAlpha: number
  moreNodes: SimNode[]
  /** Hovered or externally highlighted node, drawn on top at radius `r`. */
  focus: { node: SimNode; r: number; link: SimLink | undefined } | null
}

function circlePath(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.moveTo(x + r, y)
  c.arc(x, y, r, 0, TAU)
}

function paintNodeBatch(c: CanvasRenderingContext2D, batch: SimNode[]) {
  const first = batch[0]
  c.beginPath()
  for (const n of batch) circlePath(c, n.x, n.y, n.r)
  c.fillStyle = first.fill
  c.fill()
  c.strokeStyle = first.stroke
  c.lineWidth = first.rim
  if (first.dashed) c.setLineDash([2, 2])
  c.stroke()
  if (first.dashed) c.setLineDash([])
}

// One pass per ramp step: the segments blend source color into target color.
function paintLinkBatch(c: CanvasRenderingContext2D, batch: LinkBatch) {
  c.lineWidth = 1
  for (let i = 0; i < LINK_SEGMENTS; i++) {
    const t0 = i / LINK_SEGMENTS
    const t1 = (i + 1) / LINK_SEGMENTS
    c.beginPath()
    for (const l of batch.links) {
      const sx = l.source.x
      const sy = l.source.y
      const dx = l.target.x - sx
      const dy = l.target.y - sy
      c.moveTo(sx + dx * t0, sy + dy * t0)
      c.lineTo(sx + dx * t1, sy + dy * t1)
    }
    c.strokeStyle = batch.ramp[i]
    c.stroke()
  }
}

function paintCircle(c: CanvasRenderingContext2D, n: SimNode, r: number) {
  c.beginPath()
  circlePath(c, n.x, n.y, r)
  c.fillStyle = n.fill
  c.fill()
  c.strokeStyle = n.stroke
  c.lineWidth = rimWidth(r)
  c.stroke()
}

// Highlight is redrawn on top of its batch — one extra circle, no re-batch.
function paintFocus(c: CanvasRenderingContext2D, focus: NonNullable<Scene['focus']>) {
  const { node, r, link } = focus
  if (link) {
    const { source, target } = link
    // Only one link is ever highlighted, so a real gradient is affordable here.
    const grad = c.createLinearGradient(source.x, source.y, target.x, target.y)
    grad.addColorStop(0, link.from)
    grad.addColorStop(1, link.to)
    c.beginPath()
    c.moveTo(source.x, source.y)
    c.lineTo(target.x, target.y)
    c.strokeStyle = grad
    c.lineWidth = 1.5
    c.stroke()
    // Repaint the parent so the line ends under it, not across its centre.
    paintCircle(c, source, source.r)
  }
  paintCircle(c, node, r)
}

export function paintScene(c: CanvasRenderingContext2D, view: Viewport, scene: Scene) {
  const { transform, dpr } = view
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, view.width, view.height)
  c.translate(transform.x, transform.y)
  c.scale(transform.k, transform.k)

  c.globalAlpha = LINK_BASE_ALPHA
  for (const batch of scene.linkBatches) paintLinkBatch(c, batch)
  if (scene.enterAlpha < 1) {
    c.globalAlpha = LINK_BASE_ALPHA * scene.enterAlpha
    for (const batch of scene.enterLinkBatches) paintLinkBatch(c, batch)
  }

  c.globalAlpha = 1
  for (const batch of scene.nodeBatches) paintNodeBatch(c, batch)
  if (scene.enterAlpha < 1) {
    c.globalAlpha = scene.enterAlpha
    for (const batch of scene.enterNodeBatches) paintNodeBatch(c, batch)
    c.globalAlpha = 1
  }

  if (scene.moreNodes.length) {
    c.fillStyle = MORE_LABEL_FILL
    c.font = MORE_LABEL_FONT
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (const n of scene.moreNodes) c.fillText(n.data.name, n.x, n.y)
  }

  if (scene.focus) paintFocus(c, scene.focus)

  c.setTransform(1, 0, 0, 1, 0, 0)
}
