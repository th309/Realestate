import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StyleSignalPanel } from "../StyleSignalPanel";
import type {
  SavedStyleRef,
  StylePreferences,
} from "../../../lib/style-preferences";

function savedRef(overrides: Partial<SavedStyleRef> = {}): SavedStyleRef {
  return {
    style_reference_id: "ref-a",
    label: "Bold metro poster",
    saved_at: "2026-07-20T00:00:00.000Z",
    exists: true,
    palette: ["#0B1E3F"],
    typography: [],
    layout: [],
    summary: "High contrast.",
    ...overrides,
  };
}

function preferences(
  overrides: Partial<StylePreferences> = {},
): StylePreferences {
  return {
    brandId: "brand-1",
    signalWeight: 1,
    savedStyleRefs: [savedRef()],
    stylePreamble: "SAVED STYLE PREFERENCES (…):\n- Bold metro poster: …",
    ...overrides,
  };
}

describe("StyleSignalPanel tells the operator what is steering generation", () => {
  it("renders nothing until preferences have loaded", () => {
    const { container } = render(
      <StyleSignalPanel
        preferences={undefined}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("invites the operator to act when no styles are saved", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({ savedStyleRefs: [], stylePreamble: "" })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(
      screen.getByText(/No styles are steering generation yet/i),
    ).toBeInTheDocument();
  });

  it("names each saved style that is in play", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({
          savedStyleRefs: [
            savedRef(),
            savedRef({ style_reference_id: "ref-b", label: "Soft editorial" }),
          ],
        })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(screen.getByText("Bold metro poster")).toBeInTheDocument();
    expect(screen.getByText("Soft editorial")).toBeInTheDocument();
    expect(screen.getByText(/2 styles shape/i)).toBeInTheDocument();
  });

  it("says styles are muted rather than absent at weight 0", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({ signalWeight: 0, stylePreamble: "" })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(screen.getByText(/Saved styles are muted/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Off", pressed: true }),
    ).toBeInTheDocument();
  });

  it("shows the exact prompt text so a bad post can be traced to it", () => {
    render(
      <StyleSignalPanel
        preferences={preferences()}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(screen.getByText(/Read the exact prompt text/i)).toBeInTheDocument();
    expect(
      screen.getByText(/SAVED STYLE PREFERENCES/, { exact: false }),
    ).toBeInTheDocument();
  });

  it("offers no prompt disclosure when nothing reaches the prompt", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({ signalWeight: 0, stylePreamble: "" })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(
      screen.queryByText(/Read the exact prompt text/i),
    ).not.toBeInTheDocument();
  });

  it("marks the stored weight as the active strength", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({ signalWeight: 1.7 })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Strong", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "House look", pressed: false }),
    ).toBeInTheDocument();
  });

  it("sends the weight for the strength the operator picked", () => {
    const onChangeStrength = vi.fn();
    render(
      <StyleSignalPanel
        preferences={preferences()}
        onChangeStrength={onChangeStrength}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(onChangeStrength).toHaveBeenCalledWith(0.5);
  });

  it("explains why a deleted reference stopped counting", () => {
    render(
      <StyleSignalPanel
        preferences={preferences({
          savedStyleRefs: [savedRef(), savedRef({ exists: false })],
        })}
        onChangeStrength={vi.fn()}
        busy={false}
      />,
    );
    expect(
      screen.getByText(/1 saved reference was deleted from the library/i),
    ).toBeInTheDocument();
  });

  it("disables the dial while a change is in flight", () => {
    render(
      <StyleSignalPanel
        preferences={preferences()}
        onChangeStrength={vi.fn()}
        busy
      />,
    );
    expect(screen.getByRole("button", { name: "Strong" })).toBeDisabled();
  });
});
