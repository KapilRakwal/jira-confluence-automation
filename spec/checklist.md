# Specification-to-Implementation Checklist

**Reviewed**: 2026-11-26
**Source**: [`specification.md`](./specification.md)
**Scope**: Functional requirements FR-001–FR-038, non-functional requirements
NFR-001–NFR-008, and success criteria SC-001–SC-015.

## Result key and verification basis

- **Yes / Verified**: Implemented and exercised by a relevant automated test
  or local runtime check.
- **Partial**: The implementation exists, but an acceptance condition is
  unverified, depends on unavailable deployment inputs, or has a known gap.
- **No**: Not implemented.
- **Blocked**: Verification or deployment depends on external access, ownership,
  or benchmark inputs that are not available here.
- **Out of scope**: Explicitly excluded by the specification.
- Fixture tests verify deterministic behavior without accessing a production
  Jira tenant. A successful live Jira refresh was not possible because the Jira
  site and dedicated account are not provisioned.

Current checks:

- Backend: 52 tests passed, 1 optional PostgreSQL test skipped by the default
  runner; lint passed. Regression cases cover incomplete JQL/legacy/changelog
  pagination and precise workload-average comparison.
- PostgreSQL: the existing isolated persistence/refresh integration test
  passed in an earlier run. The updated test now also covers scoped
  decommissioning, but could not be rerun because `TEST_DATABASE_URL` is not
  configured in this environment.
- Frontend: 6 tests passed; lint and production build passed. A regression test
  verifies workload highlighting against the unrounded average.
- Running Compose endpoints: live health HTTP 200, readiness HTTP 200, and
  dashboard HTTP 503 with `DASHBOARD_NOT_READY` (expected before the first
  successful refresh).
- Edge rendered the no-snapshot state and exposed its heading/region. A
  narrow-viewport check in Chromium passed after removing the global
  320px minimum width. Successful-snapshot UI behavior is fixture-tested, not
  verified against live Jira data in a browser.
- The pinned Chart.js CDN request returned HTTP 200, and the response included
  the configured CSP. The frontend test covers the CDN-unavailable fallback.
- These checks cover separate units and the database workflow; there is no
  full Compose refresh-to-browser end-to-end test or benchmark.

## Functional requirements

