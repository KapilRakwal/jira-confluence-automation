import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createPool } from '../src/database.js'
import {
  deleteProjectDashboardData,
  publishSuccessfulSnapshot,
  readDashboard,
  recordRefreshFailure,
} from '../src/dashboardRepository.js'
import { withProjectRefreshLock } from '../src/refreshLock.js'
import { getMigrationVersions, migrate, migrationsAreCurrent } from '../src/migrations.js'
import { JiraClientError } from '../src/jiraClient.js'
import { runRefresh } from '../src/refreshService.js'

test(
  'PostgreSQL stores one current snapshot and preserves it after a failed refresh',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL)
    const projectKey = `TEST-${randomUUID()}`
    const refreshProject = `${projectKey}-RUN`
    const decommissionProject = `${projectKey}-DELETE`
    const preservedProject = `${projectKey}-PRESERVE`
    const lastAttemptAt = new Date('2026-11-26T08:30:00.000Z')

    try {
      await migrate(pool)
      assert.equal(
        await migrationsAreCurrent(pool, getMigrationVersions()),
        true,
      )

      await publishSuccessfulSnapshot(pool, projectKey, {
        asOfAt: '2026-11-26T07:59:00.000Z',
        summary: { open: 2 },
      }, new Date('2026-11-26T08:00:00.000Z'))
      await publishSuccessfulSnapshot(pool, projectKey, {
        asOfAt: '2026-11-26T08:59:00.000Z',
        summary: { open: 1 },
      }, new Date('2026-11-26T09:00:00.000Z'))
      await recordRefreshFailure(
        pool,
        projectKey,
        lastAttemptAt,
        'JIRA_UNAVAILABLE',
      )

      const { rows } = await pool.query(
        'SELECT COUNT(*)::INTEGER AS count FROM dashboard_snapshots WHERE project_key = $1',
        [projectKey],
      )
      assert.equal(rows[0].count, 1)

      const dashboard = await readDashboard(pool, projectKey)
      assert.equal(dashboard.summary.open, 1)
      assert.deepEqual(dashboard.refreshStatus, {
        state: 'failed',
        lastAttemptAt: lastAttemptAt.toISOString(),
        lastSuccessAt: dashboard.generatedAt,
        errorCode: 'JIRA_UNAVAILABLE',
      })

      const lockProject = `${projectKey}-LOCK`
      await withProjectRefreshLock(pool, lockProject, async () => {
        await assert.rejects(
          withProjectRefreshLock(pool, lockProject, async () => {
            assert.fail('a second refresh must not acquire the project lock')
          }),
          { code: 'REFRESH_ALREADY_RUNNING' },
        )
        assert.equal(
          await withProjectRefreshLock(
            pool,
            `${lockProject}-OTHER`,
            async () => 'independent project',
          ),
          'independent project',
        )
      })

      await assert.rejects(
        withProjectRefreshLock(pool, lockProject, async () => {
          throw new Error('test failure')
        }),
        /test failure/,
      )
      assert.equal(
        await withProjectRefreshLock(pool, lockProject, async () => 'released'),
        'released',
      )

      const refreshConfig = {
        jiraProject: refreshProject,
        windowDays: 14,
        reportingTimeZone: 'Asia/Kolkata',
        pocDeadline: '2026-11-30',
        staleDays: 3,
        highRiskPriorities: ['Highest', 'High'],
        refreshTimeoutMinutes: 10,
      }
      const emptyJiraClient = {
        async request(path) {
          if (path === '/rest/api/3/status') {
            return []
          }
          return { issues: [], values: [], total: 0, isLast: true }
        },
      }
      const successfulRefresh = await runRefresh({
        config: refreshConfig,
        pool,
        now: () => Date.parse('2026-11-26T12:00:00.000Z'),
        clientFactory: () => emptyJiraClient,
      })
      assert.equal(successfulRefresh.refreshStatus.state, 'success')

      await assert.rejects(
        runRefresh({
          config: refreshConfig,
          pool,
          now: () => Date.parse('2026-11-26T13:00:00.000Z'),
          clientFactory: () => ({
            async request() {
              throw new JiraClientError('JIRA_HTTP_503', { status: 503 })
            },
          }),
        }),
        { status: 503 },
      )
      const retainedDashboard = await readDashboard(pool, refreshProject)
      assert.equal(retainedDashboard.generatedAt, successfulRefresh.generatedAt)
      assert.deepEqual(retainedDashboard.refreshStatus, {
        state: 'failed',
        lastAttemptAt: '2026-11-26T13:00:00.000Z',
        lastSuccessAt: successfulRefresh.generatedAt,
        errorCode: 'JIRA_HTTP_503',
      })

      await publishSuccessfulSnapshot(pool, decommissionProject, {
        asOfAt: '2026-11-26T07:59:00.000Z',
        summary: { open: 1 },
      })
      await recordRefreshFailure(
        pool,
        decommissionProject,
        lastAttemptAt,
        'JIRA_UNAVAILABLE',
      )
      await publishSuccessfulSnapshot(pool, preservedProject, {
        asOfAt: '2026-11-26T07:59:00.000Z',
        summary: { open: 2 },
      })

      assert.deepEqual(
        await deleteProjectDashboardData(pool, decommissionProject),
        { snapshotsDeleted: 1, refreshStatesDeleted: 1 },
      )
      assert.equal(await readDashboard(pool, decommissionProject), null)
      assert.equal((await readDashboard(pool, preservedProject)).summary.open, 2)
    } finally {
      await pool.query(
        'DELETE FROM dashboard_snapshots WHERE project_key = ANY($1)',
        [[
          projectKey,
          `${projectKey}-RUN`,
          `${projectKey}-DELETE`,
          `${projectKey}-PRESERVE`,
        ]],
      )
      await pool.query(
        'DELETE FROM dashboard_refresh_state WHERE project_key = ANY($1)',
        [[
          projectKey,
          `${projectKey}-RUN`,
          `${projectKey}-DELETE`,
          `${projectKey}-PRESERVE`,
        ]],
      )
      await pool.end()
    }
  },
)
