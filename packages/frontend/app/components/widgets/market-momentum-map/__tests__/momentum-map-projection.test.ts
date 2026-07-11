import { describe, expect, it } from "vitest";
import {
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  projectMetros,
} from "../momentum-map-projection";

const desMoines = {
  id: "19780",
  name: "Des Moines-West Des Moines, IA",
  lat: 41.512,
  lon: -93.729,
  pop: 737164,
  conf: "A",
};
const sanJuanPR = {
  id: "41980",
  name: "San Juan-Bayamón-Caguas, PR",
  lat: 18.38,
  lon: -66.15,
  pop: 2000000,
  conf: "B",
};
const noPop = {
  id: "99999",
  name: "Tiny Metro",
  lat: 39.0,
  lon: -98.0,
  pop: null,
  conf: null,
};

describe("projectMetros", () => {
  const options = { minRadius: 1.5, maxRadius: 22 };

  it("projects a contiguous-US metro inside the viewBox", () => {
    const [metro] = projectMetros([desMoines], options);
    expect(metro.x).toBeGreaterThan(0);
    expect(metro.x).toBeLessThan(MAP_VIEWBOX_WIDTH);
    expect(metro.y).toBeGreaterThan(0);
    expect(metro.y).toBeLessThan(MAP_VIEWBOX_HEIGHT);
  });

  it("drops Puerto Rico metros (outside geoAlbersUsa)", () => {
    const projected = projectMetros([desMoines, sanJuanPR], options);
    expect(projected).toHaveLength(1);
    expect(projected[0].id).toBe("19780");
  });

  it("keeps matrixIndex pointing at the ORIGINAL payload row", () => {
    const projected = projectMetros([sanJuanPR, desMoines], options);
    expect(projected[0].id).toBe("19780");
    expect(projected[0].matrixIndex).toBe(1); // second in the input array
  });

  it("gives null-population metros the minimum radius and sorts big first", () => {
    const projected = projectMetros([noPop, desMoines], options);
    expect(projected[0].id).toBe("19780"); // bigger dot renders first (under)
    expect(projected[1].r).toBe(options.minRadius);
  });
});
