import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function dashboard(overrides = {}) {
  const timestamp = new Date().toISOString()
  return {
    generatedAt: timestamp,
    asOfAt: timestamp,
    projectKey: 'SCRUM',
    reportingWindow: {
      start: timestamp,
      end: timestamp,
      timeZone: 'Asia/Kolkata',
      days: 1,
    },
    deadline: { date: '2026-11-30', daysRemaining: 4 },
    summary: {
      openCount: 1,
      completedCount: 1,
      atRiskCount: 1,
      averageOpenIssueCount: 1,
      medianCycleTimeDays: null,
      medianLeadTimeDays: 2.5,
      cycleTimeIncludedIssues: 0,
      cycleTimeExcludedIssues: 1,
      leadTimeIncludedIssues: 1,
      leadTimeExcludedIssues: 0,
    },
    workload: [{ assigneeName: 'Alice', openIssueCount: 1 }],
    throughput: [{ date: '2026-11-26', completionCount: 1 }],
    cycleTimeByAssignee: [{
      assigneeName: 'Alice',
      averageDays: null,
      sampleCount: 0,
    }],
    atRiskIssues: [{
      key: 'SCRUM-1',
      summary: 'Blocked issue',
      assigneeName: 'Alice',
      status: 'In Progress',
      priority: 'High',
      dueDate: null,
      updatedAt: timestamp,
      reasons: ['Stale'],
    }],
    openIssues: [{
      key: 'SCRUM-1',
      summary: 'Blocked issue',
      assigneeName: 'Alice',
      status: 'In Progress',
      daysInStatus: null,
      dueDate: null,
    }],
    dataQuality: {
      cycleTime: { eligibleIssues: 1, includedIssues: 0, excludedIssues: 1 },
      leadTime: { eligibleIssues: 1, includedIssues: 1, excludedIssues: 0 },
      assigneeAttribution: { eligibleIssues: 0, includedIssues: 0, excludedIssues: 0 },
    },
    refreshStatus: {
      state: 'success',
      lastAttemptAt: timestamp,
      lastSuccessAt: timestamp,
      errorCode: null,
    },
    ...overrides,
  }
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

it('shows a loading state while the dashboard request is pending', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  render(<App />)

  expect(screen.getByRole('status').textContent).toContain('Loading')
})

it('shows no-snapshot state for the stable dashboard-not-ready response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      response({
        error: {
          code: 'DASHBOARD_NOT_READY',
          message: 'A dashboard snapshot is not available yet.',
        },
      }, 503),
    ),
  )

  render(<App />)

  expect(await screen.findByText('Dashboard data is not ready')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/dashboard',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

it('shows an unavailable state for service errors and malformed data', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503),
    ),
  )
  render(<App />)

  expect(await screen.findByText('Dashboard unavailable')).toBeTruthy()

  cleanup()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ projectKey: 'SCRUM' })))
  render(<App />)

  expect(await screen.findByText('Dashboard unavailable')).toBeTruthy()
})

it('renders snapshot metrics and equivalent chart tables when Chart.js is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(dashboard())))

  render(<App />)

  expect(await screen.findByText(/Project SCRUM/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'At-risk open issues' })).toBeTruthy()
  expect(screen.getAllByText('Blocked issue').length).toBe(2)
  expect(screen.getAllByText('No data').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/Chart unavailable/).length).toBe(2)
  expect(screen.getByRole('table', { name: 'Current open issues by assignee' })).toBeTruthy()
  expect(screen.getByRole('table', { name: 'Completed issues by local calendar date' })).toBeTruthy()
})

it('compares workload bars using the unrounded average', async () => {
  const workload = Array.from({ length: 20 }, (_value, index) => ({
    assigneeName: `Person ${index}`,
    openIssueCount: index === 19 ? 1 : 2,
  }))
  const data = dashboard({
    summary: { ...dashboard().summary, averageOpenIssueCount: 1.95 },
    workload,
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)))

  render(<App />)

  const table = await screen.findByRole('table', {
    name: 'Current open issues by assignee',
  })
  expect(within(table).getAllByText('Above average')).toHaveLength(19)
})

it('shows failed-refresh and stale-snapshot notices distinctly', async () => {
  const timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const data = dashboard({
    generatedAt: timestamp,
    refreshStatus: {
      state: 'failed',
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: timestamp,
      errorCode: 'JIRA_HTTP_503',
    },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)))

  render(<App />)

  expect(await screen.findByText('Latest refresh failed.')).toBeTruthy()
  expect(screen.getByText('This snapshot is more than 24 hours old.')).toBeTruthy()
  expect(screen.getByText(/JIRA_HTTP_503/)).toBeTruthy()
})
