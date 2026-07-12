/**
 * Web Push event handlers for the service worker — split out of app/sw.ts to
 * stay under CLAUDE.md's 300-line logic-file limit. Call `registerPushHandlers()`
 * once from app/sw.ts to attach them.
 *
 * Same worker-only type-checking story as sw.ts itself: covered by
 * tsconfig.worker.json ("webworker" lib), excluded from the main app tsconfig
 * (see tsconfig.json's `exclude` — it uses "dom", which conflicts).
 */

declare const self: ServiceWorkerGlobalScope;

/**
 * Payload shape sent by the backend's `PushService.sendToUser`
 * (packages/backend/src/push/push.service.ts). `url` and `badgeCount` are
 * optional so a malformed/legacy payload still shows a bare notification
 * instead of throwing.
 */
interface PiqPushPayload {
  title?: string;
  body?: string;
  url?: string;
  badgeCount?: number;
}

function handlePush(event: PushEvent): void {
  let payload: PiqPushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // Non-JSON or empty payload — fall through to the generic fallback below.
  }

  const title = payload.title || "PropertyIQ";
  const options: NotificationOptions = {
    body: payload.body,
    data: { url: payload.url || "/alerts" },
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "piq-alert",
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // App icon badge (installed PWA only) — best-effort. WorkerNavigator
      // declares setAppBadge unconditionally (lib.webworker.d.ts), but
      // real-world support is inconsistent, so the try/catch below is load
      // bearing, not defensive boilerplate.
      if (typeof payload.badgeCount === "number") {
        try {
          await self.navigator.setAppBadge(payload.badgeCount);
        } catch {
          // Non-fatal — the notification itself already showed.
        }
      }
    })(),
  );
}

function handleNotificationClick(event: NotificationEvent): void {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url || "/alerts";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = clientsList.find((client) => {
        const clientPath = new URL(client.url).pathname;
        return clientPath === new URL(url, self.location.origin).pathname;
      });
      if (existing) {
        await existing.focus();
        return;
      }
      const anyClient = clientsList[0];
      if (anyClient) {
        await anyClient.focus();
        await anyClient.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
}

/** Attaches the `push` and `notificationclick` listeners — call once from app/sw.ts. */
export function registerPushHandlers(): void {
  self.addEventListener("push", handlePush);
  self.addEventListener("notificationclick", handleNotificationClick);
}
