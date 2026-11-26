# Feature Specification: Team Workload & Delivery Dashboard

**Feature Branch**: `001-team-workload-dashboard`  
**Created**: 2026-11-26  
**Status**: Draft — scope approved; implementation assumptions remain to validate
**Input**: `project_spec.md` v1.0 and the project constitution

## Summary

Provide a read-only web dashboard for the delivery manager and authorized
stakeholders to review Jira project SCRUM workload, delivery flow, cycle and lead
times, and at-risk work. A backend refreshes the report daily and serves the
latest successful snapshot to the frontend.

This feature intentionally supersedes the Python-generated static HTML delivery
and its "no live web app" non-goal in `project_spec.md`. The source metric
definitions and daily reporting intent remain in scope. This feature covers Jira
only; Confluence automation requires a separate specification.

## Approved Scope Decision

**Approved by**: Product owner, 2026-11-26

For this feature, deliver a read-only Jira dashboard web application, replacing
the conflicting static-report delivery model. Confluence automation is
explicitly excluded and requires a separate specification. This approval is
limited to feature scope; it does not approve the remaining assumptions or
authorize production deployment.

## Decisions at a Glance

- Current workload includes every non-Done issue in the configured project,
  regardless of when it was last updated.
- The reporting window is the current local date and preceding
  `WINDOW_DAYS - 1` calendar dates, ending at the refresh's fixed `asOfAt`
  timestamp.
- `Asia/Kolkata` is the default reporting timezone; it is configurable.
- A completed issue is identified by its Jira `resolutiondate`.
- Reopened issues use the most recent completed In Progress-to-Done cycle
  associated with the issue's latest resolution.
- The assignee at resolution is used for per-person cycle-time averages.
- "Unassigned" is shown separately and excluded from the person-level workload
  average.
- The latest successful snapshot remains visible after a failed refresh and is
  immediately marked stale/refresh-failed.
- Production access is protected by the organization's SSO-enabled reverse
  proxy; the app does not implement its own account system.

## User Scenarios & Testing

### User Story 1 — Review the latest project summary (Priority: P1)

As the delivery manager, I want to see the current project summary as soon as I
open the dashboard so I can assess delivery health without manually gathering
Jira data.

**Why this priority**: The summary is the primary entry point for daily review
and exposes the deadline, open workload, recent completions, and risk level.

**Independent test**: Load the dashboard with a valid latest snapshot and verify
the project header, generation time, deadline countdown, and all summary cards.

**Acceptance scenarios**:

1. **Given** a successful refresh for the configured Jira project, **when** an
   authorized user opens the dashboard, **then** the page shows the project key,
   snapshot generation time and age, days remaining until the POC deadline,
   total open issues, completed issues in the reporting window, median cycle
   time, median lead time, at-risk issue count, and timing-data coverage.
2. **Given** no successful snapshot has ever been created, **when** a user opens
   the dashboard, **then** the page shows a clear unavailable-data state and does
   not present empty or default metrics as current Jira results.
3. **Given** a refresh has failed after a previous successful refresh, **when**
   a user opens the dashboard, **then** the last successful snapshot remains
   visible with its original timestamp and a prominent refresh-failure notice.
4. **Given** the last successful snapshot is more than 24 hours old, **when** a
   user opens the dashboard, **then** it is marked stale even if no failed run
   has been recorded.

### User Story 2 — Understand workload by assignee (Priority: P1)

As the delivery manager, I want to compare open issue counts by assignee so I
can identify overloaded, underloaded, and unassigned work.

**Why this priority**: Workload balance is a primary stated goal and supports
the manager's daily rebalancing decisions.

**Independent test**: Supply issues assigned to multiple people and at least one
unassigned issue; verify the workload chart and open-work table against the
fixture counts.

**Acceptance scenarios**:

1. **Given** open issues assigned to team members, **when** the dashboard is
   rendered, **then** it shows one workload bar for each person found on an
   open issue or an issue completed in the reporting window, including people
   with zero current open issues.
2. **Given** one or more open issues have no assignee, **when** the dashboard is
   rendered, **then** they are grouped under a visible "Unassigned" bar and are
   included in the open-work table.
