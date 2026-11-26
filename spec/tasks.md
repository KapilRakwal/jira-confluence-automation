# Implementation Tasks: Team Workload & Delivery Dashboard

**Status**: In progress — T0.1, T1.1–T1.5, T2.1–T2.4, T3.1–T3.9,
T4.1–T4.5, and T5.1–T5.4 complete; T0.2, T4.6, T5.5, and release-readiness
tasks remain partial or pending
**Parent plan**: [`plan.md`](./plan.md)
**Requirements**: [`specification.md`](./specification.md)

Use the acceptance criteria as completion gates. A task is complete only when
its criteria are verified and the relevant checks pass. Dependencies identify
work that must be completed first; tasks in the same phase may proceed in
parallel when their dependencies are satisfied. No calendar estimates or
assignees are set because scope and deployment decisions are not yet approved.

## Phase 0 — Confirm scope and implementation assumptions

### T0.1 — Approve feature scope

**Depends on**: None
**Status**: Complete — approved by product owner on 2026-11-26
**Work**: Confirm the Jira-only dashboard is the approved first feature and
resolves the conflict with the static-report and no-live-web-app scope in
`project_spec.md`. Keep Confluence automation and other excluded work out of
this implementation.

**Acceptance criteria**

- [x] Product owner confirms the live Jira dashboard replaces the conflicting
  static-report delivery model for this feature.
- [x] Jira read-only scope and Confluence exclusion are recorded in the
  specification; any required scope change is approved before implementation.

**Trace**: FR-001, FR-036; M0

### T0.2 — Confirm integration and reporting assumptions

**Depends on**: T0.1
**Status**: Partial — reporting defaults confirmed; Jira site/account remain
deployment placeholders and SSO owner is TBD
**Work**: Confirm Jira site/project access, priority names, reporting timezone,
deadline, service-account permissions, and SSO ownership.

**Acceptance criteria**

- [x] Jira site, `SCRUM` access, priority mapping, timezone, deadline, and
  read-only account are confirmed or documented as deployment configuration.
- [ ] An owner is identified for the SSO-enabled reverse proxy.
- [x] Any changed assumptions are reflected in the specification before
  implementation tasks rely on them.

**Trace**: FR-001, FR-008, FR-017–018, FR-033–034; M0

## Phase 1 — Align the application and container foundation

### T1.1 — Align frontend and backend runtime versions

**Depends on**: T0.1
**Status**: Complete — React 18 and Node.js 24 LTS foundation verified
**Work**: Align the frontend to React 18 and Vite; keep Express 5 and select an
actively supported Node.js LTS release for the backend image.

**Acceptance criteria**

- [x] Frontend dependencies and lockfile resolve to React 18 and React DOM 18.
- [x] Frontend production build succeeds.
- [x] Backend image and local runtime use the selected supported Node.js LTS
  release and Express 5.

**Trace**: NFR-001

### T1.2 — Add PostgreSQL to Docker Compose

**Depends on**: T1.1
**Status**: Complete — Compose stack and persistent volume verified
**Work**: Add PostgreSQL 15 as the `database` service with readiness checking,
persistent named storage, and appropriate backend dependency ordering.

**Acceptance criteria**

- [x] Compose starts the database, backend, and frontend services.
- [x] Backend startup waits for database readiness rather than only container
  startup.
- [x] A normal container stop/start preserves the database volume and its data.
- [x] Routine startup and refresh commands do not remove the persistent volume.

**Trace**: FR-029, NFR-001–002; M1

### T1.3 — Add safe environment configuration

**Depends on**: T0.1
**Status**: Complete — placeholder configuration and validation verified;
production values remain pending T0.2
**Work**: Add `.env.example` placeholders and backend configuration validation
for required Jira, database, reporting, and timeout settings. The documented
specification defaults define the scaffold; production credentials and
deployment-specific values remain subject to T0.2.

**Acceptance criteria**

- [x] `.env.example` documents required and default configuration without real
  credentials.
- [x] Startup rejects missing or invalid required URLs, dates, timezones, and
  non-positive numeric values.
- [x] Configuration errors identify missing/invalid variable names without
  printing secret values.
