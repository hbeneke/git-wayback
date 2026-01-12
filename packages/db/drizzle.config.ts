import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load .env.local from monorepo root
const rootDir = path.resolve(__dirname, '../..')
config({ path: path.join(rootDir, '.env.local') })

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
