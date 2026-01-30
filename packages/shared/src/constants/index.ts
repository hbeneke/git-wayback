/**
 * Application-wide constants and configuration values.
 * Centralizes magic numbers for maintainability and documentation.
 */

// =============================================================================
// Time Constants
// =============================================================================

export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = MS_PER_SECOND * 60
export const MS_PER_HOUR = MS_PER_MINUTE * 60
export const MS_PER_DAY = MS_PER_HOUR * 24

/** Cache duration for evolution snapshots (24 hours) */
export const EVOLUTION_CACHE_DURATION_MS = MS_PER_DAY

/** Debounce delay for search input (ms) */
export const SEARCH_DEBOUNCE_MS = 300

/** Animation interval for timeline playback (ms) */
export const TIMELINE_PLAYBACK_INTERVAL_MS = 2000

/** D3 transition duration for node animations (ms) */
export const D3_TRANSITION_DURATION_MS = 500

/** D3 transition duration for exit animations (ms) */
export const D3_EXIT_TRANSITION_DURATION_MS = 300

// =============================================================================
// GitHub API Limits
// =============================================================================

export const GITHUB_API = {
  /** Max items per search result page */
  SEARCH_PER_PAGE: 10,

  /** Max contributors to fetch */
  CONTRIBUTORS_PER_PAGE: 10,

  /** Max commits to fetch for activity analysis */
  COMMITS_PER_PAGE: 30,

  /** Max branches to fetch */
  BRANCHES_PER_PAGE: 100,

  /** Max releases to fetch */
  RELEASES_PER_PAGE: 10,

  /** Batch size for parallel API requests (avoids rate limits) */
  BATCH_SIZE: 5,
} as const

// =============================================================================
// Evolution / Timeline Limits
// =============================================================================

export const EVOLUTION = {
  /** Default number of tags to fetch */
  DEFAULT_LIMIT: 20,

  /** Maximum number of tags to fetch */
  MAX_LIMIT: 30,
} as const

export const TIMELINE = {
  /** Default number of tags for timeline view */
  DEFAULT_LIMIT: 50,

  /** Maximum number of tags for timeline view */
  MAX_LIMIT: 100,
} as const

// =============================================================================
// UI Display Limits
// =============================================================================

export const DISPLAY = {
  /** Max recent commits to show */
  RECENT_COMMITS: 15,

  /** Max search query length */
  MAX_SEARCH_LENGTH: 256,
} as const

// =============================================================================
// Diagram Configuration
// =============================================================================

// =============================================================================
// Rate Limiting
// =============================================================================

export const RATE_LIMIT = {
  /** Standard API rate limit per minute */
  API_REQUESTS_PER_MINUTE: 100,

  /** Search endpoint rate limit per minute */
  SEARCH_REQUESTS_PER_MINUTE: 30,

  /** Evolution endpoint rate limit per minute */
  EVOLUTION_REQUESTS_PER_MINUTE: 20,

  /** Health check rate limit per minute */
  HEALTH_REQUESTS_PER_MINUTE: 300,

  /** Cleanup interval for expired entries */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const

// =============================================================================
// Diagram Configuration
// =============================================================================

export const DIAGRAM = {
  /** Fixed height for the visualization container */
  HEIGHT: 600,

  /** Default width fallback */
  DEFAULT_WIDTH: 900,

  /** Padding from edges for tree layout */
  EDGE_PADDING: 100,

  /** Maximum node radius for files */
  MAX_NODE_RADIUS: 8,

  /** Minimum node radius for files */
  MIN_NODE_RADIUS: 3,

  /** Root node radius */
  ROOT_NODE_RADIUS: 8,

  /** Folder node radius */
  FOLDER_NODE_RADIUS: 4,
} as const
