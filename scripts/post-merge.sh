#!/bin/bash
set -e

# Install dependencies
pnpm install --frozen-lockfile

# Run the definitive migration script — creates all tables (Drizzle-managed +
# manual: users, sessions, agency_settings) and ensures a default admin user
# exists. Uses CREATE TABLE IF NOT EXISTS so it is safe to re-run.
#
# Replaces the previous `pnpm --filter db push` (drizzle-kit push) which
# requires a TTY and fails in CI/automated environments, and which also never
# created the users, sessions, or agency_settings tables.
pnpm --filter @workspace/scripts run migrate
