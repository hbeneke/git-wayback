import { type ConsolaInstance, consola } from 'consola'

const BASE_TAG = 'git-wayback'

export function createLogger(scope: string): ConsolaInstance {
  return consola.withTag(`${BASE_TAG}:${scope}`)
}

// Only the scopes actually consumed are wired; add more when needed.
export const logger = {
  evolution: createLogger('evolution'),
  rateLimit: createLogger('rate-limit'),
}
