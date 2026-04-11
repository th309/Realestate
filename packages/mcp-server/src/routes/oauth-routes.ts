/**
 * OAuth 2.1 routes for the PropertyIQ MCP server.
 *
 * Endpoints: dynamic client registration, authorization, callback, and token
 * exchange. Discovery endpoints (RFC 9728 / RFC 8414) live in
 * `oauth-discovery-routes.ts`.
 */

import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { mountOAuthDiscoveryRoutes } from "./oauth-discovery-routes";
import { registerClient, getClient } from "../lib/oauth/clients";
import { createAuthCode, exchangeCode } from "../lib/oauth/codes";
import { createTokens, refreshAccessToken } from "../lib/oauth/tokens";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://propertyiq.app";
const JWT_SECRET = process.env.MCP_OAUTH_JWT_SECRET
  ? new TextEncoder().encode(process.env.MCP_OAUTH_JWT_SECRET)
  : null;

/**
 * Mount all OAuth 2.1 routes on the given Express app.
 */
export function mountOAuthRoutes(app: Express): void {
  mountOAuthDiscoveryRoutes(app);

  // ── Dynamic client registration (no auth) ──

  app.post("/register", async (req: Request, res: Response) => {
    try {
      const { client_name, redirect_uris, grant_types, response_types } =
        req.body;
      console.log(
        `[OAuth] POST /register | client_name=${client_name} | redirect_uris=${JSON.stringify(redirect_uris)}`,
      );
      if (
        !redirect_uris ||
        !Array.isArray(redirect_uris) ||
        redirect_uris.length === 0
      ) {
        res.status(400).json({ error: "redirect_uris is required" });
        return;
      }
      const client = await registerClient({
        client_name,
        redirect_uris,
        grant_types,
        response_types,
      });
      console.log(`[OAuth] Client registered: ${client.client_id}`);
      res.status(201).json({
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
      });
    } catch (error) {
      console.error("[OAuth] Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── Authorization endpoint ──

  app.get("/authorize", async (req: Request, res: Response) => {
    try {
      if (!JWT_SECRET) {
        res.status(500).json({ error: "OAuth not configured" });
        return;
      }
      const {
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state,
        response_type,
      } = req.query as Record<string, string>;
      console.log(
        `[OAuth] GET /authorize | client_id=${client_id} | redirect_uri=${redirect_uri} | state=${state}`,
      );

      if (response_type !== "code") {
        res.status(400).json({ error: "unsupported_response_type" });
        return;
      }
      // PKCE is required for MCP clients (Claude, etc.) but optional for
      // ChatGPT Actions which uses plain OAuth 2.0 without code_challenge.
      if (code_challenge && code_challenge_method !== "S256") {
        res.status(400).json({
          error: "invalid_request",
          error_description: "S256 required when using PKCE",
        });
        return;
      }
      if (!client_id || !redirect_uri) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "Missing required parameters",
        });
        return;
      }

      // Validate client
      const client = await getClient(client_id);
      if (!client) {
        res.status(400).json({ error: "invalid_client" });
        return;
      }
      console.log(`[OAuth] Client validated: ${client_id}`);
      // Trusted OAuth callback domains — ChatGPT generates a new GPT ID on
      // every save, so exact redirect_uri matching is impossible. Allow any
      // callback from trusted AI platform domains.
      const TRUSTED_CALLBACK_PREFIXES = [
        "https://chat.openai.com/aip/",
        "https://chatgpt.com/aip/",
        "https://claude.ai/api/mcp/",
      ];
      const isTrustedRedirect =
        client.redirect_uris.includes(redirect_uri) ||
        TRUSTED_CALLBACK_PREFIXES.some((p) => redirect_uri.startsWith(p));
      if (!isTrustedRedirect) {
        console.log(`[OAuth] Rejected redirect_uri: ${redirect_uri}`);
        res.status(400).json({
          error: "invalid_request",
          error_description: "redirect_uri not registered",
        });
        return;
      }

      // Pack OAuth params into signed JWT
      const mcpSession = await new SignJWT({
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method: "S256",
        state: state || "",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("10m")
        .sign(JWT_SECRET);

      // Redirect to frontend consent page
      const consentUrl = new URL("/auth/mcp-authorize", FRONTEND_URL);
      consentUrl.searchParams.set("mcp_session", mcpSession);
      console.log(`[OAuth] Redirecting to consent: ${consentUrl.toString()}`);
      res.redirect(302, consentUrl.toString());
    } catch (error) {
      console.error("[OAuth] Authorize error:", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── OAuth callback (frontend redirects here after user consents) ──

  app.get("/oauth/callback", async (req: Request, res: Response) => {
    try {
      if (!JWT_SECRET) {
        res.status(500).json({ error: "OAuth not configured" });
        return;
      }
      const {
        mcp_session,
        token,
        error: authError,
      } = req.query as Record<string, string>;
      console.log(
        `[OAuth] GET /oauth/callback | has_mcp_session=${!!mcp_session} | has_token=${!!token} | has_error=${!!authError}`,
      );

      if (!mcp_session) {
        res.status(400).json({ error: "Missing mcp_session" });
        return;
      }

      // Verify JWT
      let payload: Record<string, string>;
      try {
        const result = await jwtVerify(mcp_session, JWT_SECRET);
        payload = result.payload as unknown as Record<string, string>;
      } catch {
        res.status(400).json({ error: "Invalid or expired session" });
        return;
      }

      console.log(
        `[OAuth] JWT verified | client_id=${payload.client_id} | redirect_uri=${payload.redirect_uri}`,
      );
      const redirectUri = new URL(payload.redirect_uri);

      // User denied
      if (authError) {
        console.log(`[OAuth] User denied access, redirecting with error`);
        redirectUri.searchParams.set("error", authError);
        if (payload.state) redirectUri.searchParams.set("state", payload.state);
        res.redirect(302, redirectUri.toString());
        return;
      }

      if (!token) {
        res.status(400).json({ error: "Missing token" });
        return;
      }

      // Validate Supabase token to get user ID
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        res.status(500).json({ error: "OAuth not configured" });
        return;
      }
      const sb = createClient(supabaseUrl, supabaseKey);
      const {
        data: { user },
        error: userError,
      } = await sb.auth.getUser(token);
      if (userError || !user) {
        res.status(400).json({ error: "Invalid user token" });
        return;
      }
      console.log(`[OAuth] User validated: ${user.id} | email=${user.email}`);

      // Create authorization code
      const code = await createAuthCode({
        clientId: payload.client_id,
        userId: user.id,
        redirectUri: payload.redirect_uri,
        codeChallenge: payload.code_challenge,
      });

      // Redirect to client callback with code and state
      console.log(
        `[OAuth] Auth code created, redirecting to: ${payload.redirect_uri} (code=${code.slice(0, 8)}...)`,
      );
      redirectUri.searchParams.set("code", code);
      if (payload.state) redirectUri.searchParams.set("state", payload.state);
      res.redirect(302, redirectUri.toString());
    } catch (error) {
      console.error("[OAuth] Callback error:", error);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── Token endpoint ──

  app.post("/token", async (req: Request, res: Response) => {
    try {
      const { grant_type, code, code_verifier, redirect_uri, refresh_token } =
        req.body;
      console.log(`[OAuth] POST /token | grant_type=${grant_type}`);

      if (grant_type === "authorization_code") {
        if (!code || !redirect_uri) {
          res.status(400).json({ error: "invalid_request" });
          return;
        }
        console.log(
          `[OAuth] Exchanging code=${code.slice(0, 8)}... | redirect_uri=${redirect_uri}`,
        );
        const result = await exchangeCode(code, redirect_uri, code_verifier);
        console.log(`[OAuth] Token exchange success | userId=${result.userId}`);
        const tokens = await createTokens(result.clientId, result.userId);
        res.json(tokens);
        return;
      }

      if (grant_type === "refresh_token") {
        if (!refresh_token) {
          res.status(400).json({ error: "invalid_request" });
          return;
        }
        console.log(`[OAuth] Refreshing token=${refresh_token.slice(0, 8)}...`);
        const tokens = await refreshAccessToken(refresh_token);
        res.json(tokens);
        return;
      }

      res.status(400).json({ error: "unsupported_grant_type" });
    } catch (error) {
      console.error("[OAuth] Token error:", error);
      res.status(400).json({
        error: "invalid_grant",
        error_description: (error as Error).message,
      });
    }
  });
}
