import rateLimit from "express-rate-limit";

/**
 * Rate limiter for the login endpoint.
 * Allows up to 5 failed attempts per IP per 15-minute window.
 * Successful logins (2xx) are excluded from the count.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,                  // max 5 failed attempts per window
  skipSuccessfulRequests: true, // only count non-2xx responses
  standardHeaders: "draft-7", // emit RateLimit-* headers per RFC draft 7
  legacyHeaders: false,
  message: {
    error:
      "Too many login attempts. Please wait 15 minutes before trying again.",
  },
  statusCode: 429,
});
