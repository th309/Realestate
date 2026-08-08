import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyImagery } from "../PropertyImagery";

const mockUse = vi.fn();
vi.mock("@/lib/data", () => ({
  usePropertyImagery: (...args: unknown[]) => mockUse(...args),
}));

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const AVAILABLE = {
  data: {
    available: true,
    url: "https://maps.googleapis.com/street.jpg",
    panoId: "P1",
    capturedAt: "2023-10",
  },
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

  it("shows both tabs and defaults to Street when a panorama exists", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByRole("button", { name: /street/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /aerial/i })).toBeInTheDocument();
    expect(
      screen.getByAltText(/street view of 200 orlando ave/i),
    ).toBeInTheDocument();
  });

  it("displays Google attribution while Street View is shown", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
  });

  it("switches to the aerial image when the Aerial tab is clicked", async () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    await userEvent.click(screen.getByRole("button", { name: /aerial/i }));
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
  });

  it("hides the Street tab entirely when no panorama exists", () => {
    mockUse.mockReturnValue({
      data: { available: false, url: null, panoId: null, capturedAt: null },
      isLoading: false,
    });
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(
      screen.queryByRole("button", { name: /street/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when neither source is available", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    mockUse.mockReturnValue({
      data: { available: false, url: null, panoId: null, capturedAt: null },
      isLoading: false,
    });
    const { container } = render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
