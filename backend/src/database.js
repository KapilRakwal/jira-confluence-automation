import pg from 'pg'

const { Pool } = pg

export function createPool(connectionString) {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  })

  pool.on('error', (error) => {
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : 'DATABASE_CONNECTION_ERROR'
    console.error(
      JSON.stringify({ event: 'database_idle_connection_failed', errorCode }),
    )
  })

  return pool
}
