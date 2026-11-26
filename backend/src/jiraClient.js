const retryDelaysMs = [1000, 2000, 4000]

export class JiraClientError extends Error {
  constructor(code, { status = null, retryable = false } = {}) {
    super(code)
    this.name = 'JiraClientError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

function retryAfterMilliseconds(value, now) {
  if (!value) {
    return 0
  }

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const retryAt = Date.parse(value)
  return Number.isNaN(retryAt) ? 0 : Math.max(0, retryAt - now())
}

function createSemaphore(limit) {
  let active = 0
  const waiters = []

  return async function acquire() {
    if (active >= limit) {
      await new Promise((resolve) => waiters.push(resolve))
    } else {
      active += 1
    }

    return () => {
      const next = waiters.shift()
      if (next) {
        next()
      } else {
        active -= 1
      }
    }
  }
}

function buildUrl(site, path, query) {
  if (typeof path !== 'string' || !path.startsWith('/rest/api/3/')) {
    throw new JiraClientError('JIRA_INVALID_PATH')
  }

  const base = new URL(site)
  const url = new URL(path, base)
  if (url.origin !== base.origin) {
    throw new JiraClientError('JIRA_INVALID_PATH')
  }

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url
}

export function createJiraClient(
  config,
  {
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = Date.now,
  } = {},
) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required')
  }

  const acquire = createSemaphore(5)
  const authorization = `Basic ${Buffer.from(
    `${config.atlassianEmail}:${config.atlassianToken}`,
  ).toString('base64')}`
  const requestTimeoutMs = config.jiraRequestTimeoutSeconds * 1000
  const refreshTimeoutMs = config.refreshTimeoutMinutes * 60 * 1000

  async function request(path, { query, signal, deadlineAt } = {}) {
    const url = buildUrl(config.atlassianSite, path, query)
    const release = await acquire()

    try {
      if (signal?.aborted) {
        throw new JiraClientError('JIRA_REQUEST_ABORTED')
      }

      const deadline = deadlineAt ?? now() + refreshTimeoutMs

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        const remainingMs = deadline - now()
        if (remainingMs <= 0) {
          throw new JiraClientError('JIRA_REFRESH_TIMEOUT')
        }

        const timeoutMs = Math.min(requestTimeoutMs, remainingMs)
        const controller = new AbortController()
        let timedOut = false
        const abortFromCaller = () => controller.abort(signal.reason)
        signal?.addEventListener('abort', abortFromCaller, { once: true })
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort()
        }, timeoutMs)

        let retryDelayMs = null
        let retryErrorCode = null

        try {
          const response = await fetchImpl(url, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: authorization,
            },
            signal: controller.signal,
          })

          if (response.ok) {
            try {
              return await response.json()
            } catch {
              throw new JiraClientError('JIRA_INVALID_RESPONSE')
            }
          }

          const retryable = response.status === 429 || response.status >= 500
          if (!retryable) {
            throw new JiraClientError(`JIRA_HTTP_${response.status}`, {
              status: response.status,
            })
          }

          if (attempt === retryDelaysMs.length) {
            throw new JiraClientError(`JIRA_HTTP_${response.status}`, {
              status: response.status,
            })
          }

          retryErrorCode = `JIRA_HTTP_${response.status}`
          retryDelayMs = Math.max(
            retryDelaysMs[attempt],
            retryAfterMilliseconds(response.headers?.get('retry-after'), now),
          )
        } catch (error) {
          if (error instanceof JiraClientError) {
            if (!error.retryable) {
              throw error
            }
          }

          if (signal?.aborted) {
            throw new JiraClientError('JIRA_REQUEST_ABORTED')
          }

          if (attempt === retryDelaysMs.length) {
            throw new JiraClientError(
              timedOut ? 'JIRA_REQUEST_TIMEOUT' : 'JIRA_NETWORK_ERROR',
            )
          }

          retryErrorCode = timedOut ? 'JIRA_REQUEST_TIMEOUT' : 'JIRA_NETWORK_ERROR'
          retryDelayMs = retryDelaysMs[attempt]
        } finally {
          clearTimeout(timer)
          signal?.removeEventListener('abort', abortFromCaller)
        }

        if (retryDelayMs === null) {
          throw new JiraClientError(retryErrorCode ?? 'JIRA_REQUEST_FAILED')
        }

        const retryRemainingMs = deadline - now()
        if (retryDelayMs >= retryRemainingMs) {
          throw new JiraClientError('JIRA_REFRESH_TIMEOUT')
        }

        await sleep(retryDelayMs)
      }

      throw new JiraClientError('JIRA_REQUEST_FAILED')
    } finally {
      release()
    }
  }

  return Object.freeze({ request })
}
