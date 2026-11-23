# Project Ideas: Jira / Confluence Automation for Managers

## 1. Weekly Sprint Status Report in Confluence

**Problem:** Managers spend time every week gathering sprint progress from Jira boards and writing it up by hand. Reports are inconsistent and often late.

**What it does:** Automatically builds a Confluence page each week summarizing sprint progress, blockers, and carry-over work.

**Data needed:**
- Jira: active sprint, issues with status, assignee, story points, priority, and flagged/blocked labels
- Jira: sprint start/end dates and completed vs. planned points
- Confluence: target space and parent page for publishing

## 2. Stale and At-Risk Ticket Alerts

**Problem:** Tickets sit in "In Progress" or "In Review" for days without updates, and overdue items are noticed too late. Managers find out about slipping work only at the end of the sprint.

**What it does:** Runs daily, finds tickets that haven't changed in N days, are past their due date, or are unassigned, and sends the manager a digest (email or Slack) grouped by person.

**Data needed:**
- Jira: issue key, summary, status, assignee, due date, last updated timestamp, and time in current status
- Jira: JQL filters per project or team (for example `status = "In Progress" AND updated <= -5d`)
- Notification target: manager email or Slack webhook

## 3. Team Workload and Delivery Dashboard

**Problem:** It is hard to see who is overloaded, how long work takes, and whether delivery is improving. Managers rely on gut feeling for staffing and planning.

**What it does:** Aggregates Jira data into metrics (open issues per person, cycle time, throughput, bug vs. feature ratio) and publishes them to a Confluence page that refreshes on a schedule.

**Data needed:**
- Jira: issues with assignee, issue type, created/resolved dates, status transition history (changelog), and story points
- Jira: team membership or a list of account IDs to include
- Confluence: a page to update, using the page ID and its current version number
