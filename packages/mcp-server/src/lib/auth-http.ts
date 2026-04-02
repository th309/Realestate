import type { Request, Response } from "express";
import { lookupAccessToken } from "./oauth/tokens";
import { checkEntitlement } from "./oauth/entitlements-cache";
import type { SessionAuth } from "./session-context";

/**
 * Extract and validate auth from request.
 * Supports two token types:
 *   1. piq_live_* API keys (existing — Claude Code, Cursor, etc.)
 *   2. OAuth access tokens (new — claude.ai web connector)
 *
 * Returns a SessionAuth on success, or null (after sending error response).
 */
export async function extractAuth(
  req: Request,
  res: Response,
): Promise<SessionAuth | null> {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authorization required" },
      id: null,
    });
    return null;
  }

  const token = auth.slice(7);

  // Path 1: piq_live_* API key
  if (token.startsWith("piq_live_")) {
    return { type: "api_key", apiKey: token };
  }

  // Path 2: OAuth access token
  try {
    const result = await lookupAccessToken(token);
    if (!result) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Invalid or expired access token" },
        id: null,
      });
      return null;
    }

    const allowed = await checkEntitlement(result.userId);
    if (!allowed) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message:
            "Pro or Enterprise subscription required for MCP access. Visit propertyiq.app/pricing to subscribe.",
        },
        id: null,
      });
      return null;
    }

    return { type: "oauth", userId: result.userId };
  } catch {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authentication failed" },
      id: null,
    });
    return null;
  }
}

/** @deprecated Use extractAuth() for new code */
export async function extractApiKey(
  req: Request,
  res: Response,
): Promise<string | null> {
  const result = await extractAuth(req, res);
  if (!result) return null;
  return result.type === "api_key" ? result.apiKey : `oauth:${result.userId}`;
}