3. **Given** an assignee's open-issue count is greater than the team average,
   **when** the workload chart is rendered, **then** that person's bar is
   visually highlighted; the average excludes the separate "Unassigned" group.
4. **Given** an open issue, **when** the full open-work table is rendered,
   **then** its key, summary, assignee, status, days in current status, and due
   date are shown; unavailable source values are identified as unavailable
   rather than fabricated.
5. **Given** no people are discovered but open issues are unassigned, **when**
   the workload chart is rendered, **then** it shows the Unassigned count and
   does not calculate or display a person-level average.

### User Story 3 — Identify work at risk (Priority: P1)

As the delivery manager, I want at-risk open issues and their reasons called out
so I can prioritize follow-up before the POC deadline.

**Why this priority**: The source specification sets a hard end-of-November
deadline and defines stale and high-priority risk rules.

**Independent test**: Provide open issues covering each risk rule and one
non-risk issue; verify inclusion and reason labels in the at-risk table.

**Acceptance scenarios**:

1. **Given** an open issue has not been updated for at least the configured
   72 elapsed hours at `asOfAt`, **when** risk is calculated,
   **then** it appears with reason "stale".
2. **Given** an open issue has Highest or High priority, **when** risk is
   calculated, **then** it appears with reason "high priority".
3. **Given** an open issue has a due date before the local report date, **when**
   risk is calculated, **then** it appears with reason "overdue"; a due date
   equal to the report date is not overdue.
4. **Given** an open issue has a due date after the POC deadline, **when** risk
   is calculated, **then** it appears with reason "deadline breach"; a due date
   equal to the POC deadline is not a breach.
5. **Given** an issue meets more than one risk rule, **when** it appears in the
   at-risk table, **then** every applicable reason is shown without duplicating
   the issue row.

### User Story 4 — Review delivery flow and elapsed times (Priority: P2)

As the delivery manager, I want to review recent throughput, cycle time, and
lead time so I can understand how work moves through the team.

**Why this priority**: These metrics provide delivery-flow context for
workload and risk, using the last two weeks of Jira activity.

**Independent test**: Use issue fixtures with known resolution dates and status
transition histories; compare daily completion counts and calculated durations
with expected values.

**Acceptance scenarios**:

1. **Given** issues were completed within the reporting window, **when** the
   throughput chart is rendered, **then** it shows the number completed on
   every local calendar date in the window, including dates with zero
   completions; completion is determined by `resolutiondate`.
2. **Given** a completed issue has status history, **when** cycle time is
   calculated, **then** it uses the latest completed In Progress-to-Done cycle
   associated with its latest resolution, not the issue creation date.
3. **Given** a completed issue has a creation date and resolution date, **when**
   lead time is calculated, **then** it is elapsed UTC time between those two
   timestamps, expressed in days.
4. **Given** completed issues in the window have usable timing data, **when**
   the time table is rendered, **then** it shows per-person average cycle time,
   team median cycle time, and team median lead time, along with included and
   excluded sample counts.
5. **Given** an issue lacks the history or dates required for a timing metric,
   **when** metrics are calculated, **then** that issue is excluded from that
   metric and the dashboard indicates the metric's data coverage; it is not
   assigned a guessed duration.

### User Story 5 — Receive a reliable daily refresh (Priority: P1)

As the delivery manager, I want the dashboard data refreshed automatically
each morning and refresh failures made visible so I can trust the age and
completeness of the report.

**Independent test**: Run the refresh against mocked Jira responses, verify that
a successful run replaces the current snapshot, and that a failed run leaves the
last successful snapshot identifiable as stale.

**Acceptance scenarios**:

1. **Given** the scheduled refresh time is reached and Jira is available,
   **when** the refresh runs, **then** it fetches the configured project data
   and atomically publishes a new latest snapshot after all required pages and
   changelog requests complete.
2. **Given** Jira authentication or network access fails, **when** the refresh
   runs, **then** it exits or records failure visibly with a readable,
   appropriately redacted error and does not mark partial results as successful.
3. **Given** the refresh is run manually by an operator, **when** it completes,
   **then** it follows the same validation and publication rules as the
   scheduled refresh.
