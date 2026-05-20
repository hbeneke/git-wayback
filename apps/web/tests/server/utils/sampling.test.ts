import { describe, expect, it } from 'vitest'
import { sampleSnapshots } from '../../../server/utils/sampling'

describe('sampleSnapshots', () => {
  it('returns the input untouched when length <= count', () => {
    const items = [1, 2, 3]
    expect(sampleSnapshots(items, 5, 'spread')).toEqual([1, 2, 3])
    expect(sampleSnapshots(items, 5, 'latest')).toEqual([1, 2, 3])
  })

  it('returns only the last element when count <= 1', () => {
    expect(sampleSnapshots([1, 2, 3, 4], 1, 'spread')).toEqual([4])
    expect(sampleSnapshots([1, 2, 3, 4], 0, 'latest')).toEqual([4])
  })

  it('latest takes the most recent N', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(sampleSnapshots(items, 3, 'latest')).toEqual([8, 9, 10])
  })

  it('spread keeps first + last and is evenly distributed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const out = sampleSnapshots(items, 5, 'spread')
    expect(out[0]).toBe(1)
    expect(out[out.length - 1]).toBe(10)
  })

  it('spread never returns duplicates even when rounding collides', () => {
    const items = [1, 2, 3, 4]
    const out = sampleSnapshots(items, 3, 'spread')
    expect(new Set(out).size).toBe(out.length)
  })

  it('handles a count equal to the pool size', () => {
    const items = [1, 2, 3]
    expect(sampleSnapshots(items, 3, 'spread')).toEqual([1, 2, 3])
  })
})
