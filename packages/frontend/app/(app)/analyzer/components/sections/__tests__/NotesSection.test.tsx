import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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

  it("Save button calls onSave with current state", () => {
    const onSave = vi.fn();
    const { container } = render(
      <NotesSection initialNotes="seed" initialShare={true} onSave={onSave} />,
    );
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(onSave).toHaveBeenCalledWith({
      notes: "seed",
      shareWithClient: true,
    });
  });

  it("after Save shows 'Saved ✓' label", () => {
    const { container, getByText } = render(<NotesSection onSave={() => {}} />);
    fireEvent.click(container.querySelector("[data-notes-save]")!);
    expect(getByText(/Saved/)).toBeTruthy();
  });
});
