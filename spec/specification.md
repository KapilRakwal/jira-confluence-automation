# Feature Specification: Team Workload & Delivery Dashboard

**Feature Branch**: `001-team-workload-dashboard`  
**Created**: 2026-11-26  
**Status**: Draft — open questions listed below  
**Input**: `project_spec.md` v1.0 and the project constitution

## Summary

Provide a read-only web dashboard for the delivery manager and authorized
stakeholders to review Jira project SCRUM workload, delivery flow, cycle and lead
times, and at-risk work. The dashboard uses a rolling 14-day reporting window by
default and refreshes automatically each morning.

This specification retains the original Jira metrics and reporting goals while
replacing the original Python-generated static HTML delivery with the web
application architecture required by the project constitution. The browser
displays data from the application backend; it does not call Jira directly.

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
   snapshot generation time, days remaining until the POC deadline, total open
   issues, completed issues in the reporting window, median cycle time, median
   lead time, and number of at-risk issues.
2. **Given** no successful snapshot has ever been created, **when** a user opens
   the dashboard, **then** the page shows a clear unavailable-data state and does
   not present empty or default metrics as current Jira results.
3. **Given** a refresh has failed after a previous successful refresh, **when**
   a user opens the dashboard, **then** the last successful snapshot may remain
   visible with its original timestamp and a clear stale/refresh-failure notice.

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
   rendered, **then** it shows one workload bar per discovered assignee and the
   count of that person's open issues.
2. **Given** one or more open issues have no assignee, **when** the dashboard is
   rendered, **then** they are grouped under a visible "Unassigned" bar and are
   included in the open-work table.
3. **Given** an assignee's open-issue count is greater than the team average,
   **when** the workload chart is rendered, **then** that bar is visually
   highlighted.
4. **Given** an open issue, **when** the full open-work table is rendered,
   **then** its key, summary, assignee, status, days in current status, and due
   date are shown; unavailable source values are identified as unavailable
   rather than fabricated.

### User Story 3 — Identify work at risk (Priority: P1)

As the delivery manager, I want at-risk open issues and their reasons called out
so I can prioritize follow-up before the POC deadline.

**Why this priority**: The source specification sets a hard end-of-November
deadline and defines stale and high-priority risk rules.

**Independent test**: Provide open issues covering each risk rule and one
non-risk issue; verify inclusion and reason labels in the at-risk table.

**Acceptance scenarios**:

1. **Given** an open issue has not been updated for at least the configured
   stale threshold, **when** risk is calculated, **then** it appears with reason
   "stale".
2. **Given** an open issue has Highest or High priority, **when** risk is
   calculated, **then** it appears with reason "high priority".
3. **Given** an issue has a due date before the report date or after the POC
   deadline, **when** risk is calculated, **then** it appears with an
   appropriate overdue or deadline-breach reason.
4. **Given** an issue meets more than one risk rule, **when** it appears in the
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
   throughput chart is rendered, **then** it shows the number completed for
   every calendar day in the window, including days with zero completions.
2. **Given** a completed issue has status history, **when** cycle time is
   calculated, **then** it uses the first transition into an In Progress
   category and a subsequent transition into Done, not the issue creation date.
3. **Given** a completed issue has a creation date and resolution date, **when**
   lead time is calculated, **then** it is the elapsed time between those two
   dates.
4. **Given** completed issues in the window have usable timing data, **when**
   the time table is rendered, **then** it shows per-person cycle-time averages
   and the team median, plus the team median lead time.
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
   and atomically publishes a new latest snapshot.
2. **Given** Jira authentication or network access fails, **when** the refresh
   runs, **then** it exits or records failure visibly with a readable,
   appropriately redacted error and does not mark partial results as successful.
3. **Given** the refresh is run manually by an operator, **when** it completes,
   **then** it follows the same validation and publication rules as the
   scheduled refresh.

## Requirements

### Functional Requirements

- **FR-001**: The application MUST provide a read-only dashboard for Jira
  project `SCRUM` at the configured Atlassian site.
