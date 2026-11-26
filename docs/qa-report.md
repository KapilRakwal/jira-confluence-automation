# QA Report

**Application:** Team Workload Dashboard  
**Test date:** 2026-11-26  
**Environment:** Local Docker Compose stack; Chrome

## Summary

The application starts and serves its dashboard page. The only accessible
application page is the root dashboard. Its frontend and API connectivity
checks work, but the dashboard has no published Jira snapshot, so the main
data view remains unavailable. No forms, submit buttons, or navigation links
were present to exercise.

## Pages visited

| Page | Result |
| --- | --- |
| `http://localhost:8080/` | Loaded successfully (HTTP 200). No other application pages or navigation routes were exposed by the UI. |

A full-page screenshot of the root page was captured during testing. The
dashboard showed its empty-data state.

## Elements inspected

Visible on the root page:

- “TEAM DELIVERY” label
- “Workload dashboard” page heading
- “No successful Jira refresh has published a dashboard yet.” status text
- “API: Connected” status badge
- “Dashboard data is not ready” region and heading
- “Run the configured refresh after Jira access and the read-only account are set up.” guidance

No buttons, links, or forms were visible. Consequently, there was no form
submission flow to complete.

## Checks and results

| Check | Result |
| --- | --- |
| Docker Compose configuration validation | Passed with `.env.example`. |
| Build and startup | Passed. Database and backend reported healthy; frontend container was running. |
| Frontend root page | HTTP 200. |
| Backend live health endpoint | HTTP 200 via the frontend proxy. |
| Backend ready health endpoint | HTTP 200 via the frontend proxy. |
| Frontend JavaScript and CSS assets | HTTP 200. |
| Chart.js CDN asset | HTTP 200. |
| Favicon | HTTP 200. |
| `GET /api/v1/dashboard` | HTTP 503; response code `DASHBOARD_NOT_READY`. |
| Browser console | One resource error corresponding to the dashboard API's HTTP 503. |
| Forms and submit action | Not applicable; none are present on the page. |

## Findings

### Dashboard snapshot unavailable

`GET /api/v1/dashboard` returned HTTP 503 with
`DASHBOARD_NOT_READY` (“A dashboard snapshot is not available yet.”). The UI
handled this by showing its “Dashboard data is not ready” state. No successful
Jira refresh had published data during testing. This is a functional blocker
for validating populated dashboard metrics, but the observed response matches
the application's no-snapshot behavior.

### Local configuration required for a live refresh

Compose could not initially resolve required settings from the existing `.env`.
The stack was started using the documented `.env.example` placeholder
configuration instead. The existing `.env` was not modified. A live Jira
refresh and populated-dashboard verification therefore remain untested and
require valid Jira access configuration followed by a successful refresh.

## Fixes and changes applied

- Corrected `.vscode/mcp.json` to valid JSON and placed the `echo-windows`,
  `chrome-devtools`, and GitHub servers within the `servers` object.
- Validated that the MCP configuration parses and exposes all three server
  entries.
- Started the local Compose services using `.env.example`; this was an
  environment/startup action, not an application-code fix.
- No application source code was changed during QA.

## Current status

- **Frontend and backend availability:** Passed at the time of testing.
- **Dashboard page and empty-state rendering:** Passed.
- **Populated dashboard and Jira refresh flow:** Blocked pending valid Jira
  configuration and a successful initial refresh.
- **Form/submit workflow:** Not present in the current UI and not testable.
- **Confirmed application UI defects:** None observed in the tested empty-data
  state.
