import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockFetchRecentReports = vi.fn();
vi.mock("@/lib/data/fetchers/reports-list", () => ({
  fetchRecentReports: (...args: any[]) => mockFetchRecentReports(...args),
}));

import { RecentReportsSection } from "../RecentReportsSection";

const MOCK_REPORTS = [
  {
    id: "r1",
    title: "Austin Market Analysis",
    report_type: "snapshot",
    user_type: "investor" as const,
    primary_geography_name: "Austin, TX",
    status: "completed",
    created_at: "2025-03-01T12:00:00Z",
  },
  {
    id: "r2",
    title: "Denver Homebuyer Report",
    report_type: "comparison",
    user_type: "homebuyer" as const,
    primary_geography_name: "Denver, CO",
    status: "completed",
    created_at: "2025-02-15T08:00:00Z",
  },
];

describe("RecentReportsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section heading", async () => {
    mockFetchRecentReports.mockResolvedValue(MOCK_REPORTS);
    render(<RecentReportsSection />);
    expect(screen.getByText("Recent Reports")).toBeInTheDocument();
  });

  it("renders report titles after loading", async () => {
    mockFetchRecentReports.mockResolvedValue(MOCK_REPORTS);
    render(<RecentReportsSection />);

    await waitFor(() => {
      expect(screen.getByText("Austin Market Analysis")).toBeInTheDocument();
      expect(screen.getByText("Denver Homebuyer Report")).toBeInTheDocument();
    });
  });

  it("renders type badges for investor and homebuyer reports", async () => {
    mockFetchRecentReports.mockResolvedValue(MOCK_REPORTS);
    render(<RecentReportsSection />);

    await waitFor(() => {
      expect(screen.getByText("Investor")).toBeInTheDocument();
      expect(screen.getByText("Homebuyer")).toBeInTheDocument();
    });
  });

  it("renders Reopen links for each report", async () => {
    mockFetchRecentReports.mockResolvedValue(MOCK_REPORTS);
    render(<RecentReportsSection />);

    await waitFor(() => {
      const reopenLinks = screen.getAllByText("Reopen");
      expect(reopenLinks).toHaveLength(2);
    });
  });

  it("renders empty state when no reports", async () => {
    mockFetchRecentReports.mockResolvedValue([]);
    render(<RecentReportsSection />);

    await waitFor(() => {
      expect(screen.getByText("No reports yet")).toBeInTheDocument();
      expect(screen.getByText("Create Report")).toBeInTheDocument();
    });
  });

  it("renders empty state on fetch error", async () => {
    mockFetchRecentReports.mockRejectedValue(new Error("Network error"));
    render(<RecentReportsSection />);

    await waitFor(() => {
      expect(screen.getByText("No reports yet")).toBeInTheDocument();
    });
  });

  it("calls fetchRecentReports with limit of 5", async () => {
    mockFetchRecentReports.mockResolvedValue([]);
    render(<RecentReportsSection />);

    await waitFor(() => {
      expect(mockFetchRecentReports).toHaveBeenCalledWith(5);
    });
  });
});
