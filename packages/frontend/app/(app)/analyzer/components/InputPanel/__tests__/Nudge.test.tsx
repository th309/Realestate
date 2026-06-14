import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Nudge } from "../Nudge";

describe("Nudge", () => {
  it("ok level uses tertiary tone", () => {
    const { container } = render(<Nudge level="ok" text="Looks good" />);
    const el = container.querySelector("[data-nudge]");
    expect(el?.getAttribute("data-level")).toBe("ok");
    expect(el?.className).toMatch(/tertiary/);
    expect(el?.textContent).toBe("Looks good");
  });

  it("warn level uses warning/error-container tone", () => {
    const { container } = render(<Nudge level="warn" text="High taxes" />);
    const el = container.querySelector("[data-nudge]");
    expect(el?.getAttribute("data-level")).toBe("warn");
    expect(el?.className).toMatch(/error-container|warning/);
    expect(el?.textContent).toBe("High taxes");
  });
});
