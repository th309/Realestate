/**
 * /about tells one founder story, in one voice.
 *
 * The page previously contradicted itself: "Behind PropertyIQ" is first-person
 * and signed "— Troy H, MBA · Founder", while "Our Team" two sections later
 * claimed PropertyIQ was "founded in 2024 by a team of data scientists and real
 * estate professionals" whose background "spans hedge fund analytics". This is
 * the page carrying the Person JSON-LD that every methodology Article points its
 * author at, so a contradiction here is an E-E-A-T defect, not a copy nit.
 *
 * These tests lock the resolved version (solo founder, matching the JSON-LD) and
 * fail if the team framing comes back — including through the FAQ answers, which
 * are separately serialized into FAQPage structured data.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { V4_CLAIMS, COVERAGE_COPY } from "@/lib/data/validation-claims";

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
  default: ({
    href,
    children,
    ...rest
  }: Omit<React.ComponentPropsWithoutRef<"a">, "href"> & {
    href: unknown;
  }) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import AboutPage from "../page";
import { ABOUT_FAQS } from "../about-faqs";

/** Visible page copy only — excludes the JSON-LD <script> payloads, which
 *  legitimately repeat the founder's name in machine-readable form. */
function visibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script").forEach((node) => node.remove());
  return clone.textContent ?? "";
}

const TEAM_FRAMING = [
  "team of data scientists",
  "The founders combined",
  "hedge fund analytics",
  "cross-disciplinary expertise",
];

describe("About page founder attribution", () => {
  it("credits a single named founder, matching the Person JSON-LD", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    expect(text).toContain("founded in 2024 by Troy H, MBA");
    expect(text).toContain("— Troy H, MBA · Founder, PropertyIQ");
  });

  it("no longer claims a founding team anywhere in the page copy", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    for (const phrase of TEAM_FRAMING) {
      expect(text).not.toContain(phrase);
    }
  });

  it("keeps the Person JSON-LD naming the same founder", () => {
    const { container } = render(<AboutPage />);
    const personLd = Array.from(container.querySelectorAll("script"))
      .map((node) => node.textContent ?? "")
      .find((json) => json.includes('"Person"'));

    expect(personLd).toBeTruthy();
    const parsed = JSON.parse(personLd!);
    expect(parsed.name).toBe("Troy H");
    expect(parsed.jobTitle).toBe("Founder");
  });
});

describe("About page sourced claims", () => {
  it("renders the information coefficient from validation-claims, not a literal", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    // Appears in both "Who Builds It" and the journey timeline.
    const occurrences = text.split(String(V4_CLAIMS.ic3Y)).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("renders coverage only through COVERAGE_COPY tokens", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    expect(text).toContain(COVERAGE_COPY.metros);
    expect(text).toContain(COVERAGE_COPY.counties);
    expect(text).toContain(COVERAGE_COPY.zips);
    // Raw live counts and the retired hardcoded strings must never appear.
    for (const raw of ["935", "3,150", "34,000", "925", "33,000+"]) {
      expect(text).not.toContain(raw);
    }
  });

  it("describes the score as 1–99, never 0–100", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    expect(text).toContain("1–99");
    expect(text).not.toContain("0–100");
    expect(text).not.toContain("out of 100");
  });
});

describe("About FAQ answers", () => {
  const answers = ABOUT_FAQS.map((faq) => faq.answer).join("\n");

  it("tells the same solo-founder story as the page", () => {
    expect(answers).toContain("founded in 2024 by Troy H, MBA");
    for (const phrase of TEAM_FRAMING) {
      expect(answers).not.toContain(phrase);
    }
  });

  it("sources the information coefficient from validation-claims", () => {
    expect(answers).toContain(`${V4_CLAIMS.ic3Y} information coefficient`);
  });

  it("states the 1 to 99 range and that 50 is the state average", () => {
    expect(answers).toContain("1 to 99");
    expect(answers).toContain("state average");
    // The score is computed on a national pool and calibrated to state — it is
    // never "ranked within its state".
    expect(answers).not.toMatch(/ranked within/i);
  });
});
