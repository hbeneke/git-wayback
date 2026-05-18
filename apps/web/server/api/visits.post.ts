import { createDb, repoVisits } from '@git-wayback/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    repoFullName: string
    repoAvatar?: string
  }>(event)

  if (!body.repoFullName) {
    throw createError({ statusCode: 400, message: 'repoFullName is required' })
  }

  // Visitor identifier = platform-trusted client IP. Raw x-forwarded-for is
  // NOT used here because it is client-controlled (see getTrustedClientIp).
  const visitorIp = getTrustedClientIp(event)

  const db = createDb(getDatabaseUrl())

  await db
    .insert(repoVisits)
    .values({
      visitorId: visitorIp,
      repoFullName: body.repoFullName,
      repoAvatar: body.repoAvatar || null,
    })
    .onConflictDoNothing()

  return { ok: true }
})
