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
LTS and PostgreSQL 15. For a placeholder-only scaffold run that does not edit
an existing `.env`, use:

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

Open <http://localhost:8080>. The starter UI checks backend readiness. Jira
data fetching and dashboard metrics are not implemented yet.

Health endpoints:

- <http://localhost:8080/api/v1/health/live>
- <http://localhost:8080/api/v1/health/ready>

The backend runs the idempotent migration command before serving requests.
Normal shutdown preserves the named PostgreSQL volume:

```bash
docker compose down
```

For local checks outside Compose, run `npm ci` once in each package directory.
Then run `npm test`, `npm run lint`, and `npm run build` in `frontend/`; run
`npm test` and `npm run lint` in `backend/`. The backend also supports
`npm run migrate` and `npm start`. Since the backend is plain JavaScript and
has no compile step, `docker compose build backend` builds its production
image.
