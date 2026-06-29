interface EnvConfig {
  databaseUrl: string
  githubToken: string | null
  upstashRedisRestUrl: string | null
  upstashRedisRestToken: string | null
}

let cachedConfig: EnvConfig | null = null

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
  }

  return cachedConfig
}

export function getDatabaseUrl(): string {
  return getEnvConfig().databaseUrl
}

// null when unset → GitHub falls back to unauthenticated rate limits
export function getGitHubToken(): string | null {
  return getEnvConfig().githubToken
}

export function isConfigValid(): boolean {
  try {
    getEnvConfig()
    return true
  } catch {
    return false
  }
}
