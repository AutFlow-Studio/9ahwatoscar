import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const PgStore = connectPg(session);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the Replit preview domain + localhost dev. The sameSite+httpOnly cookie
// config is the primary CSRF protection for session-based auth.
app.use(
  cors({
    origin: true,          // reflect origin (safe with credentials: include)
    credentials: true,     // allow cookies cross-origin for dev proxy
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Session middleware ────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1); // Trust Replit's reverse proxy

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "sessions",
      // createTableIfMissing is intentionally omitted — esbuild strips the
      // bundled table.sql at build time. Table is created by scripts/migrate.ts.
    }),
    name: "autflow.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,          // HTTPS only in production
      sameSite: "lax",         // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Global error handler ─────────────────────────────────────────────────────
// Express 5 forwards async errors automatically via next(err).
// This middleware catches everything not handled by routes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode
    ?? 500;

  const message =
    isProd && status === 500
      ? "Internal server error"
      : (err instanceof Error ? err.message : String(err));

  logger.error({ err, url: req.url, method: req.method }, "Unhandled request error");

  // Guard against "headers already sent" if a response was partially flushed
  if (res.headersSent) return;
  res.status(status).json({ error: message });
});

export default app;
