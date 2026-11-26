import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  }
}

test('live health is available without a database query', async () => {
  const app = createApp({
    pool: { query: () => assert.fail('liveness must not query the database') },
    expectedMigrations: [],
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/live`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('readiness requires database connectivity and applied migrations', async () => {
  const pool = {
    async query(query) {
      if (query === 'SELECT 1') {
        return { rows: [{ '?column?': 1 }] }
      }

      return { rows: [{ version: '001_initial' }] }
    },
  }
  const app = createApp({ pool, expectedMigrations: ['001_initial'] })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ready' })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('readiness remains false while an expected migration is pending', async () => {
  const pool = {
    async query(query) {
      if (query === 'SELECT 1') {
        return { rows: [{ '?column?': 1 }] }
      }

      return { rows: [] }
    },
  }
  const app = createApp({ pool, expectedMigrations: ['001_initial'] })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { status: 'not_ready' })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('readiness returns a sanitized unavailable response when the database fails', async () => {
  const app = createApp({
    pool: {
      async query() {
        throw new Error('database connection includes private details')
      },
    },
    expectedMigrations: [],
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { status: 'not_ready' })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('dashboard returns the stored snapshot with the latest refresh state', async () => {
  const generatedAt = new Date('2026-11-26T08:00:00.000Z')
  const lastAttemptAt = new Date('2026-11-26T08:30:00.000Z')
  const lastSuccessAt = new Date('2026-11-26T08:00:00.000Z')
  const pool = {
    async query(_query, values) {
      assert.deepEqual(values, ['SCRUM'])
      return {
        rows: [{
          payload: { asOfAt: '2026-11-26T07:59:00.000Z', summary: { open: 4 } },
          generated_at: generatedAt,
          as_of_at: new Date('2026-11-26T07:59:00.000Z'),
          refresh_state: 'failed',
          last_attempt_at: lastAttemptAt,
          last_success_at: lastSuccessAt,
          error_code: 'JIRA_UNAVAILABLE',
        }],
      }
    },
  }
  const app = createApp({
    pool,
    expectedMigrations: [],
    projectKey: 'SCRUM',
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      asOfAt: '2026-11-26T07:59:00.000Z',
      projectKey: 'SCRUM',
      generatedAt: generatedAt.toISOString(),
      summary: { open: 4 },
      refreshStatus: {
        state: 'failed',
        lastAttemptAt: lastAttemptAt.toISOString(),
        lastSuccessAt: lastSuccessAt.toISOString(),
        errorCode: 'JIRA_UNAVAILABLE',
      },
    })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('dashboard returns a stable not-ready response before the first snapshot', async () => {
  const app = createApp({
    pool: { async query() { return { rows: [] } } },
    expectedMigrations: [],
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DASHBOARD_NOT_READY',
        message: 'A dashboard snapshot is not available yet.',
      },
    })
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('dashboard returns a sanitized service-unavailable response for database failures', async () => {
  const app = createApp({
    pool: {
      async query() {
        throw Object.assign(new Error('private connection details'), {
          code: 'ECONNREFUSED',
        })
      },
    },
    expectedMigrations: [],
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`)
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.deepEqual(body, {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The dashboard service is temporarily unavailable.',
      },
    })
    assert.equal(JSON.stringify(body).includes('private'), false)
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('dashboard sanitizes unexpected server errors', async () => {
  const app = createApp({
    pool: {
      async query() {
        throw new Error('private SQL and issue details')
      },
    },
    expectedMigrations: [],
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`)
    assert.equal(response.status, 500)
    const body = await response.json()
    assert.deepEqual(body, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The dashboard could not be loaded.',
      },
    })
    assert.equal(JSON.stringify(body).includes('private'), false)
  } finally {
    server.close()
    await once(server, 'close')
  }
})
