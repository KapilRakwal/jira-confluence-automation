function requiredString(environment, name) {
  const value = environment[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function positiveInteger(environment, name, defaultValue) {
  const value = environment[name] ?? String(defaultValue)
  const parsedValue = Number(value)

  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(parsedValue)) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsedValue
}

function validateDate(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} must be a valid calendar date`)
  }

  return value
}

function validateUrl(value, name, protocols) {
  let url

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }

  if (!protocols.includes(url.protocol) || !url.hostname) {
    throw new Error(`${name} must use an allowed URL protocol`)
  }

  if (
    protocols.includes('postgres:') &&
    (!url.username || !url.password)
  ) {
    throw new Error(`${name} must include database credentials`)
  }

  return url
}

function validateTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
  } catch {
    throw new Error('REPORTING_TIME_ZONE must be a valid IANA timezone')
  }

  return value
}

export function loadConfig(environment = process.env) {
  const atlassianSite = validateUrl(
    requiredString(environment, 'ATLASSIAN_SITE'),
    'ATLASSIAN_SITE',
    ['https:'],
  )
  const email = requiredString(environment, 'ATLASSIAN_EMAIL')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ATLASSIAN_EMAIL must be a valid email address')
  }

  const token = requiredString(environment, 'ATLASSIAN_TOKEN')
  const databaseUrl = validateUrl(
    requiredString(environment, 'DATABASE_URL'),
    'DATABASE_URL',
    ['postgres:', 'postgresql:'],
  )
  const priorities = (environment.HIGH_RISK_PRIORITIES ?? 'Highest,High')
    .split(',')
    .map((priority) => priority.trim())

  if (priorities.length === 0 || priorities.some((priority) => !priority)) {
    throw new Error('HIGH_RISK_PRIORITIES must contain non-empty names')
  }

  return Object.freeze({
    port: positiveInteger(environment, 'PORT', 3000),
    atlassianSite: atlassianSite.href.replace(/\/$/, ''),
    atlassianEmail: email,
    atlassianToken: token,
    databaseUrl: databaseUrl.href,
    jiraProject: environment.JIRA_PROJECT?.trim() || 'SCRUM',
    windowDays: positiveInteger(environment, 'WINDOW_DAYS', 14),
    staleDays: positiveInteger(environment, 'STALE_DAYS', 3),
    pocDeadline: validateDate(environment.POC_DEADLINE ?? '2026-11-30', 'POC_DEADLINE'),
    reportingTimeZone: validateTimezone(
      environment.REPORTING_TIME_ZONE ?? 'Asia/Kolkata',
    ),
    highRiskPriorities: priorities,
    jiraRequestTimeoutSeconds: positiveInteger(
      environment,
      'JIRA_REQUEST_TIMEOUT_SECONDS',
      30,
    ),
    refreshTimeoutMinutes: positiveInteger(
      environment,
      'REFRESH_TIMEOUT_MINUTES',
      10,
    ),
  })
}
