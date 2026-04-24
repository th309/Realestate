import type { Express, Request, Response } from "express";
import { invalidateMany } from "../lib/oauth/entitlements-cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Mounts internal service-to-service routes under /internal/*.
 *
 * These are NOT user-facing: they are called only by the backend
 * (packages/backend) using a shared secret. Not protected by OAuth.
 */
export function mountInternalRoutes(app: Express): void {
  app.post(
    "/internal/entitlements/invalidate",
    (req: Request, res: Response) => {
      const expected = process.env.MCP_INTERNAL_SECRET;
      if (!expected) {
        console.log(
          "[MCP Internal] Rejecting: MCP_INTERNAL_SECRET not configured",
        );
        res.status(401).json({ error: "internal_secret_not_configured" });
        return;
      }

      const header = req.headers.authorization ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

      // Constant-time comparison to avoid timing attacks on the secret
      const providedBuf = Buffer.from(provided);
      const expectedBuf = Buffer.from(expected);
      const ok =
        providedBuf.length === expectedBuf.length &&
        timingSafeEqual(providedBuf, expectedBuf);

      if (!ok) {
        console.log("[MCP Internal] Rejecting: bad/missing secret");
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const body = req.body as { userIds?: unknown };
      if (!Array.isArray(body.userIds)) {
        res.status(400).json({ error: "userIds must be an array of strings" });
        return;
      }

      const userIds = body.userIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      );
      const invalidated = invalidateMany(userIds);
      console.log(
        `[MCP Internal] Invalidate | requested=${body.userIds.length} | removed=${invalidated}`,
      );
      res.json({ invalidated });
    },
  );
}
