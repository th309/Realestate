import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => true }),
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/components/entitlements/PaywallCard", () => ({
  PaywallCard: () => <div />,
}));

import { MapContextMenu } from "../MapContextMenu";

describe("MapContextMenu → Graphs", () => {
  it("pushes /graphs with the mid/mtype/mname/mstate params useGraphsState reads", () => {
    render(
      <MapContextMenu
        geography={
          {
            id: "12420",
            name: "Austin",
            geoLevel: "metro",
            value: null,
            stateAbbr: "TX",
          } as any
        }
        x={0}
        y={0}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("View in Graphs"));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("mid=12420");
    expect(url).toContain("mtype=metro");
    expect(url).toContain("mname=Austin");
    expect(url).toContain("mstate=TX");
    expect(url).not.toContain("geo=");
    expect(url).not.toContain("level=");
  });
});