4. **Given** another refresh is already running, **when** a scheduled or manual
   refresh starts, **then** it exits with a visible "refresh already running"
   result and does not start a concurrent snapshot write.

### User Story 6 — View an accessible, protected dashboard (Priority: P1)

As an authorized stakeholder, I want to view the dashboard without receiving
access to Jira credentials or database connections.

**Independent test**: Verify unauthenticated external requests are blocked by
the deployment access-control layer, and verify keyboard and screen-reader
access to the dashboard's textual metrics and tables.

**Acceptance scenarios**:

1. **Given** a request comes through the approved SSO-enabled access boundary,
   **when** it requests the dashboard or API, **then** it can read the snapshot
   without receiving Jira credentials or direct database access.
2. **Given** a request is not authorized by that boundary, **when** it requests
   the dashboard or API, **then** it is denied before dashboard data is served.
3. **Given** charts are unavailable or cannot be interpreted by assistive
   technology, **when** a user views the page, **then** equivalent values remain
   available in accessible tables and text.

## Requirements

### Functional Requirements

- **FR-001**: Version 1 MUST provide a read-only dashboard for Jira project
  `SCRUM` at the configured Atlassian site. It MUST NOT read or write
  Confluence data.
- **FR-002**: The backend MUST retrieve Jira data through REST API v3. It MUST
  retrieve every page required for the specified datasets and every changelog
  page needed for cycle-time, assignee-at-resolution, and current-status
  calculations.
- **FR-003**: The current open-work dataset MUST include every issue in the
  configured project whose status category is not Done, regardless of its
  `updated` timestamp. Jira does not provide a transactionally consistent
  snapshot across paginated requests; `asOfAt` defines report-window and
  calculation boundaries, while issue fields reflect the values returned
  during the refresh.
- **FR-004**: The completed-work dataset MUST include issues with a non-null
  `resolutiondate` in the reporting interval and a current status category of
  Done. Completion date, throughput grouping, and membership in
  completed-in-window metrics MUST all use `resolutiondate`. Issues currently
  reopened are not counted as completed.
- **FR-005**: The backend MUST use the JQL search endpoint. It MAY fall back to
  the legacy search endpoint only when the JQL endpoint returns HTTP 404 or
  410 as unsupported; it MUST NOT use fallback to hide authentication,
  permission, validation, rate-limit, or transient server errors.
- **FR-006**: A failure to retrieve any required page or changelog after the
  retry policy is exhausted MUST fail the refresh. A partial dataset MUST NOT
  replace the last successful snapshot.
- **FR-007**: The reporting window MUST comprise the current local calendar
  date and the preceding `WINDOW_DAYS - 1` calendar dates. Its start is local
  midnight `WINDOW_DAYS - 1` dates before the report date, inclusive; its
  exclusive end is `asOfAt`, captured once at the beginning of the refresh.
  `generatedAt` is the successful snapshot commit time. `WINDOW_DAYS` MUST
  default to `14` and MUST be a positive integer.
- **FR-008**: The reporting timezone MUST default to `Asia/Kolkata` and be
  configurable. Jira timestamps MUST be interpreted as UTC instants and
  converted to the configured timezone only for local date bucketing and
  display.
- **FR-009**: The dynamic people roster MUST be the union of assignees on
  current open issues and assignees at resolution for issues completed in the
  reporting window. People in this roster with zero current open issues MUST
  appear with a zero count. People with no issue in either dataset are not
  included. Unassigned issues MUST be grouped separately.
- **FR-010**: Workload MUST count each non-Done issue once, grouped by its
  current assignee. The person-level average MUST be the sum of open counts
  divided by the number of people in the roster; "Unassigned" MUST NOT be in
  that denominator. If the roster is empty, no average is calculated.
- **FR-011**: The daily throughput series MUST contain one value for each local
  calendar date in the reporting window, including dates with zero completions.
  Each issue is counted once on its `resolutiondate` local date.
