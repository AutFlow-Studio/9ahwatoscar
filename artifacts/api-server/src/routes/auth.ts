import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import type { PublicUser } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/rate-limit";

const router: IRouter = Router();

function sanitizeUser(u: typeof usersTable.$inferSelect): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

// POST /api/auth/login
router.post("/auth/login", loginRateLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()))
    .limit(1);

  if (!user) {
    // Constant-time compare to prevent user enumeration
    await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Update last login timestamp
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // Persist session
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  res.json(sanitizeUser(user));
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("autflow.sid");
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json(sanitizeUser(user));
});

// POST /api/auth/register (owner-only after first user created)
router.post("/auth/register", requireAuth, async (req, res): Promise<void> => {
  if (req.session.userRole !== "owner") {
    res.status(403).json({ error: "Only owners can create new users" });
    return;
  }

  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const validRole = role === "owner" ? "owner" : "member";

  const [newUser] = await db
    .insert(usersTable)
    .values({ name: String(name).trim(), email: normalizedEmail, passwordHash, role: validRole })
    .returning();

  res.status(201).json(sanitizeUser(newUser));
});

// PATCH /api/auth/password — change own password
router.patch("/auth/password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new passwords are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

// PATCH /api/auth/profile — update own name/email
router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const { name, email } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name) updates.name = String(name).trim();
  if (email) updates.email = String(email).toLowerCase().trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.session.userId!))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Keep session in sync
  if (updates.name) req.session.userName = updated.name;
  if (updates.email) req.session.userEmail = updated.email;

  res.json(sanitizeUser(updated));
});

export default router;
