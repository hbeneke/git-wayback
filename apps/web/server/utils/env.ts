/**
 * Environment variable validation and access.
 * Provides type-safe access to configuration with validation.
 */

interface EnvConfig {
  databaseUrl: string
  githubToken: string | null
}

let cachedConfig: EnvConfig | null = null

/**
 * Validates that a required environment variable is set.
 * Throws a descriptive error if missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set it in your .env file or environment.`
    )
  }

  return value.trim()
}

/**
 * Gets an optional environment variable, returning null if not set.
 */
function optionalEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : null
}

/**
 * Validates and returns the application configuration.
 * Caches the result after first validation.
 *
 * @throws Error if required environment variables are missing
 */
export function getEnvConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  cachedConfig = {
    databaseUrl: requireEnv('DATABASE_URL'),
    githubToken: optionalEnv('GITHUB_TOKEN'),
  }

  return cachedConfig
}

/**
 * Gets the database connection string.
 * Throws if DATABASE_URL is not configured.
 */
export function getDatabaseUrl(): string {
  return getEnvConfig().databaseUrl
}

/**
 * Gets the GitHub token if configured.
 * Returns null if not set (will use unauthenticated rate limits).
 */
export function getGitHubToken(): string | null {
  return getEnvConfig().githubToken
}

/**
 * Checks if the application has all required configuration.
 * Useful for health checks.
 */
export function isConfigValid(): boolean {
  try {
    getEnvConfig()
    return true
  } catch {
    return false
  }
}
