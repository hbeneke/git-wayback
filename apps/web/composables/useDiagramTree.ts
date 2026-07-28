export interface FileNode {
  path: string
  name: string
  size: number
  extension: string | null
}

export interface TagSnapshot {
  tag: string
  sha: string
  date: string
  message: string
  files: FileNode[]
  stats: {
    totalFiles: number
    totalSize: number
  }
  /** GitHub tree was truncated — file list is incomplete for this snapshot. */
  truncated?: boolean
}

export type EvolutionSource = 'tags' | 'commits'
export type EvolutionSampling = 'spread' | 'latest'

export interface EvolutionResponse {
  snapshots: TagSnapshot[]
  repoName: string
  source: EvolutionSource
  branch: string | null
  sampling: EvolutionSampling
  poolSize: number
  cached: boolean
  capturedAt: string
}

export interface TreeNode {
  name: string
  path: string
  /** 'more' is a synthetic node standing in for files collapsed out of view. */
  type: 'file' | 'folder' | 'more'
  extension?: string | null
  size?: number
  /** Files represented by a 'more' node. */
  count?: number
  children: TreeNode[]
}

/**
 * Rendered file bubbles are budgeted: past this many the graph is thinned per
 * folder. Folders are never dropped, so the shape of the repo survives.
 */
export const RENDER_FILE_BUDGET = 1200

export const EXTENSION_COLORS: Record<string, string> = {
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

const FILE_KINDS: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  vue: 'vue component',
  json: 'json',
  md: 'markdown',
  css: 'stylesheet',
  html: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
  yaml: 'yaml config',
  yml: 'yaml config',
  sh: 'shell script',
  tsx: 'typescript jsx',
  jsx: 'javascript jsx',
  svg: 'svg image',
  png: 'image',
  jpg: 'image',
  gif: 'image',
  toml: 'toml config',
  lock: 'lockfile',
  gitignore: 'git config',
  env: 'env config',
  sql: 'sql',
}

export function buildTree(files: FileNode[], rootName: string): TreeNode {
  const root: TreeNode = {
    name: rootName,
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

function countFiles(node: TreeNode): number {
  if (node.type === 'file') return 1
  let n = 0
  for (const c of node.children) n += countFiles(c)
  return n
}

/** Folders holding at least one direct file — the ones a per-folder cap applies to. */
function countFileHoldingFolders(node: TreeNode): number {
  if (node.type !== 'folder') return 0
  let n = node.children.some((c) => c.type === 'file') ? 1 : 0
  for (const c of node.children) n += countFileHoldingFolders(c)
  return n
}

function collapseNode(node: TreeNode, perFolder: number, keepExpanded: Set<string>): TreeNode {
  if (node.type !== 'folder') return node

  const files: TreeNode[] = []
  const folders: TreeNode[] = []
  for (const c of node.children) {
    if (c.type === 'folder') folders.push(collapseNode(c, perFolder, keepExpanded))
    else files.push(c)
  }

  if (keepExpanded.has(node.path) || files.length <= perFolder) {
    return { ...node, children: [...folders, ...files] }
  }

  // Biggest files first: they carry the most signal about what a folder holds.
  const sorted = [...files].sort((a, b) => (b.size || 0) - (a.size || 0))
  const hidden = files.length - perFolder

  return {
    ...node,
    children: [
      ...folders,
      ...sorted.slice(0, perFolder),
      {
        name: `+${hidden}`,
        path: `${node.path}/__more__`,
        type: 'more',
        count: hidden,
        children: [],
      },
    ],
  }
}

/**
 * Thins the tree so the renderer stays under `budget` file bubbles: each folder
 * keeps its largest files and gets one 'more' node for the rest. Folders in
 * `keepExpanded` are left whole (the user clicked their 'more' node).
 * Returns the tree untouched when it already fits.
 */
export function collapseTree(
  root: TreeNode,
  budget = RENDER_FILE_BUDGET,
  keepExpanded: Set<string> = new Set(),
): TreeNode {
  if (countFiles(root) <= budget) return root
  const folders = Math.max(countFileHoldingFolders(root), 1)
  const perFolder = Math.max(2, Math.floor(budget / folders))
  return collapseNode(root, perFolder, keepExpanded)
}

export function getExtensionColor(ext: string | null): string {
  if (!ext) return EXTENSION_COLORS.other
  return EXTENSION_COLORS[ext.toLowerCase()] || EXTENSION_COLORS.other
}

export function getNodeColor(data: TreeNode): string {
  if (data.type === 'folder') return 'rgb(16, 185, 129)'
  if (data.type === 'more') return EXTENSION_COLORS.other
  return getExtensionColor(data.extension || null)
}

export function getFileKind(data: TreeNode): string {
  if (data.type === 'folder') return 'folder'
  if (data.type === 'more') return `${data.count} more files — click to expand`
  if (!data.extension) return 'file'
  const ext = data.extension.toLowerCase()
  return FILE_KINDS[ext] || `${ext} file`
}

function parseRgb(color: string): [number, number, number] | null {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const n =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
  return null
}

export function darken(color: string, factor: number): string {
  const rgb = parseRgb(color)
  if (!rgb) return color
  return `rgb(${Math.round(rgb[0] * factor)}, ${Math.round(rgb[1] * factor)}, ${Math.round(rgb[2] * factor)})`
}
