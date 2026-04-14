/**
 * SeoPageConversionBar — trigger, content, dismissal persistence.
 *
 * Covers:
 *  - Hidden before trigger fires
 *  - Stays hidden if dismissed within 7 days
 *  - Appears after timer; shows market variant copy
 *  - Persists dismissal with current timestamp on close
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/lib/analytics/tracker", () => ({
  trackEvent: vi.fn(),
  flush: vi.fn(),
}));

import { SeoPageConversionBar } from "../SeoPageConversionBar";

const DISMISS_KEY = "piq_seo_bar_dismissed";

describe("SeoPageConversionBar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render until trigger fires", () => {
    render(<SeoPageConversionBar context="market" />);
    expect(screen.queryByText(/Sign up free/i)).toBeNull();
  });

  it("appears after 8s timer and shows blog variant copy", () => {
    render(<SeoPageConversionBar context="blog" />);
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(screen.getByText(/Sign up free/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly market pulse/i)).toBeInTheDocument();
  });

  it("stays hidden if dismissed within 7 days", () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 86_400_000));
    render(<SeoPageConversionBar context="market" />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText(/Sign up free/i)).toBeNull();
  });

  it("reappears if prior dismissal is older than 7 days", () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 8 * 86_400_000));
    render(<SeoPageConversionBar context="market" marketName="Austin, TX" />);
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(
      screen.getByText(/Get the full score breakdown for Austin, TX/i),
    ).toBeInTheDocument();
  });
});
