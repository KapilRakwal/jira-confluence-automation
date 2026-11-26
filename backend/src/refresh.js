import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { runRefresh } from './refreshService.js'

let pool

try {
  const config = loadConfig()
  pool = createPool(config.databaseUrl)
  await runRefresh({ config, pool })
} catch {
  if (!pool) {
    console.error(JSON.stringify({
      event: 'refresh_failed',
      errorCode: 'CONFIGURATION_INVALID',
    }))
  }
  process.exitCode = 1
} finally {
  if (pool) {
    await pool.end()
  }
}
