---
name: AutFlow Studio setup
description: Full-stack agency OS — key architectural decisions, bug patterns, and bootstrap facts worth remembering across sessions.
---

## Bootstrap facts
- Login credentials: `admin@autflow.io` / `admin123`
- DB tables (13): clients, projects, deliverables, payments, documents, notes, meetings, tasks, activity, users, settings, notifications, sessions
- Codegen command: `pnpm --filter @workspace/api-spec run codegen` (runs orval + typecheck:libs)
- Fresh-env setup: `pnpm install` → `pnpm --filter @workspace/scripts run migrate` → `pnpm --filter @workspace/scripts run seed`

## Architecture
- Monorepo: pnpm workspaces
- Frontend: `artifacts/autflow-studio` (React + Vite)
- API: `artifacts/api-server` (Express 5)
- DB schema: `lib/db/src/schema/` — each domain has its own file, all exported from `index.ts`
- API spec → codegen pipeline: `lib/api-spec/openapi.yaml` → `lib/api-client-react/src/generated/api.ts` + `lib/api-zod/src/generated/api.ts`
- `lib/api-client-react/src/index.ts` must NOT have duplicate export lines (codegen used to add them twice; keep only 4 lines)

## Notification system (completed)
- `lib/db/src/schema/notifications.ts` — notificationsTable with: id, type, title, message, entityType, entityId (nullable), href (nullable), isRead (bool), createdAt
- `artifacts/api-server/src/lib/createNotification.ts` — fire-and-forget helper; always `void`-cast the call so route errors don't propagate
- `artifacts/api-server/src/routes/notifications.ts` — 5 endpoints (GET list, GET unread-count, PATCH :id/read, POST mark-all-read, DELETE :id)
- Notification-emitting routes: clients POST, projects POST + PATCH (status), payments POST + PATCH (status=paid), tasks POST + PATCH (status=done), documents POST
- Frontend bell icon: uses `useListNotifications` (refetchInterval 30s), `useMarkNotificationRead`, `useMarkAllNotificationsRead`, `useDeleteNotification`
- Query invalidation pattern: pass `invalidateNotifications` as `onSuccess` callback to each mutation's `mutate()` call
- Pass `queryKey: getListNotificationsQueryKey()` inside the `query:` option to satisfy TypeScript (React Query v5 requires it)

## "Something went wrong" on delete — root cause & fix (2026-07-15)
- Caused by `<Users size={24} />` in the empty-state branch of `clients/index.tsx` — `Users` was not imported from lucide-react.
- Empty state renders when clients list is empty (including after deleting the last client), so React crashed into the error boundary.
- Fix: added `Users` to the existing lucide-react import on line 7 of `clients/index.tsx`.
- Pattern to watch: any empty-state branch that uses an icon/component that might not be imported will be invisible until the list is empty.

## Type alias fix (2026-07-15)
- `documents/index.tsx` imported `type ListClientsResponseItem` from `@workspace/api-client-react`, but that name was never exported.
- Fixed by aliasing: `type Client as ListClientsResponseItem` — `Client` is the correct generated type for list items.

## Known remaining TS errors (not introduced by above work)
- `artifacts/api-server/src/lib/objectStorage.ts` — `signed_url` property type
- `index.css` color tokens all set to `red` (placeholder, deferred task)
- GCS storage credentials not configured — document uploads fail silently

## Persistent state
- All data in PostgreSQL. Sessions also in PG (not memory). Nothing important in localStorage or browser memory.
- See PROJECT_CONTEXT.md at repo root for full reference documentation.
