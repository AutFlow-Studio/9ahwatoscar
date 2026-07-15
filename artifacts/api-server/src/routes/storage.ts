import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

// Shared service instance — stateless, safe to reuse across routes
export const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Returns a presigned GCS URL for direct client-side upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Auth is enforced by the requireAuth middleware in routes/index.ts.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    const { name, size, contentType } = req.body ?? {};
    if (!name || size == null || !contentType) {
      res.status(400).json({ error: "name, size, and contentType are required" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
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
    const objectPath = `/objects/${wildcardPath}`;

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // Force download for non-viewable types; let images and PDFs display inline
    const ct = response.headers.get("content-type") || "";
    if (!ct.startsWith("image/") && ct !== "application/pdf") {
      const filename = req.query.filename
        ? String(req.query.filename).replace(/"/g, "")
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
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
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
    const objectPath = `/objects/${wildcardPath}`;

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await objectFile.delete();
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.sendStatus(204); // already deleted — treat as success
      return;
    }
    req.log.error({ err: error }, "Error deleting object");
    res.status(500).json({ error: "Failed to delete object" });
  }
});

export default router;
