import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SavedMarketsSection } from "../SavedMarketsSection";

const MOCK_ITEMS = [
  {
    id: "1",
    geography_type: "metro",
    geography_id: "31080",
    geography_name: "Austin, TX",
    added_at: "2025-01-01T00:00:00Z",
    score_at_add: 78,
  },
  {
    id: "2",
    geography_type: "county",
    geography_id: "06001",
    geography_name: "Alameda County, CA",
    added_at: "2025-02-01T00:00:00Z",
    score_at_add: null,
  },
];

describe("SavedMarketsSection", () => {
  it("renders section heading", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("Saved Markets")).toBeInTheDocument();
  });

  it("renders market names", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
    expect(screen.getByText("Alameda County, CA")).toBeInTheDocument();
  });

  it("renders geography type for each item", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("metro")).toBeInTheDocument();
    expect(screen.getByText("county")).toBeInTheDocument();
  });

  it("renders score when present", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("78")).toBeInTheDocument();
  });

  it("renders '--' when score is null", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("shows count vs limit for pro tier", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    expect(screen.getByText("2 of 10 used")).toBeInTheDocument();
  });

  it("hides limit for admin tier (unlimited)", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="admin" />,
    );
    expect(screen.getByText("2 used")).toBeInTheDocument();
  });

  it("renders empty state when no items", () => {
    render(<SavedMarketsSection items={[]} isLoading={false} tier="pro" />);
    expect(screen.getByText("No saved markets yet")).toBeInTheDocument();
    expect(screen.getByText("Explore Markets")).toBeInTheDocument();
  });

  it("renders loading skeletons when loading", () => {
    const { container } = render(
      <SavedMarketsSection items={[]} isLoading={true} tier="pro" />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders View links for each item", () => {
    render(
      <SavedMarketsSection items={MOCK_ITEMS} isLoading={false} tier="pro" />,
    );
    const viewLinks = screen.getAllByText("View");
    expect(viewLinks).toHaveLength(2);
  });
});
