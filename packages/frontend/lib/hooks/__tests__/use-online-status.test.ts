import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../use-online-status";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("useOnlineStatus", () => {
  afterEach(() => {
    setNavigatorOnline(true);
  });

  it("reflects navigator.onLine on mount", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("flips to false when an 'offline' event fires", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });

  it("flips back to true when an 'online' event fires", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current).toBe(true);
  });

  it("removes its event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useOnlineStatus());
    const registeredEvents = addSpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event === "online" || event === "offline");
    expect(registeredEvents).toEqual(["online", "offline"]);

    unmount();

    const removedEvents = removeSpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event === "online" || event === "offline");
    expect(removedEvents).toEqual(["online", "offline"]);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
