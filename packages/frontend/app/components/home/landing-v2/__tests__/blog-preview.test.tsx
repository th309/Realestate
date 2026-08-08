import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BlogPost } from "@/lib/blog";

/**
 * `getAllPosts` reads the MDX directory off disk and returns posts already
 * sorted newest-first. Mocking it keeps this test off the filesystem and lets
 * the fixtures prove the band takes the HEAD of that ordering, not the tail.
 */
function makePost(slug: string, title: string, date: string): BlogPost {
  return {
    slug,
    frontmatter: {
      title,
      description: `Why ${title} matters for investors this quarter.`,
      date,
      author: "PropertyIQ Research",
      category: "market-analysis",
      tags: [],
      states: [],
      targetKeyword: title.toLowerCase(),
      image: `/images/blog/${slug}.png`,
    },
    content: "",
    readingTime: "7 min read",
  };
}

const NEWEST_FIRST: BlogPost[] = [
  makePost("cap-rate-by-metro-2026", "Cap Rate by Metro in 2026", "2026-07-26"),
  makePost(
    "how-to-read-rent-trends-by-metro-2026",
    "How to Read Rent Trends by Metro",
    "2026-07-20",
  ),
  makePost(
    "sun-belt-real-estate-markets-2026",
    "Sun Belt Real Estate in 2026",
    "2026-06-11",
  ),
  makePost(
    "cleveland-ohio-real-estate-market-2026",
    "Cleveland Ohio Real Estate Market",
    "2026-05-02",
  ),
  makePost(
    "best-markets-house-hacking-2026",
    "Best Markets for House Hacking",
    "2026-04-18",
  ),
  makePost(
    "austin-vs-houston-real-estate-2026",
    "Austin vs Houston Real Estate",
    "2026-03-09",
  ),
];

vi.mock("@/lib/blog", () => ({
  getAllPosts: () => NEWEST_FIRST,
}));

const { BlogPreview } = await import("../BlogPreview");

describe("BlogPreview shows the four most recent posts and no more", () => {
  it("renders exactly four post cards even when the loader returns six posts", () => {
    const { container } = render(<BlogPreview />);
    expect(container.querySelectorAll("article")).toHaveLength(4);
  });

  it("renders the four newest posts in loader order, newest first", () => {
    const { container } = render(<BlogPreview />);
    const titles = Array.from(container.querySelectorAll("h3")).map(
      (heading) => heading.textContent,
    );
    expect(titles).toEqual([
      "Cap Rate by Metro in 2026",
      "How to Read Rent Trends by Metro",
      "Sun Belt Real Estate in 2026",
      "Cleveland Ohio Real Estate Market",
    ]);
  });

  it("omits the two posts that fall outside the four newest", () => {
    render(<BlogPreview />);
    expect(
      screen.queryByText("Best Markets for House Hacking"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Austin vs Houston Real Estate"),
    ).not.toBeInTheDocument();
  });
});

describe("BlogPreview links each card to its own post", () => {
  it.each(NEWEST_FIRST.slice(0, 4))(
    "points the $title card at /blog/$slug",
    ({ slug, frontmatter }) => {
      render(<BlogPreview />);
      expect(
        screen.getByRole("link", { name: frontmatter.title }),
      ).toHaveAttribute("href", `/blog/${slug}`);
    },
  );

  it("gives each card a single link target, so four cards yield four post links", () => {
    render(<BlogPreview />);
    const postLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/blog/"));
    expect(postLinks).toHaveLength(4);
  });
});

/**
 * The card's accessible name must be the post title. The generated hero image
 * repeats that title and the meta row carries a date, so either leaking into the
 * link name would leave a screen reader announcing "Jul 26, 2026, 7 min read".
 */
describe("BlogPreview names each card link by its post title", () => {
  it("resolves every card link by title alone", () => {
    render(<BlogPreview />);
    for (const post of NEWEST_FIRST.slice(0, 4)) {
      expect(
        screen.getByRole("link", { name: post.frontmatter.title }),
      ).toBeInTheDocument();
    }
  });

  it("marks the hero image decorative so it never joins the link name", () => {
    const { container } = render(<BlogPreview />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(4);
    for (const image of images) {
      expect(image.getAttribute("alt")).toBe("");
    }
  });
});

describe("BlogPreview offers a route to the full blog index", () => {
  it("renders a link to /blog beneath the grid", () => {
    render(<BlogPreview />);
    expect(
      screen.getByRole("link", { name: /read the blog/i }),
    ).toHaveAttribute("href", "/blog");
  });

  it("renders the approved section heading and subhead", () => {
    const { container } = render(<BlogPreview />);
    expect(container.querySelector("h2")?.textContent).toBe(
      "The PropertyIQ Blog",
    );
    expect(
      screen.getByText(
        "Market breakdowns and rankings, generated from the same scored dataset that powers the product.",
      ),
    ).toBeInTheDocument();
  });
});
