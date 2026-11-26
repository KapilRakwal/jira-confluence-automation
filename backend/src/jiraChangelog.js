import { toIsoUtc } from './dateTime.js'
import { JiraClientError } from './jiraClient.js'

const pageSize = 100

function normalizeStatusName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

export async function fetchStatusCategories(client, { signal, deadlineAt } = {}) {
  const statuses = await client.request('/rest/api/3/status', {
    signal,
    deadlineAt,
  })

  if (!Array.isArray(statuses)) {
    throw new JiraClientError('JIRA_INVALID_STATUS_RESPONSE')
  }

  const categories = new Map()
  for (const status of statuses) {
    const category = status.statusCategory?.key
    if (typeof category !== 'string') {
      continue
    }

    if (status.id !== undefined) {
      categories.set(String(status.id), category)
    }
    const normalizedName = normalizeStatusName(status.name)
    if (normalizedName) {
      categories.set(normalizedName, category)
    }
  }

  return categories
}

function categoryFor(categories, id, name) {
  if (id !== null && id !== undefined) {
    const category = categories.get(String(id))
    if (category) {
      return category
    }
  }

  const normalizedName = normalizeStatusName(name)
  return normalizedName ? categories.get(normalizedName) ?? null : null
}

function normalizeHistory(history, categories) {
  if (!history || !Array.isArray(history.items)) {
    throw new JiraClientError('JIRA_INVALID_CHANGELOG')
  }

  const changedAt = toIsoUtc(history.created, 'changelog timestamp')
  const events = []

  for (const [index, item] of history.items.entries()) {
    if (item.fieldId === 'status' || item.field === 'status') {
      events.push({
        type: 'status',
        at: changedAt,
        historyId: history.id ?? null,
        itemIndex: index,
        fromStatusId: item.from === null || item.from === undefined
          ? null
          : String(item.from),
        fromStatusName: item.fromString ?? null,
        fromCategory: categoryFor(categories, item.from, item.fromString),
        toStatusId: item.to === null || item.to === undefined
          ? null
          : String(item.to),
        toStatusName: item.toString ?? null,
        toCategory: categoryFor(categories, item.to, item.toString),
      })
    } else if (item.fieldId === 'assignee' || item.field === 'assignee') {
      events.push({
        type: 'assignee',
        at: changedAt,
        historyId: history.id ?? null,
        itemIndex: index,
        fromAccountId: item.from === null || item.from === undefined
          ? null
          : String(item.from),
        fromDisplayName: item.fromString ?? null,
        toAccountId: item.to === null || item.to === undefined
          ? null
          : String(item.to),
        toDisplayName: item.toString ?? null,
      })
    }
  }

  return events
}

async function fetchIssueHistory(client, issueKey, categories, { signal, deadlineAt }) {
  const events = []
  let startAt = 0

  while (true) {
    const page = await client.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/changelog`,
      {
        query: { startAt, maxResults: pageSize },
        signal,
        deadlineAt,
      },
    )
    const histories = page?.values ?? page?.histories

    if (!Array.isArray(histories)) {
      throw new JiraClientError('JIRA_INVALID_CHANGELOG')
    }
    if (
      (page.total !== undefined &&
        (!Number.isSafeInteger(page.total) || page.total < 0)) ||
      (page.isLast !== undefined && typeof page.isLast !== 'boolean')
    ) {
      throw new JiraClientError('JIRA_INVALID_CHANGELOG')
    }

    for (const history of histories) {
      events.push(...normalizeHistory(history, categories))
    }

    const nextStartAt = startAt + histories.length
    if (page.isLast === true) {
      if (page.total !== undefined && nextStartAt !== page.total) {
        throw new JiraClientError('JIRA_INCOMPLETE_CHANGELOG')
      }
      break
    }

    if (
      page.total !== undefined &&
      nextStartAt === page.total &&
      page.isLast !== false
    ) {
      break
    }

    if (
      nextStartAt <= startAt ||
      histories.length === 0 ||
      (page.total !== undefined && nextStartAt > page.total) ||
      (page.isLast === false &&
        page.total !== undefined &&
        nextStartAt >= page.total) ||
      (page.isLast === undefined && page.total === undefined)
    ) {
      throw new JiraClientError('JIRA_INCOMPLETE_CHANGELOG')
    }
    startAt = nextStartAt
  }

  return events
}

export async function fetchChangelogs(
  client,
  issues,
  { signal, deadlineAt } = {},
) {
  if (!Array.isArray(issues)) {
    throw new TypeError('issues must be an array')
  }

  const categories = await fetchStatusCategories(client, { signal, deadlineAt })
  const entries = await Promise.all(
    issues.map(async (issue) => {
      if (!issue || typeof issue.key !== 'string') {
        throw new JiraClientError('JIRA_INVALID_ISSUE')
      }

      const events = await fetchIssueHistory(
        client,
        issue.key,
        categories,
        { signal, deadlineAt },
      )
      return [issue.key, events]
    }),
  )

  return new Map(entries)
}
