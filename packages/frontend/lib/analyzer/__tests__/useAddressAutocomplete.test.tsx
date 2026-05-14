import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAddressAutocomplete } from "../useAddressAutocomplete";

const fetchMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = fetchMock as any;
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test.token";

describe("useAddressAutocomplete", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("does not query under 3 chars", async () => {
    const { result } = renderHook(() => useAddressAutocomplete());
    act(() => {
      result.current.setQuery("12");
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces and queries Mapbox places API after 3+ chars", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "addr.1",
            place_name: "123 Main St, Austin, TX 78704",
            text: "123 Main St",
            center: [-97.7, 30.25],
            context: [
              { id: "postcode.1", text: "78704" },
              { id: "place.1", text: "Austin" },
              { id: "region.1", short_code: "US-TX", text: "Texas" },
            ],
          },
        ],
      }),
    });
    const { result } = renderHook(() => useAddressAutocomplete());
    act(() => {
      result.current.setQuery("123 Main");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain("mapbox.places");
    expect(fetchMock.mock.calls[0][0]).toContain("types=address");
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    expect(result.current.suggestions[0].postalCode).toBe("78704");
    expect(result.current.suggestions[0].state).toBe("TX");
  });
});