- **FR-012**: For a completed issue, the cycle-time interval MUST use the latest
  completed cycle associated with its latest resolution: the ending event is
  the latest transition into the Done status category at or before
  `resolutiondate`; the starting event is the latest transition from a
  non-In-Progress category into In Progress after the preceding Done transition
  and before that ending event. If there is no preceding Done transition, use
  the latest In Progress entry before the ending event. An issue with no valid
  pair MUST be excluded from cycle-time metrics.
- **FR-013**: Cycle and lead durations MUST be computed from UTC elapsed time in
  seconds divided by 86,400. Calculations MUST retain full precision and values
  MUST be displayed to one decimal day. The median of an even-sized sample is
  the arithmetic mean of the two middle values.
- **FR-014**: Lead time MUST be measured from Jira `created` to
  `resolutiondate`. Per-person averages are required for cycle time only;
  lead time is reported as a team median. Per-person cycle time MUST be grouped
  by assignee at resolution, reconstructed from changelog. If attribution is
  unavailable, the issue is excluded from per-person averages and counted in
  the coverage data; it remains included in the team cycle-time median if its
  cycle duration is valid.
- **FR-015**: Timing summaries MUST state the number of eligible issues,
  included samples, and excluded samples. No duration may be inferred from
  missing dates or changelog entries. If no valid samples exist, display "No
  data" and a zero sample count, not a numeric zero duration. Eligible cycle
  and lead-time issues are the completed-in-window dataset. Eligible
  assignee-attribution issues are completed-in-window issues with a valid cycle
  duration.
- **FR-016**: An open issue MUST be considered stale when its `updated`
  timestamp is at least `STALE_DAYS * 24` elapsed hours before snapshot
  `asOfAt`. `STALE_DAYS` MUST default to `3`.
- **FR-017**: An open issue MUST be high-priority risk when its Jira priority
  name, compared case-insensitively, matches one of the configured high-risk
  priority names. The default names are `Highest` and `High`.
- **FR-018**: An open issue MUST be overdue when its due date is earlier than
  the snapshot's local report date. A due date equal to the report date is not
  overdue. An open issue MUST be a deadline breach when its due date is later
  than the POC deadline. A due date equal to the deadline is not a breach. Both
  reasons may apply to the same issue. The default deadline is `2026-11-30`.
- **FR-019**: The at-risk table MUST contain only open issues that match at
  least one risk rule. It MUST show key, summary, assignee, status, priority,
  due date, last-updated time, and every applicable reason. Sort by the
  order in `HIGH_RISK_PRIORITIES`, then other risk reasons, earliest non-null
  due date, then issue key.
- **FR-020**: The open-work table MUST show key, summary, assignee, status,
  days in current status, and due date, sorted by issue key. Days in status MUST
  be elapsed UTC time since the latest transition into the current status,
  divided by 86,400 and displayed to one decimal day. If the issue has never
  left its initial status, use its creation timestamp. Otherwise, if the
  required transition is unavailable, display "Unavailable."
- **FR-021**: The dashboard MUST include a project header, generated-at
  timestamp, snapshot age, deadline countdown, total open issues, completed
  issues in-window, median cycle time, median lead time, at-risk issue count,
  workload chart, daily throughput chart, timing table, at-risk table, and
  open-work table.
- **FR-022**: The deadline countdown MUST be the calendar-date difference
  `POC_DEADLINE - report date` in the configured timezone: zero on the
  deadline date and negative after it.
- **FR-023**: Workload bars above the average defined in FR-010 MUST be
  highlighted. If no person-level average can be calculated, no bar is
  highlighted and the average is shown as unavailable.
- **FR-024**: Charts MUST use Chart.js loaded from the jsDelivr CDN URL
  `https://cdn.jsdelivr.net/npm/chart.js@<pinned-version>/dist/chart.umd.min.js`.
  The deployed page MUST use an exact Chart.js 4.x release, Subresource
  Integrity, and a restrictive Content Security Policy that permits only the
  required CDN host. The version and integrity hash MUST be committed with the
  frontend source; a floating `latest` URL is prohibited. Jira data MUST be
  rendered locally and MUST NOT be sent to the CDN. If the CDN is unavailable,
  a fallback message MUST appear and equivalent textual/table data MUST remain
  available.
