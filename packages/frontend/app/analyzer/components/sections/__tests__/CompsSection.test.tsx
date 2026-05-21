import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CompsSection, type CompPin } from "../CompsSection";

vi.mock("react-map-gl/mapbox", () => ({
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-mapbox-mock>{children}</div>
  ),
  Marker: ({
    children,
    anchor,
  }: {
    children?: React.ReactNode;
    anchor?: string;
  }) => <div data-marker={anchor ?? "center"}>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-popup>{children}</div>
  ),
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
  it("renders distribution + map + table", () => {
    const { container, getByText } = render(
      <CompsSection
        subjectLat={30.27}
        subjectLon={-97.74}
        subjectAddress="123 Subject St, Phoenix, AZ"
        pricePerSqftValues={[150, 160, 170, 180, 190, 200]}
        yourPricePerSqft={170}
        salesComps={sales}
        rentalComps={rents}
        mapboxToken="pk.test"
      />,
    );
    expect(getByText("Comparable Sales & Rentals")).toBeTruthy();
    expect(container.querySelector("[data-comps-distribution]")).toBeTruthy();
    expect(container.querySelector("[data-comps-map]")).toBeTruthy();
    expect(container.querySelector("[data-mapbox-mock]")).toBeTruthy();
    expect(container.querySelector("[data-comps-table]")).toBeTruthy();
  });

  it("renders subject + sales + rental markers", () => {
    const { container } = render(
      <CompsSection
        subjectLat={30.27}
        subjectLon={-97.74}
        subjectAddress="123 Subject St"
        pricePerSqftValues={[]}
        yourPricePerSqft={170}
        salesComps={sales}
        rentalComps={rents}
        mapboxToken="pk.test"
      />,
    );
    // 1 subject + 2 sales + 1 rental = 4 markers
    expect(container.querySelectorAll("[data-marker]").length).toBe(4);
    // Sales + rental markers carry data-comp-marker attribute (subject does not)
    expect(container.querySelectorAll("[data-comp-marker]").length).toBe(3);
  });

  it("renders the empty-state distribution when no valid sales comps", () => {
    const { container } = render(
      <CompsSection
        subjectLat={null}
        subjectLon={null}
        subjectAddress={null}
        pricePerSqftValues={[]}
        yourPricePerSqft={0}
        salesComps={[]}
        rentalComps={[]}
        mapboxToken=""
      />,
    );
    // Distribution slot still rendered, but CompsDistribution is replaced by
    // a "No sales comps..." empty state. We just verify the slot exists.
    expect(container.querySelector("[data-comps-distribution]")).toBeTruthy();
  });
});
