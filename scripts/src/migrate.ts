/**
 * Definitive migration script — creates every table the app needs.
 *
 * Safe to run multiple times — all statements use CREATE TABLE IF NOT EXISTS /
 * CREATE INDEX IF NOT EXISTS. Runs in any environment (no TTY required).
 *
 * Covers:
 *   • Drizzle-managed tables (clients, projects, deliverables, payments,
 *     documents, notes, meetings, tasks, activity, agency_settings)
 *   • Manually-managed tables (users, sessions)
 *   • Default admin user (created only when no users exist)
 *
 * Run order:
 *   pnpm --filter @workspace/scripts run migrate
 */
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

async function migrate() {
  const client = await pool.connect();
  try {
    // ── Drizzle-managed tables ────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id               SERIAL PRIMARY KEY,
        company_name     TEXT NOT NULL,
        logo_url         TEXT,
        industry         TEXT,
        website          TEXT,
        email            TEXT,
        phone            TEXT,
        primary_contact  TEXT,
        secondary_contact TEXT,
        address          TEXT,
        timezone         TEXT,
        status           TEXT NOT NULL DEFAULT 'active',
        start_date       DATE,
        contract_value   NUMERIC(15,2),
        monthly_retainer NUMERIC(15,2),
        payment_method   TEXT,
        notes            TEXT,
        tags             TEXT[] NOT NULL DEFAULT '{}',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id               SERIAL PRIMARY KEY,
        client_id        INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        name             TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'planning',
        priority         TEXT NOT NULL DEFAULT 'medium',
        progress         INTEGER NOT NULL DEFAULT 0,
        start_date       DATE,
        deadline         DATE,
        estimated_budget NUMERIC(15,2),
        actual_cost      NUMERIC(15,2),
        revenue          NUMERIC(15,2),
        description      TEXT,
        owner_notes      TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deliverables (
        id              SERIAL PRIMARY KEY,
        project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        deadline        DATE,
        assigned_to     TEXT,
        completion_date DATE,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                SERIAL PRIMARY KEY,
        client_id         INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        project_id        INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        invoice_number    TEXT NOT NULL,
        amount            NUMERIC(15,2) NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        due_date          DATE,
        paid_date         DATE,
        payment_method    TEXT,
        remaining_balance NUMERIC(15,2),
        notes             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id         SERIAL PRIMARY KEY,
        client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        title      TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT 'other',
        url        TEXT,
        notes      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         SERIAL PRIMARY KEY,
        client_id  INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id           SERIAL PRIMARY KEY,
        client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        date         TIMESTAMPTZ NOT NULL,
        summary      TEXT,
        action_items TEXT,
        next_meeting TIMESTAMPTZ,
        attachments  TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id         SERIAL PRIMARY KEY,
        title      TEXT NOT NULL,
        priority   TEXT NOT NULL DEFAULT 'medium',
        status     TEXT NOT NULL DEFAULT 'todo',
        deadline   DATE,
        notes      TEXT,
        client_id  INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity (
        id          SERIAL PRIMARY KEY,
        type        TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   INTEGER,
        description TEXT NOT NULL,
        client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agency_settings (
        id                          SERIAL PRIMARY KEY,
        agency_name                 TEXT NOT NULL DEFAULT 'AutFlow Studio',
        agency_email                TEXT NOT NULL DEFAULT 'hello@autflowstudio.com',
        website                     TEXT,
        support_email               TEXT,
        logo_url                    TEXT,
        default_currency            TEXT NOT NULL DEFAULT 'USD',
        timezone                    TEXT NOT NULL DEFAULT 'UTC',
        invoice_prefix              TEXT NOT NULL DEFAULT 'INV',
        payment_terms_days          INTEGER NOT NULL DEFAULT 30,
        tax_rate                    NUMERIC(5,2) NOT NULL DEFAULT 0,
        notify_invoice_paid         BOOLEAN NOT NULL DEFAULT TRUE,
        notify_deadline_approaching BOOLEAN NOT NULL DEFAULT TRUE,
        notify_weekly_digest        BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          SERIAL PRIMARY KEY,
        type        TEXT NOT NULL,
        title       TEXT NOT NULL,
        message     TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   INTEGER,
        href        TEXT,
        is_read     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Manually-managed tables ───────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'member',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      )
    `);

    // Sessions table for connect-pg-simple.
    // createTableIfMissing: true is intentionally NOT used — esbuild strips
    // the bundled table.sql at build time, so this script creates it instead.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid    VARCHAR      NOT NULL COLLATE "default",
        sess   JSON         NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        CONSTRAINT sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire)
    `);

    console.log("✓ All tables ensured.");

    // ── Default admin user (only when no users exist) ─────────────────────
    // This makes a fresh production deployment immediately usable without
    // running the full seed (which truncates data).
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users`
    );
    const userCount = parseInt(rows[0]!.count, 10);

    if (userCount === 0) {
      const hash = await bcrypt.hash("admin123", 12);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        ["Admin", "admin@autflow.io", hash, "owner"]
      );
      console.log("✓ Default admin user created (admin@autflow.io).");
    } else {
      console.log(`✓ ${userCount} user(s) already exist — skipping default admin.`);
    }

    console.log("✓ Migration complete.");
  } finally {
    client.release();
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