- **FR-002**: The application MUST retrieve Jira data through the backend using
  Jira REST API v3, including pagination and issue changelog data needed for
  status-transition metrics. It MUST support the JQL search endpoint and the
  documented legacy search fallback when required.
- **FR-003**: The reporting window MUST default to the rolling last 14 days and
  be configurable.
- **FR-004**: The dashboard MUST discover assignees from Jira data rather than
  rely on a hard-coded team roster. Unassigned open issues MUST be represented
  explicitly.
- **FR-005**: The open-work summary MUST count issues whose status category is
  not Done and group them by assignee.
- **FR-006**: The completed-in-window count and throughput chart MUST use
  issues completed during the reporting window, grouped by completion date.
- **FR-007**: Cycle time MUST be measured from the first transition into an
  In Progress status category to a subsequent transition into Done. Lead time
  MUST be measured from issue creation to its resolution date.
- **FR-008**: The time summary MUST provide the team median cycle time, team
  median lead time, and per-person average cycle time for issues completed in
  the reporting window. The per-person grouping rule for reassigned issues is
  listed as an open question.
- **FR-009**: An open issue MUST be considered stale when its last update is at
  least the configured stale threshold old. The default threshold MUST be
  three days.
- **FR-010**: An open issue MUST be considered high-priority risk when its
  priority is Highest or High.
- **FR-011**: An open issue with a due date before the report date or after the
  configured POC deadline MUST be identified as overdue or deadline-breach
  risk, respectively. The default POC deadline MUST be `2026-11-30`.
- **FR-012**: The at-risk table MUST show each matching issue once and list all
  applicable reasons: stale, high priority, overdue, or deadline breach.
- **FR-013**: The dashboard MUST contain a project header, generation time,
  deadline countdown, summary cards, workload chart, daily throughput chart,
  cycle/lead time table, at-risk table, and full open-work table.
- **FR-014**: Workload bars above the displayed team average MUST be visually
  highlighted.
- **FR-015**: Charts MUST use Chart.js loaded from a CDN, with a graceful
  fallback message when the chart library is unavailable. The associated
  tables and essential report data MUST remain usable without the CDN.
- **FR-016**: The backend MUST publish a latest successful dashboard snapshot
  through a read-only HTTP/JSON API. The frontend MUST NOT call Jira or the
  database directly.
- **FR-017**: PostgreSQL MUST store only the current dashboard snapshot and the
  minimum refresh status/configuration needed to serve it. A successful refresh
  MUST replace the previous snapshot atomically; this feature MUST NOT create a
  historical data warehouse.
- **FR-018**: A failed refresh MUST preserve the last successful snapshot,
  record or expose the failed refresh status, and show its original generation
  time so users can identify stale data.
- **FR-019**: On Windows, the refresh MUST be scheduled through Windows Task
  Scheduler to run daily at 08:00 in the configured reporting timezone. It
  MUST also support an operator-invoked manual run.
- **FR-020**: Jira credentials MUST be loaded only by the backend from
  environment-based secret configuration. Credentials MUST NOT be committed,
  returned to the browser, or written to logs.
- **FR-021**: The deployed dashboard MUST be accessible only to authorized
  stakeholders. In-app account management is not required by this feature; the
  deployment access-control mechanism must be selected before production
  release.
- **FR-022**: The application MUST provide clear, redacted failure information
  for invalid credentials, network/API errors, and unusable Jira responses.

### Key Entities

- **Jira Issue**: Source issue identified by project and issue key; relevant
  attributes include summary, assignee, status and status category, priority,
  created date, updated date, due date, resolution date, and changelog.
- **Status Transition**: A Jira changelog event recording the prior and new
  status and transition timestamp; used to calculate cycle time and days in
  current status.
- **Dashboard Snapshot**: The latest successfully computed report for one
  configured project and reporting window, including generation time, summary
  metrics, workload groups, throughput by day, per-person timing values,
  at-risk issues, and open issues.
- **Refresh Run**: The most recent attempt to retrieve and calculate report
  data, including its start/completion time and success or failure state. It is
  operational status, not a historical reporting warehouse.

## Success Criteria