- [x] Jira credentials are not exposed in frontend assets or command-line
  arguments.

**Trace**: FR-033, FR-035; NFR-004

### T1.4 — Implement health and readiness endpoints

**Depends on**: T1.2, T1.3
**Status**: Complete — health, readiness, and migration checks verified
**Work**: Implement and wire the required health routes into the backend and
Compose health checks.

**Acceptance criteria**

- [x] `GET /api/v1/health/live` reports process liveness without exposing
  configuration or project data.
- [x] `GET /api/v1/health/ready` reports not-ready when PostgreSQL is
  unavailable or migrations have not completed.
- [x] Compose health checks use the required route and keep dependent services
  from treating an unready backend as healthy.

**Trace**: FR-037–038; NFR-003; SC-015

### T1.5 — Establish repeatable local development commands

**Depends on**: T1.1, T1.2, T1.3
**Status**: Complete — documented commands and local stack verified
**Work**: Ensure package scripts and repository instructions provide a
repeatable local build, lint, test, and Compose workflow.

**Acceptance criteria**

- [x] Frontend and backend have documented commands for build/lint/test
  checks, using repository-supported tooling.
- [x] README instructions start the stack through Docker Compose and identify
  required environment setup.
- [x] A clean developer setup can follow the documented commands without
  relying on production credentials.

**Trace**: NFR-001, NFR-008; M1

## Phase 2 — Define persistence, migrations, and API foundation

### T2.1 — Design snapshot and refresh-state schema

**Depends on**: T1.2
**Status**: Complete — project-scoped snapshot and refresh-state tables added
**Work**: Define a minimal PostgreSQL model for the latest dashboard snapshot
and latest refresh state per project.

**Acceptance criteria**

- [ ] Schema supports one current snapshot and latest refresh state per
  configured project.
- [ ] Schema stores no historical snapshots or raw changelog archives.
- [ ] Constraints and indexes support project-scoped retrieval and refresh
  publication.
- [ ] Decommissioning can remove a project's snapshot and refresh state.

**Trace**: FR-028–029; Key Entities

### T2.2 — Implement repeatable migrations and readiness integration

**Depends on**: T2.1, T1.4
**Status**: Complete — migration applied idempotently and readiness verified
**Work**: Add a committed migration runner and connect migration completion to
backend readiness.

**Acceptance criteria**

- [ ] `npm run migrate` applies pending migrations without resetting existing
  data.
- [ ] Re-running migrations is safe and does not duplicate or corrupt schema.
- [ ] A clean database becomes ready after successful migration.
- [ ] A failed migration keeps readiness false and returns a failing command
  status.

**Trace**: FR-030, FR-037; NFR-002–003; SC-015

### T2.3 — Implement snapshot persistence access

**Depends on**: T2.1
**Status**: Complete — transactional persistence and isolated PostgreSQL test
verified
**Work**: Add separated persistence operations for reading the current
snapshot/state and transactionally storing a successful snapshot.

**Acceptance criteria**

- [ ] Repository operations are scoped to the configured project.
- [ ] Snapshot reads return the stored snapshot and latest refresh state.
- [ ] A successful snapshot and its success metadata can be committed in one
  database transaction.
- [ ] Persistence tests use isolated PostgreSQL test data and verify the
  one-current-snapshot behavior.

**Trace**: FR-028–029; NFR-008

### T2.4 — Implement dashboard API contract and error responses

**Depends on**: T2.2, T2.3
**Status**: Complete — dashboard success, not-ready, and sanitized failures
covered by tests
**Work**: Implement `GET /api/v1/dashboard`, response serialization, health
route error behavior, and stable sanitized error shapes.

**Acceptance criteria**

- [ ] Success responses match FR-025 field names, formats, and nullability.
- [ ] A stored snapshot returns HTTP 200, including the latest failed refresh
  state if one exists.
- [ ] No successful snapshot returns HTTP 503 with
  `error.code: "DASHBOARD_NOT_READY"` and a sanitized message.
- [ ] Database unavailability returns HTTP 503 with
  `error.code: "SERVICE_UNAVAILABLE"` and readiness is false.
- [ ] Other errors do not expose stack traces, credentials, or sensitive Jira
  issue content.
