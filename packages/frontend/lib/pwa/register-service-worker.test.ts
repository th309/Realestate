import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression coverage for the first-install surprise-reload bug: with
 * `clientsClaim: true` (app/sw.ts), a brand-new visitor's very first
 * activation also fires `controllerchange` — there is no update to apply in
 * that case, and register-service-worker.ts must never reload the page for
 * it. See the guard comment in register-service-worker.ts for the two
 * independent mechanisms this exercises (lazy-arm + `isUpdate` gate).
 */

type ListenerMap = Map<string, Set<(event: unknown) => void>>;

const { MockSerwist, instances } = vi.hoisted(() => {
  class MockSerwistImpl {
    listeners: ListenerMap = new Map();
    messageSkipWaiting = vi.fn();
    register = vi.fn(async () => undefined);

    constructor(public scriptURL: string) {}

    addEventListener(type: string, listener: (event: unknown) => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(listener);
    }

    dispatchEvent(type: string, event: unknown) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
  }
  const created: MockSerwistImpl[] = [];
  return {
    MockSerwist: class extends MockSerwistImpl {
      constructor(scriptURL: string) {
        super(scriptURL);
        created.push(this);
      }
    },
    instances: created,
  };
});

vi.mock("@serwist/window", () => ({ Serwist: MockSerwist }));

const { registerServiceWorker } = await import("./register-service-worker");

describe("registerServiceWorker — controlling→reload guard", () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    instances.length = 0;
    // process.env.NODE_ENV is typed read-only (Next.js's ProcessEnv
    // augmentation) — vi.stubEnv is the vitest-sanctioned way to override it.
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function register() {
    const onUpdateWaiting = vi.fn();
    registerServiceWorker(onUpdateWaiting);
    const serwist = instances.at(-1)!;
    return { serwist, onUpdateWaiting };
  }

  it("does not reload on a brand-new visitor's first-ever activation (no waiting event, isUpdate: false)", () => {
    const { serwist } = register();

    // First-ever install never enters "waiting" (browsers auto-activate it);
    // clientsClaim still fires "controlling" once it activates.
    serwist.dispatchEvent("controlling", {
      isUpdate: false,
      isExternal: false,
    });

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not reload if a controllerchange fires before the user taps Refresh", () => {
    const { serwist, onUpdateWaiting } = register();

    serwist.dispatchEvent("waiting", { isUpdate: false });
    expect(onUpdateWaiting).toHaveBeenCalledTimes(1);

    // applyUpdate() was never invoked — the reload listener isn't armed yet.
    serwist.dispatchEvent("controlling", { isUpdate: true, isExternal: false });

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(serwist.messageSkipWaiting).not.toHaveBeenCalled();
  });

  it("reloads exactly once after the user taps Refresh on a genuine update", () => {
    const { serwist, onUpdateWaiting } = register();

    serwist.dispatchEvent("waiting", { isUpdate: true });
    const applyUpdate = onUpdateWaiting.mock.calls[0][0] as () => void;

    applyUpdate();
    expect(serwist.messageSkipWaiting).toHaveBeenCalledTimes(1);

    serwist.dispatchEvent("controlling", { isUpdate: true, isExternal: false });
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // A duplicate controllerchange must not trigger a second reload.
    serwist.dispatchEvent("controlling", { isUpdate: true, isExternal: false });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("gates on isUpdate even after Refresh was tapped (defense in depth)", () => {
    const { serwist, onUpdateWaiting } = register();

    serwist.dispatchEvent("waiting", { isUpdate: true });
    const applyUpdate = onUpdateWaiting.mock.calls[0][0] as () => void;
    applyUpdate();

    // Should never happen per Serwist's own semantics, but the gate must
    // hold regardless.
    serwist.dispatchEvent("controlling", {
      isUpdate: false,
      isExternal: false,
    });

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
