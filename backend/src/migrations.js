import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url))
const migrationNamePattern = /^(\d{3,}_[a-z0-9_-]+)\.sql$/i

export function loadMigrations() {
  if (!existsSync(migrationsDirectory)) {
    return []
  }

  return readdirSync(migrationsDirectory)
    .map((fileName) => {
      const match = migrationNamePattern.exec(fileName)
      return match
        ? {
            version: match[1],
            sql: readFileSync(join(migrationsDirectory, fileName), 'utf8'),
          }
        : null
    })
    .filter((migration) => migration !== null)
    .sort((left, right) => left.version.localeCompare(right.version))
}

export function getMigrationVersions() {
  return loadMigrations().map(({ version }) => version)
}

export async function migrate(pool) {
  const client = await pool.connect()

  try {
    await client.query('SELECT pg_advisory_lock($1)', [728194615])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const migrations = loadMigrations()
    const { rows } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version',
    )
    const applied = new Set(rows.map(({ version }) => version))
    const expected = new Set(migrations.map(({ version }) => version))
    const unknownVersions = [...applied].filter((version) => !expected.has(version))

    if (unknownVersions.length > 0) {
      throw new Error('Database contains migrations missing from this application')
    }

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
        ])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [728194615])
    } finally {
      client.release()
    }
  }
}

export async function migrationsAreCurrent(pool, expectedVersions) {
  const { rows } = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version',
  )
  const applied = new Set(rows.map(({ version }) => version))
  const expected = new Set(expectedVersions)

  return (
    applied.size === expected.size &&
    [...expected].every((version) => applied.has(version))
  )
}