- **FR-025**: The backend MUST expose `GET /api/v1/dashboard` as a read-only
  JSON endpoint. A successful response MUST include `generatedAt`,
  `asOfAt`, `projectKey`, `reportingWindow` (`start`, `end`, `timeZone`,
  `days`),
  `deadline` (`date`, `daysRemaining`), `summary`, `workload`, `throughput`,
  `cycleTimeByAssignee`, `atRiskIssues`, `openIssues`, `dataQuality`, and
  `refreshStatus`. Timestamps MUST be ISO 8601 UTC strings; date-only values
  MUST use `YYYY-MM-DD`; unavailable numeric values MUST be JSON `null`.
  `reportingWindow.end` MUST equal `asOfAt`, not `generatedAt`.
  `summary` MUST contain integer open, completed, and at-risk counts; nullable
  median cycle-time and lead-time days; and included/excluded counts for both
  timing metrics. `workload` items MUST contain `assigneeName` and integer
  `openIssueCount`; `throughput` items MUST contain `date` and integer
  `completionCount`; `cycleTimeByAssignee` items MUST contain `assigneeName`,
  nullable `averageDays`, and integer `sampleCount`. `atRiskIssues` items MUST
  contain `key`, `summary`, `assigneeName`, `status`, `priority`, nullable
  `dueDate`, `updatedAt`, and string-array `reasons`. `openIssues` items MUST
  contain `key`, `summary`, `assigneeName`, `status`, nullable numeric
  `daysInStatus`, and nullable `dueDate`. `dataQuality` MUST contain
  `cycleTime`, `leadTime`, and
  `assigneeAttribution` objects, each with integer `eligibleIssues`,
  `includedIssues`, and `excludedIssues`. `refreshStatus` MUST contain `state`
  (`success` or `failed`), `lastAttemptAt`, `lastSuccessAt`, and nullable
  `errorCode`; `lastSuccessAt` is `null` before the first successful refresh.
  An unavailable `daysInStatus`, `averageDays`, or median MUST be `null` in
  JSON and rendered as "Unavailable" or "No data" as appropriate.
- **FR-026**: The dashboard endpoint MUST return HTTP 200 with the last
  successful snapshot and failed refresh status if a newer refresh failed.
  If no successful snapshot exists, it MUST return HTTP 503 with a stable
  `DASHBOARD_NOT_READY` error code in an `error.code` JSON field and a
  sanitized `error.message`. If PostgreSQL is unavailable, it MUST return HTTP
  503 with `SERVICE_UNAVAILABLE`. Other server errors MUST return a sanitized
  error code and MUST NOT expose stack traces or credentials. The SSO boundary
  MUST return HTTP 401 or 403 before protected data is served.
- **FR-027**: The frontend MUST show an initial loading state, a no-snapshot
  state, a stale/failed-refresh banner, and an API-unavailable state. A snapshot
  MUST be marked stale when it is more than 24 hours old; any failed refresh
  MUST immediately display a failure banner even if the previous snapshot is
  less than 24 hours old.
- **FR-028**: PostgreSQL MUST store one current snapshot per configured
  project and only the latest refresh state. A successful refresh MUST replace
  the snapshot and mark the run successful in one transaction. A failed
  refresh MUST leave the snapshot unchanged and record the failure state
  separately. No historical snapshots or raw changelog archives may be kept.
- **FR-029**: The current snapshot MUST be retained until replaced by a
  successful refresh or explicitly removed when the project is decommissioned.
  Decommissioning MUST delete the snapshot and refresh state. The Compose
  database volume MUST persist across normal container restarts; scheduled
  operations MUST NOT remove it. The snapshot is a reproducible cache, not the
  source of truth; no application-level historical backup is required. Any
  infrastructure backup MUST follow the same access restrictions and the
  organization's retention policy.
- **FR-030**: On Windows, Task Scheduler MUST invoke a repository PowerShell
  refresh wrapper daily at 08:00 in `REPORTING_TIME_ZONE`. The wrapper MUST
  run `docker compose up -d database`, wait for database readiness, run
  `docker compose run --rm backend npm run migrate`, then run
  `docker compose run --rm backend npm run refresh`. It MUST preserve the
  Compose volume, capture stdout/stderr in the Task Scheduler history or an
  appropriately redacted log, and return a non-zero exit code on failure.
  Manual operation MUST use the same commands and refresh implementation.
