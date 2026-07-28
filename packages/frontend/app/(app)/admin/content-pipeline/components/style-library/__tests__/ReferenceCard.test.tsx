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
  render(
    <ReferenceCard
      reference={reference()}
      isSaved={false}
      onReExtract={vi.fn()}
      onDelete={vi.fn()}
      isReExtracting={false}
      {...props}
    />,
  );
}

describe("ReferenceCard defers preference learning to the group header", () => {
  it("renders no per-card save star (the group header owns it)", () => {
    renderCard();
    expect(
      screen.queryByRole("button", { name: /for generation/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the existing re-extract and delete actions", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: "Re-extract" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

describe("ReferenceCard preview prefers the signed storage mirror", () => {
  it("renders the signed preview_strip_url over source_url", () => {
    renderCard({
      reference: reference({
        preview_strip_url: "https://project.supabase.co/signed/preview.jpg",
      }),
    });
    expect(screen.getByAltText("Bold metro poster")).toHaveAttribute(
      "src",
      "https://project.supabase.co/signed/preview.jpg",
    );
  });

  it("falls back to source_url when no mirror exists", () => {
    renderCard();
    expect(screen.getByAltText("Bold metro poster")).toHaveAttribute(
      "src",
      "https://example.invalid/a.png",
    );
  });

  it("ignores an unsigned supabase:// preview rather than rendering a broken src", () => {
    renderCard({
      reference: reference({
        preview_strip_url: "supabase://content-pipeline/x/preview.jpg",
      }),
    });
    expect(screen.getByAltText("Bold metro poster")).toHaveAttribute(
      "src",
      "https://example.invalid/a.png",
    );
  });

  it("shows the no-image placeholder when neither URL is present", () => {
    renderCard({
      reference: reference({ source_url: null, preview_strip_url: null }),
    });
    expect(screen.getByText("(no image)")).toBeInTheDocument();
  });
});

describe("ReferenceCard palette handles both extraction shapes", () => {
  it("falls back to a video reference's dominant_palette swatches", () => {
    renderCard({
      reference: reference({
        extracted_attributes: { dominant_palette: ["#112233", "#445566"] },
      }),
    });
    expect(screen.getByTitle("#112233")).toBeInTheDocument();
    expect(screen.getByTitle("#445566")).toBeInTheDocument();
  });

  it("survives a malformed non-array dominant_palette without crashing", () => {
    renderCard({
      reference: reference({
        extracted_attributes: {
          dominant_palette: "not-an-array" as unknown as string[],
        },
      }),
    });
    expect(
      screen.getByText("No palette extracted yet. Try Re-extract."),
    ).toBeInTheDocument();
  });
});
