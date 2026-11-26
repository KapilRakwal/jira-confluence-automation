import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addCalendarDays,
  calendarDaysBetween,
  elapsedDays,
  localDateAt,
  reportingWindow,
  toIsoUtc,
} from '../src/dateTime.js'

test('reporting window includes the current local date and preceding calendar dates', () => {
  const window = reportingWindow(
    new Date('2026-11-26T12:00:00.000Z'),
    14,
    'Asia/Kolkata',
  )

  assert.equal(window.start, '2026-11-12T18:30:00.000Z')
  assert.equal(window.end, '2026-11-26T12:00:00.000Z')
  assert.equal(window.reportDate, '2026-11-26')
  assert.equal(window.dates.length, 14)
  assert.equal(window.dates[0], '2026-11-13')
  assert.equal(window.dates[13], '2026-11-26')
})

test('reporting window uses the configured timezone at date boundaries', () => {
  const instant = new Date('2024-03-10T02:00:00.000Z')
  const newYork = reportingWindow(instant, 1, 'America/New_York')
  const kolkata = reportingWindow(instant, 1, 'Asia/Kolkata')

  assert.equal(newYork.reportDate, '2024-03-09')
  assert.equal(newYork.start, '2024-03-09T05:00:00.000Z')
  assert.equal(kolkata.reportDate, '2024-03-10')
  assert.equal(kolkata.start, '2024-03-09T18:30:00.000Z')
})

test('reporting window respects daylight-saving changes in local calendar dates', () => {
  const window = reportingWindow(
    new Date('2024-11-04T05:00:00.000Z'),
    2,
    'America/New_York',
  )

  assert.equal(window.start, '2024-11-03T04:00:00.000Z')
  assert.deepEqual(window.dates, ['2024-11-03', '2024-11-04'])
  assert.equal(elapsedDays(window.start, window.end), 25 / 24)
})

test('date and duration helpers preserve calendar and UTC semantics', () => {
  assert.equal(addCalendarDays('2026-01-01', -1), '2025-12-31')
  assert.equal(calendarDaysBetween('2026-01-01', '2026-01-14'), 13)
  assert.equal(
    elapsedDays('2024-03-10T06:00:00.000Z', '2024-03-11T05:00:00.000Z'),
    23 / 24,
  )
  assert.equal(localDateAt('2026-11-26T12:00:00.000Z', 'Asia/Kolkata'), '2026-11-26')
  assert.equal(toIsoUtc('2026-11-26T12:00:00-05:00'), '2026-11-26T17:00:00.000Z')
})

test('date helpers reject invalid dates and window sizes', () => {
  assert.throws(() => reportingWindow(new Date(), 0, 'UTC'), /positive integer/)
  assert.throws(() => addCalendarDays('2026-02-30', 1), /Calendar date is invalid/)
  assert.throws(() => toIsoUtc('not-a-date'), /valid date/)
})