- [ ] Contract tests cover success and each specified failure response.

**Trace**: FR-025–027, FR-037–038; NFR-003–004

## Phase 3 — Implement Jira retrieval and metric calculations

### T3.1 — Implement the server-side Jira client

**Depends on**: T1.3, T0.2
**Status**: Complete — backend-only read client and mocked request tests added
**Work**: Add a REST API v3 client that authenticates using backend-only
configuration and requests only the read data required by this feature.

**Acceptance criteria**

- [ ] Jira requests use the configured site and a dedicated read-only account.
- [ ] Credentials and authorization headers are never returned to the browser
  or written to logs.
- [ ] Client behavior is testable with mocked responses and no production
  credentials.
- [ ] Requests do not perform Jira write operations.

**Trace**: FR-001–002, FR-033; Constitution III

### T3.2 — Retrieve complete open and completed issue datasets

**Depends on**: T3.1, T0.2
**Status**: Complete — paginated JQL, exact local-window filtering, and
404/410-only fallback verified with fixtures
**Work**: Implement the specified JQL searches, pagination, dataset membership,
and issue deduplication.

**Acceptance criteria**

- [ ] Open dataset includes every issue in the project whose status category
  is not Done, independent of `updated`.
- [ ] Completed-in-window dataset uses non-null `resolutiondate`, report-window
  membership, and current Done status.
- [ ] Every required search page is retrieved; duplicate issues are counted
  once.
- [ ] Legacy search fallback occurs only for unsupported HTTP 404/410 from the
  JQL endpoint; other failures are surfaced.
- [ ] Fixture tests verify complete multi-page results and no omitted or
  duplicated issues.

**Trace**: FR-003–006; SC-002

### T3.3 — Retrieve and normalize Jira changelogs

**Depends on**: T3.1, T3.2
**Status**: Complete — all changelog pages and UTC status/assignee transitions
covered by fixtures
**Work**: Retrieve all required changelog pages and normalize status,
assignee, and transition events for calculations.

**Acceptance criteria**

- [ ] Changelog pagination continues until the response is complete.
- [ ] Status category and assignee transitions retain their UTC event times.
- [ ] Failed changelog retrieval fails the refresh input rather than silently
  producing a complete-looking partial dataset.
- [ ] A successful response with no usable history is represented as missing
  evidence for coverage calculations, not as a fabricated duration.
- [ ] Fixtures cover multi-page changelogs and absent transition history.

**Trace**: FR-002, FR-006, FR-012, FR-014–015, FR-020; SC-005, SC-007

### T3.4 — Enforce Jira retry, timeout, and concurrency rules

**Depends on**: T3.1
**Status**: Complete — retries, request timeout, shared refresh deadline, and
five-request concurrency ceiling are tested
**Work**: Add bounded retry and concurrency behavior for Jira requests.

**Acceptance criteria**

- [ ] 429, 5xx, and transient network failures receive at most three retries
  after the initial request, using the specified 1/2/4-second delays unless
  `Retry-After` is longer.
- [ ] Authentication, permission, and other non-retryable 4xx responses fail
  fast.
- [ ] No more than five Jira requests are simultaneously in flight.
- [ ] Request and total refresh timeouts are enforced; a retry delay that
  exceeds the remaining refresh budget fails the refresh.
- [ ] Tests verify retry count, delay selection, concurrency ceiling, and
  deadline behavior.

**Trace**: FR-032; Configuration; NFR-007

### T3.5 — Implement reporting-window and date/time utilities

**Depends on**: T1.3
**Status**: Complete — timezone-aware windows, UTC elapsed durations, and date
boundaries verified
**Work**: Implement deterministic utilities for fixed `asOfAt`, local date
windows, UTC elapsed duration, and ISO serialization.

**Acceptance criteria**

- [ ] `asOfAt` is captured once per refresh and is the exclusive reporting
  window end.
- [ ] The window contains `WINDOW_DAYS` local calendar dates, defaults to 14,
  and uses the configured timezone.
- [ ] Elapsed durations use UTC seconds divided by 86,400; local timezone is
  used only for date bucketing and display.
- [ ] Boundary tests cover local midnight, timezone changes, daylight-saving
  transitions where applicable, and positive integer validation.