- **FR-031**: At most one refresh may run at a time. A second invocation MUST
  exit non-zero with a clear "refresh already running" result without changing
  snapshot data. The backend MUST enforce this with a PostgreSQL advisory lock
  scoped to the configured project.
- **FR-032**: Jira requests MUST retry 429, 5xx, and transient network failures
  up to three times after the initial attempt, with delays of 1, 2, and 4
  seconds unless a longer `Retry-After` is supplied. The total refresh MUST
  respect `REFRESH_TIMEOUT_MINUTES`; if a `Retry-After` exceeds the remaining
  budget, the refresh MUST fail rather than exceed the budget. No more than
  five Jira requests may be in flight concurrently. Authentication, permission,
  and other non-retryable 4xx errors MUST fail fast.
- **FR-033**: Jira credentials MUST be supplied only to the backend through
  protected environment-based configuration. The integration MUST use a
  dedicated account with the narrowest available project-level read
  permissions. Secrets MUST NOT be committed, logged, included in command-line
  arguments, or returned to the browser.
- **FR-034**: Production dashboard and API routes MUST be behind the
  organization's SSO-enabled reverse proxy. The browser and API MUST share
  that access boundary. Local development MAY bind only to loopback without
  SSO. No public unauthenticated deployment is permitted.
- **FR-035**: Required configuration MUST be documented in `.env.example` with
  placeholders only. Startup MUST fail with a clear error for missing or
  invalid required configuration.
- **FR-036**: Confluence data and actions, Jira write-back, notifications,
  sprint reporting, and historical reporting are outside this feature.
- **FR-037**: The backend MUST expose `GET /api/v1/health/live` and
  `GET /api/v1/health/ready`. Readiness MUST include PostgreSQL connectivity
  and migration status; health endpoints MUST NOT disclose configuration or
  project data.
- **FR-038**: If PostgreSQL is unavailable, the refresh MUST log a redacted
  failure and exit non-zero. The API MUST report not-ready and MUST NOT claim
  to serve a snapshot while the database is unavailable.

### Non-Functional Requirements

- **NFR-001**: The implementation MUST use React 18 with Vite, Node.js with
  Express 5, and PostgreSQL 15 through Docker Compose. The Node.js image MUST
  use an actively supported LTS release at implementation time.
- **NFR-002**: PostgreSQL schema changes MUST use committed, repeatable
  migrations. Migrations MUST complete before the API reports readiness and
  MUST NOT reset or drop persistent data during normal startup.
- **NFR-003**: The backend MUST provide live and readiness health endpoints.
  Readiness MUST fail when the database is unavailable or required migrations
  have not completed. The endpoints MUST be
  `/api/v1/health/live` and `/api/v1/health/ready`.
- **NFR-004**: Operational logs MUST be structured and redact credentials,
  authorization headers, and sensitive issue content. Refresh failures MUST
  include a stable error category and enough context for an operator to
  diagnose them.
- **NFR-005**: The dashboard MUST meet WCAG 2.1 AA for the implemented views.
  Charts MUST have accessible names and equivalent tables/text; color MUST NOT
  be the only indication of risk or workload.
- **NFR-006**: The supported browsers are the latest two stable releases of
  Microsoft Edge and Google Chrome.
- **NFR-007**: For a benchmark dataset of 1,000 open issues and 500 issues
  completed in-window, the API MUST return a cached dashboard snapshot within
  2 seconds at p95, and a full refresh MUST complete within 10 minutes when
  Jira request latency is at most 1 second and no retries or rate limits occur.
  Results MUST NOT be truncated if the dataset exceeds this benchmark;
  exceeding it triggers performance review, not silent partial reporting.
- **NFR-008**: Business rules MUST have unit tests; API, persistence,
  migrations, and refresh publication MUST have integration tests using
  fixtures or isolated test data. Tests MUST NOT require production
  credentials or modify a real Jira site.

### Key Entities

- **Jira Issue**: Source issue identified by project and issue key; relevant
  attributes include summary, assignee, status and status category, priority,
  created date, updated date, due date, resolution date, and changelog.
