# Senior Specification Review: Clarifications Required

**Reviewed**: [`constitution.md`](./constitution.md) and
[`specification.md`](./specification.md)

**Review date**: 2026-11-26

**Overall assessment**: The product goal and major metrics are understandable,
but the specification is not implementation-ready. Several decisions that
change the dataset or calculation results remain open, and several operational
requirements are not testable yet.

## High-Priority Gaps and Unclear Requirements

### 1. Scope change from the original project specification

The original `project_spec.md` describes a Python-generated static HTML file and
lists a live web application as out of scope. The new specification explicitly
replaces that delivery model with React, an API, and PostgreSQL, so the two
documents conflict unless this is an approved scope change. Confirm that the
static generator is retired, identify whether any of its output or workflow must
be preserved, and update or supersede its acceptance criteria.

The constitution covers both Jira and Confluence automation, while this feature
specification excludes all Confluence behavior. That is a valid feature boundary,
but confirm that a Jira-only dashboard is the intended first feature rather than
the complete project scope.

### 2. Jira query scope and workload completeness

FR-002 does not define the JQL or the complete set of issues to retrieve.
Open Question 1 acknowledges that the full open backlog may include issues not
updated during the reporting window, but FR-005 and SC-002 cannot be tested
until that scope is decided. Querying only recently updated/completed issues
would omit stale open work and could undercount workload.

Specify separately:

- Which issues are fetched for current open-work counts and the open-work table.
- Which issues are fetched for completions, throughput, cycle time, and lead
  time within the reporting window.
- Whether closed issues are fetched only when completed in the window.
- Whether pagination must continue until the entire required result set is
  retrieved, and how incomplete pages affect publication.

### 3. Team roster and zero-work assignees

FR-004 says assignees are discovered dynamically, but it does not define which
query supplies that roster. The stated goal includes identifying idle people,
yet the acceptance scenarios only require assignees with open issues and
"Unassigned." Specify whether people with completed work in the window but zero
open issues appear with a zero count, and how a person with no issues in the
window can be represented without a hard-coded roster.

Open Question 2 also leaves unresolved whether "Unassigned" contributes to the
team average used by FR-014. Define the denominator, including behavior when
there are no assignees or no open issues.

### 4. Reporting-window and date/time semantics

The rolling 14-day window, three-day stale threshold, daily completion buckets,
08:00 schedule, and deadline countdown all depend on time boundaries. Open
Question 4 identifies timezone but does not define:

- Whether the window is the previous 14 x 24 hours or 14 calendar dates.
- Whether its start and end are inclusive.
- Whether stale means at least 72 elapsed hours or three calendar days.
- Which timestamp determines a completion: `resolutiondate` or a transition
  into Done.
- How UTC Jira timestamps are converted to reporting dates.
- Whether "days remaining" is zero on the deadline date and negative after it.

Select one reporting timezone and define these boundaries once for all metrics.

### 5. Cycle-time calculation and reopened issues

FR-007 says to use the first transition into In Progress and a subsequent
transition into Done. It does not say which Done transition to use when an issue
is reopened, whether the first In Progress transition may predate the reporting
window, or how an issue that is already In Progress when its history begins is
handled. Open Question 6 acknowledges some of this but leaves the calculation
undefined.

Define the matching transition pair for reopened issues, the treatment of
missing/truncated changelog history, and whether a cycle time can be negative
or zero. State whether duration is elapsed hours converted to days or calendar
days, and the display precision.

### 6. Completion, lead-time, and per-person attribution

FR-006 groups completions by an unspecified completion date. FR-007 defines
lead time from `created` to `resolutiondate`, but does not define the completion
event used for throughput and completed-in-window membership. Decide whether
these use `resolutiondate`, a status transition, or another Jira field, and how
reopened/resolved issues are treated.

Open Question 5 leaves the assignee for per-person cycle-time averages
unresolved. Also clarify whether the cycle-time table includes only per-person
cycle averages or per-person lead-time averages too: the source specification's
layout says "per-person averages" for a cycle/lead-time table, while its metric
definitions specify a per-person average only for cycle time.

Define the sample population for each median and average, including how
unassigned completions and issues without usable timing data affect the
denominator. For even-sized samples, specify the median convention. FR-008's
"data coverage" needs a visible definition, such as included/excluded counts.

### 7. Risk-rule boundaries and presentation

FR-009 through FR-012 need exact boundary behavior:

- Does "three days stale" mean elapsed time or calendar-day difference, and is
  the threshold evaluated at the refresh timestamp or page-view time?
- Is a due date of today overdue? Is a due date equal to the POC deadline a
  breach, or only a date after it?
- Are overdue/deadline-breach rules limited to open issues, as FR-011 says?
- What exact Jira priority identifiers/names map to Highest and High if the
  tenant has custom priorities or localized labels?
- Which reason label is used for dates after the POC deadline, and can an item
  show both overdue and deadline breach?

The risk table is required, but its displayed columns and ordering are not
defined. Specify the minimum fields, sort order, and behavior when an issue has
multiple reasons.

### 8. Days-in-status value

The open-work table requires "days in current status," but no requirement
defines its source or calculation. Specify that it uses the latest transition
into the current status, how it handles an issue with no usable changelog, its
time unit/precision, and whether the same reporting timezone applies.

### 9. Refresh failure, retries, and concurrent runs

