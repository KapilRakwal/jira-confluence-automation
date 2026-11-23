# Implementation Backlog — Team Workload & Delivery Dashboard

Derived from [project_spec.md](./project_spec.md) · Prioritization: full-spec order (§11)
**P0 (must-have):** workload table + chart · at-risk items table · cycle time · lead time
POC deadline: **2026-11-30**

---

## Phase 1 — Setup

- [ ] Create `dashboard/` folder with `output/` subfolder
- [ ] Create `.env.example` with `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_TOKEN`, `JIRA_PROJECT`, `WINDOW_DAYS`, `STALE_DAYS`, `POC_DEADLINE`
- [ ] Create `.gitignore` covering `.env`, `output/`, `__pycache__/`
- [ ] Copy `.env.example` → `.env` and fill in real credentials (fresh unscoped API token)
- [ ] Scaffold `dashboard.py` with config loader (`.env` parsing, fail fast on missing keys)
- [ ] Verify auth works: smoke-call `/rest/api/3/myself` and print the account name

## Phase 2 — Core Features

### Jira data fetch
- [ ] Implement `jira_search()` against `/rest/api/3/search/jql` with fallback to legacy `/rest/api/3/search`
- [ ] Request fields: summary, status, assignee, priority, created, updated, duedate, resolutiondate
- [ ] Fetch changelog per issue (`expand=changelog`) for status-transition timestamps
- [ ] Handle pagination (`nextPageToken` / `startAt`) for >100 issues
- [ ] Build the two base queries: open issues (`statusCategory != Done`) and completed-in-window (`resolved >= -14d`)

### Metric computation (P0)
- [ ] Workload: count open issues grouped by assignee, with "Unassigned" as its own bucket
- [ ] Cycle time: first transition into *In Progress* category → transition into *Done*, per completed issue; compute per-person average and team median
- [ ] Lead time: `created` → `resolutiondate` per completed issue; compute team median
- [ ] Risk rules: flag issues that are (a) stale ≥ `STALE_DAYS`, (b) High/Highest priority and not Done, (c) due date past or after `POC_DEADLINE`; record the reason(s) per issue
- [ ] Days-in-current-status per open issue (from changelog)
- [ ] Throughput: issues completed per day across the window

### HTML rendering
- [ ] Page skeleton: inline CSS, header with project name, generation timestamp, countdown to `POC_DEADLINE`
- [ ] Summary cards: total open, completed in window, median cycle time, median lead time, at-risk count
- [ ] Workload horizontal bar chart (Chart.js via CDN), highlight assignees above team average (P0)
- [ ] At-risk items table with highlighted rows and reason column (P0)
- [ ] Cycle/lead time table: per-person averages + team median (P0)
- [ ] Throughput chart: completed per day (Chart.js)
- [ ] Full open-work table: key, summary, assignee, status, days in status, due date — keys linked to Jira
- [ ] Offline fallback note when Chart.js CDN is unreachable (tables must render regardless)
- [ ] HTML-escape all Jira-sourced text

## Phase 3 — Integration

- [ ] Atomic write to `output/dashboard.html` (write temp file, then replace)
- [ ] Clear non-zero exit with readable message on auth/network failure
- [ ] `schedule_task.ps1`: register Windows scheduled task, daily 08:00, working directory set
- [ ] Register the task and confirm it appears in Task Scheduler
- [ ] Trigger the task manually (`Start-ScheduledTask`) and confirm output file is overwritten
- [ ] Share test: open `output/dashboard.html` from the shared location/link a stakeholder would use

## Phase 4 — Testing

- [ ] Unit tests for cycle time (incl. issue that skips In Progress, reopened issue, no transitions)
- [ ] Unit tests for lead time (incl. missing `resolutiondate`)
- [ ] Unit tests for workload grouping (incl. unassigned issues)
- [ ] Unit tests for risk rules (stale boundary at exactly `STALE_DAYS`, deadline-breach due date, multiple reasons on one issue)
- [ ] Run test suite green (`python -m pytest`)
- [ ] Manual E2E against live SCRUM project: verify every §6 section renders with real data
- [ ] Manual check of acceptance criteria §10.1–10.6 and tick them off in the spec

## Phase 5 — Documentation

- [ ] `README.md` in `dashboard/`: setup, `.env` configuration, manual run, scheduling, troubleshooting (401, CDN offline)
- [ ] Document how stakeholders access the dashboard (path/link + refresh behavior)
- [ ] Note the spec's open questions (§12) as resolved/pending with answers
- [ ] Commit dashboard code + docs to the repo (never `.env`)
