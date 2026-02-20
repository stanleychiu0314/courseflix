#!/usr/bin/env bash
set -euo pipefail

# Import CourseFlix seed SQL into the Docker database.
# Usage:
#   db/import-seed.sh db/seed-full.sql
#   db/import-seed.sh db/seed-data.sql

SEED_FILE="${1:-}"
if [[ -z "$SEED_FILE" ]]; then
  echo "Usage: db/import-seed.sh <seed-file.sql>"
  exit 1
fi

if [[ ! -f "$SEED_FILE" ]]; then
  echo "Seed file not found: $SEED_FILE"
  exit 1
fi

docker exec -i courseflix-db psql -U courseflix -d courseflix < "$SEED_FILE"
echo "Import complete: $SEED_FILE"
