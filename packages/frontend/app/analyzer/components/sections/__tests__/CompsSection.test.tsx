import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CompsSection, CompPin } from "../CompsSection";

vi.mock("react-map-gl/mapbox", () => ({
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-mapbox-mock>{children}</div>
  ),
  Marker: ({ color }: { color: string }) => <div data-marker={color} />,
}));

const sales: CompPin[] = [
  {
    address: "100 Main",
    lat: 30.27,
    lon: -97.74,
    price: 240_000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    distance: 0.5,
  },
  {
    address: "200 Main",
    lat: 30.28,
    lon: -97.74,
    price: 245_000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    distance: 0.6,
  },
];
const rents: CompPin[] = [
  {
    address: "300 Main",
    lat: 30.29,
    lon: -97.74,
    rent: 2850,
    beds: 3,
    baths: 2,
    sqft: 1500,
    distance: 0.4,
  },
];

describe("CompsSection", () => {
  it("renders violin + map placeholder + table rows", () => {
    const { container, getByText } = render(
      <CompsSection
        subjectLat={30.27}
        subjectLon={-97.74}
        pricePerSqftValues={[150, 160, 170, 180, 190, 200]}
        yourPricePerSqft={170}
        salesComps={sales}
        rentalComps={rents}
        mapboxToken="pk.test"
      />,
    );
    expect(getByText("Comparable Sales & Rentals")).toBeTruthy();
    expect(container.querySelector("[data-comps-violin]")).toBeTruthy();
    expect(container.querySelector("[data-comps-map]")).toBeTruthy();
    expect(container.querySelector("[data-mapbox-mock]")).toBeTruthy();
    // 2 sales + 1 rental = 3 comp rows
    expect(container.querySelectorAll("[data-comp-row]").length).toBe(3);
  });

  it("renders subject + sales + rental markers", () => {
    const { container } = render(
      <CompsSection
        subjectLat={30.27}
        subjectLon={-97.74}
        pricePerSqftValues={[]}
        yourPricePerSqft={170}
        salesComps={sales}
        rentalComps={rents}
        mapboxToken="pk.test"
      />,
    );
    // 1 subject + 2 sales + 1 rental = 4 markers
    expect(container.querySelectorAll("[data-marker]").length).toBe(4);
  });
});
