import { createDb, repoVisits } from '@git-wayback/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    repoFullName: string
    repoAvatar?: string
  }>(event)

  if (!body.repoFullName) {
    throw createError({ statusCode: 400, message: 'repoFullName is required' })
  }

  // Use client IP as visitor identifier (server-side, not spoofable by the client)
  const headers = getHeaders(event)
  const forwarded = headers['x-forwarded-for']
  const visitorIp = forwarded
    ? forwarded.split(',')[0].trim()
    : headers['x-real-ip'] || event.node.req.socket.remoteAddress || 'unknown'

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
