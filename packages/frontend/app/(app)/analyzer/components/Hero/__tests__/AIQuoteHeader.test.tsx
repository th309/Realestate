import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AIQuoteHeader } from "../AIQuoteHeader";

describe("AIQuoteHeader", () => {
  it("renders text when provided", () => {
    const { getByText, container } = render(
      <AIQuoteHeader text="Strong cashflow play with a 22% IRR" />,
    );
    expect(getByText(/Strong cashflow play/)).toBeTruthy();
    expect(
      container
        .querySelector("[data-ai-quote-header]")
        ?.getAttribute("data-streaming"),
    ).toBe("false");
  });

  it("renders placeholder when text empty", () => {
    const { getByText } = render(<AIQuoteHeader text="" />);
    expect(getByText(/Generating verdict/)).toBeTruthy();
  });

  it("isStreaming shows blinking caret + data-streaming=true", () => {
    const { container } = render(<AIQuoteHeader text="hello" isStreaming />);
    expect(
      container
        .querySelector("[data-ai-quote-header]")
        ?.getAttribute("data-streaming"),
    ).toBe("true");
    expect(container.querySelector("[data-ai-caret]")).toBeTruthy();
  });

  it("not streaming hides caret", () => {
    const { container } = render(<AIQuoteHeader text="hello" />);
    expect(container.querySelector("[data-ai-caret]")).toBeFalsy();
  });
});
