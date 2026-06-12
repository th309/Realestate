// packages/frontend/lib/entitlements/__tests__/useDismissable.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useDismissable } from "../useDismissable";

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { onScrimClick } = useDismissable({ onDismiss, cardRef });
  return (
    <div data-testid="scrim" onClick={onScrimClick}>
      <div ref={cardRef} data-testid="card">
        card
      </div>
    </div>
  );
}

describe("useDismissable", () => {
  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the scrim (outside the card) is clicked", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    fireEvent.click(getByTestId("scrim"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does NOT dismiss when the card itself is clicked", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    fireEvent.click(getByTestId("card"));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
