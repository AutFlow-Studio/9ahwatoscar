import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

// Shared service instance — stateless, safe to reuse across routes
export const objectStorageService = new ObjectStorageService();

/**
 * Allowed MIME types for document uploads.
 * Mirrors the frontend ACCEPTED_FILE_TYPES constant.
 * Reject anything not in this set at the URL-request stage so no signed URL
 * is ever issued for an unsupported file type.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",                                                       // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel",                                                // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // Some browsers/OSes report these for .doc/.xls
  "application/octet-stream",
]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB — matches frontend MAX_FILE_SIZE_MB

/**
 * POST /storage/uploads/request-url
 *
 * Returns a presigned GCS URL for direct client-side upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Auth is enforced by the requireAuth middleware in routes/index.ts.
 *
 * Validates:
 *   - All three fields are present
 *   - contentType is in the allowed list
 *   - size is a positive finite number ≤ 50 MB
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    const { name, size, contentType } = req.body ?? {};

    // ── Presence checks ──────────────────────────────────────────────────────
    if (!name || size == null || !contentType) {
      res.status(400).json({ error: "name, size, and contentType are required" });
      return;
    }

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name must be a non-empty string" });
      return;
    }

    // ── Content-type allowlist ───────────────────────────────────────────────
    const ct = String(contentType).toLowerCase().split(";")[0].trim();
    if (!ALLOWED_CONTENT_TYPES.has(ct)) {
      res.status(415).json({
        error: `File type not allowed. Accepted types: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG.`,
      });
      return;
    }

    // ── Size validation ──────────────────────────────────────────────────────
    const numericSize = Number(size);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      res.status(400).json({ error: "size must be a positive number" });
      return;
    }
    if (numericSize > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "File too large. Maximum allowed size is 50 MB." });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({
        uploadURL,
        objectPath,
        metadata: { name: name.trim(), size: numericSize, contentType: ct },
      });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL. Storage may not be configured." });
    }
  },
);

/**
 * GET /storage/objects/*path
 *
 * Streams a private GCS object to the client.
 * Auth is enforced by the requireAuth middleware in routes/index.ts.
 * Office documents (DOCX, XLSX, etc.) are sent with Content-Disposition: attachment.
 * Images and PDFs are served inline.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    if (!wildcardPath) {
      res.status(400).json({ error: "Object path is required" });
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // Force download for non-viewable types; let images and PDFs display inline
    const ct = response.headers.get("content-type") || "";
    if (!ct.startsWith("image/") && ct !== "application/pdf") {
      const raw = req.query.filename;
      const filename = raw
        ? String(raw).replace(/[^\w.\- ]/g, "_").slice(0, 200)
        : "download";
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found. It may have been deleted." });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to retrieve file." });
  }
});

/**
 * DELETE /storage/objects/*path
 *
 * Delete a private GCS object by its object path.
 * Auth is enforced by the requireAuth middleware in routes/index.ts.
 * Idempotent: returns 204 even if the object is already gone.
 */
router.delete("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    if (!wildcardPath) {
      res.status(400).json({ error: "Object path is required" });
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await objectFile.delete();
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.sendStatus(204); // already deleted — idempotent
      return;
    }
    req.log.error({ err: error }, "Error deleting object");
    res.status(500).json({ error: "Failed to delete file." });
  }
});

export default router;
