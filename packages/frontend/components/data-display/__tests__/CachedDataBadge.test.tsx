import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CachedDataBadge } from "../CachedDataBadge";

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("CachedDataBadge", () => {
  afterEach(() => {
    setNavigatorOnline(true);
  });

  it("renders nothing when there is no dataUpdatedAt yet", () => {
    setNavigatorOnline(false);
    const { container } = render(<CachedDataBadge dataUpdatedAt={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when data is fresh (<10min) and online", () => {
    setNavigatorOnline(true);
    const { container } = render(
      <CachedDataBadge dataUpdatedAt={Date.now() - 60_000} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the chip once data is stale (>10min), even while online", () => {
    setNavigatorOnline(true);
    const twelveMinutesAgo = Date.now() - 12 * 60 * 1000;
    render(<CachedDataBadge dataUpdatedAt={twelveMinutesAgo} />);

    expect(screen.getByText(/data from 12m ago/i)).toBeInTheDocument();
  });

  it("renders the chip while offline, even if data is fresh", () => {
    setNavigatorOnline(false);
    render(<CachedDataBadge dataUpdatedAt={Date.now()} />);

    expect(screen.getByText(/data from/i)).toBeInTheDocument();
  });
});
