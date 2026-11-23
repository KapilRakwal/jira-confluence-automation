- Accept Jira fetch requests in this format:
  + `project_key`: Jira project key; default to `JIRA_PROJECT`, or `SCRUM`.
  + `window`: `last N days` or explicit `start_date` and `end_date` in `YYYY-MM-DD`; default to `WINDOW_DAYS`, or 14 days.
  + `scope`: `open`, `completed`, or `all`; default to `all`.
  + `fields`: optional Jira fields; default to `summary`, `status`, `assignee`, `priority`, `created`, `updated`, `duedate`, and `resolutiondate`.
  + `jql`: optional additional Jira filter; preserve the requested project and date scope.
- Load `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_TOKEN` from environment or the local `.env`; never print or return credentials.
- Reject missing credentials, invalid project keys, invalid date ranges, and unsupported scopes with a clear error; do not make a request with an empty or broadened filter.
- Build Jira REST API v3 JQL for the requested project and scope; parenthesize optional `jql` and combine it with `AND` so it cannot override the project or scope.
  + `open`: fetch all issues where `statusCategory != Done`; do not restrict workload to recently updated issues.
  + `completed`: fetch issues where `statusCategory = Done` and resolution falls within the requested window.
  + `all`: fetch both sets and deduplicate by issue key; open issues are not limited by the reporting window.
- Keep requests read-only.
- Query `/rest/api/3/search/jql`; fall back to `/rest/api/3/search` only when the new endpoint returns 404.
- Request the specified fields and fetch changelog data for completed issues when status-transition timing is needed; use transition timestamps rather than issue creation dates for cycle time.
- Follow `nextPageToken` or `startAt` pagination until all matching issues are collected; do not treat a partial page as a complete result.
- Check HTTP status and API errors explicitly; report authentication, permission, rate-limit, and network failures without returning partial data as success.
- Normalize Jira issues without dropping `null` values or changing status names; represent missing assignees as `Unassigned` in workload summaries.
- Return one UTF-8 JSON object with `project_key` (string), `window` (`start_date` and `end_date`, `YYYY-MM-DD`), `fetched_at` (UTC ISO 8601), `issue_count` (integer), and `issues` (array).
- Include each issue's `key`, `summary`, `status`, `assignee`, `priority`, `created`, `updated`, `due_date`, and `resolution_date`; include normalized status transitions when changelog data was requested.
- Keep output valid UTF-8 JSON, escape Jira-sourced text when embedding it in HTML, and state the applied project/window/scope when presenting a human-readable summary.
- Never write credentials into output, logs, generated files, or version control; share Jira-derived issue data only with authorized project stakeholders.
