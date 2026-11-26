import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'

const validEnvironment = {
  ATLASSIAN_SITE: 'https://example.atlassian.net',
  ATLASSIAN_EMAIL: 'dashboard@example.invalid',
  ATLASSIAN_TOKEN: 'placeholder-token',
  DATABASE_URL: 'postgresql://dashboard:placeholder@database:5432/dashboard',
}

test('loads required configuration and documented defaults', () => {
  const config = loadConfig(validEnvironment)

  assert.equal(config.port, 3000)
  assert.equal(config.jiraProject, 'SCRUM')
  assert.equal(config.windowDays, 14)
  assert.equal(config.reportingTimeZone, 'Asia/Kolkata')
  assert.deepEqual(config.highRiskPriorities, ['Highest', 'High'])
})

test('rejects missing secrets without including secret values in errors', () => {
  const environment = { ...validEnvironment, ATLASSIAN_TOKEN: '' }

  assert.throws(() => loadConfig(environment), /ATLASSIAN_TOKEN is required/)
})

test('rejects invalid date, timezone, and non-positive numeric settings', () => {
  assert.throws(
    () => loadConfig({ ...validEnvironment, POC_DEADLINE: '2026-02-30' }),
    /POC_DEADLINE/,
  )
  assert.throws(
    () => loadConfig({ ...validEnvironment, REPORTING_TIME_ZONE: 'Invalid/Zone' }),
    /REPORTING_TIME_ZONE/,
  )
  assert.throws(
    () => loadConfig({ ...validEnvironment, WINDOW_DAYS: '0' }),
    /WINDOW_DAYS/,
  )
  assert.throws(
    () => loadConfig({ ...validEnvironment, WINDOW_DAYS: '999999999999999999999' }),
    /WINDOW_DAYS/,
  )
})

test('rejects malformed integration URLs and account email', () => {
  assert.throws(
    () => loadConfig({ ...validEnvironment, ATLASSIAN_SITE: 'http://example.atlassian.net' }),
    /ATLASSIAN_SITE/,
  )
  assert.throws(
    () => loadConfig({ ...validEnvironment, ATLASSIAN_EMAIL: 'not-an-email' }),
    /ATLASSIAN_EMAIL/,
  )
  assert.throws(
    () => loadConfig({ ...validEnvironment, DATABASE_URL: 'postgresql://database/dashboard' }),
    /DATABASE_URL/,
  )
})
