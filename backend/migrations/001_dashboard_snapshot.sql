CREATE TABLE dashboard_snapshots (
  project_key TEXT PRIMARY KEY CHECK (length(trim(project_key)) > 0),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  as_of_at TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dashboard_refresh_state (
  project_key TEXT PRIMARY KEY CHECK (length(trim(project_key)) > 0),
  state TEXT NOT NULL CHECK (state IN ('success', 'failed')),
  last_attempt_at TIMESTAMPTZ NOT NULL,
  last_success_at TIMESTAMPTZ,
  error_code TEXT,
  CHECK (
    (state = 'success' AND last_success_at IS NOT NULL AND error_code IS NULL)
    OR
    (state = 'failed' AND error_code IS NOT NULL)
  ),
  CHECK (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]*$')
);
