# Calculator

This project provides a `multiply()` function and a small program that demonstrates it.

## `multiply(a, b)`

Multiplies two numbers and returns their product.

- `a` (`float`): the first number
- `b` (`float`): the second number
- Returns (`float`): `a * b`

Example:

```python
from calculator import multiply

product = multiply(6, 7)
print(product)  # 42
```

Run the demonstration program with:

```bash
python main.py
```

## Team Workload Dashboard

The frontend uses React 18 and Vite. The backend uses Express 5 on Node.js 24
LTS and PostgreSQL 15. To run locally with placeholder configuration without
editing an existing `.env`, use:

```bash
docker compose --env-file .env.example up --build
```

To use a local `.env`, copy `.env.example` only if no `.env` already exists,
then set the Atlassian site, email, read-only token, PostgreSQL password, and
matching `DATABASE_URL`. Merge the required keys into an existing `.env`
without overwriting its contents. Keep real secrets in `.env`; never commit it.

Start the database, backend, and frontend with Docker Compose:

```bash
docker compose up --build
```

Open <http://localhost:8080>. The dashboard reads data only from the backend
API. It presents project summary metrics, workload and throughput charts with
equivalent data tables, timing coverage, at-risk work, and the complete open
issue list. If no refresh has succeeded, the UI shows a clear no-snapshot
state; `GET /api/v1/dashboard` returns `DASHBOARD_NOT_READY` until the first
snapshot is published. Jira retrieval and dashboard calculations are
implemented, but a live refresh requires provisioned read-only Jira access and
deployment configuration.

Chart.js is pinned with Subresource Integrity and loaded from jsDelivr. Jira
issue data is not sent to the CDN, and the equivalent tables remain available
if the chart library cannot load.

Health endpoints:

- <http://localhost:8080/api/v1/health/live>
- <http://localhost:8080/api/v1/health/ready>
- <http://localhost:8080/api/v1/dashboard>

The backend runs the idempotent migration command before serving requests.
Normal shutdown preserves the named PostgreSQL volume:

```bash
docker compose down
```

Run a manual refresh with the same wrapper intended for daily scheduling:

```powershell
.\scripts\refresh.ps1
```

The wrapper starts PostgreSQL, waits for database readiness, applies migrations,
and runs `npm run refresh`. It preserves the Compose volume and returns a
non-zero exit code if any step fails. A dedicated Jira read-only account and
deployment `.env` values are required for a live refresh.

For Windows Task Scheduler, create a daily task at 08:00 in
`REPORTING_TIME_ZONE` (default `Asia/Kolkata`):

- Program: `powershell.exe`
- Arguments:

  ```powershell
  -NoProfile -ExecutionPolicy Bypass -File "<project>\scripts\refresh.ps1"
  ```

- Start in: the project root.

Capture task history/output and configure the task not to start a new instance
while one is already running; the PostgreSQL advisory lock is the final
concurrency guard. The scheduled task must run under an account that can access
Docker and the deployment `.env`.

When a Jira project is decommissioned, stop its scheduled refresh and remove
only that project's cached snapshot and refresh state. Run this command with
the exact key configured as `JIRA_PROJECT`:

```powershell
docker compose run --rm backend npm run decommission -- --confirm SCRUM
```

The command requires the `--confirm` flag and matching project key, uses the
backend database configuration, and does not remove the PostgreSQL volume or
other projects' data.

For local checks outside Compose, run `npm ci` once in each package directory.
Then run `npm test`, `npm run lint`, and `npm run build` in `frontend/`; run
`npm test` and `npm run lint` in `backend/`. The backend also supports
`npm run migrate` and `npm start`. Since the backend is plain JavaScript and
has no compile step, `docker compose build backend` builds its production
image.
