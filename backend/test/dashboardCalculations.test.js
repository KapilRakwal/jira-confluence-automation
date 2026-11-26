import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assembleDashboardSnapshot,
  calculateRiskAndOpenIssues,
  calculateTimingMetrics,
  validateDashboardSnapshot,
  calculateWorkloadAndThroughput,
} from '../src/dashboardCalculations.js'
import { reportingWindow } from '../src/dateTime.js'

function openIssue(key, {
  assignee = null,
  updated = '2026-11-26T11:00:00.000Z',
  dueDate = null,
  priority = null,
  status = { id: '1', name: 'To Do' },
  summary = `${key} summary`,
} = {}) {
  return {
    key,
    fields: {
      summary,
      assignee,
      updated,
      duedate: dueDate,
      priority: priority ? { name: priority } : null,
      status: { ...status, statusCategory: { key: 'new' } },
      created: '2026-11-20T00:00:00.000Z',
    },
  }
}

function completedIssue(key, {
  resolutiondate = '2026-11-26T10:00:00.000Z',
  created = '2026-11-20T10:00:00.000Z',
} = {}) {
  return {
    key,
    fields: {
      resolutiondate,
      created,
      assignee: null,
      status: { name: 'Done', statusCategory: { key: 'done' } },
      summary: `${key} summary`,
    },
  }
}

const window = reportingWindow(
  new Date('2026-11-26T12:00:00.000Z'),
  14,
  'Asia/Kolkata',
)

test('workload roster includes completed assignees with zero open issues and separates unassigned', () => {
  const openIssues = [
    openIssue('SCRUM-1', {
      assignee: { accountId: 'alice', displayName: 'Alice' },
    }),
    openIssue('SCRUM-2', {
      assignee: { accountId: 'alice', displayName: 'Alice' },
    }),
    openIssue('SCRUM-3'),
  ]
  const completedIssues = [
    completedIssue('SCRUM-4'),
  ]
  const changelogs = new Map([
    ['SCRUM-4', [{
      type: 'assignee',
      at: '2026-11-26T09:00:00.000Z',
      toAccountId: 'bob',
      toDisplayName: 'Bob',
    }]],
  ])
  const metrics = calculateWorkloadAndThroughput(
    openIssues,
    completedIssues,
    changelogs,
    window,
  )

  assert.deepEqual(metrics.workload, [
    { assigneeName: 'Alice', openIssueCount: 2 },
    { assigneeName: 'Bob', openIssueCount: 0 },
    { assigneeName: 'Unassigned', openIssueCount: 1 },
  ])
  assert.equal(metrics.averageOpenIssueCount, 1)
  assert.equal(metrics.throughput.length, 14)
  assert.deepEqual(
    metrics.throughput.filter(({ completionCount }) => completionCount > 0),
    [{ date: '2026-11-26', completionCount: 1 }],
  )
})

test('snapshot retains the precise workload average for bar comparisons', () => {
  const openIssues = Array.from({ length: 20 }, (_value, personIndex) =>
    Array.from(
      { length: personIndex === 19 ? 1 : 2 },
      (_issue, issueIndex) =>
        openIssue(`SCRUM-${personIndex}-${issueIndex}`, {
          assignee: {
            accountId: `person-${personIndex}`,
            displayName: `Person ${personIndex}`,
          },
        }),
    ),
  ).flat()
  const snapshot = assembleDashboardSnapshot({
    projectKey: 'SCRUM',
    window,
    deadline: '2026-11-30',
    staleDays: 3,
    highRiskPriorities: ['Highest', 'High'],
    openIssues,
    completedIssues: [],
    changelogs: new Map(),
  })

  assert.equal(snapshot.summary.averageOpenIssueCount, 1.95)
})

