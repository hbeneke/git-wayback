import { createDb, repoVisits } from '@git-wayback/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    visitorId: string
    repoFullName: string
    repoAvatar?: string
  }>(event)

  if (!body.visitorId || !body.repoFullName) {
    throw createError({ statusCode: 400, message: 'visitorId and repoFullName are required' })
  }

  const db = createDb(getDatabaseUrl())

  await db
    .insert(repoVisits)
    .values({
      visitorId: body.visitorId,
      repoFullName: body.repoFullName,
      repoAvatar: body.repoAvatar || null,
    })
    .onConflictDoNothing()

  return { ok: true }
})
