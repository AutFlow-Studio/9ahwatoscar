import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: require the request to have an authenticated session.
 * Returns 401 if no session user is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * Middleware: require the authenticated user to have the "owner" role.
 * Returns 401 if not authenticated, 403 if authenticated but not owner.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.session.userRole !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}
