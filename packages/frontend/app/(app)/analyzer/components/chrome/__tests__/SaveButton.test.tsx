import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveButton } from "../SaveButton";

// NOTE: `@testing-library/user-event` is NOT a dependency of this repo — only
// `@testing-library/jest-dom` and `@testing-library/react` are installed. Use
// `fireEvent`, which is the established idiom here (see
// AutoKillBanner.test.tsx).

describe("SaveButton reports its own save state", () => {
  it("invites the first save when no row exists", () => {
    render(<SaveButton status="idle" hasRow={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save deal/i })).toBeEnabled();
  });

  it("shows Saving while a write is in flight and blocks re-entry", () => {
    render(<SaveButton status="saving" hasRow onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("confirms Saved once clean", () => {
    render(<SaveButton status="saved" hasRow onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /^saved$/i }),
    ).toBeInTheDocument();
  });

  it("surfaces a retry on failure — a silent autosave failure loses work", () => {
    render(<SaveButton status="error" hasRow onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /retry save/i });
    expect(btn).toBeEnabled();
  });

  it("calls onClick when actionable", () => {
    const onClick = vi.fn();
    render(<SaveButton status="error" hasRow onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /retry save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick while saving", () => {
    const onClick = vi.fn();
    render(<SaveButton status="saving" hasRow onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /saving/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("SaveButton never claims to have saved what it cannot save", () => {
  // `GET /saved/:id` is deliberately not Pro-gated, so a lapsed-Pro user can
  // open a trial-era deal — but autosave and the PATCH endpoint ARE gated.
  // Reading "Saved" while every edit is dropped is affirmative reassurance
  // that work is safe, on the one control the user would check.
  it("offers an upgrade instead of Saved on an existing row", () => {
    render(
      <SaveButton status="saved" hasRow canSave={false} onClick={vi.fn()} />,
    );
    expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /upgrade to save edits/i }),
    ).toHaveAttribute("href", expect.stringContaining("/pricing"));
  });

  it("offers an upgrade instead of Save deal on a fresh analysis", () => {
    render(
      <SaveButton
        status="idle"
        hasRow={false}
        canSave={false}
        onClick={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: /^upgrade to save$/i }),
    ).toBeInTheDocument();
  });

  it("never fires the save handler for a user who cannot save", () => {
    const onClick = vi.fn();
    render(
      <SaveButton status="idle" hasRow canSave={false} onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole("link", { name: /upgrade/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
