import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyImagery } from "../PropertyImagery";

const mockUse = vi.fn();
vi.mock("@/lib/data", () => ({
  usePropertyImagery: (...args: unknown[]) => mockUse(...args),
}));

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STREET_URL = "https://maps.googleapis.com/street.jpg";
const AVAILABLE = {
  data: {
    available: true,
    url: STREET_URL,
    panoId: "P1",
    capturedAt: "2023-10",
  },
  isLoading: false,
};
const UNAVAILABLE = {
  data: { available: false, url: null, panoId: null, capturedAt: null },
  isLoading: false,
};

describe("PropertyImagery", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
    mockUse.mockReturnValue(AVAILABLE);
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
    vi.clearAllMocks();
  });

  it("renders nothing when coordinates are missing", () => {
    const { container } = render(
      <PropertyImagery lat={null} lon={null} address="200 Orlando Ave" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the street and aerial tiles side by side", () => {
    const { container } = render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(
      screen.getByAltText(/street view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
    // Two-up on anything wider than mobile.
    expect(
      container.querySelector("[data-property-imagery]")?.className,
    ).toContain("sm:grid-cols-2");
  });

  it("points the street tile at the resolved signed URL", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByAltText(/street view/i)).toHaveAttribute(
      "src",
      STREET_URL,
    );
  });

  it("displays Google attribution on the street tile", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
  });

  it("pins both tiles to 16:10 so neither 640x400 source is cropped", () => {
    const { container } = render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    const tiles = container.querySelectorAll("figure");
    expect(tiles).toHaveLength(2);
    tiles.forEach((tile) => {
      expect(tile.className).toContain("aspect-[16/10]");
    });
  });

  it("drops the street tile entirely when no panorama exists", () => {
    mockUse.mockReturnValue(UNAVAILABLE);
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.queryByAltText(/street view/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
    expect(screen.getByAltText(/aerial view/i)).toBeInTheDocument();
  });

  it("drops the aerial tile when the Mapbox token is absent", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.queryByAltText(/aerial view/i)).not.toBeInTheDocument();
    expect(screen.getByAltText(/street view/i)).toBeInTheDocument();
  });

  it("renders nothing when neither source is available", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    mockUse.mockReturnValue(UNAVAILABLE);
    const { container } = render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
