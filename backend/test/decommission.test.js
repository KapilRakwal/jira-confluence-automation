import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(new URL('../src/decommission.js', import.meta.url))
const environment = {
  ...process.env,
  ATLASSIAN_SITE: 'https://example.atlassian.net',
  ATLASSIAN_EMAIL: 'readonly@example.invalid',
  ATLASSIAN_TOKEN: 'placeholder-token',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  JIRA_PROJECT: 'SCRUM',
}

test('decommission requires the exact project confirmation before DB access', async (t) => {
  for (const [label, args] of [
    ['missing confirmation', []],
    ['mismatched project key', ['--confirm', 'OTHER']],
  ]) {
    await t.test(label, () => {
      const result = spawnSync(process.execPath, [scriptPath, ...args], {
        encoding: 'utf8',
        env: environment,
      })

      assert.equal(result.error, undefined)
      assert.equal(result.status, 1)
      assert.equal(
        JSON.parse(result.stderr).errorCode,
        'PROJECT_CONFIRMATION_REQUIRED',
      )
    })
  }
})
