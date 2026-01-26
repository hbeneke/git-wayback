/**
 * Formatting utilities for consistent data presentation across the application.
 * These pure functions handle number, date, and string transformations.
 */

const MILLISECONDS_PER_SECOND = 1000
const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * 60
const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * 60
const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * 24

const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * 1024
const GIGABYTE = MEGABYTE * 1024

/**
 * Formats large numbers into human-readable abbreviated form.
 *
 * @example
 * formatNumber(1500)    // "1.5K"
 * formatNumber(2500000) // "2.5M"
 * formatNumber(500)     // "500"
 */
export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return String(value)
}

/**
 * Formats a date string into a localized readable format.
 *
 * @example
 * formatDate("2024-01-15T10:30:00Z") // "Jan 15, 2024"
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a date string into a human-readable relative time.
 *
 * @example
 * formatRelativeDate("2024-01-28T10:00:00Z") // "2 days ago" (if today is Jan 30)
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`

  return `${Math.floor(diffDays / 365)} years ago`
}

/**
 * Formats file size in kilobytes to human-readable format.
 *
 * @example
 * formatSize(500)    // "500 KB"
 * formatSize(2048)   // "2.0 MB"
 * formatSize(2097152) // "2.0 GB"
 */
export function formatSize(sizeInKb: number): string {
  if (sizeInKb >= MEGABYTE) {
    return `${(sizeInKb / MEGABYTE).toFixed(1)} GB`
  }

  if (sizeInKb >= KILOBYTE) {
    return `${(sizeInKb / KILOBYTE).toFixed(1)} MB`
  }

  return `${sizeInKb} KB`
}

/**
 * Strips protocol and trailing slash from URLs for display.
 *
 * @example
 * formatUrl("https://example.com/") // "example.com"
 */
export function formatUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

/**
 * Calculates proportional bar height for chart visualization.
 * Returns a pixel height based on the value's proportion to the maximum in the array.
 *
 * @param value - The current value to calculate height for
 * @param values - Array of all values (used to determine maximum)
 * @param maxHeight - Maximum bar height in pixels (default: 60)
 *
 * @example
 * getBarHeight(50, [25, 50, 100]) // 30 (50% of maxHeight)
 */
export function getBarHeight(
  value: number,
  values: number[],
  maxHeight = 60
): number {
  const max = Math.max(...values, 1)
  return Math.round((value / max) * maxHeight)
}