**Trace**: FR-007–008, FR-013, FR-022; SC-006

### T3.6 — Calculate roster, workload, and throughput

**Depends on**: T3.2, T3.3, T3.5
**Status**: Complete — roster, Unassigned, average, and daily-series fixtures
pass
**Work**: Implement workload aggregation, dynamic roster behavior, average
workload, and daily completion series.

**Acceptance criteria**

- [ ] Each non-Done issue contributes exactly once to its current assignee or
  the separate Unassigned group.
- [ ] Roster is the union of open assignees and assignees at resolution for
  completed-in-window issues; zero-open members remain visible.
- [ ] Person-level average excludes Unassigned and is unavailable for an empty
  roster.
- [ ] Throughput includes every local date in the reporting window, including
  zero-completion dates, and counts each issue by `resolutiondate`.
- [ ] Fixture tests verify all grouping and boundary behavior.

**Trace**: FR-009–011, FR-023; SC-002–003, SC-006

### T3.7 — Calculate cycle time, lead time, and coverage

**Depends on**: T3.2, T3.3, T3.5
**Status**: Complete — reopened-cycle selection, elapsed durations, medians,
attribution, and coverage fixtures pass
**Work**: Implement cycle selection for reopened issues, lead-time calculation,
assignee-at-resolution averages, medians, and coverage counts.

**Acceptance criteria**

- [ ] Cycle-time start and end events follow FR-012 for first-time and
  reopened issues.
- [ ] Lead time uses `created` to `resolutiondate`; no creation-to-resolution
  substitution is used for cycle time.
- [ ] Per-person cycle time uses assignee at resolution; unavailable
  attribution excludes the issue only from person-level averages.
- [ ] Eligible, included, and excluded counts are correct for cycle time, lead
  time, and attribution.
- [ ] Durations retain full precision for calculations, display to one decimal
  day, and even-sized medians average the two middle values.
- [ ] Missing evidence yields excluded samples and "No data" where no samples
  remain, never a zero duration.

**Trace**: FR-012–015; SC-005–007

### T3.8 — Calculate risk, current-status age, and deadline countdown

**Depends on**: T3.2, T3.3, T3.5
**Status**: Complete — risk and status-age boundaries are fixture-tested
**Work**: Implement risk rules, open-issue status age, deadline countdown, and
specified sorting.

**Acceptance criteria**

- [ ] Stale risk uses elapsed `STALE_DAYS * 24` hours before `asOfAt`, with the
  default three days and exact threshold inclusive.
- [ ] Priority matching is case-insensitive and uses configured priority order.
- [ ] Overdue and deadline breach boundaries are strict as specified; all
  applicable reasons are returned once per issue.
- [ ] Open issues are sorted by key; at-risk issues follow priority/reason,
  earliest non-null due date, then issue key.
- [ ] Days in status use the latest transition into current status, or issue
  creation only for an issue still in its initial status; unavailable history
  stays unavailable.
- [ ] Tests cover 72-hour, report-date, deadline-date, and combined-reason
  boundaries.

**Trace**: FR-016–020, FR-022; SC-004, SC-014

### T3.9 — Assemble and validate the dashboard snapshot

**Depends on**: T2.4, T3.6, T3.7, T3.8
**Status**: Complete — snapshot contract validation and empty-state fixtures
pass
**Work**: Combine calculated datasets into the exact API snapshot contract.

**Acceptance criteria**

- [ ] Snapshot contains every required summary, reporting, workload,
  throughput, timing, risk, open-issue, data-quality, and refresh-status field.
- [ ] Timestamps are ISO 8601 UTC; date-only values are `YYYY-MM-DD`; missing
  numeric values are null.
- [ ] `reportingWindow.end` equals `asOfAt`; `generatedAt` is assigned at
  successful snapshot commit.
- [ ] Snapshot validation rejects incomplete or invalid structures before
  publication.
- [ ] Contract fixtures cover empty datasets and unavailable numeric values.

**Trace**: FR-007, FR-015, FR-021–026; SC-001

## Phase 4 — Build the refresh and publication workflow

### T4.1 — Implement refresh orchestration

