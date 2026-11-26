import { useEffect, useRef, useState } from 'react'
import './App.css'

function isCount(value) {
  return Number.isInteger(value) && value >= 0
}

function isOptionalNumber(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isCoverage(value) {
  return Boolean(
    value &&
      isCount(value.eligibleIssues) &&
      isCount(value.includedIssues) &&
      isCount(value.excludedIssues) &&
      value.includedIssues + value.excludedIssues === value.eligibleIssues,
  )
}

function isDashboard(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.projectKey === 'string' &&
      typeof value.generatedAt === 'string' &&
      Number.isFinite(Date.parse(value.generatedAt)) &&
      typeof value.asOfAt === 'string' &&
      Number.isFinite(Date.parse(value.asOfAt)) &&
      value.reportingWindow &&
      typeof value.reportingWindow.start === 'string' &&
      Number.isFinite(Date.parse(value.reportingWindow.start)) &&
      value.reportingWindow.end === value.asOfAt &&
      typeof value.reportingWindow.timeZone === 'string' &&
      Number.isInteger(value.reportingWindow.days) &&
      value.deadline &&
      typeof value.deadline.date === 'string' &&
      Number.isInteger(value.deadline.daysRemaining) &&
      value.summary &&
      isCount(value.summary.openCount) &&
      isCount(value.summary.completedCount) &&
      isCount(value.summary.atRiskCount) &&
      isOptionalNumber(value.summary.averageOpenIssueCount) &&
      isOptionalNumber(value.summary.medianCycleTimeDays) &&
      isOptionalNumber(value.summary.medianLeadTimeDays) &&
      isCount(value.summary.cycleTimeIncludedIssues) &&
      isCount(value.summary.cycleTimeExcludedIssues) &&
      isCount(value.summary.leadTimeIncludedIssues) &&
      isCount(value.summary.leadTimeExcludedIssues) &&
      Array.isArray(value.workload) &&
      value.workload.every(
        (person) =>
          typeof person.assigneeName === 'string' &&
          isCount(person.openIssueCount),
      ) &&
      Array.isArray(value.throughput) &&
      value.throughput.every(
        (day) =>
          typeof day.date === 'string' && isCount(day.completionCount),
      ) &&
      Array.isArray(value.cycleTimeByAssignee) &&
      value.cycleTimeByAssignee.every(
        (person) =>
          typeof person.assigneeName === 'string' &&
          isOptionalNumber(person.averageDays) &&
          isCount(person.sampleCount),
      ) &&
      Array.isArray(value.atRiskIssues) &&
      value.atRiskIssues.every(
        (issue) =>
          typeof issue.key === 'string' &&
          typeof issue.summary === 'string' &&
          typeof issue.assigneeName === 'string' &&
          typeof issue.status === 'string' &&
          typeof issue.priority === 'string' &&
          (issue.dueDate === null || typeof issue.dueDate === 'string') &&
          (issue.updatedAt === null || typeof issue.updatedAt === 'string') &&
          Array.isArray(issue.reasons) &&
          issue.reasons.every((reason) => typeof reason === 'string'),
      ) &&
      Array.isArray(value.openIssues) &&
      value.openIssues.every(
        (issue) =>
          typeof issue.key === 'string' &&
          typeof issue.summary === 'string' &&
          typeof issue.assigneeName === 'string' &&
          typeof issue.status === 'string' &&
          isOptionalNumber(issue.daysInStatus) &&
          (issue.dueDate === null || typeof issue.dueDate === 'string'),
      ) &&
      value.dataQuality &&
      isCoverage(value.dataQuality.cycleTime) &&
      isCoverage(value.dataQuality.leadTime) &&
      isCoverage(value.dataQuality.assigneeAttribution) &&
      value.refreshStatus &&
      ['success', 'failed'].includes(value.refreshStatus.state) &&
      typeof value.refreshStatus.lastAttemptAt === 'string' &&
      Number.isFinite(Date.parse(value.refreshStatus.lastAttemptAt)) &&
      (value.refreshStatus.lastSuccessAt === null ||
        (typeof value.refreshStatus.lastSuccessAt === 'string' &&
          Number.isFinite(Date.parse(value.refreshStatus.lastSuccessAt)))) &&
      (value.refreshStatus.errorCode === null ||
        typeof value.refreshStatus.errorCode === 'string'),
  )
}

