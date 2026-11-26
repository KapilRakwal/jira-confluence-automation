import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [apiStatus, setApiStatus] = useState('Checking...')

  useEffect(() => {
    fetch('/api/v1/health/ready')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        return response.json()
      })
      .then(({ status }) =>
        setApiStatus(status === 'ready' ? 'Connected' : 'Unavailable'),
      )
      .catch(() => setApiStatus('Unavailable'))
  }, [])

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Team delivery</p>
          <h1>Workload dashboard</h1>
          <p className="subtitle">Team workload and delivery flow at a glance.</p>
        </div>
        <span className={`api-status ${apiStatus === 'Connected' ? 'online' : ''}`}>
          API: {apiStatus}
        </span>
      </header>
      <section className="empty-state" aria-labelledby="dashboard-content-title">
        <h2 id="dashboard-content-title">Dashboard data will appear here</h2>
        <p>
          The frontend and backend are connected. Jira data fetching and dashboard
          metrics can be added next.
        </p>
      </section>
    </main>
  )
}

export default App