- **Status Transition**: A Jira changelog event recording the prior and new
  status category and transition timestamp; used to calculate cycle time and
  days in current status.
- **Dashboard Snapshot**: The single latest successfully computed report per
  configured project and reporting window, including generation time, summary
  metrics, workload groups, throughput, timing samples, at-risk issues, and
  open issues.
- **Refresh State**: The most recent attempt's start/completion time, outcome,
  stable error code when failed, and last successful snapshot time. Historical
  refresh-run records are not retained.

## Success Criteria

- **SC-001**: With a successful refresh, each dashboard section is rendered
  from the returned snapshot. Empty datasets display an explicit zero or "No
  data" state; missing source values are never represented as fabricated
  metrics.
- **SC-002**: Given a fixture of open issues across every page of the Jira
  search response, the workload totals equal the fixture exactly, with no
  duplicate or omitted issue and unassigned issues in their own group.
- **SC-003**: The roster contains assignees found on open issues and
  in-window completions; a roster member with no open issues is shown with
  count zero, and Unassigned is excluded from the person-level average.
- **SC-004**: A test issue updated exactly 72 hours before `asOfAt` is stale;
  one updated less than 72 hours before `asOfAt` is not stale on that rule
  alone.
- **SC-005**: Cycle-time fixtures, including a reopened issue, prove that the
  selected cycle uses the specified status transitions and never substitutes
  issue creation time.
- **SC-006**: Throughput fixtures match `resolutiondate` local-date buckets
  for all `WINDOW_DAYS` dates (14 by default), including zero-completion
  dates; lead-time fixtures match elapsed time from `created` to
  `resolutiondate`.
- **SC-007**: A failed request or incomplete pagination for a required Jira
  page/changelog causes the refresh to fail without replacing the last
  successful snapshot. A successful response with no usable timing history
  excludes that issue and updates the coverage counts.
- **SC-008**: A failed refresh immediately produces a visible failure state
  while the prior snapshot remains available with its original timestamp.
  A successful snapshot older than 24 hours is marked stale.
- **SC-009**: The scheduled task runs daily at 08:00 in the configured
  timezone (Asia/Kolkata by default), returns a non-zero exit code on failure,
  and never starts a concurrent refresh.
- **SC-010**: Requests denied by the configured SSO boundary cannot retrieve
  either the frontend or dashboard API data.
- **SC-011**: With the Chart.js CDN blocked, all metric values and issue data
  remain available in accessible tables and a chart fallback message appears.
- **SC-012**: For the NFR-007 benchmark dataset, cached API response p95 is
  below 2 seconds and refresh duration is below 10 minutes under the stated
  Jira response assumptions.
- **SC-013**: Automated tests cover the calculations, API, database
  transactions, migrations, failure handling, and publication behavior
  without production credentials or writes to a real Jira site.
- **SC-014**: Risk fixtures prove that due dates equal to the report date and
  deadline are not flagged by those respective rules, a date after the
  deadline is a breach, and all applicable reason labels appear once per
  issue.
- **SC-015**: Migration tests prove a clean database becomes ready, a failed
  migration keeps readiness false, and normal service restarts preserve the
  latest snapshot.

## Constraints

- The implementation MUST follow the project constitution: React 18 with Vite,
  Node.js with Express 5, and PostgreSQL 15 run through Docker Compose.
- Jira integration MUST be read-only for this feature.
- Jira credentials and dashboard data MUST be protected as specified in
  FR-033 and FR-034.
- Jira issue data is sensitive and MUST be shared only through an approved
  access-controlled deployment.

## Configuration

All secrets are supplied to the backend only. `.env.example` MUST contain
placeholder values, never real credentials.

