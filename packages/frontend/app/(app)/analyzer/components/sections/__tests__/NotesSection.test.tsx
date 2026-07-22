import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { NotesSection } from "../NotesSection";

describe("NotesSection", () => {
  it("typing in textarea updates state", () => {
    const { container } = render(<NotesSection />);
    const ta = container.querySelector(
      "[data-notes-textarea]",
    ) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "hello world" } });
    expect(ta.value).toBe("hello world");
  });

  it("toggling share checkbox updates state", () => {
    const { container } = render(<NotesSection />);
    const cb = container.querySelector(
      "[data-notes-share]",
    ) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it("Save button calls onSave with current state", async () => {
    const onSave = vi.fn();
    const { container } = render(
      <NotesSection initialNotes="seed" initialShare={true} onSave={onSave} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        notes: "seed",
        shareWithClient: true,
      }),
    );
  });

  it("after Save shows 'Saved ✓' label", async () => {
    const { container, findByText } = render(
      <NotesSection onSave={() => {}} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(await findByText(/Saved/)).toBeTruthy();
  });

  it("shows an inline error and keeps the label 'Save' when onSave resolves false", async () => {
    const { container, findByText } = render(
      <NotesSection onSave={async () => false} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(await findByText(/Couldn.t save/)).toBeTruthy();
    expect(container.querySelector("[data-notes-save]")!.textContent).toBe(
      "Save",
    );
  });

  it("clears the save-failed banner when the textarea is edited again", async () => {
    const { container, findByText, queryByText } = render(
      <NotesSection onSave={async () => false} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(await findByText(/Couldn.t save/)).toBeTruthy();

    fireEvent.change(container.querySelector("[data-notes-textarea]")!, {
      target: { value: "revised notes" },
    });
    expect(queryByText(/Couldn.t save/)).toBeNull();
  });

  it("clears the save-failed banner when the share checkbox is toggled again", async () => {
    const { container, findByText, queryByText } = render(
      <NotesSection onSave={async () => false} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(await findByText(/Couldn.t save/)).toBeTruthy();

    fireEvent.click(container.querySelector("[data-notes-share]")!);
    expect(queryByText(/Couldn.t save/)).toBeNull();
  });
});
