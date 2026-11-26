import {
  calendarDaysBetween,
  elapsedDays,
  localDateAt,
  toIsoUtc,
} from './dateTime.js'

function displayDays(value) {
  return value === null ? null : Math.round((value + Number.EPSILON) * 10) / 10
}

function validTimestamp(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return null
  }

  const timestamp = new Date(value).valueOf()
  return Number.isNaN(timestamp) ? null : timestamp
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? value
    : null
}

function personFromAssignee(assignee) {
  if (!assignee || typeof assignee !== 'object') {
    return null
  }

  const id = assignee.accountId ?? assignee.key ?? assignee.name
  if (typeof id !== 'string' || id.length === 0) {
    return null
  }

  return {
    id,
    name: assignee.displayName ?? assignee.name ?? id,
  }
}

function assigneeAtResolution(issue, changelogs) {
  const resolutionAt = validTimestamp(issue.fields?.resolutiondate)
  if (resolutionAt === null) {
    return { available: false, person: null }
  }

  const transitions = (changelogs.get(issue.key) ?? [])
    .filter((event) => event.type === 'assignee')
    .filter((event) => {
      const eventAt = validTimestamp(event.at)
      return eventAt !== null && eventAt <= resolutionAt
    })
    .sort((left, right) => validTimestamp(left.at) - validTimestamp(right.at))
  const latest = transitions.at(-1)

  if (!latest) {
    return { available: false, person: null }
  }
  if (!latest.toAccountId) {
    return { available: true, person: null }
  }

  return {
    available: true,
    person: {
      id: latest.toAccountId,
      name: latest.toDisplayName ?? latest.toAccountId,
    },
  }
}

export function calculateWorkloadAndThroughput(
  openIssues,
  completedIssues,
  changelogs,
  window,
) {
  const roster = new Map()
  const openCounts = new Map()
  let unassignedCount = 0

  for (const issue of openIssues) {
    const person = personFromAssignee(issue.fields?.assignee)
    if (!person) {
      unassignedCount += 1
      continue
    }

    roster.set(person.id, person)
    openCounts.set(person.id, (openCounts.get(person.id) ?? 0) + 1)
  }

  for (const issue of completedIssues) {
    const attribution = assigneeAtResolution(issue, changelogs)
    if (attribution.person) {
      roster.set(attribution.person.id, attribution.person)
    }
  }

  const people = [...roster.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  )
  const workload = people.map((person) => ({
    assigneeName: person.name,
    openIssueCount: openCounts.get(person.id) ?? 0,
  }))
  if (unassignedCount > 0) {
    workload.push({
      assigneeName: 'Unassigned',
      openIssueCount: unassignedCount,
    })
  }

  const averageOpenIssueCount = people.length
    ? people.reduce(
        (sum, person) => sum + (openCounts.get(person.id) ?? 0),
        0,
      ) / people.length
    : null
  const throughputByDate = new Map(window.dates.map((date) => [date, 0]))

  for (const issue of completedIssues) {
    const resolutionDate = validTimestamp(issue.fields?.resolutiondate)
    if (resolutionDate === null) {
      continue
    }

    const date = localDateAt(new Date(resolutionDate), window.timeZone)
    if (throughputByDate.has(date)) {
      throughputByDate.set(date, throughputByDate.get(date) + 1)
    }
  }

  return {
    workload,
    averageOpenIssueCount,
    throughput: [...throughputByDate].map(([date, completionCount]) => ({
      date,
      completionCount,
    })),
  }
}

function sortedEvents(events) {
  return events
    .filter((event) => validTimestamp(event.at) !== null)
    .sort((left, right) => {
    const timeDifference = validTimestamp(left.at) - validTimestamp(right.at)
    return timeDifference || (left.itemIndex ?? 0) - (right.itemIndex ?? 0)
    })
}

