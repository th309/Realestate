import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/data/fetchers/base", () => ({
  fetchAPIRaw: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import ActivatePage from "../page";

describe("ActivatePage success screen", () => {
  it("shows forward links to API keys and MCP docs after activation", async () => {
    const { container, getByPlaceholderText, getByRole } = render(
      <ActivatePage />,
    );
    fireEvent.change(getByPlaceholderText("ABCD-1234"), {
      target: { value: "ABCD-1234" },
    });
    fireEvent.click(getByRole("button", { name: /activate/i }));
    await waitFor(() => {
      expect(
        container.querySelector('a[href="/account/api-keys"]'),
      ).toBeTruthy();
    });
    expect(container.querySelector('a[href="/docs/mcp"]')).toBeTruthy();
  });
});
