interface GitHubTreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

interface GitHubTreeResponse {
  sha: string
  url: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

export interface FileNode {
  path: string
  name: string
  type: 'file' | 'folder'
  size: number
  extension: string | null
  depth: number
  parentPath: string | null
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = validateRepoParams(event)
  const commitSha = validateCommitSha(event)
  const headers = getGitHubHeaders()

  // Get the tree for this commit (recursive)
  const treeResponse = await $fetch<GitHubTreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitSha}`,
    {
      headers,
      query: { recursive: '1' },
    }
  )

  // Transform tree into structured file nodes
  const files: FileNode[] = []

  for (const item of treeResponse.tree) {
    if (item.type === 'blob') {
      const parts = item.path.split('/')
      const name = parts[parts.length - 1]
      const extension = name.includes('.') ? name.split('.').pop() || null : null
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null

      files.push({
        path: item.path,
        name,
        type: 'file',
        size: item.size || 0,
        extension,
        depth: parts.length - 1,
        parentPath,
      })
    }
  }

  // Group files by top-level folder for visualization
  const folderGroups: Record<string, FileNode[]> = {}
  
  for (const file of files) {
    const topFolder = file.path.split('/')[0]
    const isTopLevel = !file.path.includes('/')
    const groupKey = isTopLevel ? '(root)' : topFolder
    
    if (!folderGroups[groupKey]) {
      folderGroups[groupKey] = []
    }
    folderGroups[groupKey].push(file)
  }

  // Calculate stats
  const stats = {
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    extensionCounts: {} as Record<string, number>,
    folderCounts: {} as Record<string, number>,
  }

  for (const file of files) {
    const ext = file.extension || '(no ext)'
    stats.extensionCounts[ext] = (stats.extensionCounts[ext] || 0) + 1
  }

  for (const [folder, folderFiles] of Object.entries(folderGroups)) {
    stats.folderCounts[folder] = folderFiles.length
  }

  return {
    sha: commitSha,
    truncated: treeResponse.truncated,
    files,
    folderGroups,
    stats,
  }
})
