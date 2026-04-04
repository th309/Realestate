import type { Request, Response } from "express";
import { lookupAccessToken } from "./oauth/tokens";
import { checkEntitlement } from "./oauth/entitlements-cache";
import type { SessionAuth } from "./session-context";

const MCP_BASE_URL = process.env.MCP_BASE_URL || "https://mcp.propertyiq.app";
const WWW_AUTHENTICATE = `Bearer resource_metadata="${MCP_BASE_URL}/.well-known/oauth-protected-resource", scope="mcp"`;

/** Send 401 with WWW-Authenticate header so ChatGPT triggers OAuth sign-in */
function send401(res: Response, message: string): void {
  res.setHeader("WWW-Authenticate", WWW_AUTHENTICATE);
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

/**
 * Extract and validate OAuth auth from request.
 * Returns a SessionAuth on success, or null (after sending error response).
 */
export async function extractAuth(
  req: Request,
  res: Response,
): Promise<SessionAuth | null> {
  const auth = req.headers.authorization;
  const headerSnippet = auth ? `Bearer ${auth.slice(7, 15)}...` : "none";
  console.log(`[Auth] extractAuth called | auth_header=${headerSnippet}`);

  if (!auth?.startsWith("Bearer ")) {
    console.log("[Auth] No Bearer token — returning 401");
    send401(res, "Authorization required");
    return null;
  }

  const token = auth.slice(7);

  try {
    const result = await lookupAccessToken(token);
    if (!result) {
      console.log("[Auth] OAuth token lookup: not_found");
      send401(res, "Invalid or expired access token");
      return null;
    }
    console.log(`[Auth] OAuth token lookup: found | userId=${result.userId}`);

    const allowed = await checkEntitlement(result.userId);
    if (!allowed) {
      console.log(`[Auth] Entitlement check: denied | userId=${result.userId}`);
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

    console.log(`[Auth] Entitlement check: allowed | userId=${result.userId}`);
    return { userId: result.userId };
  } catch (err) {
    console.log(
      `[Auth] Auth failed with error: ${err instanceof Error ? err.message : String(err)}`,
    );
    send401(res, "Authentication failed");
    return null;
  }
}
