import express from 'express'
import { migrationsAreCurrent } from './migrations.js'
import { readDashboard } from './dashboardRepository.js'

const databaseUnavailableCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  '57P01',
  '57P02',
  '57P03',
])

function isDatabaseUnavailable(error) {
  const code = error && typeof error === 'object' && 'code' in error
    ? error.code
    : ''

  return typeof code === 'string' &&
    (code.startsWith('08') || databaseUnavailableCodes.has(code))
}

export function createApp({ pool, expectedMigrations, projectKey = 'SCRUM' }) {
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

  app.get('/api/v1/dashboard', async (_request, response) => {
    try {
      const dashboard = await readDashboard(pool, projectKey)

      if (!dashboard) {
        return response.status(503).json({
          error: {
            code: 'DASHBOARD_NOT_READY',
            message: 'A dashboard snapshot is not available yet.',
          },
        })
      }

      return response.json(dashboard)
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        console.error(JSON.stringify({
          event: 'dashboard_read_failed',
          errorCode: 'SERVICE_UNAVAILABLE',
        }))
        return response.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'The dashboard service is temporarily unavailable.',
          },
        })
      }

      console.error(JSON.stringify({
        event: 'dashboard_read_failed',
        errorCode: 'INTERNAL_SERVER_ERROR',
      }))
      return response.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The dashboard could not be loaded.',
        },
      })
    }
  })

  return app
}
