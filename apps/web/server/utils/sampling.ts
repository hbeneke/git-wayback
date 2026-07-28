import type { EvolutionSampling } from '@git-wayback/shared'

/**
 * Pick `count` items from a chronologically-sorted (oldest first) array.
 * - `latest`: the most recent `count`.
 * - `spread`: evenly spaced indices across [0, len-1], endpoints included.
 *   Duplicates from rounding are dropped — the returned array may be shorter
 *   than `count` for small inputs, which is intentional.
 *
 * Extracted out of the evolution endpoint so it is unit-testable.
 */
export function sampleSnapshots<T>(items: T[], count: number, strategy: EvolutionSampling): T[] {
  if (items.length <= count) return items
  if (count <= 1) return [items[items.length - 1]]
  if (strategy === 'latest') return items.slice(items.length - count)

  const last = items.length - 1
  const picked: T[] = []
  const seen = new Set<number>()
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * last) / (count - 1))
    if (!seen.has(idx)) {
      seen.add(idx)
      picked.push(items[idx])
    }
  }
  return picked
}
