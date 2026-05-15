import { describe, it, expectTypeOf } from "vitest";
import type {
  ProjectionResult,
  SensitivityResult,
  BreakEvenResult,
  BrrrrTimelineResult,
  AfterTaxResult,
  RentalResult,
  BrrrrResult,
} from "./types";

describe("new analyzer-core types are exported", () => {
  it("ProjectionResult shape", () => {
    expectTypeOf<ProjectionResult>().toHaveProperty("yearly");
    expectTypeOf<ProjectionResult>().toHaveProperty("horizons");
  });
  it("RentalResult has optional projection", () => {
    expectTypeOf<RentalResult["projection"]>().toEqualTypeOf<
      ProjectionResult | undefined
    >();
  });
  it("BrrrrResult has optional timeline", () => {
    expectTypeOf<BrrrrResult["timeline"]>().toEqualTypeOf<
      BrrrrTimelineResult | undefined
    >();
  });
});