| ID | Implemented? | Does it work? | Evidence and remaining gap |
|---|---|---|---|
| FR-001 | Yes | Fixture-tested; live tenant unverified | Jira-only read client and dashboard project configuration are present. Jira calls use GET; no Confluence client or writes are in scope. Site and account are placeholders. |
| FR-002 | Yes | Normal and incomplete pagination fixtures tested | JQL pagination requires continuation metadata for non-final pages; legacy search and changelog pagination reject empty or contradictory pages before the advertised total. Focused regression tests cover these fail-closed cases. Live Jira pagination remains unverified. |
| FR-003 | Yes | Fixture-tested | Open JQL is not restricted by `updated`; returned issues are filtered to non-Done status category and deduplicated. No live Jira dataset was checked. |
| FR-004 | Yes | Fixture-tested | Completed issues are filtered to current Done status and `resolutiondate` in the exact `[window.start, asOfAt)` interval; reopened issues are excluded. |
| FR-005 | Yes | Fixture-tested | Legacy search fallback is restricted to JQL endpoint HTTP 404/410. Tests verify other failures do not fall back. |
| FR-006 | Yes | Failure handling and snapshot retention tested | Jira request/changelog failures reject refresh, incomplete pagination fails closed, and the isolated PostgreSQL integration test previously verified failed-refresh snapshot retention. The integration test was skipped in this run because no test database URL is configured. |
| FR-007 | Yes | Unit-tested | Reporting window uses local calendar dates, a fixed `asOfAt`, exclusive end, and a 14-day default. Timezone boundary and DST tests pass. |
| FR-008 | Yes | Unit-tested | `Asia/Kolkata` default and IANA timezone validation are implemented; UTC instants are used for durations and local timezone for date buckets/display. |
| FR-009 | Yes | Unit-tested | Roster includes open assignees and assignees reconstructed at resolution; zero-open members and separate Unassigned grouping are tested. |
| FR-010 | Yes | Unit-tested | Counts and roster denominator exclude Unassigned; the snapshot retains the precise average used by the chart and comparison table. |
| FR-011 | Yes | Unit-tested | Throughput creates one row per reporting date and groups by local `resolutiondate`; zero dates are initialized. |
| FR-012 | Yes | Fixture-tested | Cycle calculation selects the latest completed In-Progress-to-Done cycle and excludes missing/invalid pairs. Reopened-cycle tests pass. |
| FR-013 | Yes | Unit-tested | Durations are calculated from UTC elapsed time; medians use full-precision samples and even-sized medians average the middle pair. Display values are rounded to one decimal. |
| FR-014 | Yes | Fixture-tested | Lead time uses `created` to `resolutiondate`; cycle-time averages use assignee-at-resolution evidence; unavailable attribution is excluded from person averages and reflected in coverage. |
| FR-015 | Yes | Fixture-tested | Eligible/included/excluded counts and null/“No data” behavior are implemented; missing evidence is not turned into zero duration. |
| FR-016 | Yes | Boundary-tested | Stale rule is inclusive at the configured elapsed-hour threshold; test covers the exact threshold. |
| FR-017 | Yes | Implemented; priority order not live-tenant verified | Priority matching is case-insensitive and uses configured names/order, defaulting to `Highest,High`. |
| FR-018 | Yes | Boundary-tested | Overdue and deadline-breach comparisons are strict; equality boundaries and combined reasons are covered by calculation tests. |
| FR-019 | Yes | Implemented; full sort acceptance not independently exercised | At-risk items include required fields/reasons and are sorted by configured priority, reason ordering, due date, and key. No live Jira priorities were verified. |
| FR-020 | Yes | Fixture-tested | Open issues are sorted by key; status age uses the latest current-status transition or creation only when there is no transition history. Missing evidence remains unavailable. |
| FR-021 | Yes | Fixture-tested | React renders summary, deadline, reporting metadata, charts/tables, timing, risk, and open-work sections from a valid fixture snapshot. |
| FR-022 | Yes | Implemented; direct countdown boundary test not identified | Countdown uses calendar-day difference between report date and deadline, including negative values after the deadline. |
| FR-023 | Yes | Backend and frontend regression-tested | The snapshot preserves the full-precision average and the chart/table comparison uses that value. A 39-issues/20-people fixture confirms a count of 2 is highlighted above the true 1.95 average. |
| FR-024 | Yes | CDN delivery and fallback tested | Chart.js 4.5.1 is pinned with SRI; CSP permits jsDelivr and same-origin assets. Data remains in the browser and equivalent tables render when Chart.js is unavailable. A live successful-snapshot chart was not exercised. |
| FR-025 | Yes | API contract and fixture-tested | Backend constructs the required response shape, timestamps, nullability, counts, and refresh state; the frontend rejects malformed snapshots. API tests cover stored snapshots and error shapes. |
| FR-026 | Partial | Local API success/failure paths tested; SSO condition absent | 200 snapshot, `DASHBOARD_NOT_READY`, `SERVICE_UNAVAILABLE`, and sanitized 500 behavior are tested. No SSO reverse proxy is configured to produce 401/403 before serving data. |
| FR-027 | Yes | UI-state tested | Loading, no-snapshot, API-unavailable, stale, and failed-refresh states are distinct; UI tests cover them. |
| FR-028 | Yes | PostgreSQL integration-tested | One snapshot and latest refresh state per project; successful publication is transactional, and failure recording preserves the snapshot. No history/changelog archive table is present. |
| FR-029 | Partial | Command and runbook implemented; updated DB test awaits execution | The guarded decommission CLI requires `--confirm` and an exact configured project key, deletes only that project's snapshot and refresh-state rows transactionally, and is documented in README. The new isolated PostgreSQL assertion verifies scoped deletion, but could not run here because `TEST_DATABASE_URL` is unset. |
| FR-030 | Partial | Wrapper order/syntax checked; no live run | The PowerShell wrapper starts the database, waits, runs migrations, then refreshes using the same backend command. README documents Task Scheduler settings, but no manual live refresh, scheduled task, or controlled scheduled run has been exercised. |
| FR-031 | Yes | PostgreSQL integration-tested | Per-project advisory lock rejects a second invocation, allows another project, and releases after failure. |
| FR-032 | Yes | Unit-tested | Retry count/backoff, Retry-After/deadline, request timeout, fail-fast 4xx, and five-request concurrency limit are covered by Jira client tests. |
| FR-033 | Partial | Mock/config checks pass; production permissions unverified | Credentials are backend environment configuration, not frontend assets or command arguments; logs use stable codes. A least-privilege Jira account cannot be checked until provisioned. |
| FR-034 | Partial | Local loopback boundary verified; production protection absent | Compose publishes only on `127.0.0.1`. No SSO reverse proxy or shared frontend/API production boundary is configured; owner remains TBD. |
| FR-035 | Yes | Config tests pass | `.env.example` contains placeholders/defaults. Startup validates required values and rejects invalid URLs, dates, timezones, and numeric settings without echoing secret values. |
| FR-036 | Out of scope | Confirmed against specification | Confluence data/actions, Jira write-back, notifications, sprint reporting, and historical reporting are explicitly outside this feature; their absence is intentional, not an implementation gap. |
| FR-037 | Yes | Unit and live endpoint checks pass | Live/readiness routes exist; readiness checks PostgreSQL and migrations. Tests cover unavailable database and pending migrations without exposing project data. |
| FR-038 | Partial | API outage handling tested; refresh outage not exercised end-to-end | Refresh logs stable redacted failure codes and exits non-zero by CLI design; API/readiness return unavailable/not-ready. A real refresh with PostgreSQL down was not run. |

