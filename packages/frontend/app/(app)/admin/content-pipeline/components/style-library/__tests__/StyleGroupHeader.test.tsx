import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StyleGroupHeader } from "../StyleGroupHeader";

function renderHeader(
  props: Partial<Parameters<typeof StyleGroupHeader>[0]> = {},
) {
  const onToggle = vi.fn();
  render(
    <StyleGroupHeader
      name="Doom-Data Alarm"
      isSteering={false}
      busy={false}
      onToggle={onToggle}
      {...props}
    />,
  );
  return { onToggle };
}

describe("StyleGroupHeader owns the single per-style generation star", () => {
  it("offers to use a style that is not steering yet", () => {
    renderHeader();
    expect(
      screen.getByRole("button", {
        name: "Use Doom-Data Alarm for generation",
        pressed: false,
      }),
    ).toBeInTheDocument();
  });

  it("marks a steering style and offers to stop", () => {
    renderHeader({ isSteering: true });
    expect(
      screen.getByRole("button", {
        name: "Stop using Doom-Data Alarm for generation",
        pressed: true,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Steering generation")).toBeInTheDocument();
  });

  it("toggles on click", () => {
    const { onToggle } = renderHeader();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use Doom-Data Alarm for generation",
      }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("blocks clicks while the group save is in flight", () => {
    renderHeader({ busy: true });
    expect(
      screen.getByRole("button", {
        name: "Use Doom-Data Alarm for generation",
      }),
    ).toBeDisabled();
  });
});
