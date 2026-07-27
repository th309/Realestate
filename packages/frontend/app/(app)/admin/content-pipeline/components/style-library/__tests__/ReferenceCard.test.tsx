import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReferenceCard } from "../ReferenceCard";
import type { StyleReference } from "../../../lib/style-refs-api";

function reference(overrides: Partial<StyleReference> = {}): StyleReference {
  return {
    id: "ref-a",
    user_id: "user-1",
    kind: "thumbnail",
    label: "Bold metro poster",
    source_url: "https://example.invalid/a.png",
    preview_strip_url: null,
    extracted_attributes: { palette: ["#0B1E3F"], summary: "High contrast." },
    vision_cost_usd: 0.0012,
    created_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof ReferenceCard>[0]> = {}) {
  const onToggleSaved = vi.fn();
  render(
    <ReferenceCard
      reference={reference()}
      isSaved={false}
      onToggleSaved={onToggleSaved}
      onReExtract={vi.fn()}
      onDelete={vi.fn()}
      isSaving={false}
      isReExtracting={false}
      {...props}
    />,
  );
  return { onToggleSaved };
}

describe("ReferenceCard save toggle drives preference learning", () => {
  it("offers to use an unsaved style, naming the reference", () => {
    renderCard();
    expect(
      screen.getByRole("button", {
        name: "Use Bold metro poster for generation",
        pressed: false,
      }),
    ).toBeInTheDocument();
  });

  it("offers to stop using a saved style and marks the card", () => {
    renderCard({ isSaved: true });
    expect(
      screen.getByRole("button", {
        name: "Stop using Bold metro poster for generation",
        pressed: true,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Steering generation")).toBeInTheDocument();
  });

  it("does not claim an unsaved style is steering generation", () => {
    renderCard();
    expect(screen.queryByText("Steering generation")).not.toBeInTheDocument();
  });

  it("toggles on click", () => {
    const { onToggleSaved } = renderCard();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use Bold metro poster for generation",
      }),
    );
    expect(onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("blocks a second click while the save is in flight", () => {
    renderCard({ isSaving: true });
    expect(
      screen.getByRole("button", {
        name: "Use Bold metro poster for generation",
      }),
    ).toBeDisabled();
  });

  it("keeps the existing re-extract and delete actions", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: "Re-extract" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