test('cycle time selects the latest complete cycle for a reopened issue', () => {
  const issue = completedIssue('SCRUM-1', {
    resolutiondate: '2026-11-26T10:00:00.000Z',
  })
  const events = [
    { type: 'status', at: '2026-11-20T10:00:00.000Z', fromCategory: 'new', toCategory: 'indeterminate' },
    { type: 'status', at: '2026-11-21T10:00:00.000Z', fromCategory: 'indeterminate', toCategory: 'done' },
    { type: 'status', at: '2026-11-24T10:00:00.000Z', fromCategory: 'done', toCategory: 'indeterminate' },
    { type: 'status', at: '2026-11-25T10:00:00.000Z', fromCategory: 'indeterminate', toCategory: 'done' },
    { type: 'assignee', at: '2026-11-25T09:00:00.000Z', toAccountId: 'alice', toDisplayName: 'Alice' },
  ]
  const metrics = calculateTimingMetrics([issue], new Map([['SCRUM-1', events]]))

  assert.equal(metrics.medianCycleTimeDays, 1)
  assert.equal(metrics.medianLeadTimeDays, 6)
  assert.deepEqual(metrics.cycleTimeByAssignee, [
    { assigneeName: 'Alice', averageDays: 1, sampleCount: 1 },
  ])
  assert.deepEqual(metrics.dataQuality, {
    cycleTime: { eligibleIssues: 1, includedIssues: 1, excludedIssues: 0 },
    leadTime: { eligibleIssues: 1, includedIssues: 1, excludedIssues: 0 },
    assigneeAttribution: { eligibleIssues: 1, includedIssues: 1, excludedIssues: 0 },
  })
})

test('missing timing evidence is excluded instead of represented as zero', () => {
  const issue = completedIssue('SCRUM-1')
  const metrics = calculateTimingMetrics([issue], new Map())

  assert.equal(metrics.medianCycleTimeDays, null)
  assert.equal(metrics.medianLeadTimeDays, 6)
  assert.equal(metrics.dataQuality.cycleTime.excludedIssues, 1)
  assert.equal(metrics.dataQuality.assigneeAttribution.eligibleIssues, 0)
})

test('even-sized timing medians average the two middle full-precision samples', () => {
  const first = completedIssue('SCRUM-1', {
    resolutiondate: '2026-11-26T10:00:00.000Z',
    created: '2026-11-24T10:00:00.000Z',
  })
  const second = completedIssue('SCRUM-2', {
    resolutiondate: '2026-11-26T10:00:00.000Z',
    created: '2026-11-20T10:00:00.000Z',
  })
  const changelogs = new Map([
    ['SCRUM-1', [
      { type: 'status', at: '2026-11-24T10:00:00.000Z', fromCategory: 'new', toCategory: 'indeterminate' },
      { type: 'status', at: '2026-11-25T10:00:00.000Z', fromCategory: 'indeterminate', toCategory: 'done' },
    ]],
    ['SCRUM-2', [
      { type: 'status', at: '2026-11-22T10:00:00.000Z', fromCategory: 'new', toCategory: 'indeterminate' },
      { type: 'status', at: '2026-11-25T10:00:00.000Z', fromCategory: 'indeterminate', toCategory: 'done' },
    ]],
  ])
  const metrics = calculateTimingMetrics([first, second], changelogs)

  assert.equal(metrics.medianCycleTimeDays, 2)
  assert.equal(metrics.medianLeadTimeDays, 4)
})

