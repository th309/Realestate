import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaleDealNotice } from "../StaleDealNotice";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("StaleDealNotice", () => {
  it("renders nothing for a fresh deal", () => {
    const { container } = render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(3)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the deal was never saved", () => {
    const { container } = render(
      <StaleDealNotice
        marketCapturedAt={null}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states the real age past the threshold", () => {
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/74 days old/i)).toBeInTheDocument();
  });

  it("offers a refresh the user can trigger", () => {
    const onRefresh = vi.fn();
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /update market data/i }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("never uses quality words for the market (CLAUDE.md §9)", () => {
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    const text = document.body.textContent ?? "";
    for (const banned of [
      "excellent",
      "good",
      "poor",
      "bad",
      "worse",
      "better",
    ]) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });
});
