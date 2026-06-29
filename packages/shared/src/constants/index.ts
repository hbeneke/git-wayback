// Time constants
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

// GitHub API limits
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

// Evolution / timeline limits
export const EVOLUTION = {
  /** Default number of snapshots to render */
  DEFAULT_LIMIT: 20,

  /** Maximum number of snapshots (hard cap — bump here to raise the ceiling) */
  MAX_LIMIT: 30,

  /** Counts offered in the UI selector (kept <= MAX_LIMIT) */
  LIMIT_OPTIONS: [10, 20, 30],

  /**
   * Max items pulled from GitHub before sampling down to `limit`.
   * Bounds API cost for repos with thousands of tags/commits.
   */
  FETCH_POOL: 100,

  /** Available data sources */
  SOURCES: ['tags', 'commits'] as const,
  DEFAULT_SOURCE: 'tags' as const,

  /**
   * Sampling strategies when the pool is larger than `limit`:
   * - spread: evenly spaced across history (first + last + intermediate)
   * - latest: the most recent N
   */
  SAMPLING: ['spread', 'latest'] as const,
  DEFAULT_SAMPLING: 'spread' as const,
} as const

export type EvolutionSource = (typeof EVOLUTION.SOURCES)[number]
export type EvolutionSampling = (typeof EVOLUTION.SAMPLING)[number]

// UI display limits
export const DISPLAY = {
  /** Max recent commits to show */
  RECENT_COMMITS: 15,

  /** Max search query length */
  MAX_SEARCH_LENGTH: 256,
} as const

// Diagram configuration
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