function cycleInterval(issue, events) {
  const resolutionAt = validTimestamp(issue.fields?.resolutiondate)
  if (resolutionAt === null) {
    return null
  }

  const statuses = sortedEvents(events.filter((event) => event.type === 'status'))
    .filter((event) => validTimestamp(event.at) <= resolutionAt)
  const ending = statuses
    .filter((event) => event.toCategory === 'done')
    .at(-1)

  if (!ending) {
    return null
  }

  const precedingDone = statuses
    .filter(
      (event) =>
        event.toCategory === 'done' &&
        validTimestamp(event.at) < validTimestamp(ending.at),
    )
    .at(-1)
  const starting = statuses
    .filter(
      (event) =>
        event.toCategory === 'indeterminate' &&
        event.fromCategory !== 'indeterminate' &&
        validTimestamp(event.at) < validTimestamp(ending.at) &&
        (!precedingDone ||
          validTimestamp(event.at) > validTimestamp(precedingDone.at)),
    )
    .at(-1)

  if (!starting) {
    return null
  }

  const days = elapsedDays(starting.at, ending.at)
  return days > 0 ? days : null
}

function median(values) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function leadDuration(issue) {
  const createdAt = validTimestamp(issue.fields?.created)
  const resolvedAt = validTimestamp(issue.fields?.resolutiondate)

  if (createdAt === null || resolvedAt === null || resolvedAt < createdAt) {
    return null
  }

  return elapsedDays(new Date(createdAt), new Date(resolvedAt))
}