## Non-functional requirements

| ID | Implemented? | Does it work? | Evidence and remaining gap |
|---|---|---|---|
| NFR-001 | Yes | Verified locally | Compose uses React 18/Vite, Express 5, Node.js 24 LTS, and PostgreSQL 15; builds and running services were checked. |
| NFR-002 | Partial | Migration behavior integration-tested | Versioned migrations apply idempotently and preserve data. The migration source is present in the working tree but has not been committed to Git, as the requirement states. |
| NFR-003 | Yes | Unit/runtime verified | Required routes and database/migration readiness behavior are implemented and tested. |
| NFR-004 | Yes | Unit-tested | JSON lifecycle events and stable error codes are logged; tests verify sensitive exception text is omitted. Production credentials/issue content were not available for a live redaction check. |
| NFR-005 | Partial | Some accessible alternatives verified | Semantic headings/regions, named charts, tables, textual comparison labels, and focus styling exist. Edge exposed the no-snapshot heading/region; full WCAG 2.1 AA contrast, keyboard, and screen-reader testing remains outstanding. |
| NFR-006 | Partial | Not fully verified | The no-snapshot view rendered in Edge and Chromium. The latest two stable Edge/Chrome releases were not identified/tested as a matrix; Chrome was not exposed in the available UI inventory. |
| NFR-007 | Blocked | Not measured | No 1,000-open/500-completed benchmark has been run; Jira latency assumptions and an approved dataset are unavailable, so API p95 and full-refresh duration are unknown. |
| NFR-008 | Partial | Unit suites and one isolated DB integration pass | Business rules, API, persistence, refresh publication/failure, and frontend behavior have tests. There is no full Compose refresh-to-browser end-to-end test, and migration-failure integration behavior is not directly demonstrated. |

## Success criteria