| Key | Default / requirement | Purpose |
|---|---|---|
| `ATLASSIAN_SITE` | Required | Jira Cloud base URL |
| `ATLASSIAN_EMAIL` | Required | Dedicated read-only integration account |
| `ATLASSIAN_TOKEN` | Required secret | Jira API token for that account |
| `JIRA_PROJECT` | `SCRUM` | Jira project key |
| `WINDOW_DAYS` | `14` | Number of local calendar dates in the report |
| `STALE_DAYS` | `3` | Elapsed-day stale threshold |
| `POC_DEADLINE` | `2026-11-30` | Deadline date |
| `REPORTING_TIME_ZONE` | `Asia/Kolkata` | IANA timezone for report dates and schedule |
| `HIGH_RISK_PRIORITIES` | `Highest,High` | Ordered, case-insensitive Jira priority names |
| `DATABASE_URL` | Required secret/config | PostgreSQL connection for backend |
| `JIRA_REQUEST_TIMEOUT_SECONDS` | `30` | Per-request timeout |
| `REFRESH_TIMEOUT_MINUTES` | `10` | Maximum total refresh duration |

The backend MUST validate required variables at startup, reject invalid URLs,
dates, timezones, and non-positive numeric values, and report missing variable
names without printing secret values. `JIRA_REQUEST_TIMEOUT_SECONDS` and
`REFRESH_TIMEOUT_MINUTES` MUST be positive integers, and each Jira retry MUST
remain within the total refresh timeout.

## Assumptions and Decisions to Validate

- On 2026-11-26, the product owner confirmed `Highest,High` as the priority
  mapping, `Asia/Kolkata` as the reporting timezone, and `2026-11-30` as the
  POC deadline. The Jira site, `SCRUM` access, and dedicated read-only account
  remain deployment placeholders until provisioned; no credentials are stored
  in this specification.
- The owner for the SSO-enabled reverse proxy is still TBD and must be assigned
  before release.
- The reporting timezone defaults to `Asia/Kolkata` based on the project
  owner's stated locale; deployments may override it. The configured timezone
  governs the 08:00 schedule, date buckets, stale-day reporting, and deadline
  display.
- The reporting window is 14 local calendar dates, including the current date
  up to `asOfAt`, rather than exactly 14 x 24 hours. Other configured window
  lengths use the same calendar-date rule.
- `resolutiondate` is the authoritative completion timestamp. Issues reopened
  after resolution are counted only if they are currently Done and have a
  non-null `resolutiondate` in the window at refresh time.
- Cycle time represents the latest completed In Progress-to-Done cycle
  associated with the latest resolution. This refines the original
  first-transition rule for reopened issues.
- Per-person cycle time uses the assignee at resolution reconstructed from
  changelog. Per-person lead time is not required in v1.
- Issue-count throughput is sufficient; story points are excluded.
- The standard Jira priority names `Highest` and `High` are used by default.
  If the tenant uses different names, deployment configuration must map them
  before release.
- The legacy `project_spec.md` request for an unscoped token is superseded.
  Use the narrowest token type available and a dedicated account with
  project-level read-only permissions; no Jira write permission is granted.
- The production environment provides an SSO-enabled reverse proxy for both
  frontend and API. Selecting and configuring that proxy is a deployment
  prerequisite, not an application login feature.
- Baseline performance is sized for a team of about 10 people, up to 1,000
  open issues and 500 completions in the reporting window. These are test
  benchmarks, not data truncation limits.
- Confluence automation is a separate future feature with its own
  specification and acceptance criteria.

## Out of Scope

- Creating, editing, transitioning, or deleting Jira issues.
- Reading or writing Confluence pages, spaces, comments, or attachments.
- Sprint ceremony or sprint-status reporting.
- Historical trend analysis or a historical data warehouse.
- In-app user account management.
- Notifications, alerts, or automated workload reassignment.
- Replacing or extending the separate weekly status report tool.

## Review & Acceptance Checklist

- [ ] Product owner confirms the assumptions in "Assumptions and Decisions to
      Validate," especially timezone, priority names, workload scope, and
      reopened-issue cycle semantics.
- [ ] All requirements are traceable to a user story or explicit project
      constraint.
- [ ] The feature plan follows `spec/constitution.md` and the approved stack.
- [ ] The dedicated Jira account has least-privilege read access; the
      production SSO boundary is configured and tested before release.
- [ ] Migrations, health checks, refresh scheduling, retention, and failure
      visibility are covered by implementation tasks.
- [ ] Acceptance scenarios can be tested using fixtures without production
      credentials.
