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
