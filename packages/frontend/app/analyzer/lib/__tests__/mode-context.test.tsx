import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeProvider, useMode } from "../mode-context";

function Probe() {
  const { mode, setMode } = useMode();
  return (
    <>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode("present")}>P</button>
    </>
  );
}

describe("ModeContext", () => {
  it("default mode is pro", () => {
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );
    expect(screen.getByTestId("mode").textContent).toBe("pro");
  });

  it("setMode changes mode", () => {
    render(
      <ModeProvider>
        <Probe />
      </ModeProvider>,
    );
    fireEvent.click(screen.getByText("P"));
    expect(screen.getByTestId("mode").textContent).toBe("present");
  });
});
