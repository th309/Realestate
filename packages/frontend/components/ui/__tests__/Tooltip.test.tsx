import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { Tooltip, RichTooltip } from "../Tooltip";

describe("RichTooltip — touch fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderRichTooltip() {
    return render(
      <RichTooltip title="Cap Rate" content="NOI ÷ Purchase Price">
        <button type="button">Trigger</button>
      </RichTooltip>,
    );
  }

  it("hover still opens after the delay (desktop behavior unchanged)", () => {
    const { container, getByRole } = renderRichTooltip();
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();

    fireEvent.mouseEnter(
      getByRole("button", { name: "Trigger" }).parentElement!,
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(container.querySelector('[role="tooltip"]')?.textContent).toMatch(
      /NOI ÷ Purchase Price/,
    );
  });

  it("mouse leave closes the hover-opened tooltip", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.mouseLeave(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
  });

  it("tap (click) opens the tooltip", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
  });

  it("second tap closes the tooltip", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
  });

  it("outside click closes an open tooltip", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
  });

  it("clicking inside the open tooltip content does not close it (regression)", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.click(trigger);
    const tooltipBody = container.querySelector('[role="tooltip"]');
    expect(tooltipBody).toBeTruthy();

    fireEvent.click(tooltipBody!);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
  });

  it("Escape closes an open tooltip", () => {
    const { container, getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
  });

  it("exposes aria-expanded on the trigger container", () => {
    const { getByRole } = renderRichTooltip();
    const trigger = getByRole("button", { name: "Trigger" }).parentElement!;

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Tooltip (base) — click-toggle addition", () => {
  it("click opens the tooltip without breaking hover/focus consumers", () => {
    const { container, getByText } = render(
      <Tooltip content="Hello there">
        <span>Hover me</span>
      </Tooltip>,
    );
    const trigger = getByText("Hover me").parentElement!;
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.click(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
  });

  it("focus still opens the tooltip (existing behavior preserved)", () => {
    vi.useFakeTimers();
    const { container, getByText } = render(
      <Tooltip content="Hello there">
        <span>Hover me</span>
      </Tooltip>,
    );
    const trigger = getByText("Hover me").parentElement!;

    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();

    fireEvent.blur(trigger);
    expect(container.querySelector('[role="tooltip"]')).toBeFalsy();
    vi.useRealTimers();
  });
});
