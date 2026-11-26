# Implementation Plan: Team Workload & Delivery Dashboard

**Status**: Draft  
**Source**: [`specification.md`](./specification.md) and
[`constitution.md`](./constitution.md)  
**Planning basis**: Ordered phases and acceptance gates; calendar estimates are
intentionally omitted until the assumptions and deployment environment are
confirmed.

## Goal and delivery approach

Deliver the Jira-only, read-only dashboard in independently verifiable
increments. The backend owns Jira access, calculations, persistence, refresh
and authorization-independent data contracts. The frontend reads only the
backend API. A refresh publishes a complete snapshot atomically; failures must
remain visible without replacing the last successful snapshot.

Do not begin production deployment until the assumptions called out in the
specification's review checklist are confirmed, particularly the Jira project
and priority names, reporting timezone, service account permissions, and SSO
boundary. The feature specification supersedes the older static-report and
no-live-web-app scope in `project_spec.md`; confirm that scope change with the
project owner.

## Current implementation state

The React 18, Express 5, Node.js 24, and PostgreSQL 15 Compose stack is in
place. Phases 1–4 have been implemented and their unit and PostgreSQL
integration checks pass. The dashboard UI for Phase 5 is implemented, including
API states, summary metrics, charts with equivalent tables, and issue tables.

The remaining gates are accessibility and supported-browser verification,
full Compose refresh-to-render acceptance, the defined dataset benchmark, and
deployment review/sign-off. Live Jira refresh and SSO verification require
provisioned Jira access and an identified SSO deployment owner. Preserve
unrelated worktree changes and keep those production gates blocked until their
external assumptions are confirmed.

## Phases and milestones

### Phase 0 — Confirm scope and implementation assumptions

**Activities**

- Review the assumptions and acceptance checklist in the specification with
  the project owner.
- Confirm Jira Cloud site, `SCRUM` project access, default priority names,
  reporting timezone, POC deadline, and the read-only integration account.
- Confirm the production SSO reverse proxy and who owns its configuration.
- Confirm that the Jira dashboard replaces the conflicting static-report
  delivery model for this feature; leave Confluence automation out of scope.
- Record any approved changes in the specification before implementing
  conflicting behavior.

**Milestone M0 — Requirements approved**

- Scope and assumptions are accepted or updated in the specification.
- A least-privilege Jira account and an SSO deployment owner are identified.
- No unresolved decision changes dataset membership or metric definitions.

### Phase 1 — Align the application and container foundation

**Activities**

- Align frontend dependencies with React 18 while retaining Vite.
- Keep Express 5 and select an actively supported Node.js LTS release for the
  backend image.
- Add PostgreSQL 15 as the Compose `database` service, with a named persistent
  volume, readiness check, and backend dependency on database readiness.
- Update backend health checks and implement the required live and readiness
  route paths.
- Add `.env.example` with placeholders only; validate required configuration
  at startup without logging secret values.
- Establish repeatable frontend/backend build, lint, and test commands and a
  documented local Compose startup flow.

**Milestone M1 — Reproducible compliant development environment**

- `docker compose up` starts the database, API, and frontend successfully.
- PostgreSQL remains available across normal container restarts.
- Live health reports process liveness; readiness is false until the database
  is connected and migrations are complete.
- React 18, Vite, Express 5, Node.js LTS, and PostgreSQL 15 match the approved
  stack.

### Phase 2 — Define persistence, migrations, and API foundation

**Activities**

- Design a minimal schema for the latest dashboard snapshot and latest refresh
  state per configured project; do not persist historical snapshots or raw
  changelogs.
- Add versioned, repeatable migrations and make readiness depend on migration
  success.
- Implement `GET /api/v1/dashboard` response validation and serialization for
  the exact field names, timestamps, nullability, and error shapes in FR-025
  and FR-026.
- Implement sanitized error handling, stable error codes, and the specified
  no-snapshot and database-unavailable responses.
- Keep route handlers separate from persistence and business logic.

**Milestone M2 — Storage and API contract verified**

- A clean database migrates to ready; a migration failure leaves readiness
  false.
- API contract tests cover success, no snapshot, unavailable database, and
  sanitized errors.
- Snapshot and refresh-state constraints support the one-current-snapshot
  retention policy.

### Phase 3 — Implement Jira retrieval and metric calculations

**Activities**

- Implement a server-side Jira REST API v3 client using validated
  environment-based configuration; ensure credentials never reach the browser,
  logs, or command-line arguments.
- Retrieve all current non-Done issues and all completed-in-window issues
  required by FR-003 and FR-004. Follow every required search and changelog
  page; deduplicate issues and fail the run on request or pagination failure.
- Use the JQL endpoint, allowing legacy-endpoint fallback only for the
  specified unsupported 404/410 responses.
- Implement timeouts, three bounded retries, `Retry-After` handling, a maximum
  of five concurrent Jira requests, and the total refresh deadline.