| ID | Implemented? | Does it work? | Evidence and remaining gap |
|---|---|---|---|
| SC-001 | Partial | Fixture-rendered sections work | Frontend fixture test covers snapshot metrics, issue tables, null metrics, and chart fallback. A successful refresh rendered through the full Compose stack has not been demonstrated. |
| SC-002 | Yes | Fixture-tested | JQL pagination/deduplication tests verify supplied pages, filtering, and no duplicates; new cases also verify incomplete pages fail closed. This is not a live/large Jira run. |
| SC-003 | Yes | Unit-tested | Roster, zero-open assignees, Unassigned grouping, and average denominator are covered. |
| SC-004 | Yes | Boundary-tested | Stale threshold tests cover the inclusive 72-hour boundary and a value below it. |
| SC-005 | Yes | Fixture-tested | Reopened issue cycle selection and missing-history exclusion are tested. |
| SC-006 | Yes | Unit-tested | Date-window/DST helpers and throughput/lead-time calculations use local date buckets and UTC elapsed duration. |
| SC-007 | Partial | Failure fixtures pass; live and integrated rerun unavailable | Jira/changelog failures and incomplete pagination reject refresh; the prior isolated PostgreSQL run verified snapshot retention. The integration test was not rerun in this environment, and live Jira failure behavior remains unverified. |
| SC-008 | Partial | UI and persistence tested separately | UI tests verify stale/failed notices; PostgreSQL integration verifies prior snapshot retention. The complete failure-to-render path is not an end-to-end test. |
| SC-009 | Partial | Wrapper documented/tested, schedule unverified | Wrapper sequence and locking are implemented; Task Scheduler registration, history capture, and a controlled scheduled run are outstanding. |
| SC-010 | Blocked | Not testable in this deployment | No SSO boundary/owner is configured, so unauthorized frontend/API requests cannot yet be verified. |
| SC-011 | Yes | Fixture-tested | Chart-unavailable UI test verifies fallback notice and equivalent accessible data tables. |
| SC-012 | Blocked | Not measured | Required API p95 and refresh-duration benchmark needs the specified dataset and Jira latency conditions, which are not available. |
| SC-013 | Partial | Component and DB integration tests pass | Current backend/frontend suites and isolated PostgreSQL integration cover the listed components without production credentials. Full Compose end-to-end coverage remains missing. |
| SC-014 | Yes | Boundary-tested | Risk calculation tests cover equal report/deadline dates, deadline breach, stale threshold, and multiple reasons. |
| SC-015 | Partial | Normal migrations/readiness verified | Clean/idempotent migration, pending-migration readiness, and volume persistence have been checked. An actual failing SQL migration keeping readiness false was not tested. |

## Release-blocking inputs and follow-up

The code-level gaps found in this review (pagination completeness, workload
average precision, and project decommission deletion) have been implemented.
Remaining unchecked/partial conditions are classified below; no known
implementation gap remains.

### External or deployment verification blockers

1. Provision the Jira site/project and dedicated read-only account; configure
   access privately and run a controlled refresh. Do not put credentials in
   this checklist.
2. Identify the SSO reverse-proxy owner and configure/test the shared frontend
   and API access boundary (FR-026/FR-034/SC-010).
3. Register and execute the Windows Task Scheduler task, capturing its history
   and verifying a controlled run (FR-030/SC-009).
4. Run the full Compose refresh-to-browser flow with a successful Jira refresh,
   then complete supported-browser and WCAG 2.1 AA verification (SC-001,
   SC-008, NFR-005/NFR-006).
5. Run the specified 1,000-open/500-completed benchmark under the Jira latency
   assumptions and record p95 API and refresh duration (NFR-007/SC-012).
6. Rerun the isolated PostgreSQL integration test, including the new
   decommission assertions, with `TEST_DATABASE_URL` set (FR-029).

### Out of scope

- FR-036 explicitly excludes Confluence data/actions, Jira write-back,
  notifications, sprint reporting, and historical reporting. These are not
  implementation gaps and should not be added without an approved scope change.

### Nice-to-have test polish

- Add a direct countdown boundary test for FR-022; the implementation is
  present, but a dedicated boundary assertion was not identified.
- Add focused assertions for the full at-risk sort ordering (FR-019).
- Add an integration case where a SQL migration itself fails and readiness
  remains false (SC-015); current coverage verifies pending migrations and
  database unavailability.