**Depends on**: T2.3, T3.9
**Status**: Complete — fixed `asOfAt`, complete Jira inputs, calculations, and
deadline validation are fixture-tested
**Work**: Implement the refresh flow from fixed `asOfAt` through Jira fetch,
calculations, validation, and publication input.

**Acceptance criteria**

- [ ] Refresh captures one `asOfAt` at its start and uses it consistently.
- [ ] Every required page and changelog must complete before a snapshot is
  eligible for publication.
- [ ] Refresh returns a non-zero result on Jira, validation, or timeout
  failure.
- [ ] Integration tests use mocked Jira data and do not access production Jira.

**Trace**: FR-006–008, FR-032; SC-007, SC-013

### T4.2 — Prevent concurrent project refreshes

**Depends on**: T2.1
**Status**: Complete — PostgreSQL advisory lock integration tested for same-
project exclusion, separate projects, and release after failure
**Work**: Add a PostgreSQL advisory lock scoped to the configured project.

**Acceptance criteria**

- [ ] A refresh acquires the project lock before modifying refresh state or
  snapshot data.
- [ ] A second invocation exits non-zero with a clear "refresh already
  running" result and does not modify snapshot data.
- [ ] Lock release is safe on success, error, and process termination.
- [ ] Integration tests prove only one refresh for a project can publish at a
  time.

**Trace**: FR-031; SC-009

### T4.3 — Publish successful snapshots atomically and retain prior data

**Depends on**: T2.3, T4.1, T4.2
**Status**: Complete — PostgreSQL integration test verifies atomic success and
prior-snapshot retention after refresh failure
**Work**: Implement successful transaction and separate failure-state update.

**Acceptance criteria**

- [ ] Successful publication replaces the prior snapshot and updates success
  metadata in one transaction.
- [ ] Any failure before commit leaves the prior snapshot and its generation
  time unchanged.
- [ ] Failed-attempt state is recorded separately when PostgreSQL is
  available.
- [ ] If PostgreSQL is unavailable, the refresh logs a redacted failure and
  exits non-zero; the API does not claim a snapshot is available.
- [ ] Integration tests verify rollback, failure-state behavior, and
  persistence across normal service restarts.

**Trace**: FR-026, FR-028–029, FR-038; SC-008, SC-015

### T4.4 — Add structured redacted operational logs

**Depends on**: T3.1, T4.1
**Status**: Complete — refresh lifecycle logs use stable categories and a
redaction test excludes error content
**Work**: Add structured logs for refresh lifecycle and failures.

**Acceptance criteria**

- [ ] Logs identify start, completion, duration, outcome, and stable failure
  category.
- [ ] Credentials, authorization headers, and sensitive issue content are
  redacted.
- [ ] Logs give operators enough non-sensitive context to diagnose Jira,
  database, migration, timeout, and lock failures.
- [ ] Tests or controlled checks demonstrate secret values do not appear in
  emitted logs.

**Trace**: FR-033, FR-038; NFR-004

### T4.5 — Add refresh command and Windows wrapper

**Depends on**: T2.2, T4.3, T4.4
**Status**: Complete — npm refresh command and PowerShell wrapper added; wrapper
syntax validated
**Work**: Add `npm run refresh` and the repository PowerShell wrapper used for
both manual and scheduled refresh.

**Acceptance criteria**

- [ ] `npm run refresh` invokes the same validated refresh flow used by the
  scheduled operation.
- [ ] PowerShell wrapper starts `database`, waits for readiness, runs
  `npm run migrate`, then runs `npm run refresh` in the required order.
- [ ] Wrapper preserves Compose volumes, captures output appropriately, and
  returns a non-zero exit code on any failed step.
- [ ] Manual command and failure behavior are documented.

**Trace**: FR-030, FR-038; SC-009

### T4.6 — Document and configure daily scheduling

**Depends on**: T4.5, T0.2
**Status**: Partial — Task Scheduler instructions documented; registration and
controlled scheduled run await deployment-account setup
**Work**: Document Windows Task Scheduler setup for daily execution.

**Acceptance criteria**

- [ ] Instructions specify 08:00 in `REPORTING_TIME_ZONE` (Asia/Kolkata by
  default), executable/script paths, and required environment setup.
