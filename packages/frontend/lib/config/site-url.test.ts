import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPublicSiteUrl, isLocalhostUrl } from "./site-url";

const CANONICAL = "https://www.propertyiq.app";

describe("getPublicSiteUrl falls back to the live site for any localhost value", () => {
  let originalAppUrl: string | undefined;

  beforeEach(() => {
    originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  const localhostValues = [
    "http://localhost:3000",
    "https://localhost",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://[::1]:3000",
  ];

  it.each(localhostValues)(
    "rewrites localhost env value %s to the canonical site",
    (value) => {
      process.env.NEXT_PUBLIC_APP_URL = value;
      expect(getPublicSiteUrl()).toBe(CANONICAL);
    },
  );

  it("returns the canonical site when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getPublicSiteUrl()).toBe(CANONICAL);
  });

  it("returns the canonical site when the env var is empty/whitespace", () => {
    process.env.NEXT_PUBLIC_APP_URL = "   ";
    expect(getPublicSiteUrl()).toBe(CANONICAL);
  });

  it("preserves a real production URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = CANONICAL;
    expect(getPublicSiteUrl()).toBe(CANONICAL);
  });

  it("preserves a non-localhost staging/preview URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.propertyiq.app";
    expect(getPublicSiteUrl()).toBe("https://staging.propertyiq.app");
  });

  it("strips a trailing slash so links never double up", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.propertyiq.app/";
    expect(getPublicSiteUrl()).toBe(CANONICAL);
  });
});

describe("isLocalhostUrl", () => {
  it.each([
    "http://localhost:3000/betatest/abc",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("flags %s as localhost", (url) => {
    expect(isLocalhostUrl(url)).toBe(true);
  });

  it.each([
    "https://www.propertyiq.app/betatest/abc",
    "https://staging.propertyiq.app",
  ])("does not flag %s", (url) => {
    expect(isLocalhostUrl(url)).toBe(false);
  });
});
