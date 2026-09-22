#!/usr/bin/env bash
set -euo pipefail

echo "[railway] Running Prisma migrate deploy..."
npm run db:migrate:deploy

echo "[railway] Starting Next.js..."
npm run start --workspace=@uln/web
