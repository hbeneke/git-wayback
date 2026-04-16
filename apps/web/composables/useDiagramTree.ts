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
}

export interface EvolutionResponse {
  snapshots: TagSnapshot[]
  repoName: string
  cached: boolean
  capturedAt: string
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  extension?: string | null
  size?: number
  children: TreeNode[]
}

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
  ts: 'typescript', js: 'javascript', vue: 'vue component',
  json: 'json', md: 'markdown', css: 'stylesheet', html: 'html',
  py: 'python', go: 'go', rs: 'rust', yaml: 'yaml config',
  yml: 'yaml config', sh: 'shell script', tsx: 'typescript jsx',
  jsx: 'javascript jsx', svg: 'svg image', png: 'image', jpg: 'image',
  gif: 'image', toml: 'toml config', lock: 'lockfile',
  gitignore: 'git config', env: 'env config', sql: 'sql',
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

export function getExtensionColor(ext: string | null): string {
  if (!ext) return EXTENSION_COLORS.other
  return EXTENSION_COLORS[ext.toLowerCase()] || EXTENSION_COLORS.other
}

export function getNodeColor(data: TreeNode): string {
  if (data.type === 'folder') return 'rgb(16, 185, 129)'
  return getExtensionColor(data.extension || null)
}

export function getFileKind(data: TreeNode): string {
  if (data.type === 'folder') return 'folder'
  if (!data.extension) return 'file'
  const ext = data.extension.toLowerCase()
  return FILE_KINDS[ext] || ext + ' file'
}

function parseRgb(color: string): [number, number, number] | null {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const n = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
  return null
}

export function darken(color: string, factor: number): string {
  const rgb = parseRgb(color)
  if (!rgb) return color
  return `rgb(${Math.round(rgb[0] * factor)}, ${Math.round(rgb[1] * factor)}, ${Math.round(rgb[2] * factor)})`
}
