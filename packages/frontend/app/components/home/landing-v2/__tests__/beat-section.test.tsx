import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BeatSection } from "../BeatSection";

describe("BeatSection delegates layout to the shared contract", () => {
  it("uses the contract container width", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("max-w-6xl");
  });

  it("uses the contract gutter, not px-5", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("px-6");
    expect(container.innerHTML).not.toContain("px-5");
  });

  it("uses the contract rhythm", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("py-20 lg:py-28");
  });
});

describe("BeatSection preserves its existing API", () => {
  it("still forwards an id for in-page anchors", () => {
    const { container } = render(<BeatSection id="beat-proof">x</BeatSection>);
    expect(container.querySelector("section")?.id).toBe("beat-proof");
  });

  it("still renders an eyebrow", () => {
    const { getByText } = render(
      <BeatSection eyebrow="The proof">x</BeatSection>,
    );
    expect(getByText("The proof")).toBeInTheDocument();
  });

  it("still applies a caller className", () => {
    const { container } = render(
      <BeatSection className="text-center">x</BeatSection>,
    );
    expect(container.innerHTML).toContain("text-center");
  });

  it("places the requested surface band on the section", () => {
    const { container } = render(<BeatSection surface="b">x</BeatSection>);
    expect(container.querySelector("section")?.className).toContain(
      "bg-surface-container-low",
    );
  });
});

/**
 * `tone="dark"` painted body copy `text-on-primary` (white) because the beat
 * used to sit on the dark top of a page-wide indigo gradient. Now that each
 * section owns an opaque light surface, emitting white body text would render
 * those beats invisible — the exact hardcoded-colour-versus-token desync this
 * redesign exists to remove.
 */
describe("BeatSection never emits white body copy on a light band", () => {
  it.each(["dark", "light"] as const)(
    "keeps readable body text for tone=%s",
    (tone) => {
      const { container } = render(<BeatSection tone={tone}>x</BeatSection>);
      expect(container.innerHTML).not.toContain("text-on-primary");
    },
  );
});