function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

function snapshotAge(value, now) {
  const ageMs = Math.max(0, now - new Date(value).valueOf())
  const hours = Math.floor(ageMs / 3_600_000)

  if (hours < 1) {
    return 'Less than 1 hour old'
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} old`
  }

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} old`
}

function formatDays(value) {
  return value === null || value === undefined
    ? 'No data'
    : `${Number(value).toFixed(1)} days`
}

function ChartPanel({
  title,
  labels,
  values,
  valueLabel,
  tableCaption,
  average,
}) {
  const canvasRef = useRef(null)
  const [chartAvailable, setChartAvailable] = useState(false)

  useEffect(() => {
    const ChartConstructor = globalThis.Chart
    if (typeof ChartConstructor !== 'function' || !canvasRef.current) {
      setChartAvailable(false)
      return undefined
    }

    const chart = new ChartConstructor(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: valueLabel,
          data: values,
          backgroundColor: values.map((value) =>
            average !== null && value > average ? '#a34021' : '#176b87',
          ),
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
          },
        },
      },
    })
    setChartAvailable(true)

    return () => chart.destroy()
  }, [average, labels, valueLabel, values])

  return (
    <section className="panel chart-panel" aria-labelledby={`${tableCaption}-heading`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Trend</p>
          <h2 id={`${tableCaption}-heading`}>{title}</h2>
        </div>
      </div>
      <div
        className="chart-frame"
        role="img"
        aria-label={`${title} bar chart. The data is also available in the table below.`}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
      {!chartAvailable && (
        <p className="chart-fallback" role="status">
          Chart unavailable. The values remain available in the table below.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <caption>{tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">Date or assignee</th>
              <th scope="col">{valueLabel}</th>
              {average !== null && <th scope="col">Comparison</th>}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, index) => (
              <tr key={`${label}-${index}`}>
                <th scope="row">{label}</th>
                <td>{values[index]}</td>
                {average !== null && (
                  <td>
                    {values[index] > average
                      ? 'Above average'
                      : 'At or below average'}
                  </td>
                )}
              </tr>
            ))}
            {labels.length === 0 && (
              <tr>
                <td colSpan={average === null ? 2 : 3}>No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <h2>{label}</h2>
      <p className="metric-value">{value}</p>
      {detail && <p className="metric-detail">{detail}</p>}
    </article>
  )
}

function CoverageTable({ dashboard }) {
  const rows = [
    {
      name: 'Cycle time',
      median: dashboard.summary.medianCycleTimeDays,
      quality: dashboard.dataQuality.cycleTime,
    },
    {
      name: 'Lead time',
      median: dashboard.summary.medianLeadTimeDays,
      quality: dashboard.dataQuality.leadTime,
    },
    {
      name: 'Assignee at resolution',
      median: null,
      quality: dashboard.dataQuality.assigneeAttribution,
    },
  ]

  return (
    <div className="table-wrap">
      <table>
        <caption>Timing metrics and evidence coverage</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Median</th>
            <th scope="col">Eligible</th>
            <th scope="col">Included</th>
            <th scope="col">Excluded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ name, median, quality }) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{median === null ? 'No data' : formatDays(median)}</td>
              <td>{quality.eligibleIssues}</td>
              <td>{quality.includedIssues}</td>
              <td>{quality.excludedIssues}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RiskTable({ issues }) {
  return (
    <div className="table-wrap">
      <table>
        <caption>Open issues matching one or more risk rules</caption>
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Summary</th>
            <th scope="col">Assignee</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Due date</th>
            <th scope="col">Last updated</th>
            <th scope="col">Risk reasons</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.key}>
              <th scope="row">{issue.key}</th>
              <td>{issue.summary}</td>
              <td>{issue.assigneeName}</td>
              <td>{issue.status}</td>
              <td>{issue.priority}</td>
              <td>{issue.dueDate ?? 'Unavailable'}</td>
              <td>{issue.updatedAt ? formatDateTime(issue.updatedAt, 'UTC') : 'Unavailable'}</td>
              <td>
                <ul className="reason-list">
                  {issue.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr><td colSpan="8">No at-risk open issues.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function OpenIssuesTable({ issues }) {
  return (
    <div className="table-wrap">
      <table>
        <caption>All open issues, ordered by issue key</caption>
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Summary</th>
            <th scope="col">Assignee</th>
            <th scope="col">Status</th>
            <th scope="col">Days in status</th>
            <th scope="col">Due date</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.key}>
              <th scope="row">{issue.key}</th>
              <td>{issue.summary}</td>
              <td>{issue.assigneeName}</td>
              <td>{issue.status}</td>
              <td>{issue.daysInStatus === null ? 'Unavailable' : formatDays(issue.daysInStatus)}</td>
              <td>{issue.dueDate ?? 'Unavailable'}</td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr><td colSpan="6">No open issues.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Dashboard({ data, loadedAt }) {
  const timeZone = data.reportingWindow.timeZone
  const age = snapshotAge(data.generatedAt, loadedAt)
  const isStale = loadedAt - new Date(data.generatedAt).valueOf() > 86_400_000
  const workloadAverage = data.summary.averageOpenIssueCount ?? null
  const deadlineLabel = data.deadline.daysRemaining < 0
    ? `${Math.abs(data.deadline.daysRemaining)} days overdue`
    : data.deadline.daysRemaining === 0
      ? 'Due today'
      : `${data.deadline.daysRemaining} days remaining`

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Team delivery</p>
          <h1>Workload dashboard</h1>
          <p className="subtitle">
            Project {data.projectKey} · Snapshot {formatDateTime(data.generatedAt, timeZone)} · {age}
          </p>
        </div>
        <span className="api-status online">API: Connected</span>
      </header>

      {data.refreshStatus.state === 'failed' && (
        <div className="notice notice-error" role="alert">
          <strong>Latest refresh failed.</strong>
          {' '}Showing the last successful snapshot.
          {data.refreshStatus.errorCode && (
            <span> Error code: {data.refreshStatus.errorCode}.</span>
          )}
        </div>
      )}
      {isStale && (
        <div className="notice notice-warning" role="status">
          This snapshot is more than 24 hours old.
        </div>
      )}

      <section className="metric-grid" aria-label="Project summary">
        <MetricCard label="Open issues" value={data.summary.openCount} />
        <MetricCard label="Completed in window" value={data.summary.completedCount} />
        <MetricCard label="At risk" value={data.summary.atRiskCount} />
        <MetricCard
          label="Median cycle time"
          value={formatDays(data.summary.medianCycleTimeDays)}
        />
        <MetricCard
          label="Median lead time"
          value={formatDays(data.summary.medianLeadTimeDays)}
        />
        <MetricCard
          label="Deadline"
          value={deadlineLabel}
          detail={data.deadline.date}
        />
      </section>

      <section className="panel" aria-labelledby="reporting-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Reporting period</p>
            <h2 id="reporting-heading">Window and refresh</h2>
          </div>
        </div>
        <dl className="metadata-grid">
          <div><dt>Window start</dt><dd>{formatDateTime(data.reportingWindow.start, timeZone)}</dd></div>
          <div><dt>As of</dt><dd>{formatDateTime(data.asOfAt, timeZone)}</dd></div>
          <div><dt>Timezone</dt><dd>{timeZone}</dd></div>
          <div><dt>Latest attempt</dt><dd>{formatDateTime(data.refreshStatus.lastAttemptAt, timeZone)}</dd></div>
        </dl>
      </section>

      <div className="chart-grid">
        <ChartPanel
          title="Current workload"
          labels={data.workload.map((person) => person.assigneeName)}
          values={data.workload.map((person) => person.openIssueCount)}
          valueLabel="Open issues"
          tableCaption="Current open issues by assignee"
          average={workloadAverage}
        />
        <ChartPanel
          title="Daily throughput"
          labels={data.throughput.map((day) => day.date)}
          values={data.throughput.map((day) => day.completionCount)}
          valueLabel="Completed issues"
          tableCaption="Completed issues by local calendar date"
          average={null}
        />
      </div>

      <section className="panel" aria-labelledby="timing-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Cycle and lead time</p>
            <h2 id="timing-heading">Timing and data coverage</h2>
          </div>
        </div>
        <CoverageTable dashboard={data} />
        <div className="table-wrap secondary-table">
          <table>
            <caption>Cycle time average by assignee</caption>
            <thead>
              <tr>
                <th scope="col">Assignee</th>
                <th scope="col">Average cycle time</th>
                <th scope="col">Samples</th>
              </tr>
            </thead>
            <tbody>
              {data.cycleTimeByAssignee.map((person) => (
                <tr key={person.assigneeName}>
                  <th scope="row">{person.assigneeName}</th>
                  <td>{formatDays(person.averageDays)}</td>
                  <td>{person.sampleCount}</td>
                </tr>
              ))}
              {data.cycleTimeByAssignee.length === 0 && (
                <tr><td colSpan="3">No attributed cycle-time data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="risk-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Needs attention</p>
            <h2 id="risk-heading">At-risk open issues</h2>
          </div>
        </div>
        <RiskTable issues={data.atRiskIssues} />
      </section>

      <section className="panel" aria-labelledby="open-issues-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Current work</p>
            <h2 id="open-issues-heading">Open issues</h2>
          </div>
        </div>
        <OpenIssuesTable issues={data.openIssues} />
      </section>
    </main>
  )
}

function App() {
  const [view, setView] = useState({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/v1/dashboard', { signal: controller.signal })
      .then(async (response) => {
        let body
        try {
          body = await response.json()
        } catch {
          throw new Error('Invalid dashboard response')
        }

        if (
          response.status === 503 &&
          body?.error?.code === 'DASHBOARD_NOT_READY'
        ) {
          setView({ status: 'empty' })
          return
        }
        if (!response.ok || !isDashboard(body)) {
          setView({ status: 'unavailable' })
          return
        }

        setView({ status: 'loaded', data: body, loadedAt: Date.now() })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setView({ status: 'unavailable' })
        }
      })

    return () => controller.abort()
  }, [])

  if (view.status === 'loading') {
    return (
      <main className="dashboard">
        <p className="eyebrow">Team delivery</p>
        <h1>Workload dashboard</h1>
        <p role="status">Loading dashboard data…</p>
      </main>
    )
  }

  if (view.status === 'empty') {
    return (
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Team delivery</p>
            <h1>Workload dashboard</h1>
            <p className="subtitle">No successful Jira refresh has published a dashboard yet.</p>
          </div>
          <span className="api-status online">API: Connected</span>
        </header>
        <section className="empty-state" aria-labelledby="dashboard-content-title">
          <h2 id="dashboard-content-title">Dashboard data is not ready</h2>
          <p>Run the configured refresh after Jira access and the read-only account are set up.</p>
        </section>
      </main>
    )
  }

  if (view.status === 'unavailable') {
    return (
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Team delivery</p>
            <h1>Workload dashboard</h1>
          </div>
          <span className="api-status">API: Unavailable</span>
        </header>
        <section className="empty-state" role="alert">
          <h2>Dashboard unavailable</h2>
          <p>The dashboard service could not provide valid data. Try again later.</p>
        </section>
      </main>
    )
  }

  return <Dashboard data={view.data} loadedAt={view.loadedAt} />
}

export default App
