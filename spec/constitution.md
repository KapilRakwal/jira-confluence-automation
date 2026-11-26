# Project Constitution

**Version:** 1.0  
**Ratified:** 2026-11-26  
**Scope:** Jira and Confluence automation application

This constitution defines the engineering principles that every feature specification,
implementation plan, and code change in this project must follow. Feature specifications
may add requirements but must not silently weaken these principles.

## I. Specifications Define Behavior

- Every feature begins with a clear user need, intended outcome, and measurable
  acceptance criteria.
- Specifications must identify the Jira or Confluence data involved, whether an
  operation reads or writes data, and expected behavior for authorization, rate
  limits, partial failures, and unavailable services.
- Implementations must not invent business rules or side effects that are absent
  from the approved specification. Resolve material ambiguity before implementation.

## II. Use the Approved Technology Stack

- The frontend MUST use React 18 with Vite.
- The backend MUST use Node.js with Express.
- PostgreSQL 15 MUST be the relational database and run through Docker for
  development and local integration testing.
- The browser MUST communicate with the backend through documented HTTP/JSON API
  contracts. It MUST NOT connect directly to Jira, Confluence, or PostgreSQL.
- Changes to these foundational technologies require an explicit constitution
  amendment and an impact review.

## III. Protect Integrations and Their Data

- Jira and Confluence credentials MUST remain server-side, be supplied through
  environment-based secret configuration, and never be committed, logged, or exposed
  in frontend bundles or API responses.
- Use the narrowest available permissions and request only the data required by the
  feature.
- Integrations are read-only by default. A feature that writes to Jira or Confluence
  MUST explicitly define the permitted operations, target scope, authorization,
  failure handling, and audit requirements.
- Destructive or bulk changes MUST have an explicit safeguard, such as a preview and
  confirmation step, unless the approved specification documents a safe unattended
  workflow.
- Do not send project data to third-party services unless the feature specification
  explicitly authorizes that data flow.

## IV. Preserve Data Integrity and Minimize Persistence

- PostgreSQL schemas MUST use migrations and enforce appropriate constraints,
  relationships, and transaction boundaries.
- Persist only data needed for an approved feature. Specifications that introduce
  cached or historical Jira/Confluence data MUST define its purpose, freshness,
  retention, and deletion behavior.
- Repeated automation runs MUST avoid unintended duplicate or contradictory effects.
  Write operations, when approved, should be idempotent where the external API allows.
- Failures MUST be visible and actionable; partial results MUST NOT be presented as
  complete or successful.

## V. Keep Responsibilities Clear

- React components are responsible for presentation and user interaction; backend
  services own business rules, integration calls, and data access.
- Express routes validate requests and delegate work to services. Jira and
  Confluence clients, business logic, and PostgreSQL access should remain separable
  and independently testable.
- API inputs and outputs MUST be validated and documented. Errors returned to users
  must be useful without disclosing credentials, internal stack traces, or sensitive
  project data.

## VI. Verify Behavior with Tests

- Business rules and data transformations MUST have focused automated tests.
- API and database behavior MUST be covered with integration tests where practical.
- Tests MUST use fixtures, mocks, or isolated test data; they MUST NOT depend on
  production credentials or modify real Jira/Confluence workspaces.
- Changes are complete only when their acceptance criteria are verified and relevant
  checks pass. Any unverified behavior or known limitation must be stated explicitly.

## VII. Make Development and Operations Reproducible

- Local development and integration dependencies MUST be runnable through the
  repository's Docker Compose setup.
- Required configuration MUST be documented in an example environment file with
  placeholders only; real secrets remain outside version control.
- Services MUST provide useful health/readiness checks and structured, appropriately
  redacted logs for operational failures.
- Database schema changes MUST be repeatable through committed migrations; startup
  must not silently discard or reset persistent data.

## Governance

- The constitution applies to all project features and supersedes conflicting
  implementation shortcuts.
- A feature specification or implementation plan that conflicts with this document
  must identify the conflict and request an explicit amendment before proceeding.
- Amendments MUST be versioned and include the reason, affected principles, and
  impact on existing specifications and implementations.