export function calculateTimingMetrics(completedIssues, changelogs) {
  const cycles = new Map()
  const leads = []
  const cyclesByPerson = new Map()
  let includedLeadCount = 0
  let includedAttributionCount = 0

  for (const issue of completedIssues) {
    const events = changelogs.get(issue.key) ?? []
    const cycleDays = cycleInterval(issue, events)
    if (cycleDays !== null) {
      cycles.set(issue.key, cycleDays)
    }

    const leadDays = leadDuration(issue)
    if (leadDays !== null) {
      leads.push(leadDays)
      includedLeadCount += 1
    }

    const attribution = assigneeAtResolution(issue, changelogs)
    if (cycleDays !== null && attribution.person) {
      includedAttributionCount += 1
      const samples = cyclesByPerson.get(attribution.person.id) ?? {
        person: attribution.person,
        values: [],
      }
      if (cycleDays !== null) {
        samples.values.push(cycleDays)
      }
      cyclesByPerson.set(attribution.person.id, samples)
    } else if (attribution.person) {
      cyclesByPerson.set(
        attribution.person.id,
        cyclesByPerson.get(attribution.person.id) ?? {
          person: attribution.person,
          values: [],
        },
      )
    }
  }

  const cycleValues = [...cycles.values()]
  const cycleTimeByAssignee = [...cyclesByPerson.values()]
    .map(({ person, values }) => ({
      assigneeName: person.name,
      averageDays: values.length
        ? displayDays(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null,
      sampleCount: values.length,
    }))
    .sort((left, right) => left.assigneeName.localeCompare(right.assigneeName))
  const cycleEligible = completedIssues.length
  const attributionEligible = cycleValues.length

  return {
    medianCycleTimeDays: displayDays(median(cycleValues)),
    medianLeadTimeDays: displayDays(median(leads)),
    cycleTimeByAssignee,
    dataQuality: {
      cycleTime: {
        eligibleIssues: cycleEligible,
        includedIssues: cycleValues.length,
        excludedIssues: cycleEligible - cycleValues.length,
      },
      leadTime: {
        eligibleIssues: completedIssues.length,
        includedIssues: includedLeadCount,
        excludedIssues: completedIssues.length - includedLeadCount,
      },
      assigneeAttribution: {
        eligibleIssues: attributionEligible,
        includedIssues: includedAttributionCount,
        excludedIssues: attributionEligible - includedAttributionCount,
      },
    },
  }
}

function currentStatusStart(issue, events, asOfAt) {
  const status = issue.fields?.status
  const currentId = status?.id === undefined ? null : String(status.id)
  const currentName = status?.name?.trim().toLowerCase()
  const asOfTimestamp = validTimestamp(asOfAt)
  const statusEvents = sortedEvents(events.filter((event) => event.type === 'status'))
    .filter((event) => validTimestamp(event.at) <= asOfTimestamp)
  const matchingTransition = statusEvents
    .filter(
      (event) =>
        (currentId !== null && event.toStatusId === currentId) ||
        (currentName && event.toStatusName?.trim().toLowerCase() === currentName),
    )
    .at(-1)

  if (matchingTransition) {
    return matchingTransition.at
  }

  return statusEvents.length === 0 ? issue.fields?.created ?? null : null
}

function issueAssigneeName(issue) {
  return personFromAssignee(issue.fields?.assignee)?.name ?? 'Unassigned'
}

function statusName(issue) {
  return issue.fields?.status?.name ?? 'Unknown'
}

function issueSummary(issue) {
  return typeof issue.fields?.summary === 'string' ? issue.fields.summary : ''
}

function timestampOrNull(value) {
  const timestamp = validTimestamp(value)
  return timestamp === null ? null : toIsoUtc(new Date(timestamp))
}

function statusAgeDays(issue, events, asOfAt) {
  const statusStartedAt = currentStatusStart(issue, events, asOfAt)
  const start = validTimestamp(statusStartedAt)
  const end = validTimestamp(asOfAt)

  if (start === null || end === null || start > end) {
    return null
  }

  return displayDays(elapsedDays(new Date(start), new Date(end)))
}

function riskReasons(issue, {
  asOfAt,
  reportDate,
  deadline,
  staleDays,
  highRiskPriorities,
}) {
  const reasons = []
  const priorityName = issue.fields?.priority?.name ?? ''
  const normalizedPriority = priorityName.toLowerCase()
  const priorityIndex = highRiskPriorities.findIndex(
    (priority) => priority.toLowerCase() === normalizedPriority,
  )

  if (priorityIndex >= 0) {
    reasons.push('High priority')
  }

  const updatedAt = validTimestamp(issue.fields?.updated)
  const snapshotAt = validTimestamp(asOfAt)
  if (
    updatedAt !== null &&
    snapshotAt !== null &&
    updatedAt <= snapshotAt - staleDays * 86_400_000
  ) {
    reasons.push('Stale')
  }

  const dueDate = dateOnly(issue.fields?.duedate)
  if (dueDate && dueDate < reportDate) {
    reasons.push('Overdue')
  }
  if (dueDate && dueDate > deadline) {
    reasons.push('Deadline breach')
  }

  return { reasons, priorityIndex }
}

function compareRiskIssues(left, right) {
  if (left.priorityIndex !== right.priorityIndex) {
    return left.priorityIndex - right.priorityIndex
  }

  const reasonOrder = ['Stale', 'Overdue', 'Deadline breach']
  const leftReasons = left.reasons
    .filter((reason) => reason !== 'High priority')
    .map((reason) => reasonOrder.indexOf(reason))
  const rightReasons = right.reasons
    .filter((reason) => reason !== 'High priority')
    .map((reason) => reasonOrder.indexOf(reason))
  const reasonDifference = leftReasons.join(',').localeCompare(rightReasons.join(','))
  if (reasonDifference !== 0) {
    return reasonDifference
  }

  const leftDueDate = left.dueDate ?? '9999-12-31'
  const rightDueDate = right.dueDate ?? '9999-12-31'
  return leftDueDate.localeCompare(rightDueDate) || left.key.localeCompare(right.key)
}

export function calculateRiskAndOpenIssues(
  openIssues,
  changelogs,
  {
    asOfAt,
    reportDate,
    deadline,
    staleDays,
    highRiskPriorities,
  },
) {
  const riskOptions = {
    asOfAt,
    reportDate,
    deadline,
    staleDays,
    highRiskPriorities,
  }
  const riskCandidates = []
  const open = []

  for (const issue of openIssues) {
    const events = changelogs.get(issue.key) ?? []
    const dueDate = dateOnly(issue.fields?.duedate)
    const risk = riskReasons(issue, riskOptions)
    const openIssue = {
      key: issue.key,
      summary: issueSummary(issue),
      assigneeName: issueAssigneeName(issue),
      status: statusName(issue),
      daysInStatus: statusAgeDays(issue, events, asOfAt),
      dueDate,
    }
    open.push(openIssue)

    if (risk.reasons.length > 0) {
      riskCandidates.push({
        key: issue.key,
        summary: issueSummary(issue),
        assigneeName: issueAssigneeName(issue),
        status: statusName(issue),
        priority: issue.fields?.priority?.name ?? 'Unspecified',
        dueDate,
        updatedAt: timestampOrNull(issue.fields?.updated),
        reasons: risk.reasons,
        priorityIndex: risk.priorityIndex < 0
          ? highRiskPriorities.length
          : risk.priorityIndex,
      })
    }
  }

  open.sort((left, right) => left.key.localeCompare(right.key))
  riskCandidates.sort(compareRiskIssues)
  const atRiskIssues = riskCandidates.map(
    ({ priorityIndex: _priorityIndex, ...issue }) => issue,
  )

  return { atRiskIssues, openIssues: open }
}

function assertInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`)
  }
}

function assertDataQuality(value, name) {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${name} is required`)
  }

  for (const key of ['eligibleIssues', 'includedIssues', 'excludedIssues']) {
    assertInteger(value[key], `${name}.${key}`)
  }
  if (value.includedIssues + value.excludedIssues !== value.eligibleIssues) {
    throw new TypeError(`${name} coverage counts do not add up`)
  }
}

