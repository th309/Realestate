/** HTTP auth helpers for the remote MCP transport. */

import type { Request, Response } from "express";
import { config } from "./config";

/**
 * Extract and validate a piq_live_* Bearer token from the request.
 * Returns the token string, or sends a 401 and returns null.
 */
export async function extractApiKey(
  req: Request,
  res: Response,
): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401);
    await res.json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Authorization required: Bearer piq_live_...",
      },
      id: null,
    });
    return null;
  }

  const token = auth.slice(7);
  if (!token.startsWith("piq_live_")) {
    res.status(401);
    await res.json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Invalid API key format. Keys start with piq_live_",
      },
      id: null,
    });
    return null;
  }

  return token;
}

/**
 * Validate key against the backend. The backend checks the key is active
 * and the user has Pro or Enterprise subscription.
 */
export async function validateApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const r = await fetch(`${config.apiUrl}/api/entitlements/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ resources: ["mcp_access"] }),
    });
    if (r.status === 401)
      return { valid: false, error: "Invalid or revoked API key" };
    if (r.status === 403)
      return { valid: false, error: "Pro or Enterprise subscription required" };
    if (!r.ok) return { valid: false, error: `Backend returned ${r.status}` };
    return { valid: true };
  } catch {
    return { valid: false, error: "Backend unreachable" };
  }
}
