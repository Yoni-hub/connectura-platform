#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

if command -v pg_isready >/dev/null 2>&1; then
  echo "Waiting for database to be ready..."
  for i in {1..30}; do
    if PGPASSWORD="${DB_PASSWORD:-}" pg_isready -h "${DB_HOST:-}" -p "${DB_PORT:-}" -U "${DB_USER:-}" -d "${DB_NAME:-}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

echo "Ensuring database schema..."
npx prisma db push
npx prisma generate

exec "$@"