export function validateDashboardSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    typeof snapshot.projectKey !== 'string' ||
    !Number.isInteger(snapshot.reportingWindow?.days) ||
    snapshot.reportingWindow.days < 1 ||
    snapshot.reportingWindow.end !== snapshot.asOfAt ||
    !Number.isFinite(Date.parse(snapshot.asOfAt)) ||
    !Number.isFinite(Date.parse(snapshot.reportingWindow.start)) ||
    typeof snapshot.reportingWindow.timeZone !== 'string'
  ) {
    throw new TypeError('Dashboard snapshot reporting metadata is invalid')
  }

  if (
    !snapshot.deadline ||
    !dateOnly(snapshot.deadline.date) ||
    !Number.isInteger(snapshot.deadline.daysRemaining)
  ) {
    throw new TypeError('Dashboard snapshot deadline is invalid')
  }

  const summary = snapshot.summary
  if (!summary || typeof summary !== 'object') {
    throw new TypeError('Dashboard snapshot summary is required')
  }
  for (const key of [
    'openCount',
    'completedCount',
    'atRiskCount',
    'cycleTimeIncludedIssues',
    'cycleTimeExcludedIssues',
    'leadTimeIncludedIssues',
    'leadTimeExcludedIssues',
  ]) {
    assertInteger(summary[key], `summary.${key}`)
  }
  for (const key of ['medianCycleTimeDays', 'medianLeadTimeDays', 'averageOpenIssueCount']) {
    if (summary[key] !== null && !Number.isFinite(summary[key])) {
      throw new TypeError(`summary.${key} must be a finite number or null`)
    }
  }

  for (const key of [
    'workload',
    'throughput',
    'cycleTimeByAssignee',
    'atRiskIssues',
    'openIssues',
  ]) {
    if (!Array.isArray(snapshot[key])) {
      throw new TypeError(`Dashboard snapshot ${key} must be an array`)
    }
  }
  for (const person of snapshot.workload) {
    if (typeof person.assigneeName !== 'string') {
      throw new TypeError('Workload assigneeName is required')
    }
    assertInteger(person.openIssueCount, 'workload.openIssueCount')
  }
  for (const day of snapshot.throughput) {
    if (!dateOnly(day.date)) {
      throw new TypeError('Throughput date is invalid')
    }
    assertInteger(day.completionCount, 'throughput.completionCount')
  }
  for (const person of snapshot.cycleTimeByAssignee) {
    if (typeof person.assigneeName !== 'string') {
      throw new TypeError('Cycle-time assigneeName is required')
    }
    if (person.averageDays !== null && !Number.isFinite(person.averageDays)) {
      throw new TypeError('Cycle-time averageDays must be finite or null')
    }
    assertInteger(person.sampleCount, 'cycleTimeByAssignee.sampleCount')
  }
  for (const issue of [...snapshot.atRiskIssues, ...snapshot.openIssues]) {
    if (
      typeof issue.key !== 'string' ||
      typeof issue.summary !== 'string' ||
      typeof issue.assigneeName !== 'string' ||
      typeof issue.status !== 'string'
    ) {
      throw new TypeError('Dashboard issue fields are invalid')
    }
  }
  for (const issue of snapshot.atRiskIssues) {
    if (
      typeof issue.priority !== 'string' ||
      !Array.isArray(issue.reasons) ||
      issue.reasons.some((reason) => typeof reason !== 'string') ||
      (issue.dueDate !== null && !dateOnly(issue.dueDate)) ||
      (issue.updatedAt !== null && !Number.isFinite(Date.parse(issue.updatedAt)))
    ) {
      throw new TypeError('At-risk issue fields are invalid')
    }
  }
  for (const issue of snapshot.openIssues) {
    if (
      (issue.daysInStatus !== null && !Number.isFinite(issue.daysInStatus)) ||
      (issue.dueDate !== null && !dateOnly(issue.dueDate))
    ) {
      throw new TypeError('Open issue fields are invalid')
    }
  }

  if (!snapshot.dataQuality) {
    throw new TypeError('Dashboard snapshot dataQuality is required')
  }
  assertDataQuality(snapshot.dataQuality.cycleTime, 'dataQuality.cycleTime')
  assertDataQuality(snapshot.dataQuality.leadTime, 'dataQuality.leadTime')
  assertDataQuality(
    snapshot.dataQuality.assigneeAttribution,
    'dataQuality.assigneeAttribution',
  )
  if (
    summary.openCount !== snapshot.openIssues.length ||
    summary.completedCount !== snapshot.throughput.reduce(
      (sum, day) => sum + day.completionCount,
      0,
    ) ||
    summary.atRiskCount !== snapshot.atRiskIssues.length ||
    summary.cycleTimeIncludedIssues !== snapshot.dataQuality.cycleTime.includedIssues ||
    summary.cycleTimeExcludedIssues !== snapshot.dataQuality.cycleTime.excludedIssues ||
    summary.leadTimeIncludedIssues !== snapshot.dataQuality.leadTime.includedIssues ||
    summary.leadTimeExcludedIssues !== snapshot.dataQuality.leadTime.excludedIssues
  ) {
    throw new TypeError('Dashboard snapshot totals are inconsistent')
  }

  return snapshot
}

