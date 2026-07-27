import { createDb, repoVisits } from '@git-wayback/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ repoFullName?: unknown }>(event)

  // Free text from the client that ends up on the public rankings, so it is
  // parsed into a real owner/repo pair rather than just checked for presence.
  const { owner, repo } = parseRepoFullName(body?.repoFullName)
  const repoFullName = `${owner}/${repo}`

  // Derived, never read from the body: a caller-supplied URL would render as
  // <img src> on the home page for every visitor.
  const repoAvatar = `https://github.com/${owner}.png`

  // Visitor identifier = platform-trusted client IP. Raw x-forwarded-for is
  // NOT used here because it is client-controlled (see getTrustedClientIp).
  const visitorIp = getTrustedClientIp(event)

  // UTC day bucket — dedup is per visitor+repo+day (see schema unique).
  const visitDay = new Date().toISOString().slice(0, 10)

  const db = createDb(getDatabaseUrl())

  await db
    .insert(repoVisits)
    .values({
      visitorId: visitorIp,
      repoFullName,
      repoAvatar,
      visitDay,
    })
    .onConflictDoNothing()

  return { ok: true }
})
