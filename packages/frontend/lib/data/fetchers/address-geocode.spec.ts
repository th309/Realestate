import { describe, it, expect } from "vitest";
import { featureToSuggestion } from "./address-geocode";

describe("featureToSuggestion", () => {
  it("extracts label, center, and ZIP from a Mapbox address feature", () => {
    const feature = {
      id: "address.1",
      place_type: ["address"],
      place_name: "123 Main St, Austin, Texas 78702, United States",
      text: "Main St",
      center: [-97.72, 30.26],
      context: [
        { id: "postcode.1", text: "78702" },
        { id: "place.1", text: "Austin" },
        { id: "region.1", text: "Texas", short_code: "US-TX" },
      ],
    };
    expect(featureToSuggestion(feature as never)).toEqual({
      id: "address.1",
      label: "123 Main St, Austin, Texas 78702, United States",
      lng: -97.72,
      lat: 30.26,
      zip: "78702",
    });
  });

  it("reads ZIP from a postcode-type feature itself", () => {
    const feature = {
      id: "postcode.2",
      place_type: ["postcode"],
      place_name: "78702, Texas, United States",
      text: "78702",
      center: [-97.7, 30.25],
      context: [{ id: "region.1", text: "Texas" }],
    };
    expect(featureToSuggestion(feature as never).zip).toBe("78702");
  });

  it("returns null zip when none present", () => {
    const feature = {
      id: "address.3",
      place_type: ["address"],
      place_name: "Somewhere",
      text: "x",
      center: [0, 0],
      context: [],
    };
    expect(featureToSuggestion(feature as never).zip).toBeNull();
  });
});
