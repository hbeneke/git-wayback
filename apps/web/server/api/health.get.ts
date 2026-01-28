export default defineEventHandler(() => {
  const configValid = isConfigValid()

  return {
    status: configValid ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      config: configValid,
      githubToken: !!getGitHubToken(),
    },
  }
})
