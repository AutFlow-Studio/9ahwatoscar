# AutFlow Studio — Complete Technical & Product Audit
> Prepared from full source-code review · July 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Complete User Journey](#3-complete-user-journey)
4. [Screens / Pages](#4-screens--pages)
5. [User Roles](#5-user-roles)
6. [Database](#6-database)
7. [APIs](#7-apis)
8. [Backend Architecture](#8-backend-architecture)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Business Logic](#10-business-logic)
11. [Security Review](#11-security-review)
12. [Code Quality Review](#12-code-quality-review)
13. [Missing Features](#13-missing-features)
14. [Scalability](#14-scalability)
15. [Deployment](#15-deployment)
16. [Product Roadmap](#16-product-roadmap)
17. [Competitive Analysis](#17-competitive-analysis)
18. [Technical Complexity](#18-technical-complexity)
19. [Business Evaluation](#19-business-evaluation)
20. [Final Verdict](#20-final-verdict)

---

## 1. Executive Summary

### What this product is

**AutFlow Studio** is a web-based Agency Operating System — a single application that allows a digital agency owner and their team to manage every operational aspect of their business from one screen: clients, projects, deliverables, invoices, documents, meeting logs, tasks, and performance reporting.

### Business idea

The product replaces the combination of Notion + Trello + FreshBooks + Google Contacts + Calendly notes that most small agencies cobble together. Instead of switching between tools, everything is in one dark-themed, professional dashboard that feels custom-built for agency work.

### Target users

- **Primary**: Solo digital agency owners / freelancers managing 5–30 clients
- **Secondary**: Small agency teams (2–10 people) needing a shared workspace
- **Industry**: Digital marketing, web development, design, branding, content agencies

### Core value proposition

> "One place to run your entire agency" — client roster, project tracker, invoice manager, document vault, calendar, and Kanban board, all linked together with automatic activity logging.

### Product maturity

**Late MVP / Early Beta.** The core feature set is implemented and functional. Authentication, data persistence, and all CRUD operations work. However, it lacks real-time updates, email notifications, multi-tenancy, file uploads, and several other features that paying customers would expect. It is demo-ready, not production-ready for a paying customer.

### Overall architecture

```
┌─────────────────────────────────────────────────┐
│              Browser (React/Vite)               │
│  Tailwind + Radix UI + TanStack Query + Wouter  │
└────────────────────┬────────────────────────────┘
                     │ HTTP + Session Cookie
                     │ /api/* (Vite proxy in dev,
                     │  Replit routing in prod)
┌────────────────────▼────────────────────────────┐
│           Express 5 API Server                  │
│  Sessions · Zod validation · Drizzle ORM        │
└────────────────────┬────────────────────────────┘
                     │ pg Pool (DATABASE_URL)
┌────────────────────▼────────────────────────────┐
│              PostgreSQL (Neon)                  │
│  12 tables · Session store included             │
└─────────────────────────────────────────────────┘
```

**Monorepo packages** (pnpm workspaces):

| Package | Role |
|---------|------|
| `artifacts/autflow-studio` | React frontend (Vite) |
| `artifacts/api-server` | Express 5 REST API |
| `lib/db` | Drizzle schema + pg pool |
| `lib/api-zod` | Generated Zod types from OpenAPI spec |
| `lib/api-client-react` | Generated React Query hooks |
| `scripts` | migrate.ts · seed.ts |

---

## 2. Product Overview

### Feature 1 — Dashboard / Command Center

**Purpose**: Give the agency owner a real-time snapshot of their entire business at a glance.

**Why it exists**: An agency owner's biggest daily problem is knowing "what needs my attention right now". The dashboard answers this without requiring navigation to individual sections.

**Who uses it**: The first thing every logged-in user sees.

**Business value**: Reduces context-switching. Surfaces at-risk projects and overdue invoices proactively.

**Technical implementation**: Single `GET /api/dashboard` endpoint that runs 6 parallel database queries (clients, projects, payments, recent activity, upcoming meetings, recent notes), computes derived metrics server-side (delayed projects, outstanding revenue, at-risk projects), and returns a single JSON blob. The frontend renders this in one TanStack Query fetch.

**Metrics shown**:
- Total clients / active clients
- Projects in progress / completed / delayed
- Monthly revenue (paid invoices)
- Outstanding payments
- Upcoming project deadlines (next 30 days)
- Projects at risk (past deadline OR <30% progress with deadline <30 days)
- Projects needing attention (paused, waiting, zero-progress non-planning)
- Upcoming meetings (next 5)
- Recent notes (last 5)
- Quick-action buttons (New Client, New Project, New Task, New Invoice)
- Notification bell (dynamically built from at-risk projects + deadlines + unpaid invoices)

---

### Feature 2 — Client Management

**Purpose**: A CRM-lite for agency clients.

**Who uses it**: Agency owner and team members.

**Business value**: Single source of truth for every client relationship. Eliminates spreadsheets of client contacts.

**Technical implementation**: Full CRUD on `clients` table. List view with search (company name, industry, email via SQL `ilike`) and status filter. Card-based grid UI with company avatar, contact info, contract value, and status badge. Detail page shows linked projects, payments, documents, notes, and meetings in tabs.

**Client lifecycle states**: `prospect` → `active` → `inactive` → `churned`

**Client detail page aggregates**:
- All projects for this client
- All payments with total revenue + outstanding balance
- Open payments list
- Documents vault
- Internal notes
- Meeting history

**Fields captured**:
- Company name, logo URL, industry, website, email, phone
- Primary contact, secondary contact, address, timezone
- Status, start date, contract value, monthly retainer, payment method
- Internal notes, tags (array)

---

### Feature 3 — Project Management

**Purpose**: Track every project from planning to delivery with financial visibility.

**Who uses it**: Agency owner and team members.

**Business value**: Gives owners a live view of project health, profitability, and progress. The `profit` computed field (revenue − actual cost) gives an instant P&L per project.

**Technical implementation**: Full CRUD. List view supports filtering by clientId, status, and search. Two display modes: list (table) and grid (cards). Detail page includes tabbed sections for deliverables, activity, notes, and description.

**Project statuses** (ordered by typical flow):
`planning` → `design` → `development` → `testing` → `review` → `delivered` | `paused` | `waiting` | `cancelled`

**Project priorities**: `low`, `medium`, `high`, `urgent`

**Financial fields**: `estimated_budget`, `actual_cost`, `revenue`. The API computes `profit = revenue - actual_cost` on every response.

**Progress**: Integer 0–100 (manually set, no automatic calculation from deliverables).

**Notable**: Project detail fetches deliverables, documents, and notes in one `GET /api/projects/:id` call (3 parallel sub-queries). Deliverables are managed inline on the project detail page.

---

### Feature 4 — Deliverable Tracking

**Purpose**: Break projects into trackable line-item deliverables.

**Why it exists**: Clients often pay for specific deliverables (logo + brand guide + 5 social templates). Tracking them individually helps the team know what is done vs. pending.

**Technical implementation**: Full CRUD under `deliverables` table. Always scoped to a project. Status transitions are manual.

**Deliverable statuses**: `pending` → `in_progress` → `review` → `done`

**Fields**: title, status, deadline, assigned_to (text, not linked to a user ID), completion_date, notes.

**Limitation**: `assigned_to` is a free-text field — it does not link to actual user accounts. This means no task assignment enforcement.

---

### Feature 5 — Payment / Invoice Tracking

**Purpose**: Track all client invoices and their payment status.

**Who uses it**: Agency owner (primarily financial oversight).

**Business value**: Single view of all money owed, overdue, and collected. Eliminates the need for a separate invoicing tool for basic tracking.

**Technical implementation**: Full CRUD. List view filterable by client and status. Table layout showing invoice number, client, amount, status, and due date. Inline status updates.

**Payment statuses**: `pending` → `paid` | `overdue` | `cancelled`

**PDF Invoice generation**: Client-side using `jsPDF`. The `downloadInvoicePDF(payment, agencyName, agencyEmail, website)` function generates a text-based PDF (no template engine — it uses raw jsPDF `text()` calls). Pulls agency details from `AgencyProfileProvider` context.

**Limitation**: This is invoice *tracking*, not invoice *creation with line items*. There is no line-item breakdown on invoices — just a total amount. No Stripe / payment processor integration. No email sending.

---

### Feature 6 — Document Vault

**Purpose**: Store links to client-related documents (contracts, proposals, designs, GitHub repos, Figma files, etc.).

**Who uses it**: Anyone on the team who needs to find a document fast.

**Business value**: Eliminates "where's the contract for Client X?" Slack messages.

**Technical implementation**: Documents are URL links with a type label — there is no actual file storage. Full CRUD. Can be scoped to a client or a client + project. Global documents page shows all documents with type-based icon and search.

**Document types**: `contract`, `invoice`, `proposal`, `design`, `brand_assets`, `link`, `google_drive`, `github`, `figma`, `other`

**Limitation**: No actual file uploads. URL-only. No file preview.

---

### Feature 7 — Meeting Log

**Purpose**: Record meeting summaries, action items, and schedule follow-up meetings.

**Who uses it**: Agency owner documenting client conversations.

**Business value**: Institutional memory. Every conversation with a client is recorded. Reduces "we agreed to X in that call last month" disputes.

**Technical implementation**: Full CRUD. Scoped to a client. Fields: date, summary, action_items (free text), next_meeting (timestamp), attachments (text). Logged to activity feed. Upcoming meetings surface on the dashboard.

**Limitation**: No calendar integration (Google Calendar, Outlook). No meeting invites. "Attachments" is a text field, not actual file attachments.

---

### Feature 8 — Task Board (Kanban)

**Purpose**: Internal task management for the agency team.

**Who uses it**: All team members for personal and shared tasks.

**Business value**: Replaces Trello / Linear for simple task tracking. Tasks can be linked to clients and projects for context.

**Technical implementation**: Kanban board with 4 columns (todo, in_progress, review, done). Tasks displayed as cards with priority badge, title, optional client link, and deadline. Click a card to open a detail/edit dialog.

**Task priorities**: `low`, `medium`, `high`, `urgent`

**Task statuses**: `todo`, `in_progress`, `review`, `done`

**Important limitation**: The Kanban board is **visual only** — there is no drag-and-drop. The `GripVertical` icon is rendered on hover, suggesting it was planned, but actual DnD is not implemented. Status changes require opening the task dialog and changing the status dropdown.

---

### Feature 9 — Calendar View

**Purpose**: A unified weekly calendar showing all time-based events from across the app.

**Who uses it**: Agency owner planning their week.

**Business value**: Single calendar view across meetings, project deadlines, and payment due dates. Eliminates needing to check 3 different places.

**Technical implementation**: `GET /api/calendar` endpoint that aggregates:
1. Project deadlines (where deadline is a date in the window, status not delivered/cancelled)
2. Client meetings
3. Payment due dates

All returned as `CalendarEvent[]` with a `type` field (`project_deadline`, `meeting`, `payment_due`). The frontend renders a 7-day weekly view. Navigation buttons move forward/backward one week. Today is highlighted. Events are color-coded by type.

**Limitation**: No month view. No event creation from the calendar (meetings must be created in the client detail or meetings page). No iCal/Google Calendar sync.

---

### Feature 10 — Reports

**Purpose**: Business performance analytics.

**Who uses it**: Agency owner for strategic decision-making.

**Business value**: Answers "How is my business doing?" with charts.

**Technical implementation**: Two API endpoints:
- `GET /api/reports/overview` — summary metrics (total clients, active clients, total projects, projects by status, total revenue, outstanding, overdue)
- `GET /api/reports/revenue` — revenue breakdown by client, by month (last 11 months), and totals

Frontend renders Recharts bar charts and pie charts. Revenue by month chart always shows the last 11 months anchored to today (no gaps even if zero revenue for a month). Revenue by client shown as a pie chart + table.

**Limitation**: Reports are static — no date range filters, no export to CSV/Excel, no custom report builder.

---

### Feature 11 — Global Search

**Purpose**: Find any entity (client, project, payment, note) by keyword.

**Who uses it**: All users.

**Technical implementation**: `GET /api/search?q=<term>` uses PostgreSQL `ilike` (case-insensitive pattern matching) across clients (company name, email, contact), projects (name, description), payments (invoice number), and notes (content). Results are typed (`client`, `project`, `payment`, `note`) with title, subtitle, and URL for navigation. Results link to the correct detail page.

**Limitation**: Not full-text search (no ranking, no stemming). Large datasets will be slow because it runs a separate `ilike` query per entity type with no indexing on those columns.

---

### Feature 12 — Activity Feed

**Purpose**: An audit log of every significant action in the system.

**Who uses it**: Agency owner reviewing what happened.

**Business value**: Accountability trail. "Who created this client? When was this project updated?" Without this, nothing is traceable.

**Technical implementation**: The `activity` table receives an `INSERT` every time a client, project, payment, meeting, or note is created or updated. Each entry has `type` (e.g. `client_created`, `project_updated`), `entity_type`, `entity_id`, `description`, and `client_id`. The `GET /api/activity` endpoint returns the last N entries globally. The `GET /api/clients/:clientId/timeline` endpoint returns activity scoped to one client.

---

### Feature 13 — Settings

**Purpose**: Configure agency profile, notification preferences, invoice defaults, user profile, and theme.

**Who uses it**: Agency owner.

**Technical implementation**: Tabbed settings page. Four sections:
1. **Agency Profile** — name, email, website, support email, currency, timezone, invoice prefix, payment terms days (PATCH/PUT to `/api/settings/agency`)
2. **Notifications** — three boolean toggles: notify on invoice paid, deadline approaching, weekly digest (stored in DB but no actual notification mechanism implemented)
3. **Account** — update own name/email (`PATCH /api/auth/profile`) and change password (`PATCH /api/auth/password`)
4. **Theme** — Light / Dark / System (localStorage only via `next-themes`)

**Singleton pattern**: `agency_settings` table always has exactly one row. `GET /api/settings/agency` uses a `getOrCreateSettings()` helper that creates the row with defaults if it doesn't exist.

---

### Feature 14 — Admin Data Reset

**Purpose**: Truncate all demo/test data and start fresh.

**Who uses it**: Owners only (via a button inside the Dashboard page).

**Technical implementation**: A "Clear Data" button on the dashboard opens an AlertDialog. On confirm, `POST /api/admin/reset` (protected by `requireOwner` middleware) runs `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` on all data tables (activity, deliverables, documents, meetings, notes, payments, tasks, projects, clients). This does NOT delete users or agency settings.

**Risk**: Irreversible. Single confirmation dialog is the only safeguard.

---

## 3. Complete User Journey

### 3.1 First-time Setup (Owner)

```
1. Owner opens the app URL
   ↓
2. Frontend fetches GET /api/auth/me → 401 (no session)
   ↓
3. AuthGate renders LoginPage
   ↓
4. Owner enters admin@autflow.io / admin123 (from migration)
   ↓
5. POST /api/auth/login
   → Finds user in users table by email (lowercased)
   → bcrypt.compare(password, hash)
   → If valid: sets req.session.userId/role/name/email
   → Session saved to sessions table (connect-pg-simple)
   → Returns PublicUser JSON (no passwordHash)
   ↓
6. Frontend receives user object, AuthProvider sets user state
   ↓
7. AuthGate renders Layout + Dashboard
   ↓
8. Dashboard calls GET /api/dashboard → 6 parallel DB queries
   ↓
9. Owner sees Command Center with empty state (no data yet)
   ↓
10. Owner navigates to Settings → Agency Profile
    → Fills in agency name, email, etc.
    → PUT /api/settings/agency → updates agency_settings row
    ↓
11. Owner ready to add first client
```

---

### 3.2 Adding a Client

```
1. Owner navigates to /clients
   → GET /api/clients (no filters) → all clients listed
   ↓
2. Clicks "+ New Client" button
   → Dialog opens with ClientFormDialog
   ↓
3. Fills: company name (required), industry, email, phone, website
   Sets status = "prospect"
   ↓
4. Submits form
   → POST /api/clients { companyName, industry, email, phone, website, status }
   → Zod validates via CreateClientBody schema
   → INSERT into clients table
   → INSERT into activity: "Client X created"
   → Returns 201 with new client
   ↓
5. queryClient.invalidateQueries → refetches client list
6. New client card appears in the grid
7. Owner can click card → navigates to /clients/:id (client detail)
```

---

### 3.3 Managing a Project

```
1. Owner opens client detail at /clients/:id
   → Tabs: Overview, Projects, Payments, Documents, Notes
   ↓
2. Clicks "Add Project" in Projects tab
   → Dialog: name, status (planning), priority, deadline
   ↓
3. POST /api/projects { clientId, name, status, priority, deadline }
   → INSERT into projects
   → Activity logged
   → Returns 201
   ↓
4. Owner navigates to /projects/:id
   → GET /api/projects/:id
   → Returns project + deliverables[] + documents[] + notes[]
   ↓
5. Owner adds deliverables in the Deliverables tab
   → POST /api/deliverables { projectId, title, status, deadline, assignedTo }
   ↓
6. Owner updates progress slider (0-100) and status
   → PATCH /api/projects/:id { progress, status }
   → Activity logged
   ↓
7. When work is done:
   → Status set to "delivered"
   → Project disappears from "in progress" counts
   → Appears in completed count on dashboard
```

---

### 3.4 Creating and Tracking an Invoice

```
1. Navigate to /payments or Client Detail → Payments tab
   ↓
2. Click "New Invoice"
   → Dialog: client (required), invoice number, amount, status, due date
   ↓
3. POST /api/payments { clientId, invoiceNumber, amount, status, dueDate }
   → INSERT into payments
   → Activity logged: "Invoice INV-001 added ($5,000)"
   ↓
4. Invoice appears in payments list with status badge "pending"
   ↓
5. Client pays. Owner opens invoice and updates status
   → PATCH /api/payments/:id { status: "paid", paidDate: "2026-07-14" }
   ↓
6. Dashboard revenue counter updates on next refresh
7. Reports page revenue by month updates
   ↓
8. Owner can download PDF via "Download" button
   → jsPDF generates client-side PDF with:
     Agency name, email, website (from agency profile context)
     Invoice number, client name, amount, status, dates
   → Browser initiates file download
```

---

### 3.5 Logging a Meeting

```
1. Navigate to Client Detail → any tab
   → "Add Meeting" button (or from meetings page)
   ↓
2. POST /api/meetings { clientId, date, summary, actionItems, nextMeeting }
   → INSERT into meetings
   → Activity: "Meeting with ClientX logged"
   ↓
3. Meeting appears on:
   → Client detail timeline
   → Dashboard "Upcoming Meetings" if date > now
   → Calendar view on the correct day
```

---

### 3.6 Using the Task Board

```
1. Navigate to /tasks
   → GET /api/tasks → all tasks
   → Grouped into 4 Kanban columns: todo / in_progress / review / done
   ↓
2. Click "+ New Task" → dialog: title, priority, status, deadline, client (optional)
   → POST /api/tasks
   → Task card appears in correct column
   ↓
3. Click on a task card → detail dialog opens
   → Can edit title, priority, status, deadline, notes
   → PATCH /api/tasks/:id
   → Card moves to new column
   ↓
4. Click delete icon on a task
   → AlertDialog confirmation
   → DELETE /api/tasks/:id → 204
   → Card removed from board
```

---

### 3.7 Searching

```
1. Click search icon in top navigation bar
   → Navigates to /search?q=
   ↓
2. User types a search term
   → GET /api/search?q=<term> (triggered on input change)
   → Four ilike queries: clients, projects, payments, notes
   → Returns SearchResults { results: SearchResult[] }
   ↓
3. Results rendered as cards with type badge (CLIENT, PROJECT, etc.)
4. Click a result → navigates to the entity's detail page
```

---

### 3.8 Signing Out

```
1. Click user avatar in top right → dropdown menu → "Sign out"
   ↓
2. POST /api/auth/logout
   → req.session.destroy()
   → res.clearCookie("autflow.sid")
   ↓
3. AuthProvider sets user = null
4. AuthGate renders LoginPage
```

---

## 4. Screens / Pages

### 4.1 Login Page

| Property | Value |
|----------|-------|
| Route | `/` (when unauthenticated) |
| Component | `src/pages/login/index.tsx` |
| Inputs | Email (text), Password (password) |
| Buttons | Sign in |
| Validation | Client: both fields required. Server: 400 if missing, 401 if wrong |
| API calls | `POST /api/auth/login` |
| DB interactions | SELECT from users · UPDATE lastLoginAt · INSERT into sessions |
| Error states | Inline error message ("Invalid email or password") |
| Loading state | Button shows "Signing in…" and is disabled |

---

### 4.2 Dashboard (Command Center)

| Property | Value |
|----------|-------|
| Route | `/` (when authenticated) |
| Component | `src/pages/dashboard.tsx` |
| Inputs | None (read-only with action buttons) |
| Outputs | Metrics cards, deadline list, at-risk projects, meetings, notes, activity |
| Buttons | New Client, New Project, New Task, New Invoice (navigate), Clear Data (destructive) |
| API calls | `GET /api/dashboard` |
| DB interactions | Reads clients, projects, payments, activity, meetings, notes |
| Error states | Skeleton loading. No error state shown explicitly |

**Metrics cards**:
1. Active Clients (total / active breakdown)
2. Projects In Progress (with delayed count)
3. Monthly Revenue (from paid payments this month — uncertain: the code sums all paid, not filtering by month on the dashboard endpoint)
4. Outstanding Payments (pending + overdue)

---

### 4.3 Clients List

| Property | Value |
|----------|-------|
| Route | `/clients` |
| Component | `src/pages/clients/index.tsx` |
| Inputs | Search box (debounced via query param), Status filter dropdown |
| Outputs | Grid of client cards |
| Buttons | New Client (opens dialog), View Details, Edit, Delete |
| Validation | Company name required |
| API calls | `GET /api/clients?status=&search=`, `POST /api/clients`, `PATCH /api/clients/:id`, `DELETE /api/clients/:id` |
| DB | CRUD on clients table |

---

### 4.4 Client Detail

| Property | Value |
|----------|-------|
| Route | `/clients/:id` |
| Component | `src/pages/clients/detail.tsx` |
| Tabs | Overview, Projects, Payments, Documents, Notes |
| Inputs | Edit dialogs for client, project, invoice, document, note |
| Buttons | Edit Client, Add Project, Add Invoice, Add Document, Add Note |
| API calls | `GET /api/clients/:id`, `GET /api/projects?clientId=`, `GET /api/payments?clientId=`, `GET /api/documents/:clientId`, `GET /api/notes?clientId=` |
| Computed fields | Total revenue, outstanding balance, number of open payments |

---

### 4.5 Projects List

| Property | Value |
|----------|-------|
| Route | `/projects` |
| Component | `src/pages/projects/index.tsx` |
| Inputs | Search, Status filter, Priority filter, View toggle (list/grid) |
| Outputs | Table (list mode) or card grid (grid mode) |
| Buttons | New Project (dialog), row action menu |
| API calls | `GET /api/projects?status=&priority=&search=`, `POST /api/projects` |
| Note | Priority filter is front-end only — projects list endpoint only supports `status` and `search` filters on the server. Priority filter happens client-side by filtering the full response. |

---

### 4.6 Project Detail

| Property | Value |
|----------|-------|
| Route | `/projects/:id` |
| Component | `src/pages/projects/detail.tsx` |
| Tabs | Overview (progress + deliverables), Activity, Details (description), Notes (ownerNotes) |
| Inputs | Progress slider, Status select, inline edit fields |
| Buttons | Edit deliverable, Delete deliverable, Add deliverable |
| API calls | `GET /api/projects/:id` (returns deliverables, docs, notes inline), `POST /api/deliverables`, `PATCH /api/deliverables/:id`, `DELETE /api/deliverables/:id`, `PATCH /api/projects/:id` |

---

### 4.7 Tasks (Kanban)

| Property | Value |
|----------|-------|
| Route | `/tasks` |
| Component | `src/pages/tasks/index.tsx` |
| Outputs | 4 Kanban columns: To Do, In Progress, Review, Done |
| Inputs | Task creation dialog, task edit dialog |
| Buttons | New Task, task card (opens detail) |
| API calls | `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` |
| Note | No drag-and-drop despite the GripVertical icon being rendered |

---

### 4.8 Calendar

| Property | Value |
|----------|-------|
| Route | `/calendar` |
| Component | `src/pages/calendar/index.tsx` |
| Outputs | 7-day weekly grid with color-coded events |
| Inputs | Week navigation (prev/next/this week) |
| API calls | `GET /api/calendar` |
| Event types | `project_deadline` (red/orange), `meeting` (blue), `payment_due` (green) |

---

### 4.9 Payments

| Property | Value |
|----------|-------|
| Route | `/payments` |
| Component | `src/pages/payments/index.tsx` |
| Inputs | Search (client-side filter on invoice number), Status filter |
| Buttons | New Invoice (dialog), Download PDF (jsPDF) |
| API calls | `GET /api/payments`, `POST /api/payments` |

---

### 4.10 Documents

| Property | Value |
|----------|-------|
| Route | `/documents` |
| Component | `src/pages/documents/index.tsx` |
| Inputs | Search (client-side), Type filter |
| Buttons | Add Document (dialog) |
| API calls | `GET /api/documents/all`, `POST /api/documents/:clientId` |

---

### 4.11 Reports

| Property | Value |
|----------|-------|
| Route | `/reports` |
| Component | `src/pages/reports/index.tsx` |
| Outputs | Summary stats, Revenue by month bar chart, Revenue by client pie chart |
| API calls | `GET /api/reports/overview`, `GET /api/reports/revenue` |
| Charts | Recharts BarChart (monthly revenue) + PieChart (by client) |

---

### 4.12 Search

| Property | Value |
|----------|-------|
| Route | `/search` |
| Component | `src/pages/search/index.tsx` |
| Inputs | Search bar (synced to `?q=` query param) |
| Outputs | Mixed-type result cards |
| API calls | `GET /api/search?q=<term>` |

---

### 4.13 Settings

| Property | Value |
|----------|-------|
| Route | `/settings` |
| Component | `src/pages/settings/index.tsx` |
| Tabs | Agency, Notifications, Account, Theme |
| API calls | `GET /api/settings/agency`, `PUT /api/settings/agency`, `PATCH /api/auth/profile`, `PATCH /api/auth/password` |
| Validation | Email format (client-side), password minimum 8 chars (server-side) |

---

## 5. User Roles

### Role: `owner`

| Capability | Detail |
|-----------|--------|
| All CRUD operations | Clients, projects, deliverables, payments, documents, notes, meetings, tasks |
| View all pages | Full access |
| Register new users | `POST /api/auth/register` (gated by `requireOwner`) |
| Reset all data | `POST /api/admin/reset` (gated by `requireOwner`) |
| Change own password | `PATCH /api/auth/password` |
| Update own profile | `PATCH /api/auth/profile` |
| Update agency settings | `PUT /api/settings/agency` |

### Role: `member`

| Capability | Detail |
|-----------|--------|
| All CRUD operations | Clients, projects, deliverables, payments, documents, notes, meetings, tasks |
| View all pages | Full access |
| Register new users | ❌ 403 Forbidden |
| Reset all data | ❌ 403 Forbidden (Clear Data button not shown in UI — uncertain: the UI check is not confirmed in code, only the API is protected) |

### Authentication

- Session-based via `express-session` + `connect-pg-simple`
- Cookie name: `autflow.sid`
- `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production only
- Session contains: `{ userId, userRole, userName, userEmail }`
- Sessions expire after 7 days (`maxAge: 7 * 24 * 60 * 60 * 1000`)

### Authorization

- `requireAuth` middleware: checks `req.session.userId` exists → 401 if not
- `requireOwner` middleware: checks `req.session.userRole === "owner"` → 403 if not
- All routes except `/api/healthz`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` sit behind `requireAuth`

### Important gap

There is no per-user data isolation. All authenticated users (owner and member alike) can see and modify ALL data in the system. This is fine for a single-agency setup, but means the product is **not multi-tenant**.

---

## 6. Database

### Entity Relationship Diagram (ASCII)

```
users ──────────────────────────────────────────────
                                                    │
agency_settings ────────────────────────────────────┘ (no FK — separate singleton)

sessions (connect-pg-simple standard schema)

clients ┐
  │     └── projects ┐
  │                  └── deliverables
  │                  └── documents (also directly from clients)
  │                  └── notes    (also directly from clients)
  ├── payments (projectId optional FK → projects SET NULL on delete)
  ├── documents
  ├── notes
  ├── meetings
  └── activity (clientId optional FK → clients SET NULL)
       └── (entityType/entityId loosely reference any entity)

tasks (clientId optional, projectId optional — no cascade constraint)
```

---

### Table 1: `clients`

**Purpose**: Master record for each agency client.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Auto-increment |
| company_name | TEXT | NOT NULL | |
| logo_url | TEXT | nullable | URL only, no upload |
| industry | TEXT | nullable | Free text |
| website | TEXT | nullable | |
| email | TEXT | nullable | |
| phone | TEXT | nullable | |
| primary_contact | TEXT | nullable | Free text, not linked to users |
| secondary_contact | TEXT | nullable | |
| address | TEXT | nullable | |
| timezone | TEXT | nullable | Free text, no validation |
| status | TEXT | NOT NULL DEFAULT 'active' | prospect/active/inactive/churned |
| start_date | DATE | nullable | |
| contract_value | NUMERIC(15,2) | nullable | |
| monthly_retainer | NUMERIC(15,2) | nullable | |
| payment_method | TEXT | nullable | Free text |
| notes | TEXT | nullable | Internal notes |
| tags | TEXT[] | NOT NULL DEFAULT '{}' | Array of strings |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Auto-updated by Drizzle `$onUpdate` |

**No indexes** beyond the PK. `company_name`, `email`, `industry` are searched via `ilike` but have no GIN/btree indexes.

---

### Table 2: `projects`

**Purpose**: Work engagement between the agency and a client.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| client_id | INTEGER | NOT NULL FK → clients(id) CASCADE | If client deleted, all projects deleted |
| name | TEXT | NOT NULL | |
| status | TEXT | NOT NULL DEFAULT 'planning' | planning/design/development/testing/review/delivered/paused/waiting/cancelled |
| priority | TEXT | NOT NULL DEFAULT 'medium' | low/medium/high/urgent |
| progress | INTEGER | NOT NULL DEFAULT 0 | 0–100, manually set |
| start_date | DATE | nullable | |
| deadline | DATE | nullable | |
| estimated_budget | NUMERIC(15,2) | nullable | |
| actual_cost | NUMERIC(15,2) | nullable | |
| revenue | NUMERIC(15,2) | nullable | |
| description | TEXT | nullable | Public project description |
| owner_notes | TEXT | nullable | Private internal notes |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Computed by API** (not stored): `profit = revenue - actual_cost`, `clientName` (joined from clients).

---

### Table 3: `deliverables`

**Purpose**: Individual line-item deliverables within a project.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| project_id | INTEGER | NOT NULL FK → projects(id) CASCADE | |
| title | TEXT | NOT NULL | |
| status | TEXT | NOT NULL DEFAULT 'pending' | pending/in_progress/review/done |
| deadline | DATE | nullable | |
| assigned_to | TEXT | nullable | Free text — not a FK to users |
| completion_date | DATE | nullable | |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 4: `payments`

**Purpose**: Invoice/payment tracking per client.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| client_id | INTEGER | NOT NULL FK → clients(id) CASCADE | |
| project_id | INTEGER | nullable FK → projects(id) SET NULL | |
| invoice_number | TEXT | NOT NULL | No uniqueness constraint — duplicates possible |
| amount | NUMERIC(15,2) | NOT NULL | |
| status | TEXT | NOT NULL DEFAULT 'pending' | pending/paid/overdue/cancelled |
| due_date | DATE | nullable | |
| paid_date | DATE | nullable | |
| payment_method | TEXT | nullable | |
| remaining_balance | NUMERIC(15,2) | nullable | For partial payments |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Business risk**: No unique constraint on `invoice_number`. Two invoices with the same number can exist.

---

### Table 5: `documents`

**Purpose**: Links to client-related external documents.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| client_id | INTEGER | NOT NULL FK → clients(id) CASCADE | |
| project_id | INTEGER | nullable FK → projects(id) SET NULL | |
| title | TEXT | NOT NULL | |
| type | TEXT | NOT NULL DEFAULT 'other' | contract/invoice/proposal/design/brand_assets/link/google_drive/github/figma/other |
| url | TEXT | nullable | No URL validation beyond client-side placeholder |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 6: `notes`

**Purpose**: Internal free-text notes on clients or projects.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| client_id | INTEGER | nullable FK → clients(id) CASCADE | |
| project_id | INTEGER | nullable FK → projects(id) SET NULL | |
| content | TEXT | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 7: `meetings`

**Purpose**: Record of client meetings.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| client_id | INTEGER | NOT NULL FK → clients(id) CASCADE | |
| date | TIMESTAMPTZ | NOT NULL | |
| summary | TEXT | nullable | |
| action_items | TEXT | nullable | Free text, not structured |
| next_meeting | TIMESTAMPTZ | nullable | |
| attachments | TEXT | nullable | Free text, not actual file upload |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 8: `tasks`

**Purpose**: Internal task management (Kanban board items).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| title | TEXT | NOT NULL | |
| priority | TEXT | NOT NULL DEFAULT 'medium' | low/medium/high/urgent |
| status | TEXT | NOT NULL DEFAULT 'todo' | todo/in_progress/review/done |
| deadline | DATE | nullable | |
| notes | TEXT | nullable | |
| client_id | INTEGER | nullable FK → clients(id) SET NULL | |
| project_id | INTEGER | nullable FK → projects(id) SET NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 9: `activity`

**Purpose**: Append-only audit log of all significant events.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| type | TEXT | NOT NULL | e.g. client_created, project_updated, payment_added, meeting_logged |
| entity_type | TEXT | NOT NULL | client/project/payment/meeting/note/task |
| entity_id | INTEGER | nullable | The ID of the affected record |
| description | TEXT | NOT NULL | Human-readable description |
| client_id | INTEGER | nullable FK → clients(id) SET NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Note**: No UPDATE or DELETE on this table — it is an append-only log.

---

### Table 10: `agency_settings`

**Purpose**: Singleton agency profile + configuration.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | Always 1 row |
| agency_name | TEXT | NOT NULL DEFAULT 'AutFlow Studio' | |
| agency_email | TEXT | NOT NULL DEFAULT '...' | |
| website | TEXT | nullable | |
| support_email | TEXT | nullable | |
| logo_url | TEXT | nullable | |
| default_currency | TEXT | NOT NULL DEFAULT 'USD' | |
| timezone | TEXT | NOT NULL DEFAULT 'UTC' | |
| invoice_prefix | TEXT | NOT NULL DEFAULT 'INV' | |
| payment_terms_days | INTEGER | NOT NULL DEFAULT 30 | |
| tax_rate | NUMERIC(5,2) | NOT NULL DEFAULT 0 | |
| notify_invoice_paid | BOOLEAN | NOT NULL DEFAULT TRUE | Stored but not acted upon |
| notify_deadline_approaching | BOOLEAN | NOT NULL DEFAULT TRUE | Stored but not acted upon |
| notify_weekly_digest | BOOLEAN | NOT NULL DEFAULT TRUE | Stored but not acted upon |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### Table 11: `users`

**Purpose**: User accounts for the system.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | SERIAL | PK | |
| name | TEXT | NOT NULL | |
| email | TEXT | NOT NULL UNIQUE | Lowercased and trimmed on write |
| password_hash | TEXT | NOT NULL | bcrypt, cost factor 12 |
| role | TEXT | NOT NULL DEFAULT 'member' | owner / member |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| last_login_at | TIMESTAMPTZ | nullable | Updated on every login |

**Not a Drizzle-managed table** — created manually in `migrate.ts` because authentication was added after the initial Drizzle schema.

---

### Table 12: `sessions`

**Purpose**: `connect-pg-simple` session store.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| sid | VARCHAR | PK, NOT DEFERRABLE | Session ID (cookie value) |
| sess | JSON | NOT NULL | Session data as JSON |
| expire | TIMESTAMP(6) | NOT NULL | Expiry time |

**Index**: `idx_sessions_expire` on `expire` (for efficient cleanup of expired sessions).

---

## 7. APIs

All API routes are prefixed with `/api`. All routes except health and auth are protected by `requireAuth`.

### Authentication Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/healthz` | Public | Health check |
| POST | `/auth/login` | Public | Login with email + password |
| POST | `/auth/logout` | Public | Destroy session + clear cookie |
| GET | `/auth/me` | requireAuth (internal check) | Get current session user |
| POST | `/auth/register` | requireOwner | Create new user (owner only) |
| PATCH | `/auth/password` | requireAuth | Change own password |
| PATCH | `/auth/profile` | requireAuth | Update own name/email |

**POST /api/auth/login**
- Input: `{ email: string, password: string }`
- Validation: 400 if either missing
- Logic: lowercases email, runs `bcrypt.compare`. Uses constant-time dummy hash compare when user not found (prevents user enumeration)
- On success: saves session, updates `lastLoginAt`, returns `PublicUser`
- Errors: 401 "Invalid email or password"

**GET /api/auth/me**
- Auth: manually checks `req.session.userId` (does not use `requireAuth` middleware, handles it inline)
- Fetches fresh user from DB on every call (session data is stale-safe)
- If user deleted from DB: destroys session, returns 401

---

### Settings Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/settings/agency` | requireAuth | Get agency settings (creates defaults if missing) |
| PUT | `/settings/agency` | requireAuth | Update agency settings |

---

### Dashboard Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/dashboard` | requireAuth | Full dashboard data in one response |

**GET /api/dashboard returns**:
```typescript
{
  totalClients: number;
  activeClients: number;
  projectsInProgress: number;
  completedProjects: number;
  delayedProjects: number;
  upcomingDeadlines: Project[];       // next 30 days, max 5
  projectsAtRisk: Project[];          // past deadline OR <30% + deadline<30d
  projectsNeedingAttention: Project[];// paused/waiting/zero-progress
  invoicesAwaitingPayment: number;
  outstandingPayments: number;
  totalRevenue: number;               // all-time paid
  monthlyRevenue: number;             // (uncertain: appears to be all-time paid, not filtered by month)
  recentActivity: Activity[];         // last 10
  upcomingMeetings: Meeting[];        // next 5 from now
  recentNotes: Note[];                // last 5
}
```

---

### Client Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/clients` | requireAuth | List clients (filter: status, search) |
| POST | `/clients` | requireAuth | Create client |
| GET | `/clients/:id` | requireAuth | Get client with projects, payments summary, open payments |
| PATCH | `/clients/:id` | requireAuth | Update client |
| DELETE | `/clients/:id` | requireAuth | Delete client (CASCADE deletes all related data) |
| GET | `/clients/:clientId/timeline` | requireAuth | Activity history for one client |

**GET /clients/:id also returns**:
- `projects`: all projects for this client
- `openPayments`: pending + overdue payments
- `totalRevenue`: sum of all paid payments
- `outstandingBalance`: sum of pending + overdue

---

### Project Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/projects` | requireAuth | List (filter: clientId, status, search) |
| POST | `/projects` | requireAuth | Create |
| GET | `/projects/:id` | requireAuth | Get with deliverables, documents, notes |
| PATCH | `/projects/:id` | requireAuth | Update |
| DELETE | `/projects/:id` | requireAuth | Delete (CASCADE deliverables) |

---

### Deliverable Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/deliverables` | requireAuth | List (filter: projectId) |
| POST | `/deliverables` | requireAuth | Create |
| PATCH | `/deliverables/:id` | requireAuth | Update |
| DELETE | `/deliverables/:id` | requireAuth | Delete |

---

### Payment Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/payments` | requireAuth | List (filter: clientId, status) |
| POST | `/payments` | requireAuth | Create |
| GET | `/payments/:id` | requireAuth | Get single |
| PATCH | `/payments/:id` | requireAuth | Update status / amount |
| DELETE | `/payments/:id` | requireAuth | Delete |

---

### Document Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/documents/:clientId` | requireAuth | List docs for a client |
| GET | `/documents/all` | requireAuth | All documents across all clients |
| POST | `/documents/:clientId` | requireAuth | Create |
| PATCH | `/documents/:id` | requireAuth | Update |
| DELETE | `/documents/:id` | requireAuth | Delete |

---

### Note Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/notes` | requireAuth | List (filter: clientId, projectId) |
| POST | `/notes` | requireAuth | Create |
| PATCH | `/notes/:id` | requireAuth | Update content |
| DELETE | `/notes/:id` | requireAuth | Delete |

---

### Meeting Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/meetings` | requireAuth | List (filter: clientId) |
| POST | `/meetings` | requireAuth | Create |
| GET | `/meetings/:id` | requireAuth | Get single |
| PATCH | `/meetings/:id` | requireAuth | Update |
| DELETE | `/meetings/:id` | requireAuth | Delete |

---

### Task Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/tasks` | requireAuth | List (filter: status, clientId) |
| POST | `/tasks` | requireAuth | Create |
| PATCH | `/tasks/:id` | requireAuth | Update |
| DELETE | `/tasks/:id` | requireAuth | Delete |

---

### Utility Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/activity` | requireAuth | Recent activity (limit param, default 50) |
| GET | `/calendar` | requireAuth | Unified calendar events |
| GET | `/search` | requireAuth | Global search (q param required) |
| GET | `/reports/overview` | requireAuth | Aggregate business metrics |
| GET | `/reports/revenue` | requireAuth | Revenue breakdown by client + month |
| POST | `/admin/reset` | requireOwner | Truncate all data tables |

---

### Error Response Format

All errors return: `{ "error": "message string" }`

In production, 500 errors are masked as `"Internal server error"`. In development, the actual error message is returned.

HTTP status codes used:
- `200 OK` — successful read/update
- `201 Created` — successful create
- `204 No Content` — successful delete
- `400 Bad Request` — missing/invalid input (Zod validation failure)
- `401 Unauthorized` — not authenticated
- `403 Forbidden` — authenticated but insufficient role
- `404 Not Found` — entity doesn't exist
- `409 Conflict` — duplicate email on user creation
- `500 Internal Server Error` — unhandled error

---

## 8. Backend Architecture

### Folder Structure

```
artifacts/api-server/
├── build.mjs              ← esbuild bundler config
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           ← Entry point: PORT validation, process guards, listen
    ├── app.ts             ← Express setup: CORS, session, pino-http, error handler
    ├── lib/
    │   └── logger.ts      ← Pino logger with header redaction
    ├── middleware/
    │   └── auth.ts        ← requireAuth + requireOwner guards
    ├── routes/
    │   ├── index.ts       ← Route registry + auth gate
    │   ├── auth.ts
    │   ├── health.ts
    │   ├── settings-api.ts
    │   ├── dashboard.ts
    │   ├── clients.ts
    │   ├── projects.ts
    │   ├── deliverables.ts
    │   ├── payments.ts
    │   ├── documents.ts
    │   ├── notes.ts
    │   ├── meetings.ts
    │   ├── tasks.ts
    │   ├── activity.ts
    │   ├── timeline.ts
    │   ├── calendar.ts
    │   ├── search.ts
    │   ├── reports.ts
    │   └── admin.ts
    └── types/
        └── session.d.ts   ← Express session type augmentation
```

### Architecture Style

**Flat REST API with route-per-resource pattern.** No controllers layer, no service layer, no repository layer — business logic sits directly in route handler functions. This is intentional simplicity but limits testability and creates potential code duplication.

### Application Layers

```
Request
  ↓
pino-http (request logging)
  ↓
cors (origin: true, credentials: true)
  ↓
express.json() + express.urlencoded()
  ↓
express-session (reads/writes to PostgreSQL sessions table)
  ↓
Route matching
  ↓
[requireAuth / requireOwner middleware if protected route]
  ↓
Route handler:
  → Input validation via Zod (from @workspace/api-zod)
  → Drizzle ORM query
  → Activity log insert (for mutating operations)
  → JSON response
  ↓
Global error handler (catches any thrown error)
```

### Build System

The production build uses **esbuild** (not tsc) via `build.mjs`. Key decisions:
- Bundles to a single `dist/index.mjs` (ESM)
- Uses `esbuildPluginPino` to handle pino's worker thread requirements
- CJS compatibility shim injected via `banner` (sets `globalThis.require`, `__filename`, `__dirname`)
- Long list of known native packages marked as external (kerberos, leveldown, etc.)
- Source maps enabled (`sourcemap: "linked"`)

**Why esbuild and not tsc**: Much faster builds. The bundling into a single file simplifies the production artifact.

### Session Management

```
Cookie: autflow.sid
Store: PostgreSQL (connect-pg-simple → sessions table)
Secret: SESSION_SECRET environment variable (throws at startup if missing)
Duration: 7 days
Flags: httpOnly, sameSite=lax, secure=true (production only)
```

Sessions are saved immediately on login. The `saveUninitialized: false` setting means sessions are not saved until login.

**Critical gotcha in code**: `createTableIfMissing: true` is intentionally NOT set on `connect-pg-simple` because esbuild strips the bundled `table.sql` asset at build time, causing a runtime crash. The sessions table must be pre-created by `migrate.ts`.

### Error Handling

Three levels:
1. **Zod validation**: every route validates input with `safeParse()`. Returns `400 { error: zodError.message }` on failure.
2. **Express 5 async error forwarding**: async handlers don't need `try/catch` or `asyncHandler` wrappers — Express 5 automatically forwards thrown errors to the error middleware.
3. **Global error handler**: catches everything, logs with Pino, returns `{ error: message }` with appropriate status code. Guards against `res.headersSent`.

Process-level guards:
- `process.on("uncaughtException")` — logs and continues (does not crash server)
- `process.on("unhandledRejection")` — logs and continues
- `process.on("SIGTERM")` — graceful exit

### Logging

Pino structured JSON logging. In development, `pino-pretty` colorizes logs. In production, raw JSON. Sensitive headers are redacted: `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']`.

### Transactions

**No database transactions are used anywhere.** Activity log inserts happen in separate queries after the main mutation. If the activity insert fails, the main operation has already committed. This is a correctness risk for audit trail consistency.

---

## 9. Frontend Architecture

### Pages

13 pages (listed in Section 4). Routing handled by **Wouter** (lightweight React Router alternative). Base path support via `import.meta.env.BASE_URL`.

### Component Tree

```
App
├── ErrorBoundary
├── ThemeProvider (next-themes)
├── AuthProvider (session state)
│   ├── AgencyProfileProvider (agency settings)
│   │   ├── QueryClientProvider (TanStack Query)
│   │   │   ├── TooltipProvider
│   │   │   ├── WouterRouter (base = BASE_URL)
│   │   │   │   └── AuthGate
│   │   │   │       ├── (loading spinner)
│   │   │   │       ├── LoginPage (if no user)
│   │   │   │       └── Layout + Router (if user)
│   │   │   └── Toaster (sonner)
```

### State Management

| Layer | Tool | What's stored |
|-------|------|---------------|
| Server state | TanStack Query (React Query) | All API responses (clients, projects, etc.) |
| Auth state | AuthProvider (React Context) | `{ user, loading, login, logout }` |
| Agency profile | AgencyProfileProvider (Context) | `{ profile, setProfile }` — from `/api/settings/agency` |
| Theme | next-themes + localStorage | light/dark/system preference |
| Notifications (seen) | localStorage | Set of seen notification IDs |
| Form state | Local component state (useState) | Dialog forms only — no global form state |

**No Redux, Zustand, or other global state manager.** React Context for auth + agency profile; React Query for everything else.

### Forms

Forms are managed with local `useState` inside dialog components. No `react-hook-form` library is used despite it being in `package.json` — this is a dependency brought in by the scaffold that is not actually used in any page component. Form validation is minimal (HTML `required` attributes, select constraints).

### API Communication

The frontend uses **generated React Query hooks** from `lib/api-client-react` (generated by Orval from an OpenAPI spec). These are typed wrappers around `fetch`. The `custom-fetch.ts` file sets the base URL and `credentials: "include"` (required for session cookies).

Some API calls bypass the generated hooks — notably `AuthProvider` calls `fetch("/api/auth/me")` directly, and `POST /api/auth/login` / `POST /api/auth/logout` are also plain fetch calls in `auth-provider.tsx`.

### Navigation

```
Sidebar (desktop):
├── Dashboard
├── Clients
├── Projects
├── Tasks
├── Calendar
├── Payments
├── Documents
├── Reports
└── (Settings accessible via user menu)

Top bar:
├── Search icon → /search
├── Notification bell (dropdown)
└── User avatar → dropdown (Profile, Settings, Sign out)

Mobile: hamburger menu opens the same sidebar as a drawer
```

The notification bell pulls data from the already-loaded dashboard query — no separate notification API. "Unread" state tracks which notification IDs have been opened using `localStorage`.

### Error States

- **Global**: `ErrorBoundary` component catches React render errors and shows a fallback UI
- **Per-query**: TanStack Query's error state is used in some pages (not consistently — some pages silently show empty state on error)
- **Auth errors**: 401 responses do not automatically redirect to login — the user would need to refresh. The `retry` config skips retrying on 401/403 to avoid infinite loops.

### Loading States

Skeleton components (`<Skeleton>`) used consistently across all list and detail pages. Custom spinner shown during initial auth check.

### Design System

Radix UI primitives + shadcn/ui component library + Tailwind CSS. Dark theme is the default. Light theme is available. Custom CSS variables define the palette in `src/index.css`. Components: accordion, alert-dialog, avatar, badge, button, card, calendar, chart, checkbox, command, dialog, dropdown-menu, drawer, form, input, label, popover, progress, radio-group, scroll-area, select, separator, skeleton, slider, switch, table, tabs, textarea, toast, toggle, tooltip.

---

## 10. Business Logic

### Status Transitions

**Clients**: No enforced transition order. Any status can be set to any other. `prospect → active` is the implicit happy path.

**Projects**: No enforced transitions. All 9 statuses are selectable freely from any current status. Business logic for "at-risk" and "delayed" is computed in the dashboard endpoint:
- **Delayed**: deadline < today AND status ∉ {delivered, cancelled}
- **At-risk**: delayed OR (progress < 30% AND deadline ≤ 30 days from now)
- **Needing attention**: status = paused OR waiting OR (progress = 0 AND status ∉ {planning, cancelled})

**Payments**: No enforced transitions. Can set `pending → paid`, `pending → overdue`, etc.

**Deliverables**: No enforced transitions.

**Tasks**: No enforced transitions.

### Financial Rules

- `profit` is computed on every project response as `revenue - actual_cost` (both nullable — profit is null if either is null)
- `remaining_balance` on payments is an optional manually-entered field (no auto-calculation from partial payments)
- No tax calculation in invoices despite `tax_rate` being in agency settings
- Revenue reports count a payment as "paid" when `status === "paid"` — the `paid_date` is not required

### Invoice Numbering

- `invoice_prefix` from agency settings (e.g. "INV") is stored but **not used to auto-generate invoice numbers**. The user must manually enter the invoice number. There is no auto-increment.

### Singleton Pattern (Agency Settings)

`getOrCreateSettings()` in `settings-api.ts`:
```
SELECT first row FROM agency_settings
→ if exists: return it
→ if not: INSERT with defaults, return new row
```
This is not idempotent under concurrent requests (two simultaneous first-time requests could both INSERT) but the risk is low in practice.

### Cascade Deletion Rules

| Parent deleted | Child behavior |
|----------------|----------------|
| Client | Projects CASCADE, payments CASCADE, documents CASCADE, notes CASCADE, meetings CASCADE, activity SET NULL |
| Project | Deliverables CASCADE, documents SET NULL, notes SET NULL, tasks SET NULL |

**Important**: Deleting a client wipes all linked data permanently with no soft-delete or recovery mechanism.

### Data Reset (Admin)

`TRUNCATE TABLE ... RESTART IDENTITY CASCADE` on 9 tables. Does NOT touch:
- `users` table (no demo users are deleted)
- `agency_settings` table (configuration preserved)
- `sessions` table (active sessions preserved)

This means after a reset, the owner remains logged in.

### Activity Logging Rules

Activity is logged for: client_created, client_updated, project_created, project_updated, payment_added, payment_updated, meeting_logged. **Not logged**: deliverable changes, document uploads, note creations, task changes. This is an inconsistency — some operations create audit trail entries, others don't.

---

## 11. Security Review

### Authentication: ✅ GOOD

- bcrypt with cost factor 12 (strong)
- Constant-time dummy hash compare prevents user enumeration
- Session-based (no JWT → no token theft via XSS reading localStorage)
- Passwords never returned in API responses (PublicUser omits passwordHash)
- Email normalized (lowercased, trimmed) before storage and lookup

### Authorization: ⚠️ PARTIAL

- `requireAuth` correctly checks session on every protected route
- `requireOwner` correctly restricts admin operations
- **Gap**: No row-level security. Any authenticated user can read, update, or delete any record. In a multi-user scenario, a `member` can delete a client, project, or payment — there is no "only the creator can delete" rule.
- **Gap**: No ownership check on user profile update — a member could not update another user's profile (no route for that), but there's also no protection preventing the owner account from being demoted via the `register` route (since role is freely settable).

### Password Handling: ✅ GOOD

- bcrypt with cost 12 (secure)
- Password not logged anywhere
- Minimum 8 characters enforced server-side on `PATCH /auth/password`
- No minimum length on initial registration (gap — an owner could set a weak password for a new member)

### Session Management: ✅ GOOD

- Sessions stored server-side in PostgreSQL (not JWTs)
- `httpOnly: true` — not accessible to JavaScript
- `sameSite: "lax"` — CSRF protection for non-GET requests from cross-site navigators
- `secure: true` in production — cookie only sent over HTTPS
- 7-day expiry
- `saveUninitialized: false` — no session created for unauthenticated requests

### Input Validation: ✅ GOOD

- All route inputs validated with Zod schemas (from `@workspace/api-zod`)
- `safeParse()` used (not `parse()`) — failures return 400, not crashes
- URL fields are not validated for being real URLs (only client-side placeholder text hints)

### SQL Injection: ✅ SAFE

- All queries use Drizzle ORM parameterized queries
- The single raw `sql` template literal (TRUNCATE in admin reset) uses no user input
- Dashboard and search use `ilike` with bound parameters, not string concatenation

### XSS Protection: ⚠️ PARTIAL

- React's JSX naturally escapes string output (inherent protection)
- No explicit Content-Security-Policy headers set
- `dangerouslySetInnerHTML` is not used anywhere in the reviewed code
- No input sanitization library (DOMPurify etc.) — but since content is rendered through React, this is lower risk

### CSRF: ✅ ADEQUATE FOR USE CASE

- `sameSite: "lax"` on the cookie is the primary CSRF defense
- CORS `origin: true` reflects the request origin with `credentials: true` — this is potentially permissive but requires the cookie to also be present, which `sameSite: lax` restricts to same-site navigation + top-level GETs
- No CSRF token implemented

### Secrets / Environment Variables: ✅ GOOD

- `SESSION_SECRET` throws at startup if not set (fail-fast)
- `DATABASE_URL` throws at startup if not set (fail-fast)
- Both managed as Replit Secrets (not hardcoded)
- Pino redacts Authorization and Cookie headers from logs

### Rate Limiting: ❌ MISSING

- No rate limiting on login endpoint — brute force attacks are possible
- No rate limiting on any API endpoint
- **Risk level**: HIGH for login endpoint specifically

### File Upload Security: N/A

- No file uploads implemented (documents are URL links only)

### Potential Vulnerabilities Summary

| Vulnerability | Severity | Status |
|---------------|----------|--------|
| No rate limiting on `/auth/login` | HIGH | Not mitigated |
| No HTTPS enforcement (app-layer) | MEDIUM | Mitigated by Replit proxy in production |
| Any member can delete any record | MEDIUM | Not mitigated |
| No Content-Security-Policy headers | MEDIUM | Not mitigated |
| Duplicate invoice numbers allowed | LOW | Not mitigated |
| Singleton race condition in agency_settings | LOW | Very low risk in practice |
| No input length limits on text fields | LOW | Partially mitigated by Zod |

### Overall Security Risk Level: **MEDIUM**

Acceptable for a demo / internal tool. Not acceptable for a public-facing SaaS without adding rate limiting and row-level authorization.

---

## 12. Code Quality Review

### Architecture: **7/10**

Clean separation between frontend and backend. Monorepo with shared libraries is a sound choice. Route-per-file organization is easy to navigate. The lack of a service layer means business logic is scattered in route handlers, making testing harder.

### Readability: **8/10**

Code is clean and consistent. TypeScript types are well-used. Route handlers are clear and follow identical patterns. Variable names are descriptive. Comments explain non-obvious decisions (esbuild banner, createTableIfMissing caveat).

### Maintainability: **7/10**

The pattern repetition across routes is high (every route has the same Zod validate → DB query → map response flow). This could be abstracted. The lack of database transactions is a maintainability risk. No automated tests.

### Scalability: **5/10**

No indexes beyond primary keys on searched/filtered columns. No caching layer. Dashboard runs 6 sequential and parallel queries on every page load. This works for small data but will degrade.

### Modularity: **7/10**

Routes are well-modularized. Shared libraries (`lib/db`, `lib/api-zod`, `lib/api-client-react`) are a good pattern. The frontend components are somewhat monolithic (detail pages do a lot), but feature components are colocated with their pages.

### Reusability: **6/10**

`mapProject()` and `mapPayment()` helpers exist for response shaping. `StatusBadge` and `PageHeader` are reusable UI components. Form dialogs are not extracted into reusable components — each page defines its own dialog, leading to code duplication for client/project/payment forms that appear in multiple places.

### Naming: **9/10**

Excellent naming throughout. Table names, column names, route names, component names, and variable names are all clear and intentional.

### Complexity: **7/10**

No overly complex algorithms. The dashboard endpoint is the most complex (6 queries + multiple derived metrics). The Kanban board grouping logic in the tasks page is straightforward. Nothing feels over-engineered.

### Code Smells: **Minor issues**

- `react-hook-form` is in `package.json` but not used in any component
- `cookie-parser` is in `package.json` but not used (express-session handles cookies directly)
- Priority filter on the projects list page is frontend-only despite the API supporting server-side filtering by status — the full dataset is fetched and filtered in the browser
- `assigned_to` on deliverables is a text field that implies user assignment but doesn't reference the users table

### Technical Debt: **Moderate**

- No automated tests (unit, integration, or e2e)
- No database transactions
- No API versioning
- No pagination on any list endpoint (all records always returned)
- Mock/demo data in `seed.ts` has no mechanism to stay synchronized with schema changes

---

## 13. Missing Features

### Critical (blocking production use)

| Feature | Why it's critical |
|---------|-------------------|
| Rate limiting on auth | Login endpoint is brute-forceable |
| Pagination on all list endpoints | Performance collapses with >500 records |
| Multi-tenancy / workspace isolation | Multiple agency owners cannot use the same instance |
| Email notifications | Notification toggles exist in settings but do nothing |
| Password reset via email | No way to recover a lost password |
| Proper error states in UI | Some pages show empty state on network error with no feedback |
| DB indexes on searched columns | `company_name`, `email`, `invoice_number` need btree indexes |

### Important (needed for paying customers)

| Feature | Why it's important |
|---------|-------------------|
| File uploads (not just URL links) | Documents section is incomplete without actual upload |
| Drag-and-drop Kanban | The GripVertical icon implies it — users will expect it |
| Auto-generated invoice numbers | Current UX requires manual entry |
| Tax calculation on invoices | `tax_rate` field exists but isn't applied |
| Line items on invoices | Current invoices have only a total amount |
| Recurring invoice / retainer billing | Monthly retainer field exists but no automation |
| Client portal (read-only view for clients) | Clients cannot see their own project status |
| User management UI | Owners can register users via API but there's no UI for listing/managing/deleting users |
| Role-based UI restrictions | Members can delete any record — the UI doesn't enforce the owner/member distinction beyond the admin reset button |
| Data export (CSV/PDF) | Reports cannot be exported |
| Audit log UI | Activity table exists but there's no full audit log page (only per-client timeline) |
| Soft delete / recycle bin | Client deletion is instant and permanent |

### Nice-to-have

| Feature | Why it's nice |
|---------|---------------|
| Google Calendar / Outlook sync | Calendar view is isolated |
| Slack / email digests | Weekly digest toggle exists but does nothing |
| Time tracking per project | Common agency need |
| Client onboarding workflow | Guided first-time experience |
| Proposal generation | Agencies often create proposals before projects |
| Contract templates | Documents section could be expanded |
| Referral tracking | Useful for agency growth |
| Revenue forecasting | Future revenue based on retainers |
| Mobile app | App is responsive but not native |
| Dark/light logo variants | Single logo URL in agency settings |
| White-labeling | Agency branding applied to client portal |

---

## 14. Scalability

### 100 users (10 agencies × 10 users each)

**Requires**: Multi-tenancy (complete rebuild of data isolation). Currently 100 users would share one data namespace — everything would be visible to everyone. The architecture fundamentally does not support this without adding a `workspace_id` or `tenant_id` to every table and modifying every query.

**Technical feasibility**: Would require schema migration adding tenant isolation to all 12 tables plus all API queries.

### Single agency, growing data (100–500 clients, 1000 projects)

**Verdict**: Works with minor fixes. The dashboard queries are the biggest concern — they load all clients, all projects, and all payments into Node.js memory. At 500 clients × 50 projects = 25,000 projects, this becomes slow. Fix: add pagination + DB-side aggregation.

**Bottlenecks**:
- `/api/dashboard` — loads entire dataset into Node.js, computes metrics in JS
- `/api/reports/revenue` — loads all payments, groups in JS
- `/api/search` — 4 `ilike` queries with no full-text search indexes
- No pagination on any endpoint

### 1,000 users (enterprise single-tenant)

**Verdict**: Not viable without:
- Proper connection pooling (PgBouncer or equivalent — currently one `pg.Pool` per API process)
- Pagination on all endpoints
- Indexes on frequently queried columns
- Moving dashboard aggregations to SQL (not Node.js)
- Read replicas for reporting queries

### 10,000+ users

**Verdict**: Would require a significant architectural overhaul:
- Proper multi-tenancy with row-level security
- Redis for session storage (PostgreSQL session table won't scale)
- Background job queues for notifications
- Separate microservices for heavy operations (reporting, search)
- CDN for static assets
- Horizontal API server scaling (currently stateless, which is good)

---

## 15. Deployment

### Required Services

| Service | Purpose | Current Provider |
|---------|---------|-----------------|
| PostgreSQL | Primary data store + sessions | Replit Neon (dev) / Neon (prod) |
| Node.js 24 | Runtime | Replit container |
| Object storage | File uploads | ❌ Not implemented |
| Email service | Password reset, notifications | ❌ Not implemented |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ Yes | Random secret for session signing (min 32 chars recommended) |
| `PORT` | ✅ Yes (API) | Port for API server (8080 in production) |
| `NODE_ENV` | Yes | `production` enables secure cookies, disables pino-pretty |
| `BASE_URL` | Yes (frontend) | Base path for Vite app (injected by Replit artifact system) |
| `LOG_LEVEL` | Optional | Default: `info`. pino log level |

### Production Run Commands

**API server**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
**Frontend**: Built with `vite build` → static files served by Replit's proxy

### Database Setup (required before first deploy)

```bash
pnpm --filter @workspace/scripts run migrate   # creates all tables + default admin
pnpm --filter @workspace/scripts run seed      # (optional) demo data
```

**Critical**: `migrate` must run before the API server starts. If the `sessions` table does not exist, `connect-pg-simple` will crash on the first request.

### Production Checklist

- [ ] `SESSION_SECRET` set to a cryptographically random string (≥32 chars)
- [ ] `DATABASE_URL` points to production database
- [ ] `NODE_ENV=production` set for API server
- [ ] `migrate` script run against production database
- [ ] Default admin password changed after first login
- [ ] Rate limiting added to auth endpoints
- [ ] HTTPS confirmed (Replit handles this automatically)

### Hosting Architecture (Replit)

```
Replit Proxy (TLS termination)
  ↓
Path routing:
  / → autflow-studio frontend (Vite, port 22583)
  /api → api-server (Express, port 8080)

Development: Vite proxy → localhost:8080
Production: Replit handles routing between artifacts
```

---

## 16. Product Roadmap

### Version 1.1 — "Production Ready"
*Goal: Everything a paying solo agency owner needs*

- **Rate limiting** on auth endpoints (express-rate-limit)
- **Password reset** via email (SendGrid / Postmark)
- **Pagination** on all list endpoints (cursor-based)
- **Database indexes** on company_name, email, status, deadline columns
- **User management UI** — list users, reset passwords, deactivate accounts
- **Auto-generated invoice numbers** using agency prefix + sequential number
- **Drag-and-drop Kanban** (react-dnd or @dnd-kit)
- **Soft delete** for clients (mark as archived, don't CASCADE immediately)
- **Email notifications** — wire up the existing boolean toggles to actual email sends

### Version 2.0 — "Team Edition"
*Goal: Multi-user agency teams*

- **Role-based access control** — owners can restrict members from deleting records
- **Per-user task assignment** — link `assigned_to` to actual user accounts
- **Commenting** on projects and tasks (real-time or polling)
- **File uploads** via object storage (Replit Object Storage / S3)
- **Time tracking** — log hours against projects, compute billable hours vs budget
- **Project templates** — create a new project from a saved template
- **Recurring invoices** — auto-generate monthly invoices for retainer clients
- **Line-item invoices** — break invoices into individual service line items
- **Tax calculation** — apply `tax_rate` from agency settings to invoices
- **CSV export** for clients, projects, payments

### Version 3.0 — "Multi-Tenant SaaS"
*Goal: Multiple agencies on one platform*

- **Multi-tenancy** — complete data isolation between workspaces
- **Workspace invite flow** — invite team members by email
- **Client portal** — read-only view for clients to see their project status
- **Stripe integration** — real payment processing for invoices
- **Google Calendar sync** — two-way meeting sync
- **API webhooks** — notify external systems on status changes
- **Custom fields** — agency owners add custom fields to clients/projects
- **White-labeling** — custom logo, color scheme, domain for client portal

### Enterprise Version
*Goal: Large agency groups, enterprise sales*

- **Multi-workspace management** — group multiple agency workspaces under one account
- **SSO / SAML** integration
- **Custom reporting** — drag-and-drop report builder
- **Audit logs UI** with filtering, export, and retention policies
- **SLA management** — track response times and deliverable commitments
- **Capacity planning** — team availability and workload visualization
- **Advanced revenue forecasting** — project future revenue from retainers + pipeline

---

## 17. Competitive Analysis

*Based only on what exists in the code — no external market research applied.*

### Direct competitors inferred from feature set

| Competitor | Overlap | Gap vs AutFlow |
|-----------|---------|----------------|
| **HoneyBook** | Client management, invoices, proposals, contracts | HoneyBook has payment processing, e-signatures, scheduling |
| **Dubsado** | CRM, invoices, proposals, workflows | Dubsado has automation, questionnaires, scheduler |
| **Monday.com** | Project management, Kanban | Monday.com has advanced automation, Gantt charts |
| **FreshBooks** | Invoicing, payments, time tracking | FreshBooks has real payment processing, time tracking |
| **Notion** | Notes, tasks, documents | Notion is a horizontal tool, not agency-specific |
| **Trello / Linear** | Kanban boards | More mature task management, team features |

### AutFlow Studio's positioning (based on code)

**Strengths vs competitors**:
- All-in-one: CRM + project management + invoicing + documents in one app
- Agency-specific data model (clients → projects → deliverables → payments is a perfect agency workflow)
- Clean, modern dark-theme UI
- Self-hostable (no per-seat SaaS pricing required)
- Full-stack TypeScript with clean architecture — easy to customize

**Weaknesses vs competitors**:
- No real payment processing (tracking only)
- No email integration
- No automation / triggers
- No mobile app
- No multi-user data isolation
- No file storage

### Positioning opportunity

The most defensible position is **"the open-source, self-hosted agency OS"** targeting agency owners who don't want to pay $50-200/month for HoneyBook/Dubsado but want something more structured than Notion.

---

## 18. Technical Complexity

### Effort Estimates

| Role | Time to Understand Codebase | Time to Add a New Feature |
|------|-----------------------------|--------------------------|
| Junior developer | 1–2 weeks | 1–3 days per feature (lots of copy-paste from existing routes/pages) |
| Mid-level developer | 2–3 days | 4–8 hours per feature |
| Senior developer | 4–8 hours | 1–2 hours per feature |

### Estimated Development Time (from scratch)

| Component | Senior Dev Estimate |
|-----------|---------------------|
| Backend (all 16 route files) | 3–4 weeks |
| Frontend (all 13 pages + components) | 4–5 weeks |
| Shared libraries (db, api-zod, api-client-react) | 1–2 weeks |
| Monorepo setup, build pipeline, deployment config | 3–5 days |
| Migration + seed scripts | 2–3 days |
| **Total** | **~9–12 weeks solo** |

### Difficulty Score: **6/10**

The project is above average in scope for an MVP — full-stack TypeScript monorepo with Drizzle ORM, generated API clients, and a 12-table schema is not trivial. The difficulty is in breadth (many entities) rather than depth (no complex algorithms). The architecture is learnable in a day for a mid-level developer.

---

## 19. Business Evaluation

### Market Potential

- **TAM**: Global market for agency management software is $1B+
- **SAM**: Solo and small digital agencies (< 10 people): estimated 500k+ in English-speaking markets
- **SOM**: Early reachable market — 1,000–10,000 paying agencies at $50–150/month = $600k–$18M ARR potential at scale

### Pricing Potential

| Tier | Price | Target |
|------|-------|--------|
| Solo | $29–49/month | Freelancers, 1-person agencies |
| Team | $79–99/month | 2–5 person agencies |
| Agency | $149–199/month | 5–20 person agencies |
| Self-hosted | One-time $299–499 | Technical owners who want control |

### Who would buy it

- Solo web designers / developers managing 5–15 clients
- Small branding agencies frustrated with piecing together 5 different tools
- Freelancers "leveling up" their business operations
- Agencies that want a self-hosted alternative to HoneyBook (privacy, data control)

### Who would NOT buy it

- Agencies already invested in HoneyBook/Dubsado (switching cost too high without a killer differentiator)
- Agencies needing real payment processing (Stripe integration is missing)
- Large agencies (>20 people) who need advanced role management
- Non-technical agency owners who need hand-holding onboarding

### Business Strengths

1. **Correct problem framing** — "one tool to run your agency" is a validated pain point
2. **Right data model** — Clients → Projects → Deliverables → Payments is exactly how agencies think
3. **Modern, professional UI** — doesn't look like a side project
4. **TypeScript codebase** — easy to hire for, easy to maintain
5. **Deployable today** — working MVP with demo data

### Business Weaknesses

1. **No moat yet** — the feature set is reachable by competitors
2. **Missing killer features** — payment processing, email, file uploads
3. **Not multi-tenant** — can't run as a SaaS without a major rebuild
4. **No marketing / growth mechanics** — no freemium, no referral, no SEO

### Monetization Ideas

1. **SaaS subscription** (requires multi-tenancy rebuild)
2. **Self-hosted one-time license** with optional support/update subscription
3. **White-label license** — sell to agencies who want to offer it to their clients
4. **Marketplace** — sell add-ons (Stripe integration, email module, client portal)

---

## 20. Final Verdict

### What is this project really?

A **well-built, full-featured agency management MVP** with a professional design and a correct data model. It covers the operational surface area of a solo agency's daily work — clients, projects, invoices, tasks, and reporting — in one cohesive application. It is clearly built by someone who understands the agency workflow, not just by a developer following a spec.

### How complete is it?

**~65–70% complete** for a solo agency owner's daily use. The core loops (add client → create project → track deliverables → log invoice → mark paid) are fully functional. Missing is everything around the edges: email notifications, password recovery, file uploads, drag-and-drop, auto-invoice numbering.

### Is it MVP?

**Yes, with caveats.** It is a functional MVP for a *single* agency owner using it in a controlled environment. It is not MVP-ready for a *multi-tenant SaaS* — the data model needs structural changes before multiple paying customers can use the same instance.

### Beta?

**Yes** — for a closed beta where one agency owner tests it on real data. Would surface meaningful feedback.

### Production-ready?

**No**, for the following specific reasons:
1. No rate limiting on login (security risk)
2. No password recovery
3. No pagination (data volume risk)
4. Missing sessions table in production (deployment bug — now fixed in this session)
5. Not multi-tenant

### Would you invest in it?

**Yes, at pre-seed** — the foundation is solid, the problem is real, the code quality is above average for an MVP. The risk is market crowding (HoneyBook, Dubsado are established) and the need for a focused differentiation strategy. The technical bet is sound.

### Would you buy it?

**Yes, if:**
- You are a solo agency owner looking for a customizable tool you can self-host
- You have a developer who can extend it
- You want to avoid per-seat SaaS pricing

**No, if:**
- You need a production SaaS out of the box
- You need real payment processing
- You manage more than ~200 clients

### Biggest Strengths

1. **Excellent UX/UI** — looks like a real product, not a tutorial
2. **Correct domain model** — maps exactly to how agencies work
3. **Clean, maintainable TypeScript** — easy to extend
4. **Good security fundamentals** — bcrypt, sessions, Zod validation all correct
5. **Self-contained and deployable** — works end-to-end on day one

### Biggest Weaknesses

1. **Not multi-tenant** — architectural gap that blocks SaaS commercialization
2. **No rate limiting** — the only real security weakness
3. **No automated tests** — any refactor is a manual regression risk
4. **No pagination** — will degrade with real production data
5. **Notification toggles that do nothing** — creates false user expectations

---

*End of report. Total entities reviewed: 13 pages, 16 API route files, 12 database tables, 5 shared library packages, 2 infrastructure scripts, all configuration files.*