- **SC-001**: With valid Jira credentials and a successful refresh, every
  dashboard section specified in FR-013 is populated from Jira data.
- **SC-002**: All open issues in the chosen workload scope are counted exactly
  once, including unassigned issues in a separate group.
- **SC-003**: Cycle-time test fixtures prove durations use status-transition
  timestamps; no cycle-time result is substituted with issue creation time.
- **SC-004**: A test issue last updated at least three days ago is identified as
  stale; one updated less than three days ago is not stale on that rule alone.
- **SC-005**: Daily throughput values match Jira completion dates for every
  date in the reporting window, including zero-completion dates.
- **SC-006**: An invalid token or unavailable Jira service produces an explicit
  failed refresh; it does not replace the last successful snapshot with
  partial data.
- **SC-007**: The scheduled refresh is configured for 08:00 in the selected
  reporting timezone, and a failed scheduled run is visible to an operator.
- **SC-008**: With the chart CDN unavailable, all essential tables and textual
  metrics remain available and a chart fallback message is shown.
- **SC-009**: Automated tests can exercise metric calculations and API/database
  behavior without production credentials or writes to a real Jira site.

## Constraints

- The implementation MUST follow the project constitution: React 18 with Vite,
  Node.js with Express, and PostgreSQL 15 run through Docker.
- Jira integration MUST be read-only for this feature.
- Reporting defaults are `JIRA_PROJECT=SCRUM`, `WINDOW_DAYS=14`,
  `STALE_DAYS=3`, and `POC_DEADLINE=2026-11-30`; the Atlassian site and account
  credentials are supplied through backend-only configuration.
- Jira issue data is sensitive and MUST be shared only through an approved
  access-controlled deployment.
- The dashboard is a web application rather than the static HTML artifact in
  `project_spec.md`; the original metric definitions and daily reporting intent
  remain in scope.

## Assumptions

- Jira is the only external data source required for this feature. Confluence
  actions and data are not specified and are excluded from this version.
- The most recent successful snapshot is sufficient; historical snapshots are
  not needed.
- Chart.js is fetched from its CDN, but dashboard data is rendered locally and
  is not sent to the CDN.
- The existing issue-count-based throughput metric is used; story points are
  not part of the metric unless stakeholders resolve the open question below
  differently.
- The displayed deadline countdown uses calendar dates in the configured
  reporting timezone.

## Out of Scope

- Creating, editing, transitioning, or deleting Jira issues.
- Reading or writing Confluence pages, spaces, comments, or attachments.
- Sprint ceremony or sprint-status reporting.
- Historical trend analysis or a historical data warehouse.
- In-app user account management.
- Notifications, alerts, or automated workload reassignment.
- Replacing or extending the separate weekly status report tool.

## Open Questions

1. Should workload counts and the full open-work table include every currently
   open issue in SCRUM, including issues not updated in the 14-day window? This
   specification assumes they should, to avoid hiding old open work.
2. Should "Unassigned" be included when calculating the average used to
   highlight above-average workload? The source specification shows it as a
   separate bar but does not settle its role in the average.
3. Is issue-count throughput sufficient, or should story points be included?
4. Which reporting timezone defines the 08:00 refresh, calendar-day throughput,
   stale thresholds, and deadline countdown?
5. For per-person cycle-time averages, should a completed issue be attributed
   to its assignee at completion or its current assignee?
6. How should reopened issues be treated if they have multiple transitions into
   In Progress or Done?
7. Which organization-approved access-control mechanism will protect the
   hosted dashboard?
8. Does the project require a Confluence workflow in a later feature? If so,
   specify the spaces/pages, operations, permissions, and expected outcomes
   separately before adding it to scope.

## Review & Acceptance Checklist

- [ ] Product owner confirms the open questions that affect metric results.
- [ ] All requirements are traceable to a user story or explicit project
      constraint.
- [ ] The feature plan follows `spec/constitution.md` and the approved stack.
- [ ] Jira read-only permissions and dashboard access boundaries are documented
      before production deployment.
- [ ] Acceptance scenarios can be tested using fixtures without production
      credentials.
