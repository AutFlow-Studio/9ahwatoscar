# AutFlow Studio — Project Context

> **Keep this file up to date.** After every significant change, update the relevant section and add an entry to [Change Log](#change-log).

---

## Purpose

AutFlow Studio is a full-stack **agency operating system** for small-to-medium digital agencies. It centralises client management, project tracking, invoicing/payments, document storage, meeting scheduling, task management, and an activity feed in a single web application.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 (strict) |
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 |
| Backend | Express 5 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | express-session + connect-pg-simple + bcryptjs |
| Validation | Zod v4 + drizzle-zod |
| Data fetching | TanStack Query (React Query v5) |
| API codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Build | esbuild (CJS bundle for API server) |
| Package manager | pnpm workspaces |

---

## Repository Structure

```
/
├── artifacts/
│   ├── api-server/          # Express 5 API — port 8080
│   └── autflow-studio/      # React + Vite frontend — port 22583
├── lib/
│   ├── db/src/schema/       # Drizzle table definitions (source of truth for DB shape)
│   ├── api-spec/            # openapi.yaml (source of truth for API contracts)
│   ├── api-client-react/    # Generated: React Query hooks
│   └── api-zod/             # Generated: Zod request/response schemas
└── scripts/
    ├── src/migrate.ts       # Creates tables (users, agency_settings, sessions)
    └── src/seed.ts          # Inserts demo data + default admin
```

---

## Database Schema

All tables are defined in `lib/db/src/schema/`. The following 12 tables exist:

| Table | Purpose |
|---|---|
| `users` | Admin accounts (bcrypt passwords) |
| `sessions` | Server-side session store (connect-pg-simple) |
| `agency_settings` | Agency name, logo, contact info |
| `clients` | Client companies |
| `projects` | Projects linked to clients |
| `deliverables` | Project deliverables/milestones |
| `payments` | Invoices and payment records |
| `documents` | File/link attachments per client |
| `meetings` | Scheduled meetings |
| `notes` | Internal notes per client |
| `tasks` | Tasks (global or per-project) |
| `activity` | Append-only activity feed |
| `notifications` | In-app notification inbox |

---

## Authentication

- Strategy: **server-side sessions** — no JWT anywhere.
- Session cookie name: `autflow.sid` (HTTP-only, SameSite=Lax)
- Session store: PostgreSQL via `connect-pg-simple` (`sessions` table)
- Default admin: `admin@autflow.io` / `admin123`
- All API routes except `/api/health` and `/api/auth/(login|logout|me)` require the `requireAuth` middleware.
- Frontend must send `credentials: "include"` on every fetch (handled by `customFetch` in `lib/api-client-react/src/custom-fetch.ts`).

---

## API Design

- All routes are mounted under `/api` in `artifacts/api-server/src/app.ts`.
- Request/response shapes are defined in `lib/api-spec/openapi.yaml`.
- After changing the OpenAPI spec, run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Global async error handler in `app.ts` catches all unhandled route errors and returns a structured JSON error response. Express 5 auto-forwards async errors.

---

## How to Run

### Development

```bash
# 1. Install dependencies (once, or after adding packages)
pnpm install

# 2. On a fresh database — run once
pnpm --filter @workspace/scripts run migrate
pnpm --filter @workspace/scripts run seed

# 3. Start both services via Replit workflow buttons, or:
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=22583 BASE_PATH=/ pnpm --filter @workspace/autflow-studio run dev
```

### Regenerate API types

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Typecheck

```bash
pnpm run typecheck
```

---

## Persistence Model

All application data is persisted in **PostgreSQL**. Nothing important is stored only in browser memory or localStorage. The data flow is:

```
User action → React component → TanStack Query mutation
  → customFetch (credentials: include) → Express route
  → Drizzle ORM → PostgreSQL
  → 204 / JSON response → React Query cache invalidation → UI re-render
```

Sessions are also stored in PostgreSQL (not memory), so they survive server restarts and are consistent across multiple clients/browsers.

## Dev vs Production Database Architecture

Replit provides **two separate managed PostgreSQL databases** — one per environment. This is platform-enforced and cannot be changed; it mirrors how all major platforms (Vercel, Heroku, Netlify) work.

| | Development (Preview) | Production (Deployed app) |
|---|---|---|
| **Database** | Separate dev DB | Separate production DB |
| **URL** | `DATABASE_URL` injected by Replit | `DATABASE_URL` injected by Replit |
| **Data** | Seed/test data (`admin@autflow.io`) | Real user data (`abderrahmenhud@gmail.com`) |
| **Schema sync** | Updated via `post-merge.sh` → `migrate` | Synced when user clicks **Publish** (Replit diffs dev vs prod schema and applies it) |
| **Data sync** | Not synced — intentional | Not synced — intentional (prevents test data from overwriting production) |

**Schema changes flow:** Edit schema → `migrate` applies to dev DB → click Publish → Replit applies the SQL diff to production DB.

**Production data is permanent:** Data written to the production app persists indefinitely across re-deployments. Re-publishing updates the code and schema but never wipes production rows.

**Verified production state (2026-07-15):**
- All 13 tables exist in the production DB ✅
- Real owner account `abderrahmenhud@gmail.com` active ✅
- Sessions, notifications, all entity tables present ✅
- Health check `/api/healthz` → `{"status":"ok"}` ✅

---

## Notification System

- Notifications are created server-side by helper `artifacts/api-server/src/lib/createNotification.ts`.
- Always `void`-cast calls to this helper inside route handlers so errors don't propagate to the route response.
- Notification-emitting routes: clients POST, projects POST + PATCH (status), payments POST + PATCH (status=paid), tasks POST + PATCH (status=done), documents POST.
- Frontend polls unread count every 30 s via `useListNotifications({ refetchInterval: 30000 })`.

---

## Known Limitations

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | CSS color tokens in `index.css` are placeholder values — theming not fully applied | `artifacts/autflow-studio/src/index.css` | Low |
| 2 | `drizzle-kit push` requires a TTY — use `executeSql` to apply schema changes non-interactively | — | Operational |

---

## Completed Fixes

| Date | Description |
|---|---|
| 2026-07-15 | **"Something went wrong" on client delete** — `Users` icon from lucide-react was not imported in `clients/index.tsx`. The empty-state branch crashed React when the client list became empty (e.g. after deleting the last client). Fixed by adding `Users` to the lucide-react import. |
| 2026-07-15 | **TypeScript error in `documents/index.tsx`** — `ListClientsResponseItem` was not exported from `@workspace/api-client-react`. Fixed by aliasing the existing `Client` type. |
| 2026-07-15 | Project bootstrapped: `pnpm install`, `migrate`, `seed`, workflows started. |
| 2026-07-15 | **Document uploads fully operational** — provisioned GCS App Storage bucket (`setupObjectStorage()`); env vars `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID` set. Added backend content-type allowlist (415 on blocked types), server-side 50 MB size enforcement (413), hardened `Content-Disposition` filename sanitisation, improved GCS error surfacing in frontend (`uploadToGcs` reads XML error body), added missing size check to `ReplaceFileDialog`. E2E verified: upload → DB persist → download with content integrity → delete → GCS object confirmed gone (404). |
| 2026-07-15 | **`notifications` table missing from `migrate.ts`** — existed in Drizzle schema but was never added to the migration script. Table was created in dev DB and added to `migrate.ts` and `post-merge.sh` so all future environments get it. |
| 2026-07-15 | **`customFetch` missing `credentials: "include"`** — all React Query data hooks (create/update/delete/list) went through `lib/api-client-react/src/custom-fetch.ts` without explicit credentials. Same-origin requests work without it, but added `credentials: "include"` as the default for consistency with the raw `fetch()` calls in `auth-provider.tsx` and to guard against any future routing changes. |
| 2026-07-15 | **Document uploads** — provisioned GCS App Storage bucket; added backend content-type allowlist (415), file-size enforcement (413, max 50 MB), improved GCS error surfacing in frontend; added size check to ReplaceFileDialog; full e2e test passed (upload → persist → download → delete → GCS cleanup). |

---

## Development Workflow

After every meaningful change:

1. If the DB schema changed → run `pnpm --filter @workspace/scripts run migrate` (non-interactively).
2. If `openapi.yaml` changed → run `pnpm --filter @workspace/api-spec run codegen`.
3. Restart the affected workflow(s) and confirm logs are clean.
4. Update this file — specifically the **Completed Fixes** and **Known Limitations** tables.

---

## Change Log

| Date | Change |
|---|---|
| 2026-07-15 | Initial PROJECT_CONTEXT.md created; delete crash bug fixed; type alias fix applied. |
