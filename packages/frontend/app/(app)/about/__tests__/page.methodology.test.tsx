import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/navigation", () => ({
  PageHeaderWithBreadcrumbs: () => <header />,
}));
vi.mock("@/app/components/seo/WebPageJsonLd", () => ({
  WebPageJsonLd: () => null,
}));
vi.mock("@/app/components/seo/FaqSection", () => ({
  FaqSection: () => <section />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import AboutPage from "../page";

describe("About page", () => {
  it("links to the score methodology page", () => {
    const { container } = render(<AboutPage />);
    expect(
      container.querySelectorAll('a[href="/scores/methodology"]').length,
    ).toBeGreaterThan(0);
  });
});
