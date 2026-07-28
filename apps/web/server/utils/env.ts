interface EnvConfig {
  databaseUrl: string
  githubToken: string | null
  upstashRedisRestUrl: string | null
  upstashRedisRestToken: string | null
  cronSecret: string | null
  visitorSalt: string | null
}

let cachedConfig: EnvConfig | null = null

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Please set it in your .env file or environment.`,
    )
  }

  return value.trim()
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() !== '' ? value.trim() : null
}

export function getEnvConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  cachedConfig = {
    databaseUrl: requireEnv('DATABASE_URL'),
    githubToken: optionalEnv('GITHUB_TOKEN'),
    upstashRedisRestUrl: optionalEnv('UPSTASH_REDIS_REST_URL'),
    upstashRedisRestToken: optionalEnv('UPSTASH_REDIS_REST_TOKEN'),
    cronSecret: optionalEnv('CRON_SECRET'),
    visitorSalt: optionalEnv('VISITOR_ID_SALT'),
  }

  return cachedConfig
}

// null when unset → the maintenance endpoints refuse every caller
export function getCronSecret(): string | null {
  return getEnvConfig().cronSecret
}

/**
 * Salt for the visitor identifier hash. Without it the hash is enumerable —
 * IPv4 is only 2^32 values — so production is expected to set one.
 */
export function getVisitorSalt(): string {
  const salt = getEnvConfig().visitorSalt

  if (!salt) {
    if (isProduction()) {
      logger.visits.error('VISITOR_ID_SALT is unset — visitor hashes are enumerable')
    }
    return 'git-wayback-unsalted'
  }

  return salt
}

export function getDatabaseUrl(): string {
  return getEnvConfig().databaseUrl
}

// null when unset → GitHub falls back to unauthenticated rate limits
export function getGitHubToken(): string | null {
  return getEnvConfig().githubToken
}

/**
 * True on a real deployment (Vercel production), as opposed to local dev and
 * preview builds. Guards the checks that must fail loudly rather than degrade.
 */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

/** Whether the Upstash credentials needed for rate limiting are present. */
export function isRateLimitConfigured(): boolean {
  try {
    const config = getEnvConfig()
    return Boolean(config.upstashRedisRestUrl && config.upstashRedisRestToken)
  } catch {
    return false
  }
}

export function isConfigValid(): boolean {
  try {
    getEnvConfig()
    return true
  } catch {
    return false
  }
}