- [ ] Task Scheduler captures output or writes an appropriately redacted log
  and exposes non-zero failure status.
- [ ] Configuration prevents overlapping scheduled runs; backend locking
  remains the final concurrency guard.
- [ ] A controlled run verifies the schedule invokes the same wrapper as
  manual execution.

**Trace**: FR-030–031; SC-009

## Phase 5 — Build the dashboard experience

### T5.1 — Build dashboard shell and API loading states

**Depends on**: T2.4
**Status**: Complete — API-only data loading, response validation, and distinct
loading, not-ready, stale/failed, and unavailable states are tested
**Work**: Implement the React page shell and fetch the dashboard only from the
backend API.

**Acceptance criteria**

- [x] Frontend does not call Jira or connect to PostgreSQL.
- [x] Initial loading, no-snapshot, stale/failed-refresh, and API-unavailable
  states are distinct and understandable.
- [x] API data is validated or safely handled before rendering.
- [x] API errors do not expose internal stack traces or credentials.

**Trace**: FR-026–027, FR-034; SC-001, SC-008

### T5.2 — Render project summary and deadline metrics

**Depends on**: T5.1, T3.9
**Status**: Complete — summary cards, snapshot metadata, deadline, and null
metric rendering are implemented and covered by fixture-backed UI tests
**Work**: Render project identity, snapshot metadata, deadline countdown, and
summary metrics.

**Acceptance criteria**

- [x] Header shows project key, generation time, and snapshot age.
- [x] Deadline countdown, open/completed/at-risk counts, median cycle time,
  median lead time, and timing coverage match the API response.
- [x] Null metrics render as "Unavailable" or "No data" as appropriate; missing
  values are not rendered as fabricated zero durations.
- [x] Empty datasets show explicit zero or "No data" states.

**Trace**: FR-021–022, FR-025, FR-027; SC-001

### T5.3 — Render workload and throughput charts

**Depends on**: T5.1, T3.9
**Status**: Complete — pinned Chart.js SRI/CSP and CDN delivery verified; chart
fallback and equivalent data tables are covered by UI tests
**Work**: Add Chart.js visualizations and their security/fallback behavior.

**Acceptance criteria**

- [x] Workload chart includes roster members and Unassigned; bars above the
  defined average are highlighted without relying on color alone.
- [x] Throughput chart shows every reporting date, including zero counts.
- [x] Chart.js is an exact pinned 4.x CDN release with committed SRI hash and
  appropriate Content Security Policy.
- [x] Blocking the CDN displays a fallback message while equivalent values
  remain available in text/table form.
- [x] Jira issue data is not sent to the CDN.

**Trace**: FR-009–011, FR-023–024; SC-003, SC-006, SC-011

### T5.4 — Render timing, risk, and open-work tables

**Depends on**: T5.1, T3.9
**Status**: Complete — timing coverage, risk reasons, and complete open-work
tables are implemented and fixture-tested
**Work**: Add accessible tables for timing coverage, risk, and full open work.

**Acceptance criteria**

- [x] Timing view shows required averages/medians and eligible, included, and
  excluded counts.
- [x] At-risk table shows all required fields and every applicable reason in
  the specified sort order.
- [x] Open-work table shows all required fields in issue-key order.
- [x] Missing assignees, dates, or status ages are represented as specified,
  not silently omitted or fabricated.

**Trace**: FR-014–021, FR-025; SC-001, SC-014

### T5.5 — Verify accessibility and supported browsers

**Depends on**: T5.2, T5.3, T5.4
**Status**: Partial — the no-snapshot view and semantic region were checked in
Edge, and a narrow-viewport overflow check passed in Chromium after removing
the minimum-width constraint; full WCAG 2.1 AA and latest Edge/Chrome release
verification remain outstanding
**Work**: Validate dashboard accessibility and behavior in supported browsers.

**Acceptance criteria**

- [ ] Implemented views meet WCAG 2.1 AA checks for keyboard access, labels,
  semantics, contrast, and screen-reader output.
- [ ] Charts have accessible names and equivalent tables/text.
- [ ] Risk and workload are not communicated by color alone.
- [ ] Latest two stable Microsoft Edge and Google Chrome releases render the
  dashboard and its states correctly.

