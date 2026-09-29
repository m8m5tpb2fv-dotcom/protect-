#!/bin/sh
# Container entrypoint (Docker / Railway): apply migrations, seed idempotently, serve.
set -e
npx tsx --conditions=react-server scripts/migrate.ts
# Reference data + admin from ADMIN_EMAIL/ADMIN_PASSWORD; demo data only when DEMO_MODE=true.
# Every step is idempotent, so running it on each start is safe.
npx tsx --conditions=react-server scripts/seed.ts
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
