import { describe, expect, it } from "vitest";
import { shouldCompressProxyResponse } from "../proxy-compression";

const LARGE = 900_000;

describe("shouldCompressProxyResponse", () => {
  it("compresses a large JSON response for a gzip-capable client", () => {
    expect(
      shouldCompressProxyResponse(
        "application/json",
        "gzip, deflate, br",
        LARGE,
      ),
    ).toBe(true);
  });

  it("skips clients that do not accept gzip", () => {
    expect(shouldCompressProxyResponse("application/json", null, LARGE)).toBe(
      false,
    );
    expect(shouldCompressProxyResponse("application/json", "br", LARGE)).toBe(
      false,
    );
    expect(
      shouldCompressProxyResponse("application/json", "gzip;q=0", LARGE),
    ).toBe(false);
  });

  it("respects a positive q value", () => {
    expect(
      shouldCompressProxyResponse("application/json", "gzip;q=0.5", LARGE),
    ).toBe(true);
  });

  it("skips small bodies (not worth the header overhead)", () => {
    expect(shouldCompressProxyResponse("application/json", "gzip", 512)).toBe(
      false,
    );
  });

  it("skips non-compressible content types", () => {
    expect(shouldCompressProxyResponse("image/png", "gzip", LARGE)).toBe(false);
    expect(
      shouldCompressProxyResponse("application/octet-stream", "gzip", LARGE),
    ).toBe(false);
  });

  it("refuses SSE even though text/* is otherwise compressible", () => {
    expect(
      shouldCompressProxyResponse("text/event-stream", "gzip", LARGE),
    ).toBe(false);
    expect(shouldCompressProxyResponse("text/html", "gzip", LARGE)).toBe(true);
  });

  it("compresses buffered NDJSON (already non-streaming through this proxy)", () => {
    expect(
      shouldCompressProxyResponse("application/x-ndjson", "gzip", LARGE),
    ).toBe(true);
  });
});
