import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "../components/PostCard";

const POST = {
  slug: "best-cash-flow-real-estate-markets-2026",
  frontmatter: {
    title: "Best Cash Flow Real Estate Markets in 2026",
    description:
      "Rent-to-price ratios that survive debt service, vacancy, and tax.",
    date: "2026-03-28",
    category: "cash-flow",
    tags: ["cash-flow"],
    image: "/images/blog/best-cash-flow-real-estate-markets-2026.png",
  },
  readingTime: "7 min read",
};

describe("PostCard", () => {
  it("renders the hero image", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "alt",
      POST.frontmatter.title,
    );
  });

  it("shows the description on every card, not only featured ones", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByText(POST.frontmatter.description)).toBeInTheDocument();
  });

  it("shows date and reading time", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByText("7 min read")).toBeInTheDocument();
    expect(screen.getByText(/Mar 2[78], 2026/)).toBeInTheDocument();
  });

  it("still shows the description when featured", () => {
    render(<PostCard post={POST} featured />);
    expect(screen.getByText(POST.frontmatter.description)).toBeInTheDocument();
  });

  it("links the card to the post", () => {
    render(<PostCard post={POST} />);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/blog/${POST.slug}`,
    );
  });

  it("renders the category as a full-radius chip", () => {
    const { container } = render(<PostCard post={POST} />);
    const chip = container.querySelector(".rounded-full");
    expect(chip?.textContent).toContain("cash flow");
  });
});

/**
 * Every post now ships an image (scripts/content/generate-post-images.ts), but
 * a card must not render a broken <img> if one is ever missing — the grid
 * reserves a 16:9 slot either way.
 */
describe("PostCard without an image", () => {
  const noImage = {
    ...POST,
    frontmatter: { ...POST.frontmatter, image: undefined },
  };

  it("renders no img element", () => {
    const { container } = render(<PostCard post={noImage} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("still renders the title and description", () => {
    render(<PostCard post={noImage} />);
    expect(screen.getByText(POST.frontmatter.title)).toBeInTheDocument();
    expect(screen.getByText(POST.frontmatter.description)).toBeInTheDocument();
  });
});
