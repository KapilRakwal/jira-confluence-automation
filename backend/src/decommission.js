import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { deleteProjectDashboardData } from './dashboardRepository.js'

let pool

try {
  const config = loadConfig()
  if (
    process.argv.length !== 4 ||
    process.argv[2] !== '--confirm' ||
    process.argv[3] !== config.jiraProject
  ) {
    const error = new Error('Exact project confirmation is required')
    error.code = 'PROJECT_CONFIRMATION_REQUIRED'
    throw error
  }

  pool = createPool(config.databaseUrl)
  const result = await deleteProjectDashboardData(pool, config.jiraProject)
  console.log(JSON.stringify({
    event: 'project_dashboard_data_removed',
    projectKey: config.jiraProject,
    ...result,
  }))
} catch (error) {
  const errorCode = error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'PROJECT_DECOMMISSION_FAILED'
  console.error(JSON.stringify({
    event: 'project_decommission_failed',
    errorCode,
  }))
  process.exitCode = 1
} finally {
  if (pool) {
    await pool.end()
  }
}
