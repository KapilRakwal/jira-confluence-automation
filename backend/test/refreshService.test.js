import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRefreshSnapshot, runRefresh } from '../src/refreshService.js'
import { JiraClientError } from '../src/jiraClient.js'

const config = {
  jiraProject: 'SCRUM',
  windowDays: 14,
  reportingTimeZone: 'Asia/Kolkata',
  pocDeadline: '2026-11-30',
  staleDays: 3,
  highRiskPriorities: ['Highest', 'High'],
  refreshTimeoutMinutes: 10,
}

function openIssue() {
  return {
    id: '1',
    key: 'SCRUM-1',
    fields: {
      summary: 'Open issue',
      status: {
        id: '1',
        name: 'To Do',
        statusCategory: { key: 'new' },
      },
      assignee: null,
      updated: '2026-11-26T10:00:00.000Z',
      created: '2026-11-25T10:00:00.000Z',
      duedate: null,
      priority: null,
      resolutiondate: null,
    },
  }
}

function completedIssue() {
  return {
    id: '2',
    key: 'SCRUM-2',
    fields: {
      summary: 'Completed issue',
      status: {
        id: '3',
        name: 'Done',
        statusCategory: { key: 'done' },
      },
      assignee: null,
      updated: '2026-11-26T10:00:00.000Z',
      created: '2026-11-24T10:00:00.000Z',
      duedate: null,
      priority: null,
      resolutiondate: '2026-11-26T11:00:00.000Z',
    },
  }
}

test('refresh captures one asOfAt and completes all Jira inputs before assembling a snapshot', async () => {
  const calls = []
  const instants = [
    Date.parse('2026-11-26T12:00:00.000Z'),
    Date.parse('2026-11-26T12:00:01.000Z'),
  ]
  const client = {
    async request(path, options = {}) {
      calls.push({ path, options })
      if (path === '/rest/api/3/search/jql') {
        const isOpenSearch = options.query.jql.includes('statusCategory != Done')
        return {
          issues: [isOpenSearch ? openIssue() : completedIssue()],
          isLast: true,
        }
      }
      if (path === '/rest/api/3/status') {
        return []
      }
      return { values: [], total: 0 }
    },
  }
  const snapshot = await buildRefreshSnapshot(config, client, {
    now: () => instants.shift(),
  })

  assert.equal(snapshot.asOfAt, '2026-11-26T12:00:00.000Z')
  assert.equal(snapshot.reportingWindow.end, snapshot.asOfAt)
  assert.equal(snapshot.summary.openCount, 1)
  assert.equal(snapshot.summary.completedCount, 1)
  assert.equal(calls.length, 5)
  assert.ok(calls.every(({ options }) => options.deadlineAt === Date.parse('2026-11-26T12:10:00.000Z')))
})

test('refresh fails instead of assembling a partial dataset after Jira errors', async () => {
  const client = {
    async request() {
      throw new JiraClientError('JIRA_HTTP_403', { status: 403 })
    },
  }

  await assert.rejects(
    buildRefreshSnapshot(config, client, {
      now: () => Date.parse('2026-11-26T12:00:00.000Z'),
    }),
    { status: 403 },
  )
})

test('refresh fails if calculation and assembly exceed the total refresh deadline', async () => {
  const instants = [
    Date.parse('2026-11-26T12:00:00.000Z'),
    Date.parse('2026-11-26T12:10:01.000Z'),
  ]
  const client = {
    async request(path, options = {}) {
      if (path === '/rest/api/3/search/jql') {
        return {
          issues: [
            options.query.jql.includes('statusCategory != Done')
              ? openIssue()
              : completedIssue(),
          ],
          isLast: true,
        }
      }
      if (path === '/rest/api/3/status') {
        return []
      }
      return { values: [], total: 0 }
    },
  }

  await assert.rejects(
    buildRefreshSnapshot(config, client, { now: () => instants.shift() }),
    { code: 'JIRA_REFRESH_TIMEOUT' },
  )
})

test('refresh logs a stable error category without sensitive error content', async () => {
  const entries = []
  await assert.rejects(
    runRefresh({
      config,
      pool: {},
      now: () => Date.parse('2026-11-26T12:00:00.000Z'),
      clientFactory() {
        throw new Error('private token and issue summary')
      },
      logger: {
        log(entry) {
          entries.push(entry)
        },
        error(entry) {
          entries.push(entry)
        },
      },
    }),
    /private token and issue summary/,
  )

  assert.equal(entries.length, 2)
  assert.equal(JSON.stringify(entries).includes('private token'), false)
  assert.equal(JSON.parse(entries[1]).errorCode, 'REFRESH_FAILED')
})
