import assert from 'node:assert/strict'
import test from 'node:test'
import { reportingWindow } from '../src/dateTime.js'
import { JiraClientError } from '../src/jiraClient.js'
import { fetchIssueDatasets } from '../src/jiraIssues.js'

const window = reportingWindow(
  new Date('2026-11-26T12:00:00.000Z'),
  14,
  'Asia/Kolkata',
)

function issue(key, statusCategory, resolutiondate = null) {
  return {
    id: key,
    key,
    fields: {
      status: { statusCategory: { key: statusCategory } },
      resolutiondate,
    },
  }
}

test('retrieves all JQL pages, deduplicates results, and filters exact datasets', async () => {
  const calls = []
  const client = {
    async request(path, { query }) {
      calls.push({ path, query })
      if (query.jql.includes('statusCategory != Done')) {
        return query.nextPageToken
          ? {
              issues: [
                issue('SCRUM-2', 'indeterminate'),
                issue('SCRUM-3', 'done'),
              ],
              isLast: true,
            }
          : {
              issues: [issue('SCRUM-1', 'new')],
              nextPageToken: 'open-next',
              isLast: false,
            }
      }

      return {
        issues: [
          issue('SCRUM-4', 'done', '2026-11-26T11:00:00.000Z'),
          issue('SCRUM-5', 'done', '2026-11-12T18:29:59.999Z'),
        ],
        isLast: true,
      }
    },
  }

  const result = await fetchIssueDatasets(client, {
    projectKey: 'SCRUM',
    window,
  })

  assert.deepEqual(result.openIssues.map(({ key }) => key), ['SCRUM-1', 'SCRUM-2'])
  assert.deepEqual(result.completedIssues.map(({ key }) => key), ['SCRUM-4'])
  assert.equal(calls.length, 3)
  const openCalls = calls.filter(({ query }) =>
    query.jql.includes('statusCategory != Done'),
  )
  const completedCall = calls.find(({ query }) =>
    query.jql.includes('statusCategory = Done'),
  )
  assert.equal(openCalls.length, 2)
  assert.equal(openCalls[0].path, '/rest/api/3/search/jql')
  assert.equal(openCalls[1].query.nextPageToken, 'open-next')
  assert.ok(completedCall.query.jql.includes('resolutiondate >= "2026-11-12"'))
  assert.ok(calls.every(({ query }) => query.fields.includes('resolutiondate')))
})

test('rejects a short JQL page marked non-final without a continuation token', async () => {
  const client = {
    async request(_path, { query }) {
      return query.jql.includes('statusCategory != Done')
        ? { issues: [issue('SCRUM-1', 'new')], isLast: false }
        : { issues: [], isLast: true }
    },
  }

  await assert.rejects(
    fetchIssueDatasets(client, { projectKey: 'SCRUM', window }),
    { code: 'JIRA_INCOMPLETE_PAGINATION' },
  )
})

test('legacy search fallback occurs only for JQL endpoint 404 or 410', async () => {
  const calls = []
  const client = {
    async request(path, { query }) {
      calls.push({ path, query })
      if (path.endsWith('/search/jql')) {
        throw new JiraClientError('JIRA_HTTP_410', { status: 410 })
      }

      return {
        startAt: query.startAt,
        total: 1,
        issues: [issue('SCRUM-1', 'new')],
      }
    },
  }

  const result = await fetchIssueDatasets(client, { projectKey: 'SCRUM', window })

  assert.equal(result.openIssues.length, 1)
  assert.ok(calls.some(({ path }) => path.endsWith('/search')))
})

test('JQL authentication and transient failures do not trigger legacy fallback', async () => {
  const client = {
    async request() {
      throw new JiraClientError('JIRA_HTTP_503', { status: 503 })
    },
  }

  await assert.rejects(
    fetchIssueDatasets(client, { projectKey: 'SCRUM', window }),
    { status: 503 },
  )
})

test('legacy pagination retrieves every page and deduplicates issue keys', async () => {
  const legacyPages = { open: 0, completed: 0 }
  const client = {
    async request(path, { query }) {
      if (path.endsWith('/search/jql')) {
        throw new JiraClientError('JIRA_HTTP_404', { status: 404 })
      }
      const dataset = query.jql.includes('statusCategory != Done')
        ? 'open'
        : 'completed'
      const page = legacyPages[dataset]
      assert.equal(query.startAt, dataset === 'open' ? page * 2 : 0)
      legacyPages[dataset] += 1

      if (dataset === 'completed') {
        return { startAt: 0, total: 0, issues: [] }
      }

      return page === 0
        ? {
            startAt: 0,
            total: 4,
            issues: [issue('SCRUM-1', 'new'), issue('SCRUM-2', 'new')],
          }
        : {
            startAt: 2,
            total: 4,
            issues: [issue('SCRUM-2', 'new'), issue('SCRUM-3', 'new')],
          }
    },
  }

  const result = await fetchIssueDatasets(client, { projectKey: 'SCRUM', window })
  assert.equal(legacyPages.open, 2)
  assert.equal(legacyPages.completed, 1)
  assert.deepEqual(result.openIssues.map(({ key }) => key), [
    'SCRUM-1',
    'SCRUM-2',
    'SCRUM-3',
  ])
})

test('legacy pagination rejects an empty page before the advertised total', async () => {
  const client = {
    async request(path, { query }) {
      if (path.endsWith('/search/jql')) {
        throw new JiraClientError('JIRA_HTTP_404', { status: 404 })
      }
      if (!query.jql.includes('statusCategory != Done')) {
        return { startAt: 0, total: 0, issues: [] }
      }

      return query.startAt === 0
        ? { startAt: 0, total: 3, issues: [issue('SCRUM-1', 'new')] }
        : { startAt: 1, total: 3, issues: [] }
    },
  }

  await assert.rejects(
    fetchIssueDatasets(client, { projectKey: 'SCRUM', window }),
    { code: 'JIRA_INCOMPLETE_PAGINATION' },
  )
})

test('rejects invalid project keys and malformed paginated responses', async () => {
  const client = {
    async request() {
      return {
        issues: Array.from({ length: 100 }, () => issue('SCRUM-1', 'new')),
      }
    },
  }

  await assert.rejects(
    fetchIssueDatasets(client, { projectKey: 'SCRUM OR status = Done', window }),
    /valid Jira project key/,
  )
  await assert.rejects(
    fetchIssueDatasets(client, { projectKey: 'SCRUM', window }),
    { code: 'JIRA_INCOMPLETE_PAGINATION' },
  )
})