test('risk rules include inclusive stale threshold and strict due-date boundaries', () => {
  const issues = [
    openIssue('SCRUM-1', {
      updated: '2026-11-23T12:00:00.000Z',
      dueDate: '2026-11-26',
      priority: 'hIgH',
    }),
    openIssue('SCRUM-2', {
      updated: '2026-11-23T12:00:00.001Z',
      dueDate: '2026-11-25',
      priority: 'Medium',
    }),
    openIssue('SCRUM-3', {
      updated: '2026-11-26T11:00:00.000Z',
      dueDate: '2026-12-01',
      priority: 'Highest',
    }),
    openIssue('SCRUM-4', {
      dueDate: '2026-11-30',
      priority: 'Medium',
    }),
  ]
  const result = calculateRiskAndOpenIssues(issues, new Map(), {
    asOfAt: '2026-11-26T12:00:00.000Z',
    reportDate: '2026-11-26',
    deadline: '2026-11-30',
    staleDays: 3,
    highRiskPriorities: ['Highest', 'High'],
  })

  assert.deepEqual(result.atRiskIssues.map(({ key, reasons }) => ({ key, reasons })), [
    { key: 'SCRUM-3', reasons: ['High priority', 'Deadline breach'] },
    { key: 'SCRUM-1', reasons: ['High priority', 'Stale'] },
    { key: 'SCRUM-2', reasons: ['Overdue'] },
  ])
  assert.deepEqual(result.openIssues.map(({ key }) => key), [
    'SCRUM-1',
    'SCRUM-2',
    'SCRUM-3',
    'SCRUM-4',
  ])
  assert.equal(
    result.atRiskIssues.some(({ key }) => key === 'SCRUM-4'),
    false,
  )
})

test('status age uses latest current-status transition or creation only when unchanged', () => {
  const issues = [
    openIssue('SCRUM-1', { status: { id: '2', name: 'In Progress' } }),
    openIssue('SCRUM-2', { status: { id: '1', name: 'To Do' } }),
    openIssue('SCRUM-3', { status: { id: '3', name: 'Review' } }),
  ]
  const changelogs = new Map([
    ['SCRUM-1', [
      { type: 'status', at: '2026-11-22T00:00:00.000Z', toStatusId: '2', toStatusName: 'In Progress' },
      { type: 'status', at: '2026-11-24T12:00:00.000Z', toStatusId: '1', toStatusName: 'To Do' },
      { type: 'status', at: '2026-11-25T12:00:00.000Z', toStatusId: '2', toStatusName: 'In Progress' },
    ]],
    ['SCRUM-3', [
      { type: 'status', at: '2026-11-23T00:00:00.000Z', toStatusId: '1', toStatusName: 'To Do' },
    ]],
  ])
  const result = calculateRiskAndOpenIssues(issues, changelogs, {
    asOfAt: '2026-11-26T12:00:00.000Z',
    reportDate: '2026-11-26',
    deadline: '2026-11-30',
    staleDays: 3,
    highRiskPriorities: ['Highest', 'High'],
  })

  assert.deepEqual(
    result.openIssues.map(({ key, daysInStatus }) => ({ key, daysInStatus })),
    [
      { key: 'SCRUM-1', daysInStatus: 1 },
      { key: 'SCRUM-2', daysInStatus: 6.5 },
      { key: 'SCRUM-3', daysInStatus: null },
    ],
  )
})

test('snapshot assembly emits complete empty-state data and rejects invalid structures', () => {
  const snapshot = assembleDashboardSnapshot({
    projectKey: 'SCRUM',
    window: reportingWindow(
      new Date('2026-11-26T12:00:00.000Z'),
      1,
      'Asia/Kolkata',
    ),
    deadline: '2026-11-30',
    staleDays: 3,
    highRiskPriorities: ['Highest', 'High'],
    openIssues: [],
    completedIssues: [],
    changelogs: new Map(),
  })

  assert.equal(snapshot.summary.openCount, 0)
  assert.equal(snapshot.summary.medianCycleTimeDays, null)
  assert.deepEqual(snapshot.throughput, [
    { date: '2026-11-26', completionCount: 0 },
  ])
  assert.deepEqual(snapshot.dataQuality.cycleTime, {
    eligibleIssues: 0,
    includedIssues: 0,
    excludedIssues: 0,
  })
  assert.throws(
    () => validateDashboardSnapshot({ ...snapshot, throughput: undefined }),
    /throughput must be an array/,
  )
})
