import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

let mockState: any = { data: undefined, isLoading: true };
vi.mock("@/lib/analyzer/useSavedAnalysis", () => ({
  useSavedAnalysis: () => mockState,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import SavedClient from "../SavedClient";

describe("Analyzer SavedClient dead-end states", () => {
  it("shows a back-to-Analyzer link while loading", () => {
    mockState = { data: undefined, isLoading: true };
    const { container } = render(<SavedClient id="sa-1" />);
    expect(container.querySelector('a[href="/analyzer"]')).toBeTruthy();
  });

  it("shows a back-to-Analyzer link when the analysis is not found", () => {
    mockState = { data: null, isLoading: false };
    const { container } = render(<SavedClient id="sa-1" />);
    expect(container.querySelector('a[href="/analyzer"]')).toBeTruthy();
  });
});