- Implement pure, fixture-tested functions for reporting-window dates,
  workload and roster, throughput, cycle time, lead time, timing coverage,
  status duration, risk reasons, deadline countdown, and sorting.
- Keep UTC instants for elapsed-time calculations; apply the configured
  timezone only for local date buckets and display.

**Milestone M3 — Jira data and business rules verified**

- Fixture tests cover pagination, duplicate prevention, unassigned work,
  zero-count roster members, zero-completion dates, reopened issues, missing
  history, assignee-at-resolution, threshold boundaries, and combined risk
  reasons.
- Failed or incomplete Jira retrieval cannot be interpreted as a complete
  dataset.
- Tests use mocks or fixtures and do not require production credentials or
  write to Jira.

### Phase 4 — Build the refresh and publication workflow

**Activities**

- Implement the refresh command to capture `asOfAt` once, retrieve and validate
  all required data, calculate the snapshot, and publish it transactionally.
- Use a PostgreSQL advisory lock per project to prevent overlapping refreshes.
- On success, atomically replace the snapshot and update refresh state. On
  failure, preserve the snapshot and record the failed attempt separately.
- Add structured, redacted logs and actionable stable failure categories.
- Add the Windows PowerShell refresh wrapper and document the equivalent manual
  invocation. The wrapper must start/wait for the database, run migrations,
  then run the same backend refresh command.
- Document Task Scheduler setup for daily 08:00 execution in
  `REPORTING_TIME_ZONE`; configure it to report failures and avoid concurrent
  runs.

**Milestone M4 — Reliable refresh proven end to end**

- Success replaces the snapshot only after complete retrieval and calculation.
- Jira, timeout, migration, and persistence failures leave the previous
  snapshot intact and expose failure status.
- Concurrent invocations result in one active refresh and a clear non-zero
  result for the rejected invocation.
- The scheduled and manual paths execute the same refresh implementation.

### Phase 5 — Build the dashboard experience

**Activities**

- Implement the project summary, snapshot age and status, deadline countdown,
  workload chart, throughput chart, timing metrics and coverage, at-risk table,
  and complete open-work table.
- Connect the frontend only to `GET /api/v1/dashboard`; represent loading,
  no-snapshot, stale/failed-refresh, and API-unavailable states distinctly.
- Pin a specific Chart.js 4.x release and commit its Subresource Integrity
  hash. Configure the required Content Security Policy for the CDN.
- Provide equivalent accessible tables/text and a visible chart fallback when
  the CDN is unavailable. Meet WCAG 2.1 AA; do not use color as the sole
  indicator.
- Verify supported Edge and Chrome releases and avoid sending Jira data to the
  chart CDN.

**Milestone M5 — User stories usable and accessible**

- Authorized users can review every required metric and issue table from a
  successful snapshot.
- Null and missing values render as specified, never as fabricated zero
  durations.
- Keyboard, screen-reader, chart-failure, stale-data, and API-error behavior
  pass focused acceptance checks.

### Phase 6 — Integrate, secure, and validate release readiness

**Activities**

- Run the full application through Compose with isolated test data and mocked
  Jira responses.
- Verify end-to-end refresh, database persistence, API serialization, and
  frontend rendering.
- Configure and verify the SSO-enabled reverse proxy for both frontend and API;
  confirm unauthorized requests cannot retrieve protected data.
- Review secret handling, permissions, logs, CSP/SRI configuration, data
  retention, and volume-preserving operational commands.
- Benchmark the specified dataset: 1,000 open issues and 500 completions;
  verify cached API p95 under 2 seconds and refresh under 10 minutes under the
  stated Jira response assumptions. Investigate performance failures without
  truncating results.
- Update the project README and operational instructions to reflect the
  implemented setup and refresh procedure.

**Milestone M6 — Acceptance and release handoff**

- All relevant success criteria SC-001 through SC-015 pass or have an
  explicitly approved exception.
- No production Jira credentials are used by automated tests.
- SSO, health/readiness, migration persistence, stale/failure states, and
  accessibility checks are verified.
- Deployment owner receives the required configuration, schedule, and
  troubleshooting instructions; no unresolved release-blocking assumption
  remains.

## Traceability and completion gates

| Phase | Primary requirements |
|---|---|
| 0. Scope and assumptions | Specification decisions; FR-001, FR-017, FR-018, FR-030, FR-034 |
| 1. Foundation | NFR-001–003; FR-033, FR-035, FR-037–038 |
| 2. Persistence and API | FR-025–029, FR-037–038; NFR-002–004 |
| 3. Jira and calculations | FR-002–024, FR-032–033; SC-002–007, SC-014 |
| 4. Refresh operations | FR-006–008, FR-028–032, FR-038; SC-007–009, SC-015 |
| 5. Frontend | FR-021–027; NFR-005–006; SC-001, SC-008, SC-011 |
| 6. Release verification | NFR-004–008; SC-010–015 |

Each milestone is a gate: do not build dependent phases on a failing contract,
data-integrity, or security check. Revisit this plan if the approved
specification changes; implementation details must not override its acceptance
criteria.
