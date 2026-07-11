import { describe, it, expect } from "vitest";
import { distributionPhrase } from "./distribution-phrase";
import type { ScoreDistributionBucket } from "@/lib/data";

function bucket(label: string, count: number): ScoreDistributionBucket {
  return { label, min: 0, max: 100, count };
}

describe("distributionPhrase derives a momentum-descriptive phrase from the distribution", () => {
  it("returns the widespread-cooling phrase when easing labels exceed 60%", () => {
    const buckets = [bucket("VERY WEAK", 70), bucket("VERY STRONG", 30)];
    expect(distributionPhrase(buckets, 100)).toBe(
      "a market where cooling is widespread",
    );
  });

  it("returns the broadly-firming phrase when rising labels exceed 60%", () => {
    const buckets = [bucket("STRONG", 70), bucket("WEAK", 30)];
    expect(distributionPhrase(buckets, 100)).toBe(
      "a market where demand is broadly firming",
    );
  });

  it("returns the uneven phrase when neither group exceeds 60%", () => {
    const buckets = [
      bucket("STRONG", 34),
      bucket("STEADY", 33),
      bucket("WEAK", 33),
    ];
    expect(distributionPhrase(buckets, 100)).toBe(
      "a market moving unevenly, not in one direction",
    );
  });
});
