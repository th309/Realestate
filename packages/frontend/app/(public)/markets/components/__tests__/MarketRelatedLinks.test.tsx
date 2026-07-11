import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketRelatedLinks, buildLinkGroup } from "../MarketRelatedLinks";

describe("buildLinkGroup", () => {
  const items = Array.from({ length: 15 }, (_, i) => ({
    key: `item-${i}`,
    label: `Item ${i}`,
    href: `/markets/item-${i}`,
  }));

  it("caps links to the given limit and sets viewAll fields when items exceed the cap", () => {
    const group = buildLinkGroup("Test Group", items, 12, "/markets/view-all");
    expect(group.links).toHaveLength(12);
    expect(group.viewAllHref).toBe("/markets/view-all");
    expect(group.viewAllCount).toBe(15);
  });

  it("omits viewAll fields when items fit within the cap", () => {
    const group = buildLinkGroup(
      "Test Group",
      items.slice(0, 5),
      12,
      "/markets/view-all",
    );
    expect(group.links).toHaveLength(5);
    expect(group.viewAllHref).toBeUndefined();
    expect(group.viewAllCount).toBeUndefined();
  });
});

describe("MarketRelatedLinks", () => {
  it("renders each non-empty group with its links and view-all link", () => {
    const { container, getByText } = render(
      <MarketRelatedLinks
        groups={[
          {
            label: "Counties in this metro",
            links: [
              {
                key: "a",
                label: "Alpha County",
                href: "/markets/county/alpha",
              },
            ],
            viewAllHref: "/markets/test-metro/counties",
            viewAllCount: 20,
          },
          { label: "Empty group", links: [] },
        ]}
      />,
    );
    expect(getByText("Counties in this metro")).toBeTruthy();
    expect(getByText("Alpha County")).toBeTruthy();
    expect(getByText("View all 20 →")).toBeTruthy();
    expect(
      container.querySelectorAll('a[href="/markets/county/alpha"]'),
    ).toHaveLength(1);
    expect(() => getByText("Empty group")).toThrow();
  });

  it("renders nothing when every group is empty", () => {
    const { container } = render(
      <MarketRelatedLinks groups={[{ label: "Empty", links: [] }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
