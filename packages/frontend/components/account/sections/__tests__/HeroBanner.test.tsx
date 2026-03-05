import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { HeroBanner } from "../HeroBanner";

const DEFAULT_PROPS = {
  displayName: "Troy Hunter",
  email: "troy@propertyiq.app",
  avatarUrl: null as string | null,
  tierLabel: "PRO",
  tierClassName: "bg-white text-[#7C3AED]",
  memberSince: "January 2025",
};

describe("HeroBanner", () => {
  it("renders display name and email", () => {
    render(<HeroBanner {...DEFAULT_PROPS} />);
    expect(screen.getByText("Troy Hunter")).toBeInTheDocument();
    expect(screen.getByText("troy@propertyiq.app")).toBeInTheDocument();
  });

  it("renders tier badge with correct label", () => {
    render(<HeroBanner {...DEFAULT_PROPS} />);
    expect(screen.getByText("PRO")).toBeInTheDocument();
  });

  it("renders member since date", () => {
    render(<HeroBanner {...DEFAULT_PROPS} />);
    expect(screen.getByText("Member since January 2025")).toBeInTheDocument();
  });

  it("renders initials when no avatar URL is provided", () => {
    render(<HeroBanner {...DEFAULT_PROPS} avatarUrl={null} />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders avatar image when URL is provided", () => {
    render(
      <HeroBanner
        {...DEFAULT_PROPS}
        avatarUrl="https://example.com/avatar.jpg"
      />,
    );
    const img = screen.getByAltText("Troy Hunter");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("uses email initial when display name is empty", () => {
    render(<HeroBanner {...DEFAULT_PROPS} displayName="" />);
    expect(screen.getByText("T")).toBeInTheDocument(); // "t" from troy@...
  });

  it("does not render member since when empty", () => {
    render(<HeroBanner {...DEFAULT_PROPS} memberSince="" />);
    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });
});
