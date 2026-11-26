import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { migrate } from './migrations.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)

try {
  await migrate(pool)
  console.log(JSON.stringify({ event: 'database_migrations_complete' }))
} catch (error) {
  const errorCode = error && typeof error === 'object' && 'code' in error
    ? error.code
    : 'MIGRATION_FAILED'
  console.error(JSON.stringify({ event: 'database_migrations_failed', errorCode }))
  process.exitCode = 1
} finally {
  await pool.end()
}
