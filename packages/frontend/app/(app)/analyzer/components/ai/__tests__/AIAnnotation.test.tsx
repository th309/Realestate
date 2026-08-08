import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AIAnnotation } from "../AIAnnotation";

describe("AIAnnotation", () => {
  it("renders text when not stale", () => {
    const { getByText, container } = render(
      <AIAnnotation text="A strong cashflow play." />,
    );
    expect(getByText("A strong cashflow play.")).toBeTruthy();
    expect(
      container
        .querySelector("[data-ai-annotation]")
        ?.getAttribute("data-stale"),
    ).toBe("false");
  });

  it("isStale: marks data-stale and shows refresh button when onRefresh provided", () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <AIAnnotation text="cached" isStale={true} onRefresh={onRefresh} />,
    );
    const node = container.querySelector("[data-ai-annotation]");
    expect(node?.getAttribute("data-stale")).toBe("true");
    // Brand: a cached insight is not faded or greyed — the refresh button is
    // the sole visual cue. The text's colour itself comes from the enclosing
    // PiqInsightStrip, so it is not asserted here.
    expect(node?.className).not.toMatch(/opacity-/);
    expect(node?.className).not.toMatch(/text-piq-muted/);
    const btn = container.querySelector("[data-ai-refresh]");
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(onRefresh).toHaveBeenCalled();
  });

  it("isStale without onRefresh: data-stale but no refresh button", () => {
    const { container } = render(<AIAnnotation text="cached" isStale={true} />);
    expect(container.querySelector("[data-ai-refresh]")).toBeFalsy();
  });

  it("isLoading: shows 'Generating insight…' placeholder", () => {
    const { getByText, container } = render(<AIAnnotation isLoading={true} />);
    expect(getByText(/Generating insight/)).toBeTruthy();
    expect(container.querySelector("[data-loading]")).toBeTruthy();
  });

  it("no text + not loading: renders nothing", () => {
    const { container } = render(<AIAnnotation />);
    expect(container.querySelector("[data-ai-annotation]")).toBeFalsy();
  });
});
