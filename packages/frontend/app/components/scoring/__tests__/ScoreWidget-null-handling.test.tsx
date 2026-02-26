/**
 * ScoreWidget — Null Score Display Tests
 *
 * Verifies that ScoreWidget correctly renders an em-dash when the score is null
 * (i.e., the score type is missing from the DB) and renders the actual score
 * value when present.
 *
 * Context: P3 data-accuracy fix — after fixing null-to-zero coercion in the
 * backend, the frontend must gracefully handle null scores from the API
 * rather than displaying "0" or "F".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock the useScoreData hook so we can control its return values
const mockUseScoreData = vi.fn();
vi.mock("@/app/map/hooks/useScoreData", () => ({
  useScoreData: (...args: any[]) => mockUseScoreData(...args),
}));

// Import after mocking
import { ScoreWidget } from "../ScoreWidget";

describe("ScoreWidget — null score handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows em-dash when score is null (missing score type)", () => {
    // Simulate: API returned data but this specific score type is null
    mockUseScoreData.mockReturnValue({
      data: {
        homeready: null, // Score type missing from DB
        investoredge: { score: 72, confidence: { level: "b" } },
        marketHealth: { score: 65, confidence: { level: "a" } },
      },
      loading: false,
      error: null,
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="homeready"
      />,
    );

    // Should show em-dash (\u2014), not "0" or "F"
    expect(screen.getByText("\u2014")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("F")).not.toBeInTheDocument();
  });

  it("shows em-dash when entire data object is null", () => {
    mockUseScoreData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="99999"
        scoreType="homeready"
      />,
    );

    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("shows em-dash on error state", () => {
    mockUseScoreData.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Network error"),
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="investoredge"
      />,
    );

    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("shows loading spinner while data is fetching", () => {
    mockUseScoreData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    const { container } = render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="homeready"
      />,
    );

    // Should have the animated spinner (Loader2 component)
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    // Should NOT show em-dash or a score
    expect(screen.queryByText("\u2014")).not.toBeInTheDocument();
  });

  it("shows score value when score is valid", () => {
    mockUseScoreData.mockReturnValue({
      data: {
        homeready: { score: 72, confidence: { level: "b" } },
        investoredge: { score: 55, confidence: { level: "c" } },
        marketHealth: { score: 68, confidence: { level: "a" } },
      },
      loading: false,
      error: null,
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="homeready"
      />,
    );

    // Should render the score number
    expect(screen.getByText("72")).toBeInTheDocument();
    // Should NOT show em-dash
    expect(screen.queryByText("\u2014")).not.toBeInTheDocument();
  });

  it("shows correct score for market_health type", () => {
    mockUseScoreData.mockReturnValue({
      data: {
        homeready: { score: 72, confidence: { level: "b" } },
        investoredge: { score: 55, confidence: { level: "c" } },
        marketHealth: { score: 68, confidence: { level: "a" } },
      },
      loading: false,
      error: null,
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="market_health"
      />,
    );

    expect(screen.getByText("68")).toBeInTheDocument();
  });

  it("calls onScoreLoad with null when score is missing", () => {
    const onScoreLoad = vi.fn();

    mockUseScoreData.mockReturnValue({
      data: {
        homeready: null,
        investoredge: null,
        marketHealth: null,
      },
      loading: false,
      error: null,
    });

    render(
      <ScoreWidget
        geographyType="metro"
        geographyId="31080"
        scoreType="homeready"
        onScoreLoad={onScoreLoad}
      />,
    );

    expect(onScoreLoad).toHaveBeenCalledWith(null, null);
  });
});
