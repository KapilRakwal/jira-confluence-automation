import { addCalendarDays } from './dateTime.js'
import { JiraClientError } from './jiraClient.js'

const pageSize = 100
const issueFields = [
  'summary',
  'assignee',
  'status',
  'priority',
  'created',
  'updated',
  'duedate',
  'resolutiondate',
]

function assertProjectKey(projectKey) {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(projectKey)) {
    throw new RangeError('projectKey must be a valid Jira project key')
  }
}

function statusCategory(issue) {
  const category = issue.fields?.status?.statusCategory
  const value = category?.key ?? category?.name

  if (typeof value !== 'string') {
    throw new JiraClientError('JIRA_INVALID_ISSUE')
  }

  return value.toLowerCase()
}

function deduplicateIssues(issues) {
  const unique = new Map()

  for (const issue of issues) {
    if (!issue || typeof issue.key !== 'string') {
      throw new JiraClientError('JIRA_INVALID_ISSUE')
    }

    const identity = issue.id ?? issue.key
    if (!unique.has(identity)) {
      unique.set(identity, issue)
    }
  }

  return [...unique.values()]
}

function validatePage(page) {
  if (!page || !Array.isArray(page.issues)) {
    throw new JiraClientError('JIRA_INVALID_RESPONSE')
  }
}

async function searchJql(client, jql, { signal, deadlineAt }) {
  const issues = []
  const tokens = new Set()
  let nextPageToken

  while (true) {
    const query = {
      jql,
      fields: issueFields.join(','),
      maxResults: pageSize,
    }
    if (nextPageToken) {
      query.nextPageToken = nextPageToken
    }

    const page = await client.request('/rest/api/3/search/jql', {
      query,
      signal,
      deadlineAt,
    })
    validatePage(page)
    issues.push(...page.issues)

    if (page.isLast === true) {
      break
    }

    if (!page.nextPageToken) {
      throw new JiraClientError('JIRA_INCOMPLETE_PAGINATION')
    }
    if (page.isLast !== undefined && page.isLast !== false) {
      throw new JiraClientError('JIRA_INVALID_RESPONSE')
    }

    if (tokens.has(page.nextPageToken)) {
      throw new JiraClientError('JIRA_PAGINATION_LOOP')
    }

    tokens.add(page.nextPageToken)
    nextPageToken = page.nextPageToken
  }

  return issues
}

async function searchLegacy(client, jql, { signal, deadlineAt }) {
  const issues = []
  let startAt = 0

  while (true) {
    const page = await client.request('/rest/api/3/search', {
      query: {
        jql,
        fields: issueFields.join(','),
        maxResults: pageSize,
        startAt,
      },
      signal,
      deadlineAt,
    })
    validatePage(page)
    issues.push(...page.issues)

    if (!Number.isSafeInteger(page.total) || page.total < 0) {
      throw new JiraClientError('JIRA_INVALID_RESPONSE')
    }

    const nextStartAt = startAt + page.issues.length
    if (nextStartAt === page.total) {
      break
    }

    if (nextStartAt > page.total || page.issues.length === 0 || nextStartAt <= startAt) {
      throw new JiraClientError('JIRA_INCOMPLETE_PAGINATION')
    }
    startAt = nextStartAt
  }

  return issues
}

async function searchAll(client, jql, context) {
  try {
    return await searchJql(client, jql, context)
  } catch (error) {
    if (error?.status !== 404 && error?.status !== 410) {
      throw error
    }

    return searchLegacy(client, jql, context)
  }
}

function isWithinWindow(resolutionDate, window) {
  if (typeof resolutionDate !== 'string') {
    return false
  }

  const timestamp = Date.parse(resolutionDate)
  return (
    Number.isFinite(timestamp) &&
    timestamp >= Date.parse(window.start) &&
    timestamp < Date.parse(window.end)
  )
}

export async function fetchIssueDatasets(
  client,
  { projectKey, window, signal, deadlineAt },
) {
  assertProjectKey(projectKey)

  if (
    !window ||
    !Array.isArray(window.dates) ||
    window.dates.length < 1 ||
    !window.start ||
    !window.end ||
    !window.reportDate
  ) {
    throw new TypeError('A complete reporting window is required')
  }

  const context = { signal, deadlineAt }
  const openJql = `project = ${projectKey} AND statusCategory != Done ORDER BY key ASC`
  const completedStart = addCalendarDays(window.dates[0], -1)
  const completedEnd = addCalendarDays(window.reportDate, 1)
  const completedJql =
    `project = ${projectKey} AND statusCategory = Done ` +
    `AND resolutiondate >= "${completedStart}" ` +
    `AND resolutiondate <= "${completedEnd}" ORDER BY key ASC`

  const [openResults, completedResults] = await Promise.all([
    searchAll(client, openJql, context),
    searchAll(client, completedJql, context),
  ])
  const openIssues = deduplicateIssues(openResults).filter(
    (issue) => statusCategory(issue) !== 'done',
  )
  const completedIssues = deduplicateIssues(completedResults).filter(
    (issue) =>
      statusCategory(issue) === 'done' &&
      isWithinWindow(issue.fields?.resolutiondate, window),
  )

  return { openIssues, completedIssues }
}
