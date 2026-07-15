import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/navigation", () => ({ Breadcrumbs: () => <nav /> }));
vi.mock("../components/SectionLibrary", () => ({
  SectionLibrary: () => <aside />,
}));
vi.mock("../components/Canvas", () => ({ Canvas: () => <main /> }));
vi.mock("../components/PropertyPanel", () => ({
  PropertyPanel: () => <aside />,
}));

import { Builder } from "../Builder";

describe("Report Builder", () => {
  it("no longer renders the removed AI Assist floating action button", () => {
    const { container } = render(<Builder />);
    expect(container.querySelector(".fixed.bottom-6.right-6")).toBeNull();
  });
});