export function assembleDashboardSnapshot({
  projectKey,
  window,
  deadline,
  staleDays,
  highRiskPriorities,
  openIssues: currentOpenIssues,
  completedIssues,
  changelogs,
}) {
  const workload = calculateWorkloadAndThroughput(
    currentOpenIssues,
    completedIssues,
    changelogs,
    window,
  )
  const timing = calculateTimingMetrics(completedIssues, changelogs)
  const risk = calculateRiskAndOpenIssues(
    currentOpenIssues,
    changelogs,
    {
      asOfAt: window.end,
      reportDate: window.reportDate,
      deadline,
      staleDays,
      highRiskPriorities,
    },
  )
  const snapshot = {
    asOfAt: toIsoUtc(window.end, 'asOfAt'),
    projectKey,
    reportingWindow: {
      start: toIsoUtc(window.start, 'reportingWindow.start'),
      end: toIsoUtc(window.end, 'reportingWindow.end'),
      timeZone: window.timeZone,
      days: window.days,
    },
    deadline: {
      date: deadline,
      daysRemaining: calendarDaysBetween(window.reportDate, deadline),
    },
    summary: {
      openCount: currentOpenIssues.length,
      completedCount: completedIssues.length,
      atRiskCount: risk.atRiskIssues.length,
      averageOpenIssueCount: workload.averageOpenIssueCount,
      medianCycleTimeDays: timing.medianCycleTimeDays,
      medianLeadTimeDays: timing.medianLeadTimeDays,
      cycleTimeIncludedIssues: timing.dataQuality.cycleTime.includedIssues,
      cycleTimeExcludedIssues: timing.dataQuality.cycleTime.excludedIssues,
      leadTimeIncludedIssues: timing.dataQuality.leadTime.includedIssues,
      leadTimeExcludedIssues: timing.dataQuality.leadTime.excludedIssues,
    },
    workload: workload.workload,
    throughput: workload.throughput,
    cycleTimeByAssignee: timing.cycleTimeByAssignee,
    atRiskIssues: risk.atRiskIssues,
    openIssues: risk.openIssues,
    dataQuality: timing.dataQuality,
  }

  return validateDashboardSnapshot(snapshot)
}
