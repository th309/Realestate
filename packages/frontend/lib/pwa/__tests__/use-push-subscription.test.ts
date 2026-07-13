import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mockSubscribeToPush = vi.fn();
vi.mock("@/lib/data/fetchers/push-subscriptions", () => ({
  subscribeToPush: (...args: unknown[]) => mockSubscribeToPush(...args),
}));

const ORIGINAL_ENV_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const TEST_VAPID_KEY = "dGVzdA"; // decodes to "test" — enough for urlBase64ToUint8Array

function makeSubscription(
  overrides: Partial<{ endpoint: string; p256dh: string; auth: string }> = {},
) {
  const endpoint = overrides.endpoint ?? "https://push.example.com/abc";
  const p256dh = overrides.p256dh ?? "p256dh-key";
  const auth = overrides.auth ?? "auth-key";
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh, auth } }),
  };
}

interface MockPushManager {
  getSubscription: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

function installBrowserSupport(pushManager: MockPushManager) {
  (window as unknown as { PushManager: unknown }).PushManager = class {};
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({ pushManager }),
    },
  });
}

function installNotification(
  initialPermission: NotificationPermission,
  requestPermissionResult: NotificationPermission = initialPermission,
) {
  const requestPermission = vi.fn().mockResolvedValue(requestPermissionResult);
  let permission = initialPermission;
  (window as unknown as { Notification: unknown }).Notification = class {
    static get permission() {
      return permission;
    }
    static requestPermission = requestPermission;
  };
  return {
    requestPermission,
    setPermission(next: NotificationPermission) {
      permission = next;
    },
  };
}

describe("usePushSubscription", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSubscribeToPush.mockReset();
    mockSubscribeToPush.mockResolvedValue(true);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = TEST_VAPID_KEY;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ORIGINAL_ENV_KEY;
    // @ts-expect-error -- test cleanup of a global stubbed per-test
    delete window.PushManager;
    // @ts-expect-error -- test cleanup of a global stubbed per-test
    delete window.Notification;
    // @ts-expect-error -- restoring jsdom default (no serviceWorker) between tests
    delete navigator.serviceWorker;
  });

  it("reports isSupported false when the Push API isn't available", async () => {
    installNotification("default");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.isSupported).toBe(false);
  });

  it("reports isSupported true and mirrors Notification.permission when available", async () => {
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(),
    };
    installBrowserSupport(pushManager);
    installNotification("default");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.isSupported).toBe(true);
    expect(result.current.permission).toBe("default");
  });

  it("subscribe(): requests permission, creates a subscription, and registers it with the backend", async () => {
    const subscription = makeSubscription();
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    installBrowserSupport(pushManager);
    const { requestPermission } = installNotification("default", "granted");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(mockSubscribeToPush).toHaveBeenCalledWith({
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
      userAgent: navigator.userAgent,
    });
    expect(success).toBe(true);
    await waitFor(() => expect(result.current.permission).toBe("granted"));
  });

  it("subscribe(): permission-denied path never creates a subscription or calls the backend", async () => {
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(),
    };
    installBrowserSupport(pushManager);
    installNotification("default", "denied");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    let success = true;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(mockSubscribeToPush).not.toHaveBeenCalled();
  });

  it("subscribe(): already-subscribed short-circuit reuses the existing subscription instead of creating a new one", async () => {
    const existing = makeSubscription({
      endpoint: "https://push.example.com/existing",
    });
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(existing),
      subscribe: vi.fn(),
    };
    installBrowserSupport(pushManager);
    // Already granted — subscribe() must not re-prompt.
    const { requestPermission } = installNotification("granted");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(mockSubscribeToPush).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example.com/existing",
      }),
    );
    expect(success).toBe(true);
  });

  it("resubscribeIfNeeded(): no-ops (no prompt, no backend call) when permission isn't already granted", async () => {
    const pushManager = {
      getSubscription: vi.fn(),
      subscribe: vi.fn(),
    };
    installBrowserSupport(pushManager);
    installNotification("default");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    let success = true;
    await act(async () => {
      success = await result.current.resubscribeIfNeeded();
    });

    expect(success).toBe(false);
    expect(pushManager.getSubscription).not.toHaveBeenCalled();
    expect(mockSubscribeToPush).not.toHaveBeenCalled();
  });

  it("resubscribeIfNeeded(): silently registers a fresh subscription when permission is already granted but none exists", async () => {
    const subscription = makeSubscription({
      endpoint: "https://push.example.com/new-device",
    });
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(subscription),
    };
    installBrowserSupport(pushManager);
    installNotification("granted");
    const { usePushSubscription } = await import("../use-push-subscription");
    const { result } = renderHook(() => usePushSubscription());

    let success = false;
    await act(async () => {
      success = await result.current.resubscribeIfNeeded();
    });

    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToPush).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example.com/new-device",
      }),
    );
    expect(success).toBe(true);
  });
});
