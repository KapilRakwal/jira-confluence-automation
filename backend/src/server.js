import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { getMigrationVersions } from './migrations.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)
const app = createApp({ pool, expectedMigrations: getMigrationVersions() })

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Dashboard API listening on port ${config.port}`)
})
