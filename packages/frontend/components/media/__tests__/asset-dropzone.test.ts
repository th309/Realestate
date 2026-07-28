import { describe, it, expect } from "vitest";
import { formatFileSize, validateAsset } from "../AssetDropzone";

function fakeFile(type: string, size: number): File {
  // File's size is read-only, so build one and override the descriptor.
  const f = new File(["x"], "asset", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

const IMAGES = ["image/png", "image/jpeg", "image/webp"];
const VIDEOS = ["video/mp4", "video/quicktime"];
const MB = 1024 * 1024;

describe("validateAsset", () => {
  it("accepts a file inside the allowlist and under the cap", () => {
    expect(
      validateAsset(fakeFile("image/png", MB), IMAGES, 15 * MB),
    ).toBeNull();
  });

  it("rejects a type outside the allowlist", () => {
    expect(
      validateAsset(fakeFile("image/gif", MB), IMAGES, 15 * MB),
    ).not.toBeNull();
  });

  it("names the accepted types so the operator knows what to do", () => {
    const msg = validateAsset(fakeFile("image/gif", MB), IMAGES, 15 * MB);
    expect(msg).toContain("PNG");
    expect(msg).toContain("JPEG");
  });

  it("handles a file the browser could not type at all", () => {
    // Dragging certain files yields an empty MIME; "is  ." reads as a bug.
    const msg = validateAsset(fakeFile("", MB), IMAGES, 15 * MB);
    expect(msg).toContain("unknown type");
  });

  it("rejects a file over the cap and states both numbers", () => {
    const msg = validateAsset(
      fakeFile("video/mp4", 300 * MB),
      VIDEOS,
      200 * MB,
    );
    expect(msg).toContain("300.0 MB");
    expect(msg).toContain("200.0 MB");
  });

  it("checks type before size, so a wrong-type file is not blamed on size", () => {
    // Both rules fail here. The operator needs to hear the actionable one:
    // shrinking a GIF will never make it acceptable.
    const msg = validateAsset(fakeFile("image/gif", 900 * MB), IMAGES, 15 * MB);
    expect(msg).toContain("image/gif");
    expect(msg).not.toContain("limit is");
  });
});

describe("formatFileSize", () => {
  it.each([
    [512, "512 B"],
    [2048, "2.0 KB"],
    [5 * MB, "5.0 MB"],
  ])("renders %s bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
