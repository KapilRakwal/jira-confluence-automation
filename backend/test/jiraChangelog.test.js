import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchChangelogs } from '../src/jiraChangelog.js'
import { JiraClientError } from '../src/jiraClient.js'

const issues = [{ key: 'SCRUM-1' }]

test('retrieves all changelog pages and normalizes status and assignee events', async () => {
  const calls = []
  const client = {
    async request(path, { query } = {}) {
      calls.push({ path, query })
      if (path === '/rest/api/3/status') {
        return [
          { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
          { id: '2', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          { id: '3', name: 'Done', statusCategory: { key: 'done' } },
        ]
      }

      if (query.startAt === 0) {
        return {
          startAt: 0,
          total: 2,
          values: [{
            id: 'history-1',
            created: '2026-11-25T10:00:00-05:00',
            items: [
              { fieldId: 'status', from: '2', fromString: 'In Progress', to: '3', toString: 'Done' },
              { fieldId: 'assignee', from: 'account-1', fromString: 'A User', to: 'account-2', toString: 'B User' },
            ],
          }],
        }
      }

      return {
        startAt: 1,
        total: 2,
        isLast: true,
        values: [{
          id: 'history-2',
          created: '2026-11-26T10:00:00Z',
          items: [
            { field: 'status', from: '3', fromString: 'Done', to: '2', toString: 'In Progress' },
          ],
        }],
      }
    },
  }

  const changelogs = await fetchChangelogs(client, issues)
  assert.equal(calls.length, 3)
  assert.equal(calls[2].query.startAt, 1)
  assert.deepEqual(changelogs.get('SCRUM-1'), [
    {
      type: 'status',
      at: '2026-11-25T15:00:00.000Z',
      historyId: 'history-1',
      itemIndex: 0,
      fromStatusId: '2',
      fromStatusName: 'In Progress',
      fromCategory: 'indeterminate',
      toStatusId: '3',
      toStatusName: 'Done',
      toCategory: 'done',
    },
    {
      type: 'assignee',
      at: '2026-11-25T15:00:00.000Z',
      historyId: 'history-1',
      itemIndex: 1,
      fromAccountId: 'account-1',
      fromDisplayName: 'A User',
      toAccountId: 'account-2',
      toDisplayName: 'B User',
    },
    {
      type: 'status',
      at: '2026-11-26T10:00:00.000Z',
      historyId: 'history-2',
      itemIndex: 0,
      fromStatusId: '3',
      fromStatusName: 'Done',
      fromCategory: 'done',
      toStatusId: '2',
      toStatusName: 'In Progress',
      toCategory: 'indeterminate',
    },
  ])
})

test('successful changelog response with no history returns no fabricated events', async () => {
  const client = {
    async request(path) {
      return path === '/rest/api/3/status'
        ? []
        : { values: [], total: 0 }
    },
  }

  const changelogs = await fetchChangelogs(client, issues)
  assert.deepEqual(changelogs.get('SCRUM-1'), [])
})

test('failed changelog page rejects the whole retrieval instead of returning partial history', async () => {
  const client = {
    async request(path, { query } = {}) {
      if (path === '/rest/api/3/status') {
        return []
      }
      if (query.startAt === 0) {
        return {
          total: 2,
          values: [{
            created: '2026-11-25T10:00:00Z',
            items: [{ fieldId: 'status', from: '1', to: '2' }],
          }],
        }
      }
      throw new JiraClientError('JIRA_HTTP_503', { status: 503 })
    },
  }

  await assert.rejects(
    fetchChangelogs(client, issues),
    { status: 503 },
  )
})

test('rejects contradictory short non-final changelog pages', async () => {
  const client = {
    async request(path, { query } = {}) {
      if (path === '/rest/api/3/status') {
        return []
      }
      return {
        total: 2,
        isLast: false,
        values: query.startAt === 0
          ? [{
              created: '2026-11-25T10:00:00Z',
              items: [{ fieldId: 'status', from: '1', to: '2' }],
            }]
          : [],
      }
    },
  }

  await assert.rejects(
    fetchChangelogs(client, issues),
    { code: 'JIRA_INCOMPLETE_CHANGELOG' },
  )
})

test('rejects final changelog pages whose count disagrees with total', async () => {
  const client = {
    async request(path) {
      if (path === '/rest/api/3/status') {
        return []
      }
      return {
        total: 1,
        isLast: true,
        values: [
          { created: '2026-11-25T10:00:00Z', items: [] },
          { created: '2026-11-25T11:00:00Z', items: [] },
        ],
      }
    },
  }

  await assert.rejects(
    fetchChangelogs(client, issues),
    { code: 'JIRA_INCOMPLETE_CHANGELOG' },
  )
})
