/**
 * OAuth 2.1 discovery endpoints — RFC 9728 (protected resource metadata)
 * and RFC 8414 (authorization server metadata).
 *
 * Both responses are host-aware: the server is reachable on multiple
 * hostnames (custom domain + Railway URL), and strict OAuth client libraries
 * require `resource` (RFC 9728) and `issuer` (RFC 8414 §2) to match the URL
 * the metadata was fetched from. We resolve the host from the request and
 * mint metadata that matches.
 */

import type { Express, Request } from "express";
import {
  protectedResourceMetadata,
  authorizationServerMetadata,
  resolveResourceUrl,
} from "../lib/oauth/metadata";

function serverUrlFromRequest(req: Request): string {
  return resolveResourceUrl(
    (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host,
    req.headers["x-forwarded-proto"] as string | undefined,
  );
}

export function mountOAuthDiscoveryRoutes(app: Express): void {
  app.get("/.well-known/oauth-protected-resource", (req, res) => {
    const serverUrl = serverUrlFromRequest(req);
    console.log(
      `[OAuth] GET /.well-known/oauth-protected-resource | server=${serverUrl}`,
    );
    res.json(protectedResourceMetadata(serverUrl));
  });

  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    const serverUrl = serverUrlFromRequest(req);
    console.log(
      `[OAuth] GET /.well-known/oauth-authorization-server | server=${serverUrl}`,
    );
    res.json(authorizationServerMetadata(serverUrl));
  });
}
