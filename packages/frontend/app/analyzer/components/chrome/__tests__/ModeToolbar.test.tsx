import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ModeProvider } from "../../../lib/mode-context";
import { ModeToolbar } from "../ModeToolbar";

describe("ModeToolbar", () => {
  it("clicking a mode applies bg-primary class", () => {
    const { getByText } = render(
      <ModeProvider>
        <ModeToolbar />
      </ModeProvider>,
    );
    const presentBtn = getByText(/Present/);
    fireEvent.click(presentBtn);
    expect(presentBtn.className).toMatch(/bg-primary/);
  });
});
