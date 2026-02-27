/**
 * GrowthProgressWidget — Unit Tests
 *
 * Tests rendering states (loading, no goal, active goal), progress calculations,
 * milestone display, growth rate footer, and urgency badge styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// --- Mock useQuery so we control data/loading without QueryClientProvider ---
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => mockUseQuery(opts),
}));

// Mock the fetcher — useQuery calls it, but we intercept at the hook level
vi.mock("@/lib/data/fetchers/admin-analytics", () => ({
  fetchGrowthProgress: vi.fn(),
}));

import { GrowthProgressWidget } from "../GrowthProgressWidget";

// --- Test fixtures ---

const ACTIVE_GOAL = {
  goal: {
    id: "goal-1",
    name: "Q1 Growth Target",
    targetPaidUsers: 100,
    startDate: "2026-03-01",
    targetDate: "2026-06-30",
    milestones: [
      { target: 25, label: "25 users" },
      { target: 50, label: "50 users" },
      { target: 75, label: "75 users" },
    ],
    isActive: true,
  },
  currentPaidUsers: 42,
  daysElapsed: 30,
  daysRemaining: 120,
  totalDays: 150,
  currentGrowthRate: 8.5,
  requiredGrowthRate: 12.0,
  milestoneProgress: [
    { target: 25, label: "25 users", reached: true, reachedAt: "2026-01-15" },
    {
      target: 50,
      label: "50 users",
      reached: false,
      projectedDate: "2026-03-20",
    },
    { target: 75, label: "75 users", reached: false },
  ],
};

const ON_TRACK_GOAL = {
  ...ACTIVE_GOAL,
  currentGrowthRate: 15.0,
  requiredGrowthRate: 12.0,
};

const URGENT_GOAL = {
  ...ACTIVE_GOAL,
  daysRemaining: 25,
};

const NEARLY_URGENT_GOAL = {
  ...ACTIVE_GOAL,
  daysRemaining: 60,
};

describe("GrowthProgressWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders skeleton when loading", () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

      const { container } = render(<GrowthProgressWidget />);

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error card when fetch fails", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("Growth Goal")).toBeInTheDocument();
      expect(
        screen.getByText(/Unable to load goal progress/),
      ).toBeInTheDocument();
    });
  });

  describe("no active goal", () => {
    it("renders empty state when data is undefined", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("Growth Goal")).toBeInTheDocument();
      expect(screen.getByText(/No active growth goal set/)).toBeInTheDocument();
    });

    it("renders empty state when goal is inactive", () => {
      const inactiveGoal = {
        ...ACTIVE_GOAL,
        goal: { ...ACTIVE_GOAL.goal, isActive: false },
      };
      mockUseQuery.mockReturnValue({
        data: inactiveGoal,
        isLoading: false,
        isError: false,
      });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("Growth Goal")).toBeInTheDocument();
      expect(screen.getByText(/No active growth goal set/)).toBeInTheDocument();
    });

    it("renders empty state when goal is null", () => {
      mockUseQuery.mockReturnValue({
        data: { goal: null },
        isLoading: false,
        isError: false,
      });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("Growth Goal")).toBeInTheDocument();
      expect(screen.getByText(/No active growth goal set/)).toBeInTheDocument();
    });
  });

  describe("active goal display", () => {
    it("renders goal name", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("Q1 Growth Target")).toBeInTheDocument();
    });

    it("renders target user count and date range", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      // Text is split across elements, so use a function matcher
      const subtitle = screen.getByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          (element.textContent?.includes("100 paid users") ?? false) &&
          (element.textContent?.includes("day 30 of 150") ?? false)
        );
      });
      expect(subtitle).toBeInTheDocument();
    });

    it("renders current users and target in progress section", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("/ 100")).toBeInTheDocument();
    });

    it("renders correct progress percentage", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      // 42/100 = 42.0%
      expect(screen.getByText("42.0%")).toBeInTheDocument();
    });

    it("caps progress percentage at 100%", () => {
      const overTarget = {
        ...ACTIVE_GOAL,
        currentPaidUsers: 120,
      };
      mockUseQuery.mockReturnValue({ data: overTarget, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });
  });

  describe("days remaining badge", () => {
    it("shows days remaining text", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("120d remaining")).toBeInTheDocument();
    });

    it("applies red styling when 30 days or fewer remain", () => {
      mockUseQuery.mockReturnValue({ data: URGENT_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      const badge = screen.getByText("25d remaining");
      expect(badge.className).toContain("bg-red-100");
      expect(badge.className).toContain("text-red-700");
    });

    it("applies amber styling when 31-90 days remain", () => {
      mockUseQuery.mockReturnValue({
        data: NEARLY_URGENT_GOAL,
        isLoading: false,
      });

      render(<GrowthProgressWidget />);

      const badge = screen.getByText("60d remaining");
      expect(badge.className).toContain("bg-amber-100");
      expect(badge.className).toContain("text-amber-700");
    });

    it("applies green styling when on track with 90+ days", () => {
      mockUseQuery.mockReturnValue({ data: ON_TRACK_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      const badge = screen.getByText("120d remaining");
      expect(badge.className).toContain("bg-green-100");
      expect(badge.className).toContain("text-green-700");
    });
  });

  describe("milestones", () => {
    it("renders reached milestone with label", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("25 users")).toBeInTheDocument();
    });

    it("renders reached milestone with green styling", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      const chip = screen.getByText("25 users").closest("span");
      expect(chip?.className).toContain("bg-green-100");
    });

    it("renders unreached milestone with projected date", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      // Date may render as "Mar 19" or "Mar 20" depending on timezone
      const chip = screen.getByText((_content, element) => {
        return (
          element?.tagName === "SPAN" &&
          (element.textContent?.includes("50 users") ?? false) &&
          (element.textContent?.includes("Est.") ?? false)
        );
      });
      expect(chip).toBeInTheDocument();
    });

    it("renders unreached milestone without projected date as Pending", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText(/75 users — Pending/)).toBeInTheDocument();
    });

    it("does not render milestone section when milestones array is empty", () => {
      const noMilestones = { ...ACTIVE_GOAL, milestoneProgress: [] };
      mockUseQuery.mockReturnValue({ data: noMilestones, isLoading: false });

      render(<GrowthProgressWidget />);

      // Goal name should still render, but no milestone chips
      expect(screen.getByText("Q1 Growth Target")).toBeInTheDocument();
      expect(screen.queryByText("25 users")).not.toBeInTheDocument();
    });
  });

  describe("growth rate footer", () => {
    it("shows current growth rate", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("8.50 users/day")).toBeInTheDocument();
    });

    it("shows required growth rate", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.getByText("12.00 users/day")).toBeInTheDocument();
    });

    it("shows acceleration multiplier when behind target", () => {
      mockUseQuery.mockReturnValue({ data: ACTIVE_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      // 12.0 / 8.5 ≈ 1.4
      expect(screen.getByText("1.4x acceleration needed")).toBeInTheDocument();
    });

    it("does not show acceleration when on track", () => {
      mockUseQuery.mockReturnValue({ data: ON_TRACK_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      expect(screen.queryByText(/acceleration needed/)).not.toBeInTheDocument();
    });

    it("applies green styling to current rate when on track", () => {
      mockUseQuery.mockReturnValue({ data: ON_TRACK_GOAL, isLoading: false });

      render(<GrowthProgressWidget />);

      const rateEl = screen.getByText("15.00 users/day");
      expect(rateEl.className).toContain("text-green-600");
    });
  });

  describe("useQuery configuration", () => {
    it("passes correct query key and stale time", () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

      render(<GrowthProgressWidget />);

      const callArgs = mockUseQuery.mock.calls[0][0];
      expect(callArgs.queryKey).toEqual(["analytics", "growth-progress"]);
      expect(callArgs.staleTime).toBe(5 * 60 * 1000);
      expect(callArgs.retry).toBe(1);
    });
  });
});
