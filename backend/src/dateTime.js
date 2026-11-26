function toValidDate(value, name) {
  const date = value instanceof Date ? new Date(value) : new Date(value)

  if (Number.isNaN(date.valueOf())) {
    throw new RangeError(`${name} must be a valid date`)
  }

  return date
}

function dateOnlyParts(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (!match) {
    throw new RangeError('Calendar dates must use YYYY-MM-DD format')
  }

  const [, yearText, monthText, dayText] = match
  const parts = [Number(yearText), Number(monthText), Number(dayText)]
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))

  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) {
    throw new RangeError('Calendar date is invalid')
  }

  return parts
}

function localDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

export function toIsoUtc(value, name = 'timestamp') {
  return toValidDate(value, name).toISOString()
}

export function localDateAt(value, timeZone) {
  const date = toValidDate(value, 'timestamp')
  const { year, month, day } = localDateParts(date, timeZone)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function addCalendarDays(dateString, days) {
  if (!Number.isInteger(days)) {
    throw new RangeError('A valid date-only value and integer day offset are required')
  }

  const [year, month, day] = dateOnlyParts(dateString)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function calendarDaysBetween(startDate, endDate) {
  const [startYear, startMonth, startDay] = dateOnlyParts(startDate)
  const [endYear, endMonth, endDay] = dateOnlyParts(endDate)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)

  return (end - start) / 86_400_000
}

export function elapsedDays(startAt, endAt) {
  const start = toValidDate(startAt, 'startAt')
  const end = toValidDate(endAt, 'endAt')
  return (end.valueOf() - start.valueOf()) / 86_400_000
}

function localMidnightAsUtc(dateString, timeZone) {
  const [year, month, day] = dateOnlyParts(dateString)
  const targetLocalAsUtc = Date.UTC(year, month - 1, day)
  let candidate = targetLocalAsUtc

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = localDateParts(new Date(candidate), timeZone)
    const representedLocalAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const adjustment = targetLocalAsUtc - representedLocalAsUtc

    if (adjustment === 0) {
      return new Date(candidate).toISOString()
    }

    candidate += adjustment
  }

  throw new RangeError(`Local midnight does not exist for ${dateString} in ${timeZone}`)
}

export function reportingWindow(asOfAt, days, timeZone) {
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new RangeError('days must be a positive integer')
  }

  const end = toValidDate(asOfAt, 'asOfAt')
  const reportDate = localDateAt(end, timeZone)
  const startDate = addCalendarDays(reportDate, 1 - days)
  const dates = Array.from({ length: days }, (_value, index) =>
    addCalendarDays(startDate, index),
  )

  return {
    start: localMidnightAsUtc(startDate, timeZone),
    end: end.toISOString(),
    timeZone,
    days,
    dates,
    reportDate,
  }
}