**Trace**: NFR-005–006; SC-011

## Phase 6 — Integrate, secure, and validate release readiness

### T6.1 — Run full-stack integration and acceptance tests

**Depends on**: T1.5, T2.4, T3.9, T4.3, T5.5
**Status**: Partial — backend/frontend suites and PostgreSQL persistence,
refresh-lock, publication, and failure-retention integration checks pass;
full Compose refresh-to-render end-to-end acceptance remains outstanding
**Work**: Verify the full Compose application using isolated PostgreSQL data
and mocked Jira responses.

**Acceptance criteria**

- [ ] Automated tests cover business rules, API, migrations, persistence,
  refresh publication, failure handling, and frontend behavior.
- [ ] Tests do not require production credentials or modify a real Jira site.
- [ ] End-to-end test proves successful refresh produces the expected
  dashboard response and rendered sections.
- [ ] Failure test proves the last successful snapshot remains visible and
  failure status is shown.

**Trace**: NFR-008; SC-001–008, SC-013, SC-015

### T6.2 — Verify SSO protection for frontend and API

**Depends on**: T0.2, T5.1
**Status**: Blocked — SSO reverse-proxy owner and approved deployment boundary
have not been identified
**Work**: Configure or integrate with the approved SSO-enabled reverse proxy
for both protected routes.

**Acceptance criteria**

- [ ] Authorized requests can read the dashboard without access to Jira
  credentials or direct database access.
- [ ] Unauthorized frontend and API requests receive the approved denial
  response before protected data is served.
- [ ] Both frontend and API share the same access boundary.
- [ ] Local development instructions clearly limit the unauthenticated option
  to loopback.

**Trace**: FR-026, FR-034; SC-010

### T6.3 — Validate benchmark performance and completeness

**Depends on**: T4.3, T6.1
**Status**: Pending — the 1,000-open/500-completed benchmark has not been run
**Work**: Benchmark the defined test dataset and verify no dataset truncation.

**Acceptance criteria**

- [ ] With 1,000 open issues and 500 in-window completions, cached API p95 is
  below 2 seconds.
- [ ] Under the specified Jira response assumptions (at most one second per
  request, no retries or rate limits), refresh completes within 10 minutes.
- [ ] Tests verify every required issue is retained if data exceeds the
  benchmark; performance degradation does not silently truncate results.
- [ ] Benchmark environment and results are recorded for release review.

**Trace**: NFR-007; SC-012

### T6.4 — Complete security and operational review

**Depends on**: T4.4, T4.5, T5.3, T6.2
**Status**: Partial — local CSP/SRI, error sanitization, and refresh-log
redaction checks pass; production Jira permissions and SSO remain unverified
**Work**: Review credentials, permissions, logs, CDN policy, retention, and
operational procedures before release.

**Acceptance criteria**

- [ ] Jira account has the narrowest available project-level read permissions.
- [ ] Secret handling and logs pass review with no credentials or sensitive
  issue content exposed.
- [ ] CSP/SRI are pinned and permit only the required chart CDN source.
- [ ] Snapshot retention, deletion, persistent volume behavior, and recovery
  instructions match FR-028–029.
- [ ] Refresh and scheduling procedures preserve data and surface failures.

**Trace**: FR-024, FR-029–035; NFR-004; SC-009–010

### T6.5 — Update operating documentation and obtain release sign-off

**Depends on**: T6.1, T6.2, T6.3, T6.4
**Status**: Partial — local setup and refresh guidance is documented; product
and deployment-owner sign-off is outstanding
**Work**: Finalize README/runbook instructions and obtain product and
deployment-owner acceptance.

**Acceptance criteria**

- [ ] Documentation covers required configuration, local Compose operation,
  migrations, manual/scheduled refresh, health checks, and common failures.
- [ ] All relevant SC-001–SC-015 criteria pass or have an explicitly approved
  exception.
- [ ] Product owner confirms the recorded feature assumptions.
- [ ] Deployment owner confirms SSO, credentials, schedule, and operational
  handoff are ready.
- [ ] No unresolved release-blocking assumption remains.

**Trace**: M6; SC-001–SC-015
