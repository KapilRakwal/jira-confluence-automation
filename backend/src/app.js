import express from 'express'
import { migrationsAreCurrent } from './migrations.js'

export function createApp({ pool, expectedMigrations }) {
  const app = express()

  app.disable('x-powered-by')

  app.get('/api/v1/health/live', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/v1/health/ready', async (_request, response) => {
    try {
      await pool.query('SELECT 1')
      const migrationsCurrent = await migrationsAreCurrent(
        pool,
        expectedMigrations,
      )

      if (!migrationsCurrent) {
        return response.status(503).json({ status: 'not_ready' })
      }

      return response.json({ status: 'ready' })
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? error.code
        : 'DATABASE_UNAVAILABLE'
      console.error(JSON.stringify({ event: 'readiness_check_failed', errorCode }))
      return response.status(503).json({ status: 'not_ready' })
    }
  })

  return app
}
