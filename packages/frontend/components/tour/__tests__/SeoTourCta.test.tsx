import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SeoTourCta } from "../SeoTourCta";

const baseProps = {
  marketGeoId: "16740",
  marketGeoLevel: "metro" as const,
  marketName: "Charlotte",
};

describe("SeoTourCta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders nothing initially", () => {
    const { container } = render(<SeoTourCta {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the CTA after 1500ms", () => {
    render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/60-sec tour/i)).toBeInTheDocument();
    expect(screen.getByText(/Charlotte/)).toBeInTheDocument();
  });

  it("does not render if dismissed within last 30 days", () => {
    localStorage.setItem(
      "piq_tour_cta_dismissed",
      String(Date.now() - 5 * 86400_000),
    );
    const { container } = render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders if last dismissal was over 30 days ago", () => {
    localStorage.setItem(
      "piq_tour_cta_dismissed",
      String(Date.now() - 31 * 86400_000),
    );
    render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/60-sec tour/i)).toBeInTheDocument();
  });

  it("dismiss button stores timestamp and hides the CTA", () => {
    const { container } = render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(localStorage.getItem("piq_tour_cta_dismissed")).toBeTruthy();
    expect(container.firstChild).toBeNull();
  });

  it("Start link uses default persona=agent and market params", () => {
    render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const link = screen.getByRole("link", { name: /Start the tour/i });
    expect(link.getAttribute("href")).toMatch(/persona=agent/);
    expect(link.getAttribute("href")).toMatch(/market=metro-16740/);
  });

  it("clicking Investor chip updates the link's persona param", () => {
    render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(screen.getByRole("button", { name: "Investor" }));
    const link = screen.getByRole("link", { name: /Start the tour/i });
    expect(link.getAttribute("href")).toMatch(/persona=investor/);
  });

  it("does not hardcode hex colors", () => {
    render(<SeoTourCta {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const aside = screen.getByRole("complementary");
    expect(aside.outerHTML).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
