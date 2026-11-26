import { assembleDashboardSnapshot } from './dashboardCalculations.js'
import { reportingWindow } from './dateTime.js'
import { createJiraClient, JiraClientError } from './jiraClient.js'
import { fetchChangelogs } from './jiraChangelog.js'
import { fetchIssueDatasets } from './jiraIssues.js'
import {
  publishSuccessfulSnapshot,
  recordRefreshFailure,
} from './dashboardRepository.js'
import { withProjectRefreshLock } from './refreshLock.js'

export async function buildRefreshSnapshot(
  config,
  jiraClient,
  { now = Date.now, asOfAt: suppliedAsOfAt } = {},
) {
  const startedAtMilliseconds = suppliedAsOfAt
    ? new Date(suppliedAsOfAt).valueOf()
    : now()
  const asOfAt = new Date(startedAtMilliseconds)
  const deadlineAt =
    startedAtMilliseconds + config.refreshTimeoutMinutes * 60 * 1000
  const window = reportingWindow(
    asOfAt,
    config.windowDays,
    config.reportingTimeZone,
  )

  const datasets = await fetchIssueDatasets(jiraClient, {
    projectKey: config.jiraProject,
    window,
    deadlineAt,
  })
  const openKeys = new Set(datasets.openIssues.map(({ key }) => key))
  const completedIssues = datasets.completedIssues.filter(
    ({ key }) => !openKeys.has(key),
  )
  const allIssues = [
    ...datasets.openIssues,
    ...completedIssues,
  ]
  const changelogs = await fetchChangelogs(jiraClient, allIssues, {
    deadlineAt,
  })
  const snapshot = assembleDashboardSnapshot({
    projectKey: config.jiraProject,
    window,
    deadline: config.pocDeadline,
    staleDays: config.staleDays,
    highRiskPriorities: config.highRiskPriorities,
    openIssues: datasets.openIssues,
    completedIssues,
    changelogs,
  })

  if (now() >= deadlineAt) {
    throw new JiraClientError('JIRA_REFRESH_TIMEOUT')
  }

  return snapshot
}

function refreshErrorCode(error) {
  const errors = error instanceof AggregateError ? error.errors : [error]

  if (
    errors.some((item) =>
      typeof item?.code === 'string' &&
      (item.code.startsWith('08') ||
        ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(item.code)),
    )
  ) {
    return 'DATABASE_UNAVAILABLE'
  }

  if (errors.some((item) => typeof item?.code === 'string' && item.code.startsWith('JIRA_'))) {
    return errors.find((item) => item?.code?.startsWith('JIRA_')).code
  }

  if (errors.some((item) => item?.code === 'REFRESH_ALREADY_RUNNING')) {
    return 'REFRESH_ALREADY_RUNNING'
  }

  if (
    error &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    /^[A-Z][A-Z0-9_]*$/.test(error.code)
  ) {
    return error.code
  }

  return 'REFRESH_FAILED'
}

export async function runRefresh({
  config,
  pool,
  now = Date.now,
  clientFactory = createJiraClient,
  logger = console,
}) {
  const invocationStartedAt = now()
  logger.log(JSON.stringify({
    event: 'refresh_started',
    projectKey: config.jiraProject,
    startedAt: new Date(invocationStartedAt).toISOString(),
  }))

  try {
    const jiraClient = clientFactory(config, { now })
    const snapshot = await withProjectRefreshLock(
      pool,
      config.jiraProject,
      async () => {
        const startedAt = new Date(now())

        try {
          const dashboardSnapshot = await buildRefreshSnapshot(
            config,
            jiraClient,
            { now, asOfAt: startedAt },
          )
          const generatedAt = await publishSuccessfulSnapshot(
            pool,
            config.jiraProject,
            dashboardSnapshot,
            startedAt,
          )

          return {
            ...dashboardSnapshot,
            generatedAt,
            refreshStatus: {
              state: 'success',
              lastAttemptAt: startedAt.toISOString(),
              lastSuccessAt: generatedAt,
              errorCode: null,
            },
          }
        } catch (error) {
          try {
            await recordRefreshFailure(
              pool,
              config.jiraProject,
              startedAt,
              refreshErrorCode(error),
            )
          } catch (stateError) {
            throw new AggregateError(
              [error, stateError],
              'Refresh failed and its failure state could not be recorded',
            )
          }

          throw error
        }
      },
    )

    logger.log(JSON.stringify({
      event: 'refresh_completed',
      projectKey: config.jiraProject,
      durationMs: Math.max(0, now() - invocationStartedAt),
      outcome: 'success',
    }))
    return snapshot
  } catch (error) {
    logger.error(JSON.stringify({
      event: 'refresh_failed',
      projectKey: config.jiraProject,
      durationMs: Math.max(0, now() - invocationStartedAt),
      errorCode: refreshErrorCode(error),
    }))
    throw error
  }
}
