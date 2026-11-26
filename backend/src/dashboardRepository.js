function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function refreshStatusFromRow(row) {
  if (row.refresh_state) {
    return {
      state: row.refresh_state,
      lastAttemptAt: toIsoString(row.last_attempt_at),
      lastSuccessAt: row.last_success_at
        ? toIsoString(row.last_success_at)
        : null,
      errorCode: row.error_code,
    }
  }

  if (row.generated_at) {
    const generatedAt = toIsoString(row.generated_at)
    return {
      state: 'success',
      lastAttemptAt: generatedAt,
      lastSuccessAt: generatedAt,
      errorCode: null,
    }
  }

  return null
}

export async function readDashboard(pool, projectKey) {
  const { rows } = await pool.query(
    `SELECT
       s.payload,
       s.generated_at,
       s.as_of_at,
       r.state AS refresh_state,
       r.last_attempt_at,
       r.last_success_at,
       r.error_code
     FROM dashboard_snapshots AS s
     FULL OUTER JOIN dashboard_refresh_state AS r
       ON r.project_key = s.project_key
     WHERE COALESCE(s.project_key, r.project_key) = $1`,
    [projectKey],
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  if (!row.payload) {
    return null
  }

  const snapshot = typeof row.payload === 'string'
    ? JSON.parse(row.payload)
    : row.payload
  const generatedAt = toIsoString(row.generated_at)

  return {
    ...snapshot,
    generatedAt,
    projectKey,
    refreshStatus: refreshStatusFromRow(row),
  }
}

export async function publishSuccessfulSnapshot(
  pool,
  projectKey,
  snapshot,
  lastAttemptAt = new Date(),
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO dashboard_snapshots (
         project_key, payload, as_of_at, generated_at
       )
       VALUES ($1, $2::jsonb, $3, clock_timestamp())
       ON CONFLICT (project_key) DO UPDATE SET
         payload = EXCLUDED.payload,
         as_of_at = EXCLUDED.as_of_at,
         generated_at = EXCLUDED.generated_at
       RETURNING generated_at`,
      [projectKey, JSON.stringify(snapshot), snapshot.asOfAt],
    )
    const generatedAt = rows[0].generated_at

    await client.query(
      `INSERT INTO dashboard_refresh_state (
         project_key, state, last_attempt_at, last_success_at, error_code
       )
       VALUES ($1, 'success', $2, $3, NULL)
       ON CONFLICT (project_key) DO UPDATE SET
         state = EXCLUDED.state,
         last_attempt_at = EXCLUDED.last_attempt_at,
         last_success_at = EXCLUDED.last_success_at,
         error_code = NULL`,
      [projectKey, lastAttemptAt, generatedAt],
    )
    await client.query('COMMIT')

    return toIsoString(generatedAt)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordRefreshFailure(
  pool,
  projectKey,
  lastAttemptAt,
  errorCode,
) {
  await pool.query(
    `INSERT INTO dashboard_refresh_state (
       project_key, state, last_attempt_at, last_success_at, error_code
     )
     VALUES ($1, 'failed', $2, NULL, $3)
     ON CONFLICT (project_key) DO UPDATE SET
       state = EXCLUDED.state,
       last_attempt_at = EXCLUDED.last_attempt_at,
       error_code = EXCLUDED.error_code`,
    [projectKey, lastAttemptAt, errorCode],
  )
}

export async function deleteProjectDashboardData(pool, projectKey) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const snapshotResult = await client.query(
      'DELETE FROM dashboard_snapshots WHERE project_key = $1',
      [projectKey],
    )
    const refreshResult = await client.query(
      'DELETE FROM dashboard_refresh_state WHERE project_key = $1',
      [projectKey],
    )
    await client.query('COMMIT')

    return {
      snapshotsDeleted: snapshotResult.rowCount,
      refreshStatesDeleted: refreshResult.rowCount,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
