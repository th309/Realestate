import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

const mockRegisterServiceWorker = vi.fn();
vi.mock("@/lib/pwa/register-service-worker", () => ({
  registerServiceWorker: (onUpdateWaiting: (apply: () => void) => void) =>
    mockRegisterServiceWorker(onUpdateWaiting),
}));

import { ServiceWorkerManager } from "../ServiceWorkerManager";

/** Renders the manager and simulates registerServiceWorker reporting a
 * waiting worker, returning the `applyUpdate` mock passed to the caller. */
function renderWithUpdateWaiting() {
  const applyUpdate = vi.fn();
  render(<ServiceWorkerManager />);
  const onUpdateWaiting = mockRegisterServiceWorker.mock.calls[0][0] as (
    apply: () => void,
  ) => void;
  act(() => {
    onUpdateWaiting(applyUpdate);
  });
  return applyUpdate;
}

describe("ServiceWorkerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays hidden until registerServiceWorker reports a waiting worker", () => {
    render(<ServiceWorkerManager />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the update snackbar with Refresh and dismiss actions once an update is waiting", () => {
    renderWithUpdateWaiting();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("New version available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dismiss update notification" }),
    ).toBeInTheDocument();
  });

  it("calls the applyUpdate callback when Refresh is clicked, and never reloads on its own", () => {
    const applyUpdate = renderWithUpdateWaiting();

    act(() => {
      screen.getByRole("button", { name: "Refresh" }).click();
    });

    expect(applyUpdate).toHaveBeenCalledTimes(1);
    // Refresh only delegates to the caller-supplied callback; it doesn't
    // hide the snackbar or reload itself (that's registerServiceWorker's
    // job once the worker actually takes control).
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides the snackbar when the dismiss action is clicked, without calling applyUpdate", () => {
    const applyUpdate = renderWithUpdateWaiting();
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      screen
        .getByRole("button", { name: "Dismiss update notification" })
        .click();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();
  });
});