FR-018 says the failed refresh status may be recorded or exposed, while User
Story 1 says the last snapshot "may" remain visible. These make the user-facing
failure behavior optional even though FR-018 requires the last successful
snapshot to be preserved and its timestamp shown. Require one behavior: whether
the last-good snapshot is always displayed with a stale warning or hidden.

The specification does not define:

- Retry, timeout, and backoff behavior for Jira 429, 5xx, or transient network
  errors.
- Whether one failed page/changelog request invalidates the whole refresh or
  permits a clearly marked partial report.
- How a failed refresh is exposed to the UI and operator, including the last
  successful time and a sanitized failure reason.
- What happens if a scheduled run overlaps a manual or previous run.
- When a successful snapshot becomes stale if no new run occurs.

These are required to make "reliable daily refresh" and "partial results MUST
NOT be presented as complete" testable.

### 10. Scheduler and container lifecycle

FR-019 requires Windows Task Scheduler, while the application and PostgreSQL
are containerized. It does not define the task command, whether the task starts
or reuses the Compose stack, how it waits for database readiness, or how task
exit codes/logs are made visible. Define the supported operator procedure and
ensure startup does not create overlapping refreshes or reset persistent data.

### 11. API and UI behavior

FR-016 requires a read-only HTTP/JSON API but does not define its route,
response schema, units/nullability, versioning, status codes, or error shape.
The frontend's loading, empty, stale, and API-unavailable states should have
testable behavior. Define which dashboard data is returned and whether
refresh status is part of the same response.

FR-013 names the dashboard sections but does not define table columns for the
at-risk table or the sort order of issue tables. It also does not specify
whether charts have equivalent textual data for screen readers.

### 12. Authorization and credential requirements

FR-021 requires authorized access but leaves the deployment mechanism open.
This is a release blocker because the dashboard contains sensitive issue
summaries and assignee information. Define the trust boundary, how the frontend
and API are protected, and whether all stakeholders have identical read-only
access. "In-app account management is not required" does not by itself ensure
the API is protected.

Specify the Jira service account's minimum permissions, token type/rotation
expectations, and which environment variables are mandatory. The source
`project_spec.md` calls for an unscoped token, which conflicts with the
constitution's least-privilege principle; choose a least-privilege credential
approach and reconcile the source document.

### 13. PostgreSQL data lifecycle

FR-017 says to persist the latest snapshot and minimum status/configuration but
does not define the schema, migration process, exact stored fields, backup
behavior, or deletion/retention policy for Jira issue data. The constitution
requires migrations and requires cached data to have a purpose, freshness,
retention, and deletion behavior. Specify how a successful snapshot and its
refresh status are committed atomically, and what happens to data on
reconfiguration or project removal.

### 14. External chart dependency

FR-015 requires Chart.js from a CDN, but does not identify a trusted CDN,
version pin, integrity protection, or content security policy. Specify the
approved source and fallback behavior. Confirm that no Jira data is sent to the
CDN and that tables remain functional when it is unavailable.

### 15. Operational and quality requirements

The constitution requires Docker Compose reproducibility, health/readiness
checks, structured redacted logs, migrations, and automated tests. The feature
specification does not define acceptance criteria for those requirements.
It also lacks measurable targets for refresh completion time, API/page
response time, expected issue volume, supported browsers, and accessibility.
Add targets or explicitly defer them with a stated rationale.

The Node.js version, Express major version, and deployment configuration are
also unspecified. These can be selected in the plan, but compatibility and
support requirements should be stated there before implementation.

## Internal Inconsistencies to Resolve

1. **Snapshot visibility**: User Story 1 says a last-good snapshot "may" remain
   visible after failure; FR-018 requires it to be preserved and its generation
   time shown. Make the intended UI behavior mandatory and consistent.
2. **Populated versus unavailable sections**: SC-001 says every section is
   populated from Jira, while the acceptance scenarios allow no snapshot and
   User Story 4 allows missing timing data. Define zero, unavailable, and
   partial-coverage states so "populated" does not imply fabricated values.
3. **Risk scope**: User Story 3 and FR-011 apply risk to open issues, but
   acceptance scenario 3 says "an issue." Use the same open-issue scope
   throughout.
4. **Legacy scope**: The original project specification excludes a live web app;
   this specification replaces that constraint. The replacement is stated, but
   it should be approved and the old requirement marked superseded rather than
   left as a competing source of truth.
5. **Credential privilege**: The original project specification requests an
   unscoped API token; the constitution requires the narrowest available
   permissions. The feature specification should state which rule governs.

## Decisions Needed Before Implementation

At minimum, resolve or explicitly accept the following:

1. Full-open-backlog query scope and team-roster/zero-open-member rules.
2. Reporting timezone and all window, stale, completion, and deadline boundaries.
3. Reopened-issue cycle-time semantics, completion date, and per-person
   assignee attribution.
4. Risk-rule exact boundaries, labels, and table presentation.
5. Jira API retry/rate-limit/partial-failure policy and snapshot freshness rule.
6. Scheduler-to-Compose lifecycle and manual refresh procedure.
7. API contract and authorized deployment mechanism.
8. Snapshot schema, retention/deletion policy, and least-privilege Jira
   credential.
9. Whether Confluence is a separate future feature or a required project
   capability.
10. Measurable operational, browser, and accessibility targets.

Until these are resolved, the specification is a useful product outline but
should not be treated as a complete implementation contract.
