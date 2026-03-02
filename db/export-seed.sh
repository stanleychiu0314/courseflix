#!/usr/bin/env bash
set -euo pipefail

# Export CourseFlix database seed data via pg_dump from the Docker container.
# Usage:
#   db/export-seed.sh                # full dump (schema + data) -> db/seed-full.sql
#   db/export-seed.sh --data-only    # data only -> db/seed-data.sql
#   db/export-seed.sh --full --out db/seed-full.sql

MODE="full"
OUT="db/seed-full.sql"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --data-only)
      MODE="data-only"
      OUT="db/seed-data.sql"
      shift
      ;;
    --full)
      MODE="full"
      OUT="db/seed-full.sql"
      shift
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ "$MODE" == "data-only" ]]; then
  docker exec -t courseflix-db pg_dump -U courseflix -d courseflix --data-only > "$OUT"
else
  docker exec -t courseflix-db pg_dump -U courseflix -d courseflix > "$OUT"
fi

echo "Export complete: $OUT"
