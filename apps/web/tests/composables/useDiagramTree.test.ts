import { describe, expect, it } from 'vitest'
import {
  buildTree,
  collapseTree,
  type FileNode,
  type TreeNode,
} from '../../composables/useDiagramTree'

function file(path: string, size = 100): FileNode {
  const name = path.split('/').pop() as string
  const ext = name.includes('.') ? (name.split('.').pop() as string) : null
  return { path, name, size, extension: ext }
}

/** Every file-type node reachable from `node`. */
function files(node: TreeNode): TreeNode[] {
  if (node.type === 'file') return [node]
  return node.children.flatMap(files)
}

function moreNodes(node: TreeNode): TreeNode[] {
  const here = node.type === 'more' ? [node] : []
  return [...here, ...node.children.flatMap(moreNodes)]
}

function makeFiles(dir: string, count: number, sizeFor: (i: number) => number = () => 100) {
  return Array.from({ length: count }, (_, i) => file(`${dir}/f${i}.ts`, sizeFor(i)))
}

describe('buildTree', () => {
  it('nests files under their folders', () => {
    const root = buildTree([file('src/a.ts'), file('src/deep/b.ts'), file('readme.md')], 'repo')

    expect(root.name).toBe('repo')
    expect(
      files(root)
        .map((f) => f.path)
        .sort(),
    ).toEqual(['readme.md', 'src/a.ts', 'src/deep/b.ts'])
  })

  it('reuses a folder node across siblings', () => {
    const root = buildTree([file('src/a.ts'), file('src/b.ts')], 'repo')
    const folders = root.children.filter((c) => c.type === 'folder')

    expect(folders).toHaveLength(1)
    expect(folders[0].path).toBe('src')
  })
})

describe('collapseTree', () => {
  it('returns the tree untouched when it already fits the budget', () => {
    const root = buildTree(makeFiles('src', 5), 'repo')
    const collapsed = collapseTree(root, 100)

    expect(collapsed).toBe(root)
    expect(moreNodes(collapsed)).toHaveLength(0)
  })

  it('folds the overflow into a single "more" node per folder', () => {
    const root = buildTree(makeFiles('src', 40), 'repo')
    const collapsed = collapseTree(root, 10)
    const more = moreNodes(collapsed)

    expect(more).toHaveLength(1)
    expect(files(collapsed).length + (more[0].count as number)).toBe(40)
  })

  it('keeps the largest files, which carry the most signal', () => {
    // f0 is the smallest, f19 the largest.
    const root = buildTree(
      makeFiles('src', 20, (i) => (i + 1) * 100),
      'repo',
    )
    const collapsed = collapseTree(root, 4)
    const kept = files(collapsed).map((f) => f.size as number)

    expect(Math.min(...kept)).toBeGreaterThan(100)
    expect(kept).toContain(2000)
  })

  it('never drops a folder, so the shape of the repo survives', () => {
    const root = buildTree(
      [...makeFiles('a', 30), ...makeFiles('b', 30), ...makeFiles('b/deep', 30)],
      'repo',
    )
    const collapsed = collapseTree(root, 6)
    const paths = new Set<string>()

    const walk = (n: TreeNode) => {
      if (n.type === 'folder') paths.add(n.path)
      for (const c of n.children) walk(c)
    }
    walk(collapsed)

    expect(paths.has('a')).toBe(true)
    expect(paths.has('b')).toBe(true)
    expect(paths.has('b/deep')).toBe(true)
  })

  it('leaves a folder whole once the user expanded it', () => {
    const root = buildTree([...makeFiles('a', 30), ...makeFiles('b', 30)], 'repo')
    const collapsed = collapseTree(root, 6, new Set(['a']))

    const a = collapsed.children.find((c) => c.path === 'a') as TreeNode
    const b = collapsed.children.find((c) => c.path === 'b') as TreeNode

    expect(files(a)).toHaveLength(30)
    expect(moreNodes(a)).toHaveLength(0)
    expect(moreNodes(b)).toHaveLength(1)
  })

  it('gives every folder at least two files even under a tiny budget', () => {
    const root = buildTree([...makeFiles('a', 20), ...makeFiles('b', 20)], 'repo')
    const collapsed = collapseTree(root, 1)

    for (const dir of ['a', 'b']) {
      const folder = collapsed.children.find((c) => c.path === dir) as TreeNode
      expect(files(folder).length).toBeGreaterThanOrEqual(2)
    }
  })
})
