---
name: AutFlow Studio setup
description: Full-stack agency OS — key architectural decisions, bug patterns, and bootstrap facts worth remembering across sessions.
---

## Bootstrap facts
- Dev login credentials: `admin@autflow.io` / `admin123` (seed only — production uses a real user account)
- Production user: `abderrahmenhud@gmail.com` (owner role; password was changed by user on 2026-07-15)
- Production URL: `https://9-ahwatoscar--wahom1.replit.app`
- DB tables (13): clients, projects, deliverables, payments, documents, meetings, notes, meetings, tasks, activity, users, sessions, agency_settings, notifications
- Codegen command: `pnpm --filter @workspace/api-spec run codegen` (runs orval + typecheck:libs)
- Fresh-env setup: `pnpm install` → `pnpm --filter @workspace/scripts run migrate` → `pnpm --filter @workspace/scripts run seed`

## Architecture
- Monorepo: pnpm workspaces
- Frontend: `artifacts/autflow-studio` (React + Vite, static serve in production)
- API: `artifacts/api-server` (Express 5, node + esbuild bundle in production)
- DB schema: `lib/db/src/schema/` — each domain has its own file, all exported from `index.ts`
- API spec → codegen pipeline: `lib/api-spec/openapi.yaml` → `lib/api-client-react/src/generated/api.ts` + `lib/api-zod/src/generated/api.ts`
- `lib/api-client-react/src/index.ts` must NOT have duplicate export lines (codegen used to add them twice; keep only 4 lines)

## Dev vs Production database separation
- Replit provides TWO separate PostgreSQL databases (platform-enforced, cannot be merged)
- Development DB: seed/test data; `post-merge.sh` runs `migrate` after every task merge
- Production DB: real user data; schema synced automatically when user clicks Publish (Replit diffs dev vs prod schema and applies the SQL diff)
- Data does NOT sync between envs — this is correct/intentional behavior

## Production configuration (verified 2026-07-15)
- All 13 tables exist in production DB ✅
- Health check path: `/api/healthz` (artifact.toml matches `routes/health.ts`) ✅
- Session cookie: `secure: true` (HTTPS-only in production), `sameSite: lax`, 7-day maxAge ✅
- SESSION_SECRET: set as shared secret (available in both dev and prod) ✅
- `app.set("trust proxy", 1)` — required for Replit's reverse proxy ✅
- CORS: `origin: true` (reflects all origins) with `credentials: true` ✅
- Both artifacts served from same domain — same-origin, cookies sent automatically ✅

## Notification system (completed)
- `lib/db/src/schema/notifications.ts` — notificationsTable with: id, type, title, message, entityType, entityId (nullable), href (nullable), isRead (bool), createdAt
- `artifacts/api-server/src/lib/createNotification.ts` — fire-and-forget helper; always `void`-cast the call so route errors don't propagate
- `artifacts/api-server/src/routes/notifications.ts` — 5 endpoints (GET list, GET unread-count, PATCH :id/read, POST mark-all-read, DELETE :id)
- Notification-emitting routes: clients POST, projects POST + PATCH (status), payments POST + PATCH (status=paid), tasks POST + PATCH (status=done), documents POST
- Frontend bell icon: uses `useListNotifications` (refetchInterval 30s)
- Pass `queryKey: getListNotificationsQueryKey()` inside the `query:` option to satisfy TypeScript (React Query v5 requires it)

## "Something went wrong" on delete — root cause & fix (2026-07-15)
- Caused by `<Users size={24} />` in the empty-state branch of `clients/index.tsx` — `Users` was not imported from lucide-react
- Empty state renders when clients list is empty (e.g. after deleting last client), so React crashed into the error boundary
- Fix: added `Users` to the existing lucide-react import

## customFetch credentials (2026-07-15)
- `lib/api-client-react/src/custom-fetch.ts` — added `credentials: init.credentials ?? "include"` to every fetch call
- Same-origin requests (both dev via Vite proxy and prod via same-domain routing) work without this, but it makes intent explicit and guards against routing changes
- Raw `fetch()` calls in `auth-provider.tsx` already had `credentials: "include"` explicitly

## Known remaining issues (not introduced by above work)
- `artifacts/api-server/src/lib/objectStorage.ts` — `signed_url` property type (TS error)
- `index.css` color tokens all set to `red` (placeholder, deferred task)
- GCS storage credentials not configured — document uploads fail silently
- `POST /api/admin/reset` route exists — resets all production data (used by real user on 2026-07-15 to clear demo data)
