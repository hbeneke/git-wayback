import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

export const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => {
  return c.json({ name: 'git-wayback-api', version: '0.0.1' })
})

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})
