import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const mockFetchEmailPreferences = vi.fn();
const mockUpdateEmailPreferences = vi.fn();
vi.mock("@/lib/data", () => ({
  fetchEmailPreferences: (...args: any[]) => mockFetchEmailPreferences(...args),
  updateEmailPreferences: (...args: any[]) =>
    mockUpdateEmailPreferences(...args),
}));

import { NotificationsSection } from "../NotificationsSection";

const DEFAULT_PREFS = {
  weekly_digest: true,
  alert_emails: false,
  marketing: true,
};

describe("NotificationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEmailPreferences.mockResolvedValue(DEFAULT_PREFS);
    mockUpdateEmailPreferences.mockResolvedValue(undefined);
  });

  it("renders section heading", () => {
    render(<NotificationsSection />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders all three toggle labels after loading", async () => {
    render(<NotificationsSection />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
      expect(screen.getByText("Alert Notifications")).toBeInTheDocument();
      expect(screen.getByText("Product Updates")).toBeInTheDocument();
    });
  });

  it("renders toggle descriptions", async () => {
    render(<NotificationsSection />);

    await waitFor(() => {
      expect(
        screen.getByText("Summary of your saved markets every Monday"),
      ).toBeInTheDocument();
    });
  });

  it("toggles call updateEmailPreferences with new value", async () => {
    render(<NotificationsSection />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Digest")).toBeInTheDocument();
    });

    // Weekly digest is initially true, clicking should set to false
    const toggles = screen.getAllByRole("switch");
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(mockUpdateEmailPreferences).toHaveBeenCalledWith({
        weekly_digest: false,
      });
    });
  });

  it("defaults to all-off when fetch fails", async () => {
    mockFetchEmailPreferences.mockRejectedValue(new Error("Network error"));
    render(<NotificationsSection />);

    await waitFor(() => {
      const toggles = screen.getAllByRole("switch");
      // All should be aria-checked="false"
      toggles.forEach((toggle) => {
        expect(toggle).toHaveAttribute("aria-checked", "false");
      });
    });
  });

  it("shows loading spinner initially", () => {
    // Don't resolve the promise yet
    mockFetchEmailPreferences.mockReturnValue(new Promise(() => {}));
    const { container } = render(<NotificationsSection />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
