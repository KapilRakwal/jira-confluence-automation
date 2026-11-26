import assert from 'node:assert/strict'
import test from 'node:test'
import { createJiraClient } from '../src/jiraClient.js'

const config = {
  atlassianSite: 'https://example.atlassian.net',
  atlassianEmail: 'read-only@example.invalid',
  atlassianToken: 'test-token',
  jiraRequestTimeoutSeconds: 30,
  refreshTimeoutMinutes: 10,
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    async json() {
      return body
    },
  }
}

test('Jira client sends authenticated GET requests to the configured site', async () => {
  let request
  const client = createJiraClient(config, {
    fetchImpl: async (url, options) => {
      request = { url, options }
      return jsonResponse({ issues: [] })
    },
  })

  assert.deepEqual(
    await client.request('/rest/api/3/search/jql', {
      query: { jql: 'project = SCRUM', maxResults: 100 },
    }),
    { issues: [] },
  )
  assert.equal(request.url.origin, 'https://example.atlassian.net')
  assert.equal(request.url.searchParams.get('jql'), 'project = SCRUM')
  assert.equal(request.options.method, 'GET')
  assert.equal(request.options.headers.Accept, 'application/json')
  assert.equal(
    request.options.headers.Authorization,
    `Basic ${Buffer.from('read-only@example.invalid:test-token').toString('base64')}`,
  )
})

test('Jira client rejects external origins', async () => {
  const client = createJiraClient(config, { fetchImpl: async () => jsonResponse({}) })

  await assert.rejects(
    client.request('https://attacker.example/rest/api/3/search/jql'),
    { code: 'JIRA_INVALID_PATH' },
  )
})

test('Jira client retries rate limits and server errors with bounded backoff', async () => {
  const delays = []
  let calls = 0
  const client = createJiraClient(config, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse({}, { status: 500 })
      }
      if (calls === 2) {
        return jsonResponse({}, { status: 429, headers: { 'Retry-After': '3' } })
      }
      return jsonResponse({ ok: true })
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  })

  assert.deepEqual(await client.request('/rest/api/3/search/jql'), { ok: true })
  assert.equal(calls, 3)
  assert.deepEqual(delays, [1000, 3000])
})

test('Jira client retries transient network failures no more than three times', async () => {
  const delays = []
  let calls = 0
  const client = createJiraClient(config, {
    fetchImpl: async () => {
      calls += 1
      throw new TypeError('network details must not escape')
    },
    sleep: async (milliseconds) => delays.push(milliseconds),
  })

  await assert.rejects(
    client.request('/rest/api/3/search/jql'),
    { code: 'JIRA_NETWORK_ERROR' },
  )
  assert.equal(calls, 4)
  assert.deepEqual(delays, [1000, 2000, 4000])
})

test('Jira client enforces its per-request timeout', async () => {
  let calls = 0
  const client = createJiraClient(
    { ...config, jiraRequestTimeoutSeconds: 0.01 },
    {
      fetchImpl: async (_url, { signal }) => {
        calls += 1
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        })
      },
      sleep: async () => {},
    },
  )

  await assert.rejects(
    client.request('/rest/api/3/search/jql'),
    { code: 'JIRA_REQUEST_TIMEOUT' },
  )
  assert.equal(calls, 4)
})

test('Jira client fails fast on authentication and permission errors', async () => {
  let calls = 0
  const client = createJiraClient(config, {
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ message: 'sensitive response content' }, { status: 403 })
    },
  })

  await assert.rejects(
    client.request('/rest/api/3/search/jql'),
    { code: 'JIRA_HTTP_403', status: 403 },
  )
  assert.equal(calls, 1)
})

test('Jira client limits concurrent requests to five', async () => {
  let active = 0
  let maximumActive = 0
  let releaseRequests
  const gate = new Promise((resolve) => {
    releaseRequests = resolve
  })
  const client = createJiraClient(config, {
    fetchImpl: async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await gate
      active -= 1
      return jsonResponse({})
    },
  })
  const requests = Array.from({ length: 8 }, () =>
    client.request('/rest/api/3/search/jql'),
  )

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(maximumActive, 5)
  releaseRequests()
  await Promise.all(requests)
  assert.equal(maximumActive, 5)
})

test('Jira client fails when retry delay would exceed the refresh deadline', async () => {
  let slept = false
  const client = createJiraClient(config, {
    fetchImpl: async () =>
      jsonResponse({}, { status: 429, headers: { 'Retry-After': '2' } }),
    sleep: async () => {
      slept = true
    },
    now: () => 0,
  })

  await assert.rejects(
    client.request('/rest/api/3/search/jql', { deadlineAt: 1500 }),
    { code: 'JIRA_REFRESH_TIMEOUT' },
  )
  assert.equal(slept, false)
})
