import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
}));
vi.mock("@/app/components/scoring/ScoreDisplay", () => ({
  ScoreDisplay: () => <div />,
}));
vi.mock("../DashboardScoreBadge", () => ({
  DashboardScoreBadge: () => <div />,
}));
vi.mock("@/app/components/social-proof/SocialProofBadge", () => ({
  SocialProofBadge: () => <div />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { ScoreColumn } from "../ScoreColumn";

describe("ScoreColumn", () => {
  it("links to the score methodology page", () => {
    const { container } = render(
      <ScoreColumn
        activeView="investor"
        primaryScore={{ score: 72 }}
        geoLevel="metro"
        geoId="12420"
      />,
    );
    expect(
      container.querySelector('a[href="/scores/methodology"]'),
    ).toBeTruthy();
  });
});
