import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticPropertyImagery } from "../components/StaticPropertyImagery";

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STREET_URL = "https://maps.googleapis.com/street.jpg";

describe("StaticPropertyImagery", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
  });

  it("renders nothing without coordinates", () => {
    const { container } = render(
      <StaticPropertyImagery
        streetUrl={STREET_URL}
        lat={null}
        lon={null}
        address="200 Orlando Ave"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders both tiles with Google attribution on the street image", () => {
    render(
      <StaticPropertyImagery
        streetUrl={STREET_URL}
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(
      screen.getByAltText(/street view of 200 orlando ave/i),
    ).toHaveAttribute("src", STREET_URL);
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
  });

  it("renders aerial alone when no panorama views the address", () => {
    render(
      <StaticPropertyImagery
        streetUrl={null}
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(screen.queryByAltText(/street view/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
    expect(screen.getByAltText(/aerial view/i)).toBeInTheDocument();
  });

  it("renders nothing when neither source is available", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const { container } = render(
      <StaticPropertyImagery
        streetUrl={null}
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("carries no interactive controls — Puppeteer does not hydrate them", () => {
    const { container } = render(
      <StaticPropertyImagery
        streetUrl={STREET_URL}
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
