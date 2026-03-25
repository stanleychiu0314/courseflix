#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_SERVICE="${COURSEFLIX_DB_SERVICE:-db}"
DB_NAME="${COURSEFLIX_DB_NAME:-courseflix}"
DB_USER="${COURSEFLIX_DB_USER:-courseflix}"
PLAYWRIGHT_TEST_TOKEN="${PLAYWRIGHT_TEST_TOKEN:-e2e-ci-token}"
ADMIN_EMAILS="${ADMIN_EMAILS:-admin@vanderbilt.edu}"

cd "$ROOT_DIR"

npm ci --prefix server
npm ci --prefix client

npm run lint --prefix client
npm run build --prefix client
npm test --prefix client
npm test --prefix server

docker compose down -v
docker compose up -d "$DB_SERVICE"

for _ in {1..30}; do
  if docker compose exec -T "$DB_SERVICE" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose cp db/schemav2.sql "$DB_SERVICE:/tmp/schemav2.sql"
docker compose cp db/e2e-seed.sql "$DB_SERVICE:/tmp/e2e-seed.sql"
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/schemav2.sql
docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/e2e-seed.sql

cd "$ROOT_DIR/client"
npx playwright install --with-deps chromium
PLAYWRIGHT_TEST_TOKEN="$PLAYWRIGHT_TEST_TOKEN" \
POSTGRES_HOST=localhost \
ADMIN_EMAILS="$ADMIN_EMAILS" \
npm run e2e
