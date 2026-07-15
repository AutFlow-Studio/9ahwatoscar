# AutFlow Studio

A full-stack agency OS for managing clients, projects, payments, documents, meetings, tasks, and activity.

## Run & Operate

**Workflows (start from the Replit UI):**
- `artifacts/api-server: API Server` — Express 5 API on port 8080
- `artifacts/autflow-studio: web` — React/Vite frontend on port 22583

**One-time DB setup (fresh environment):**
1. `pnpm --filter @workspace/scripts run migrate` — creates users, agency_settings, sessions tables
2. `pnpm --filter @workspace/scripts run seed` — demo data + default admin (`admin@autflow.io` / `admin123`)

> Note: `drizzle-kit push` requires a TTY; create Drizzle-managed tables via SQL directly or via `executeSql` instead.

**Other commands:**
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind (`artifacts/autflow-studio/`)
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM (`lib/db/`)
- Auth: express-session + connect-pg-simple + bcryptjs (session cookie `autflow.sid`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/autflow-studio/src/` — React app (pages, components, auth-provider)
- `artifacts/api-server/src/` — Express routes, middleware, session config
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB shape)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — generated React Query hooks
- `lib/api-zod/` — generated Zod schemas
- `scripts/src/migrate.ts` — creates users, agency_settings, sessions tables
- `scripts/src/seed.ts` — demo data seeder

## Architecture decisions

- Sessions over JWT: server-side sessions via `express-session` + PostgreSQL store; no JWT anywhere
- `connect-pg-simple createTableIfMissing: true` is broken under esbuild — sessions table is created in `migrate.ts` instead
- `.d.ts` files must NOT be `import`ed — TypeScript picks them up automatically via `tsconfig.json` include
- All private API routes sit behind `requireAuth` middleware; public routes: `/api/health`, `/api/auth/login|logout|me`
- Frontend fetch calls must include `credentials: "include"` to send the session cookie

## Gotchas

- Always run `migrate` before `seed` on a fresh DB
- `drizzle-kit push` needs a TTY — use `executeSql` to apply schema changes non-interactively
- Workflows need `PORT` and `BASE_PATH` injected manually (e.g. `PORT=8080 BASE_PATH=/ ...`) since the artifact system isn't driving them directly

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
