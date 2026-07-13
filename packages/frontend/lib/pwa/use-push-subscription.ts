"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/data/fetchers/push-subscriptions";
import { urlBase64ToUint8Array } from "./push-encoding";

export type PushPermissionState = NotificationPermission | "unsupported";

interface UsePushSubscriptionReturn {
  isSupported: boolean;
  permission: PushPermissionState;
  subscribing: boolean;
  /**
   * Requests permission (if not yet decided) and registers this device for
   * push. Must be invoked from a user gesture (e.g. a button `onClick`) —
   * `Notification.requestPermission()` is blocked outside one in most
   * browsers.
   */
  subscribe: () => Promise<boolean>;
  /**
   * Re-registers this device's subscription with the backend without
   * prompting — for a device that already has `Notification.permission ===
   * "granted"` but no active `PushSubscription` (new browser profile,
   * cleared site data, etc.).
   */
  resubscribeIfNeeded: () => Promise<boolean>;
}

function detectSupport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Manages this device's Web Push subscription: permission state, and
 * subscribing/resubscribing via the Push API + backend (see
 * lib/data/fetchers/push-subscriptions.ts).
 */
export function usePushSubscription(): UsePushSubscriptionReturn {
  const [isSupported] = useState(detectSupport);
  const [permission, setPermission] = useState<PushPermissionState>(() =>
    detectSupport() ? Notification.permission : "unsupported",
  );
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (isSupported) setPermission(Notification.permission);
  }, [isSupported]);

  // Shared by subscribe() and resubscribeIfNeeded(): reuses an existing
  // PushSubscription if one is already registered with the browser (avoids
  // creating a second one), otherwise creates one, then upserts it with the
  // backend. Assumes permission is already "granted" — callers gate on that.
  const registerSubscription = useCallback(async (): Promise<boolean> => {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    return subscribeToPush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    });
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setSubscribing(true);
    try {
      let currentPermission = Notification.permission;
      if (currentPermission === "default") {
        currentPermission = await Notification.requestPermission();
        setPermission(currentPermission);
      }
      if (currentPermission !== "granted") return false;
      return await registerSubscription();
    } catch (err) {
      console.error("[push] subscribe failed", err);
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [isSupported, registerSubscription]);

  const resubscribeIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!isSupported || Notification.permission !== "granted") return false;
    try {
      return await registerSubscription();
    } catch (err) {
      console.error("[push] silent resubscribe failed", err);
      return false;
    }
  }, [isSupported, registerSubscription]);

  return {
    isSupported,
    permission,
    subscribing,
    subscribe,
    resubscribeIfNeeded,
  };
}
