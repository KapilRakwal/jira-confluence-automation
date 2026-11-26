export class RefreshAlreadyRunningError extends Error {
  constructor() {
    super('A refresh is already running for this project')
    this.name = 'RefreshAlreadyRunningError'
    this.code = 'REFRESH_ALREADY_RUNNING'
  }
}

export async function withProjectRefreshLock(pool, projectKey, operation) {
  if (typeof projectKey !== 'string' || projectKey.length === 0) {
    throw new TypeError('projectKey is required')
  }

  const client = await pool.connect()
  let acquired = false

  try {
    const { rows } = await client.query(
      `SELECT pg_try_advisory_lock(
         hashtextextended($1, 0)
       ) AS acquired`,
      [`dashboard-refresh:${projectKey}`],
    )
    acquired = rows[0]?.acquired === true
    if (!acquired) {
      throw new RefreshAlreadyRunningError()
    }
  } catch (error) {
    client.release()
    throw error
  }

  let result
  let operationError
  try {
    result = await operation()
  } catch (error) {
    operationError = error
  }

  let unlockError
  try {
    await client.query(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0))',
      [`dashboard-refresh:${projectKey}`],
    )
  } catch (error) {
    unlockError = error
  }
  client.release()

  if (operationError && unlockError) {
    throw new AggregateError(
      [operationError, unlockError],
      'Refresh failed and its advisory lock could not be released',
    )
  }
  if (operationError) {
    throw operationError
  }
  if (unlockError) {
    throw unlockError
  }

  return result
}
