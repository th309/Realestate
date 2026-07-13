import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "../push-encoding";

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url string with no padding needed (length % 4 === 0)", () => {
    // "test" -> base64 "dGVzdA==" -> base64url "dGVzdA" (needs 2 chars padding)
    const result = urlBase64ToUint8Array("dGVzdA");
    expect(Array.from(result)).toEqual([116, 101, 115, 116]); // "test"
  });

  it("round-trips a real VAPID-shaped 65-byte uncompressed P-256 point", () => {
    // A real applicationServerKey is 65 raw bytes (0x04 prefix + 32-byte x + 32-byte y).
    const raw = new Uint8Array(65);
    raw[0] = 0x04;
    for (let i = 1; i < 65; i++) raw[i] = i % 256;

    const base64url = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = urlBase64ToUint8Array(base64url);
    expect(result.length).toBe(65);
    expect(Array.from(result)).toEqual(Array.from(raw));
  });

  it("handles -/_ url-safe characters distinct from +//", () => {
    // Bytes chosen so the base64 encoding contains both '+' and '/' before
    // url-safe substitution, proving the reverse (-, _) -> (+, /) mapping runs.
    const raw = new Uint8Array([0xfb, 0xff, 0xbf]);
    const standardBase64 = Buffer.from(raw).toString("base64"); // "+/+/"-shaped
    expect(standardBase64).toMatch(/[+/]/);
    const urlSafe = standardBase64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = urlBase64ToUint8Array(urlSafe);
    expect(Array.from(result)).toEqual(Array.from(raw));
  });
});
