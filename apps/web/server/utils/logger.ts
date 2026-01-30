import { consola, type ConsolaInstance } from 'consola'

/**
 * Application logger built on consola.
 * Provides structured, level-aware logging for server-side code.
 */

const BASE_TAG = 'git-wayback'

/**
 * Creates a scoped logger instance with a specific tag.
 */
export function createLogger(scope: string): ConsolaInstance {
  return consola.withTag(`${BASE_TAG}:${scope}`)
}

/**
 * Pre-configured loggers for common modules.
 */
export const logger = {
  evolution: createLogger('evolution'),
  api: createLogger('api'),
  db: createLogger('db'),
  github: createLogger('github'),
}
