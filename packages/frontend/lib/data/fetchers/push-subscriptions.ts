/**
 * WEB PUSH SUBSCRIPTION FETCHERS
 *
 * Registers/unregisters this device's browser PushSubscription with the
 * backend's PushModule (`push.controller.ts` — `@Controller('push')`,
 * JwtAuthGuard, `POST`/`DELETE /push/subscriptions`).
 *
 * Routed through `fetchAPIRaw` (base.ts), same as every other fetcher — which
 * resolves through the same-origin `/backend` proxy in the browser
 * (`app/backend/[[...path]]/route.ts`). That proxy joins path segments
 * verbatim and forwards the `Authorization` header, so it works for this
 * non-`/api`-prefixed backend route with no extra Next.js route needed.
 */

import { fetchAPIRaw } from "./base";

export interface PushSubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

export interface PushSubscribeRequest {
  endpoint: string;
  keys: PushSubscriptionKeysDto;
  userAgent?: string;
}

/** Registers a browser PushSubscription with the backend. */
export async function subscribeToPush(
  subscription: PushSubscribeRequest,
): Promise<boolean> {
  const res = await fetchAPIRaw("/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return res.ok;
}

/** Removes a PushSubscription (identified by endpoint) from the backend. */
export async function unsubscribeFromPush(endpoint: string): Promise<boolean> {
  const res = await fetchAPIRaw("/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return res.ok;
}
