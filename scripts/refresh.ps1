$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  if (-not (Test-Path -LiteralPath '.env')) {
    throw 'Create .env from .env.example and configure the required values first.'
  }

  & docker compose --env-file .env up -d database
  if ($LASTEXITCODE -ne 0) {
    throw "Starting PostgreSQL failed with exit code $LASTEXITCODE."
  }

  $databaseReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    & docker compose --env-file .env exec -T database sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    if ($LASTEXITCODE -eq 0) {
      $databaseReady = $true
      break
    }

    Start-Sleep -Seconds 2
  }

  if (-not $databaseReady) {
    throw 'PostgreSQL did not become ready within 60 seconds.'
  }

  & docker compose --env-file .env run --rm backend npm run migrate
  if ($LASTEXITCODE -ne 0) {
    throw "Database migration failed with exit code $LASTEXITCODE."
  }

  & docker compose --env-file .env run --rm backend npm run refresh
  if ($LASTEXITCODE -ne 0) {
    throw "Dashboard refresh failed with exit code $LASTEXITCODE."
  }
} catch {
  Write-Error $_
  exit 1
} finally {
  Pop-Location
}
