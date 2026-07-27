import { describe, expect, it } from 'vitest'
import {
  isValidCommitSha,
  isValidGitHubOwner,
  isValidGitHubRepo,
  isValidGitRef,
  splitRepoFullName,
} from '../../../server/utils/validation'

describe('isValidGitHubOwner', () => {
  it('accepts typical usernames and orgs', () => {
    expect(isValidGitHubOwner('vercel')).toBe(true)
    expect(isValidGitHubOwner('hbeneke')).toBe(true)
    expect(isValidGitHubOwner('Nuxt-Js')).toBe(true)
    expect(isValidGitHubOwner('a')).toBe(true)
  })

  it('rejects empty, hyphen-edge and over-length names', () => {
    expect(isValidGitHubOwner('')).toBe(false)
    expect(isValidGitHubOwner('-leading')).toBe(false)
    expect(isValidGitHubOwner('trailing-')).toBe(false)
    expect(isValidGitHubOwner('a'.repeat(40))).toBe(false)
  })

  it('rejects path traversal and special chars', () => {
    expect(isValidGitHubOwner('..')).toBe(false)
    expect(isValidGitHubOwner('user/extra')).toBe(false)
    expect(isValidGitHubOwner('a b')).toBe(false)
    // biome-ignore lint/suspicious/noExplicitAny: testing wrong types
    expect(isValidGitHubOwner(null as any)).toBe(false)
  })
})

describe('isValidGitHubRepo', () => {
  it('accepts typical repo names', () => {
    expect(isValidGitHubRepo('git-wayback')).toBe(true)
    expect(isValidGitHubRepo('next.js')).toBe(true)
    expect(isValidGitHubRepo('repo_with_underscores')).toBe(true)
  })

  it('rejects "." and ".."', () => {
    expect(isValidGitHubRepo('.')).toBe(false)
    expect(isValidGitHubRepo('..')).toBe(false)
  })

  it('rejects names starting with a dot, slashes, and over-length', () => {
    expect(isValidGitHubRepo('.hidden')).toBe(false)
    expect(isValidGitHubRepo('owner/repo')).toBe(false)
    expect(isValidGitHubRepo('a'.repeat(101))).toBe(false)
  })
})

describe('isValidCommitSha', () => {
  it('accepts short (7) and full (40) hex SHAs', () => {
    expect(isValidCommitSha('abc1234')).toBe(true)
    expect(isValidCommitSha('a'.repeat(40))).toBe(true)
    expect(isValidCommitSha('ABCDEF1')).toBe(true)
  })

  it('rejects non-hex, too short, and too long', () => {
    expect(isValidCommitSha('zzzzzzz')).toBe(false)
    expect(isValidCommitSha('abc')).toBe(false)
    expect(isValidCommitSha('a'.repeat(41))).toBe(false)
    expect(isValidCommitSha('')).toBe(false)
  })
})

describe('isValidGitRef', () => {
  it('accepts common branch names', () => {
    expect(isValidGitRef('main')).toBe(true)
    expect(isValidGitRef('develop')).toBe(true)
    expect(isValidGitRef('feature/auth')).toBe(true)
    expect(isValidGitRef('release-v1.2.3')).toBe(true)
  })

  it('rejects path traversal and special git tokens', () => {
    expect(isValidGitRef('../etc')).toBe(false)
    expect(isValidGitRef('feature/..')).toBe(false)
    expect(isValidGitRef('foo@{1}')).toBe(false)
    expect(isValidGitRef('@')).toBe(false)
  })

  it('rejects forbidden characters and whitespace', () => {
    expect(isValidGitRef('with space')).toBe(false)
    expect(isValidGitRef('weird^ref')).toBe(false)
    expect(isValidGitRef('a:b')).toBe(false)
    expect(isValidGitRef('back\\slash')).toBe(false)
    expect(isValidGitRef('with~tilde')).toBe(false)
  })

  it('rejects bad slash / dot placement', () => {
    expect(isValidGitRef('/leading')).toBe(false)
    expect(isValidGitRef('trailing/')).toBe(false)
    expect(isValidGitRef('double//slash')).toBe(false)
    expect(isValidGitRef('ends.lock')).toBe(false)
    expect(isValidGitRef('ends.')).toBe(false)
    expect(isValidGitRef('feature/.hidden')).toBe(false)
  })

  it('rejects empty / non-string / over-length', () => {
    expect(isValidGitRef('')).toBe(false)
    // biome-ignore lint/suspicious/noExplicitAny: testing wrong types
    expect(isValidGitRef(undefined as any)).toBe(false)
    expect(isValidGitRef('a'.repeat(256))).toBe(false)
  })
})

describe('splitRepoFullName', () => {
  it('splits a well-formed owner/repo pair', () => {
    expect(splitRepoFullName('vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    })
    expect(splitRepoFullName('  hbeneke/git-wayback  ')).toEqual({
      owner: 'hbeneke',
      repo: 'git-wayback',
    })
  })

  it('rejects anything that is not exactly two valid segments', () => {
    expect(splitRepoFullName('novalidseparator')).toBeNull()
    expect(splitRepoFullName('too/many/segments')).toBeNull()
    expect(splitRepoFullName('/leading')).toBeNull()
    expect(splitRepoFullName('trailing/')).toBeNull()
    expect(splitRepoFullName('-bad/owner')).toBeNull()
    expect(splitRepoFullName('owner/.hidden')).toBeNull()
  })

  it('rejects the free-text payloads the rankings used to accept', () => {
    expect(splitRepoFullName('<script>alert(1)</script>')).toBeNull()
    expect(splitRepoFullName('a'.repeat(500))).toBeNull()
    expect(splitRepoFullName('')).toBeNull()
    expect(splitRepoFullName(null)).toBeNull()
    expect(splitRepoFullName(42)).toBeNull()
    expect(splitRepoFullName({ owner: 'x', repo: 'y' })).toBeNull()
  })
})
