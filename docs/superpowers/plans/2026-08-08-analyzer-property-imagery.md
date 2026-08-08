# Analyzer Property Imagery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Google Street View exterior and a Mapbox aerial view of the subject property in the Analyzer, on the public share link, and in the PDF.

**Architecture:** Street View is backend-mediated — NestJS holds the Google key plus a per-project signing secret, calls Google's free metadata endpoint to test panorama availability, and returns an HMAC-SHA1-signed image URL that the browser loads directly from Google. Aerial imagery is built client-side from the already-public `NEXT_PUBLIC_MAPBOX_TOKEN`, matching the existing `StaticCompsMap` pattern. No image bytes are ever stored or proxied by us.

**Tech Stack:** NestJS 11, `class-validator`, Node `crypto` (HMAC-SHA1), Next.js 16 App Router, React 19, TanStack Query 5, Tailwind 4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-analyzer-property-imagery-design.md`.
- **Never store or cache Google image bytes.** Google policy: "Content pre-fetching, indexing, storing, or caching is generally prohibited, except for place IDs and panorama IDs." Caching the metadata JSON (which contains `pano_id`) is permitted.
- **Attribution is contractual.** Street View imagery must display the Google logo or the text `Google Maps`, visible, unobscured, correct capitalization, on one line, not localized.
- **No secret fallbacks.** Per CLAUDE.md §1.2, missing config throws. Never write `config.get('X') || 'default'`.
- All frontend data fetching goes through `@/lib/data` (CLAUDE.md §5). Never call `fetch(API_URL...)` from a component.
- File size limits (CLAUDE.md §1.3): logic files < 300 lines, components < 400 lines.
- Backend `tsc` verification must be plain `npx tsc --noEmit` — `nest build` excludes spec files.
- Branch: `develop`. Commit with pathspecs, never `git add -A`. No `Co-Authored-By` trailer.

---

### Task 1: Google URL signer

The highest-risk unit. Google's signing secret is _URL-safe_ base64 (`-` and `_` instead of `+` and `/`) and must be decoded to raw bytes before HMAC-ing. Signing the base64 _string_ instead of the decoded bytes fails with a 403 that reads like a bad API key rather than a bad signature.

**Files:**

- Create: `packages/backend/src/street-view/google-url-signer.ts`
- Test: `packages/backend/src/street-view/google-url-signer.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `signGoogleMapsUrl(url: string, secret: string): string` — returns the input URL with `&signature=<urlsafe-base64>` appended.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/street-view/google-url-signer.spec.ts
import { signGoogleMapsUrl } from "./google-url-signer";

const URL_UNDER_TEST =
  "https://maps.googleapis.com/maps/api/streetview?size=640x400&pano=abc123&key=TEST_KEY";

describe("signGoogleMapsUrl", () => {
  it("appends a signature query parameter", () => {
    const signed = signGoogleMapsUrl(
      URL_UNDER_TEST,
      "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
    );
    expect(signed.startsWith(`${URL_UNDER_TEST}&signature=`)).toBe(true);
  });

  it("produces a 28-character URL-safe base64 signature", () => {
    const signed = signGoogleMapsUrl(
      URL_UNDER_TEST,
      "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
    );
    const sig = new URL(signed).searchParams.get("signature") as string;
    // HMAC-SHA1 is 20 bytes -> 27 base64 chars + 1 padding char.
    expect(sig).toHaveLength(28);
    expect(sig).not.toContain("+");
    expect(sig).not.toContain("/");
  });

  it("decodes the secret as URL-safe base64, not as a literal string", () => {
    // These two secrets are the same bytes, written in the two base64 alphabets.
    // If the implementation HMACs the raw string instead of the decoded bytes,
    // these produce different signatures. This is the classic failure mode.
    const urlSafe = "vNIXE0xscrmjlyV-12Nj_BvUPaw=";
    const standard = "vNIXE0xscrmjlyV+12Nj/BvUPaw=";
    expect(signGoogleMapsUrl(URL_UNDER_TEST, urlSafe)).toEqual(
      signGoogleMapsUrl(URL_UNDER_TEST, standard),
    );
  });

  it("signs only the path and query, not the scheme or host", () => {
    const a = signGoogleMapsUrl(URL_UNDER_TEST, "vNIXE0xscrmjlyV-12Nj_BvUPaw=");
    const b = signGoogleMapsUrl(
      URL_UNDER_TEST.replace(
        "https://maps.googleapis.com",
        "https://maps.google.com",
      ),
      "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
    );
    expect(new URL(a).searchParams.get("signature")).toEqual(
      new URL(b).searchParams.get("signature"),
    );
  });

  it("changes the signature when any query character changes", () => {
    const a = signGoogleMapsUrl(URL_UNDER_TEST, "vNIXE0xscrmjlyV-12Nj_BvUPaw=");
    const b = signGoogleMapsUrl(
      URL_UNDER_TEST.replace("pano=abc123", "pano=abc124"),
      "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
    );
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/street-view/google-url-signer.spec.ts`
Expected: FAIL — `Cannot find module './google-url-signer'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/street-view/google-url-signer.ts
import { createHmac } from "crypto";

/**
 * Sign a Google Maps Platform URL per the digital-signature spec.
 *
 * Google issues the signing secret in URL-safe base64 ("-" and "_" in place of
 * "+" and "/"). It must be decoded to raw bytes before use as the HMAC key —
 * HMAC-ing the base64 string itself yields a signature Google rejects with a
 * 403 that looks like an API-key problem.
 *
 * Only the path and query are signed; scheme and host are excluded.
 */
export function signGoogleMapsUrl(url: string, secret: string): string {
  const parsed = new URL(url);
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;

  const keyBytes = Buffer.from(
    secret.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );

  const signature = createHmac("sha1", keyBytes)
    .update(pathAndQuery)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${url}&signature=${signature}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/street-view/google-url-signer.spec.ts`
Expected: PASS, 5 tests.

> **Note on verification:** these tests prove internal consistency and guard the
> secret-decoding bug, but the only true oracle for signature correctness is
> Google itself. Task 8 performs the live check — a wrong signature returns
> HTTP 403 from `maps.googleapis.com`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/street-view/google-url-signer.ts packages/backend/src/street-view/google-url-signer.spec.ts
git commit -m "feat(street-view): add Google Maps URL signer"
```

---

### Task 2: Street View resolve endpoint

**Files:**

- Create: `packages/backend/src/street-view/dto/resolve-street-view.dto.ts`
- Create: `packages/backend/src/street-view/street-view.service.ts`
- Create: `packages/backend/src/street-view/street-view.controller.ts`
- Create: `packages/backend/src/street-view/street-view.module.ts`
- Test: `packages/backend/src/street-view/street-view.service.spec.ts`
- Modify: `packages/backend/src/app.module.ts` (add `StreetViewModule` to imports)
- Modify: `packages/backend/.env.example` (document the two new vars)

**Interfaces:**

- Consumes: `signGoogleMapsUrl(url, secret)` from Task 1.
- Produces:
  - `GET /api/street-view/resolve?lat=<number>&lon=<number>`
  - `interface StreetViewResolution { available: boolean; url: string | null; panoId: string | null; capturedAt: string | null; }`
  - `StreetViewService.resolve(lat: number, lon: number): Promise<StreetViewResolution>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/street-view/street-view.service.spec.ts
import { StreetViewService } from "./street-view.service";

function makeService(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    GOOGLE_MAPS_API_KEY: "TEST_KEY",
    GOOGLE_MAPS_SIGNING_SECRET: "vNIXE0xscrmjlyV-12Nj_BvUPaw=",
    ...overrides,
  };
  const config = { get: (k: string) => values[k] } as never;
  return new StreetViewService(config);
}

describe("StreetViewService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("throws when the API key is missing", () => {
    expect(() => makeService({ GOOGLE_MAPS_API_KEY: undefined })).toThrow(
      "GOOGLE_MAPS_API_KEY is required",
    );
  });

  it("throws when the signing secret is missing", () => {
    expect(() =>
      makeService({ GOOGLE_MAPS_SIGNING_SECRET: undefined }),
    ).toThrow("GOOGLE_MAPS_SIGNING_SECRET is required");
  });

  it("returns a signed image URL keyed by pano id when a panorama exists", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        pano_id: "PANO_XYZ",
        date: "2023-10",
      }),
    } as Response);

    const result = await makeService().resolve(40.4574, -88.9931);

    expect(result.available).toBe(true);
    expect(result.panoId).toBe("PANO_XYZ");
    expect(result.capturedAt).toBe("2023-10");
    expect(result.url).toContain("pano=PANO_XYZ");
    expect(result.url).toContain("signature=");
    // The stable pano id is used, never the raw coordinates.
    expect(result.url).not.toContain("location=");
  });

  it("reports unavailable on ZERO_RESULTS without calling the image endpoint", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS" }),
    } as Response);

    const result = await makeService().resolve(64.9, -19.0);

    expect(result).toEqual({
      available: false,
      url: null,
      panoId: null,
      capturedAt: null,
    });
  });

  it("degrades to unavailable when the metadata call throws", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    const result = await makeService().resolve(40.4574, -88.9931);

    expect(result.available).toBe(false);
    expect(result.url).toBeNull();
  });

  it("degrades to unavailable on REQUEST_DENIED rather than throwing", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "REQUEST_DENIED" }),
    } as Response);

    await expect(
      makeService().resolve(40.4574, -88.9931),
    ).resolves.toMatchObject({
      available: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/street-view/street-view.service.spec.ts`
Expected: FAIL — `Cannot find module './street-view.service'`.

- [ ] **Step 3: Write the DTO**

```ts
// packages/backend/src/street-view/dto/resolve-street-view.dto.ts
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude, IsNumber } from "class-validator";

export class ResolveStreetViewDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lon!: number;
}
```

- [ ] **Step 4: Write the service**

```ts
// packages/backend/src/street-view/street-view.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { signGoogleMapsUrl } from "./google-url-signer";

const METADATA_ENDPOINT =
  "https://maps.googleapis.com/maps/api/streetview/metadata";
const IMAGE_ENDPOINT = "https://maps.googleapis.com/maps/api/streetview";

export interface StreetViewResolution {
  available: boolean;
  url: string | null;
  panoId: string | null;
  capturedAt: string | null;
}

const UNAVAILABLE: StreetViewResolution = {
  available: false,
  url: null,
  panoId: null,
  capturedAt: null,
};

@Injectable()
export class StreetViewService {
  private readonly logger = new Logger(StreetViewService.name);
  private readonly apiKey: string;
  private readonly signingSecret: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("GOOGLE_MAPS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is required");

    const signingSecret = this.config.get<string>("GOOGLE_MAPS_SIGNING_SECRET");
    if (!signingSecret)
      throw new Error("GOOGLE_MAPS_SIGNING_SECRET is required");

    this.apiKey = apiKey;
    this.signingSecret = signingSecret;
  }

  /**
   * Resolve a signed Street View image URL for a coordinate.
   *
   * The metadata endpoint is free and consumes no quota, so availability is
   * always checked before we issue a billable image URL. The returned image URL
   * is keyed by `pano_id` rather than by coordinates so the photo stays stable
   * even after Google re-shoots the street. Storing the pano id is explicitly
   * permitted by Google's caching policy; storing the image is not.
   */
  async resolve(lat: number, lon: number): Promise<StreetViewResolution> {
    try {
      const metadataUrl = signGoogleMapsUrl(
        `${METADATA_ENDPOINT}?location=${lat},${lon}&key=${this.apiKey}`,
        this.signingSecret,
      );

      const response = await fetch(metadataUrl);
      const body = (await response.json()) as {
        status?: string;
        pano_id?: string;
        date?: string;
      };

      if (body.status !== "OK" || !body.pano_id) {
        if (body.status && body.status !== "ZERO_RESULTS") {
          this.logger.warn(
            `Street View metadata returned ${body.status} for ${lat},${lon}`,
          );
        }
        return UNAVAILABLE;
      }

      const imageUrl = signGoogleMapsUrl(
        `${IMAGE_ENDPOINT}?size=640x400&scale=2&fov=80&pitch=0` +
          `&pano=${encodeURIComponent(body.pano_id)}&key=${this.apiKey}`,
        this.signingSecret,
      );

      return {
        available: true,
        url: imageUrl,
        panoId: body.pano_id,
        capturedAt: body.date ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `Street View resolve failed for ${lat},${lon}: ${(error as Error).message}`,
      );
      return UNAVAILABLE;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/street-view/street-view.service.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the controller and module**

```ts
// packages/backend/src/street-view/street-view.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { ResolveStreetViewDto } from "./dto/resolve-street-view.dto";
import {
  StreetViewService,
  type StreetViewResolution,
} from "./street-view.service";

@Controller("api/street-view")
export class StreetViewController {
  constructor(private readonly streetView: StreetViewService) {}

  @Get("resolve")
  async resolve(
    @Query() query: ResolveStreetViewDto,
  ): Promise<StreetViewResolution> {
    return this.streetView.resolve(query.lat, query.lon);
  }
}
```

```ts
// packages/backend/src/street-view/street-view.module.ts
import { Module } from "@nestjs/common";
import { StreetViewService } from "./street-view.service";
import { StreetViewController } from "./street-view.controller";

@Module({
  controllers: [StreetViewController],
  providers: [StreetViewService],
  exports: [StreetViewService],
})
export class StreetViewModule {}
```

- [ ] **Step 7: Register the module**

In `packages/backend/src/app.module.ts`, add the import alongside the other module imports:

```ts
import { StreetViewModule } from "./street-view/street-view.module";
```

and add `StreetViewModule` to the `imports:` array of the `@Module` decorator.

- [ ] **Step 8: Document the env vars**

Append to `packages/backend/.env.example`:

```
# Google Maps Platform — Street View Static API (Analyzer property imagery).
# Both are read at boot and the app fails fast if either is missing.
# API key:        https://console.cloud.google.com/project/_/google/maps-apis/credentials
# Signing secret: same page, "Secret Generator" card (per-project, console-only)
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SIGNING_SECRET=
```

Then set real values in your local `packages/backend/.env` so the backend boots.

- [ ] **Step 9: Verify types and boot**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

Run: `cd packages/backend && npm run start:dev`, then in another shell:
`curl "http://localhost:3001/api/street-view/resolve?lat=40.4574&lon=-88.9931"`
Expected: JSON with `"available": true` and a `url` containing `signature=`.

Also confirm validation rejects bad input:
`curl -i "http://localhost:3001/api/street-view/resolve?lat=999&lon=-88.9931"`
Expected: HTTP 400.

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/street-view packages/backend/src/app.module.ts packages/backend/.env.example
git commit -m "feat(street-view): add signed Street View resolve endpoint"
```

---

### Task 3: Frontend data layer — fetcher and hook

**Files:**

- Create: `packages/frontend/lib/data/fetchers/street-view.ts`
- Create: `packages/frontend/lib/data/hooks/usePropertyImagery.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` (add export)
- Modify: `packages/frontend/lib/data/hooks/index.ts` (add export)
- Modify: `packages/frontend/lib/data/index.ts` (add `usePropertyImagery` to the
  hand-maintained hooks whitelist ending in `} from "./hooks";`) — **required**:
  fetchers are re-exported by wildcard, but hooks are a named allowlist, so a hook
  omitted here compiles fine yet is unreachable from `@/lib/data`
- Test: `packages/frontend/lib/data/fetchers/__tests__/street-view.test.ts`

**Interfaces:**

- Consumes: `GET /api/street-view/resolve` from Task 2; `fetchAPI<T>` from `./base`.
- Produces:
  - `interface StreetViewResolution { available: boolean; url: string | null; panoId: string | null; capturedAt: string | null; }`
  - `fetchStreetView(lat: number, lon: number): Promise<StreetViewResolution>`
  - `usePropertyImagery(lat: number | null, lon: number | null)` → `{ data, isLoading }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/data/fetchers/__tests__/street-view.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchStreetView } from "../street-view";
import * as base from "../base";

describe("fetchStreetView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests the resolve endpoint with lat and lon query params", async () => {
    const spy = vi.spyOn(base, "fetchAPI").mockResolvedValue({
      available: true,
      url: "https://maps.googleapis.com/x",
      panoId: "P1",
      capturedAt: "2023-10",
    });

    await fetchStreetView(40.4574, -88.9931);

    expect(spy).toHaveBeenCalledWith(
      "/api/street-view/resolve?lat=40.4574&lon=-88.9931",
    );
  });

  it("returns an unavailable resolution when the request fails", async () => {
    vi.spyOn(base, "fetchAPI").mockRejectedValue(new Error("500"));

    await expect(fetchStreetView(40.4574, -88.9931)).resolves.toEqual({
      available: false,
      url: null,
      panoId: null,
      capturedAt: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/street-view.test.ts`
Expected: FAIL — cannot resolve `../street-view`.

- [ ] **Step 3: Write the fetcher**

```ts
// packages/frontend/lib/data/fetchers/street-view.ts
/**
 * STREET VIEW FETCHER
 *
 * Resolves a signed Google Street View image URL for a coordinate. The Google
 * key and signing secret live on the backend; this only ever sees the signed
 * URL. Imagery is never stored — Google's policy forbids caching the bytes.
 */

import { fetchAPI } from "./base";

export interface StreetViewResolution {
  available: boolean;
  url: string | null;
  panoId: string | null;
  capturedAt: string | null;
}

const UNAVAILABLE: StreetViewResolution = {
  available: false,
  url: null,
  panoId: null,
  capturedAt: null,
};

/**
 * Never rejects. Imagery is decorative relative to the analysis, so a failure
 * degrades to "no photo" rather than surfacing an error to the user.
 */
export async function fetchStreetView(
  lat: number,
  lon: number,
): Promise<StreetViewResolution> {
  try {
    return await fetchAPI<StreetViewResolution>(
      `/api/street-view/resolve?lat=${lat}&lon=${lon}`,
    );
  } catch {
    return UNAVAILABLE;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/street-view.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the hook**

```ts
// packages/frontend/lib/data/hooks/usePropertyImagery.ts
/**
 * USE PROPERTY IMAGERY HOOK
 *
 * Resolves Street View availability for the subject property.
 *
 * Caching note: this caches the metadata resolution (availability + pano id +
 * signed URL), never image bytes. Google's policy exempts panorama IDs from the
 * caching prohibition; it does not exempt imagery.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchStreetView,
  type StreetViewResolution,
} from "../fetchers/street-view";

const TWO_HOURS = 1000 * 60 * 60 * 2;

export function usePropertyImagery(lat: number | null, lon: number | null) {
  return useQuery<StreetViewResolution>({
    queryKey: ["street-view", lat, lon],
    queryFn: () => fetchStreetView(lat as number, lon as number),
    enabled: lat != null && lon != null,
    staleTime: TWO_HOURS,
    gcTime: TWO_HOURS,
    retry: false,
  });
}
```

- [ ] **Step 6: Add the barrel exports**

Append to `packages/frontend/lib/data/fetchers/index.ts`:

```ts
export * from "./street-view";
```

Append to `packages/frontend/lib/data/hooks/index.ts`:

```ts
export * from "./usePropertyImagery";
```

- [ ] **Step 7: Verify the public export resolves**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors. `fetchStreetView` and `usePropertyImagery` are now importable from `@/lib/data`.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/lib/data/fetchers/street-view.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/hooks/usePropertyImagery.ts packages/frontend/lib/data/hooks/index.ts packages/frontend/lib/data/fetchers/__tests__/street-view.test.ts
git commit -m "feat(data): add street view fetcher and property imagery hook"
```

---

### Task 4: Aerial URL builder

Mapbox burns its own attribution into the static image by default. Unlike
`StaticCompsMap.tsx:49`, this builder does **not** pass `logo=false&attribution=false`,
so the returned image is attribution-compliant on its own.

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/PropertyImagery/buildAerialUrl.ts`
- Test: `packages/frontend/app/(app)/analyzer/components/PropertyImagery/__tests__/buildAerialUrl.test.ts`

**Interfaces:**

- Consumes: `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`.
- Produces: `buildAerialUrl(lat: number, lon: number): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/components/PropertyImagery/__tests__/buildAerialUrl.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAerialUrl } from "../buildAerialUrl";

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

describe("buildAerialUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
  });

  it("builds a satellite static image centred on the property", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).toContain("/styles/v1/mapbox/satellite-streets-v12/static/");
    expect(url).toContain("-88.9931,40.4574,18");
    expect(url).toContain("640x400@2x");
    expect(url).toContain("access_token=pk.test-token");
  });

  it("places an indigo subject pin at the property", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).toContain("pin-s+3949AB(-88.9931,40.4574)");
  });

  it("keeps Mapbox attribution burned into the image", () => {
    const url = buildAerialUrl(40.4574, -88.9931) as string;
    expect(url).not.toContain("attribution=false");
    expect(url).not.toContain("logo=false");
  });

  it("returns null when the Mapbox token is absent", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    expect(buildAerialUrl(40.4574, -88.9931)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/PropertyImagery/__tests__/buildAerialUrl.test.ts"`
Expected: FAIL — cannot resolve `../buildAerialUrl`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/frontend/app/(app)/analyzer/components/PropertyImagery/buildAerialUrl.ts
/**
 * Mapbox Static Images URL for the property's aerial view.
 *
 * Deliberately does NOT disable Mapbox's built-in logo/attribution: the burned-in
 * credit is what keeps this image compliant without extra markup.
 *
 * https://docs.mapbox.com/api/maps/static-images/
 */

const STYLE = "mapbox/satellite-streets-v12";
const ZOOM = 18;
const WIDTH = 640;
const HEIGHT = 400;
const PIN_HEX = "3949AB"; // PropertyIQ indigo

export function buildAerialUrl(lat: number, lon: number): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const pin = `pin-s+${PIN_HEX}(${lon},${lat})`;

  return (
    `https://api.mapbox.com/styles/v1/${STYLE}/static/` +
    `${pin}/${lon},${lat},${ZOOM}/${WIDTH}x${HEIGHT}@2x` +
    `?access_token=${encodeURIComponent(token)}`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/PropertyImagery/__tests__/buildAerialUrl.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/PropertyImagery/buildAerialUrl.ts" "packages/frontend/app/(app)/analyzer/components/PropertyImagery/__tests__/buildAerialUrl.test.ts"
git commit -m "feat(analyzer): add Mapbox aerial static image URL builder"
```

---

### Task 5: PropertyImagery panel component

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/PropertyImagery/PropertyImagery.tsx`
- Create: `packages/frontend/app/(app)/analyzer/components/PropertyImagery/index.ts`
- Test: `packages/frontend/app/(app)/analyzer/components/PropertyImagery/__tests__/PropertyImagery.test.tsx`

**Interfaces:**

- Consumes: `usePropertyImagery` (Task 3), `buildAerialUrl` (Task 4).
- Produces: `<PropertyImagery lat={number|null} lon={number|null} address={string} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/analyzer/components/PropertyImagery/__tests__/PropertyImagery.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropertyImagery } from "../PropertyImagery";

const mockUse = vi.fn();
vi.mock("@/lib/data", () => ({
  usePropertyImagery: (...args: unknown[]) => mockUse(...args),
}));

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const AVAILABLE = {
  data: {
    available: true,
    url: "https://maps.googleapis.com/street.jpg",
    panoId: "P1",
    capturedAt: "2023-10",
  },
  isLoading: false,
};

describe("PropertyImagery", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
    mockUse.mockReturnValue(AVAILABLE);
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
    vi.clearAllMocks();
  });

  it("renders nothing when coordinates are missing", () => {
    const { container } = render(
      <PropertyImagery lat={null} lon={null} address="200 Orlando Ave" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows both tabs and defaults to Street when a panorama exists", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByRole("tab", { name: /street/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /aerial/i })).toBeInTheDocument();
    expect(
      screen.getByAltText(/street view of 200 orlando ave/i),
    ).toBeInTheDocument();
  });

  it("displays Google attribution while Street View is shown", () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
  });

  it("switches to the aerial image when the Aerial tab is clicked", async () => {
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    await userEvent.click(screen.getByRole("tab", { name: /aerial/i }));
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
  });

  it("hides the Street tab entirely when no panorama exists", () => {
    mockUse.mockReturnValue({
      data: { available: false, url: null, panoId: null, capturedAt: null },
      isLoading: false,
    });
    render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(
      screen.queryByRole("tab", { name: /street/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when neither source is available", () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    mockUse.mockReturnValue({
      data: { available: false, url: null, panoId: null, capturedAt: null },
      isLoading: false,
    });
    const { container } = render(
      <PropertyImagery lat={40.4} lon={-88.9} address="200 Orlando Ave" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/PropertyImagery/__tests__/PropertyImagery.test.tsx"`
Expected: FAIL — cannot resolve `../PropertyImagery`.

- [ ] **Step 3: Write the component**

```tsx
// packages/frontend/app/(app)/analyzer/components/PropertyImagery/PropertyImagery.tsx
"use client";

import { useState } from "react";
import { usePropertyImagery } from "@/lib/data";
import { buildAerialUrl } from "./buildAerialUrl";

type Mode = "street" | "aerial";

interface PropertyImageryProps {
  lat: number | null;
  lon: number | null;
  /** Resolved address, used for image alt text. */
  address: string;
}

/**
 * Hero media panel: the property's Street View exterior and its aerial context,
 * behind a two-option toggle. Only the active mode's image is requested, so a
 * user who never opens Aerial costs exactly one Street View call.
 *
 * Degrades in both directions — no panorama hides the Street tab, no Mapbox
 * token hides Aerial, and neither renders nothing at all rather than an empty box.
 */
export function PropertyImagery({ lat, lon, address }: PropertyImageryProps) {
  const { data } = usePropertyImagery(lat, lon);
  const [chosen, setChosen] = useState<Mode | null>(null);

  if (lat == null || lon == null) return null;

  const streetUrl = data?.available ? data.url : null;
  const aerialUrl = buildAerialUrl(lat, lon);

  if (!streetUrl && !aerialUrl) return null;

  // Availability arrives async, so derive the active mode rather than syncing
  // state in an effect.
  const mode: Mode = chosen ?? (streetUrl ? "street" : "aerial");
  const active = mode === "street" && streetUrl ? "street" : "aerial";

  return (
    <div
      data-property-imagery
      className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low"
    >
      <div
        role="tablist"
        aria-label="Property imagery"
        className="absolute left-3 top-3 z-10 flex gap-1 rounded-full bg-surface/90 p-1 shadow-sm"
      >
        {streetUrl && (
          <button
            role="tab"
            aria-selected={active === "street"}
            onClick={() => setChosen("street")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              active === "street"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            Street
          </button>
        )}
        {aerialUrl && (
          <button
            role="tab"
            aria-selected={active === "aerial"}
            onClick={() => setChosen("aerial")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
              active === "aerial"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            Aerial
          </button>
        )}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={(active === "street" ? streetUrl : aerialUrl) as string}
        alt={
          active === "street"
            ? `Street View of ${address}`
            : `Aerial view of ${address}`
        }
        className="block h-full w-full object-cover"
      />

      {/* Google requires visible, unmodified attribution on Street View imagery.
          Mapbox burns its own attribution into the aerial raster. */}
      {active === "street" && (
        <span className="absolute bottom-2 left-3 text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          Google Maps
        </span>
      )}
    </div>
  );
}
```

```ts
// packages/frontend/app/(app)/analyzer/components/PropertyImagery/index.ts
export { PropertyImagery } from "./PropertyImagery";
export { buildAerialUrl } from "./buildAerialUrl";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/PropertyImagery/__tests__/PropertyImagery.test.tsx"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/PropertyImagery"
git commit -m "feat(analyzer): add property imagery panel with street and aerial views"
```

---

### Task 6: Wire the panel into the Analyzer

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/components/Hero/Hero.tsx`
- Test: `packages/frontend/app/(app)/analyzer/components/Hero/__tests__/Hero.test.tsx`

**Interfaces:**

- Consumes: `<PropertyImagery/>` from Task 5.
- Produces: `Hero` gains three optional props — `lat?: number | null`, `lon?: number | null`, `address?: string`. When all are present the media panel renders in a left column beside the verdict.

- [ ] **Step 1: Write the failing test**

Append to `packages/frontend/app/(app)/analyzer/components/Hero/__tests__/Hero.test.tsx`:

```tsx
it("renders the property imagery panel when coordinates are supplied", () => {
  render(
    <Hero
      verdict="strong"
      lat={40.4574}
      lon={-88.9931}
      address="200 Orlando Ave"
    />,
  );
  expect(document.querySelector("[data-property-imagery]")).toBeTruthy();
});

it("omits the imagery panel when coordinates are absent", () => {
  render(<Hero verdict="strong" />);
  expect(document.querySelector("[data-property-imagery]")).toBeNull();
});
```

Add this mock near the top of the file, beside the existing imports:

```tsx
vi.mock("@/lib/data", () => ({
  usePropertyImagery: () => ({
    data: {
      available: true,
      url: "https://maps.googleapis.com/street.jpg",
      panoId: "P1",
      capturedAt: "2023-10",
    },
    isLoading: false,
  }),
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/Hero/__tests__/Hero.test.tsx"`
Expected: FAIL — no element matches `[data-property-imagery]`.

- [ ] **Step 3: Modify Hero**

In `Hero.tsx`, add the import:

```tsx
import { PropertyImagery } from "../PropertyImagery";
```

Extend `HeroProps`:

```tsx
interface HeroProps {
  verdict: Verdict;
  aiText?: string | null;
  aiIsStreaming?: boolean;
  /** Legacy KPI tiles. Omit when rendering <StrategyKPI/> as a sibling instead. */
  kpiTiles?: KPITileProps[];
  /** Subject coordinates. When absent the media panel is omitted entirely. */
  lat?: number | null;
  lon?: number | null;
  /** Resolved address, used for image alt text. */
  address?: string;
}
```

Replace the component body's grid so the media panel occupies a left column when present:

```tsx
export function Hero({
  verdict,
  aiText,
  aiIsStreaming,
  kpiTiles,
  lat,
  lon,
  address,
}: HeroProps) {
  const showImagery = lat != null && lon != null && Boolean(address);

  return (
    <section
      data-hero
      className="rounded-2xl bg-surface border border-outline-variant p-6 md:p-8"
    >
      <div
        className={`grid grid-cols-1 gap-6 items-center ${
          showImagery
            ? "md:grid-cols-[280px_200px_1fr]"
            : "md:grid-cols-[200px_1fr]"
        } ${kpiTiles ? "mb-6" : ""}`}
      >
        {showImagery && (
          <PropertyImagery
            lat={lat as number}
            lon={lon as number}
            address={address as string}
          />
        )}
        <div className="flex justify-center md:justify-start">
          <VerdictBadge verdict={verdict} />
        </div>
        <div>
          <AIQuoteHeader text={aiText} isStreaming={aiIsStreaming} />
        </div>
      </div>
      {kpiTiles && <KPIStrip tiles={kpiTiles} />}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/Hero/__tests__/Hero.test.tsx"`
Expected: PASS, including the two new tests and all pre-existing ones.

- [ ] **Step 5: Pass coordinates from the Analyzer page**

Find the `<Hero ... />` usage in the Analyzer page (search: `cd packages/frontend && grep -rn "<Hero" "app/(app)/analyzer"`). The same component already computes `subjectLat` / `subjectLon` / `displayAddress` for the analyzer snapshot — pass those through:

```tsx
<Hero
  /* ...existing props unchanged... */
  lat={subjectLat}
  lon={subjectLon}
  address={displayAddress ?? ""}
/>
```

If the values live under different local names in that file, use whatever local variables feed `AnalyzerSnapshotDerived.subjectLat` / `subjectLon` / `displayAddress`.

- [ ] **Step 6: Verify in the running app**

Start the dev servers, open `http://localhost:3000/analyzer?address=200+Orlando+Ave,+Normal,+IL+61761`, and confirm:
the panel renders beside the verdict, defaults to Street, the Aerial toggle switches the image, and "Google Maps" is legible over the Street image.

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/Hero"
git commit -m "feat(analyzer): show property imagery in the hero"
```

---

### Task 7: Share page and PDF variant

The share page renders through Puppeteer for the PDF, which does not reliably hydrate client state — so this variant has no toggle and stacks both images.

**Files:**

- Create: `packages/frontend/app/(app)/shared/analysis/[token]/components/StaticPropertyImagery.tsx`
- Test: `packages/frontend/app/(app)/shared/analysis/[token]/components/__tests__/StaticPropertyImagery.test.tsx`
- Modify: the share page that renders `<StaticCompsMap/>` (find with `grep -rn "StaticCompsMap" "packages/frontend/app/(app)/shared"`)

**Interfaces:**

- Consumes: `buildAerialUrl` (Task 4), `fetchStreetView` (Task 3).
- Produces: `<StaticPropertyImagery streetUrl={string|null} lat={number|null} lon={number|null} address={string} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/shared/analysis/[token]/components/__tests__/StaticPropertyImagery.test.tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticPropertyImagery } from "../StaticPropertyImagery";

const ORIGINAL = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

describe("StaticPropertyImagery", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test-token";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL;
  });

  it("renders nothing without coordinates", () => {
    const { container } = render(
      <StaticPropertyImagery
        streetUrl={null}
        lat={null}
        lon={null}
        address="200 Orlando Ave"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("stacks street and aerial images with Google attribution", () => {
    render(
      <StaticPropertyImagery
        streetUrl="https://maps.googleapis.com/street.jpg"
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(
      screen.getByAltText(/street view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(/aerial view of 200 orlando ave/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Google Maps")).toBeInTheDocument();
  });

  it("renders aerial only when street view is unavailable", () => {
    render(
      <StaticPropertyImagery
        streetUrl={null}
        lat={40.4}
        lon={-88.9}
        address="200 Orlando Ave"
      />,
    );
    expect(screen.queryByAltText(/street view/i)).not.toBeInTheDocument();
    expect(screen.getByAltText(/aerial view/i)).toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/shared/analysis/[token]/components/__tests__/StaticPropertyImagery.test.tsx"`
Expected: FAIL — cannot resolve `../StaticPropertyImagery`.

- [ ] **Step 3: Write the component**

```tsx
// packages/frontend/app/(app)/shared/analysis/[token]/components/StaticPropertyImagery.tsx
import { buildAerialUrl } from "@/app/analyzer/components/PropertyImagery";

interface Props {
  /** Signed Street View URL resolved server-side; null when no panorama exists. */
  streetUrl: string | null;
  lat: number | null;
  lon: number | null;
  address: string;
}

/**
 * Print/share variant of the property imagery. No toggle and no client state —
 * Puppeteer doesn't reliably hydrate, which is the same reason StaticCompsMap
 * exists alongside the interactive Mapbox map.
 */
export function StaticPropertyImagery({ streetUrl, lat, lon, address }: Props) {
  if (lat == null || lon == null) return null;

  const aerialUrl = buildAerialUrl(lat, lon);
  if (!streetUrl && !aerialUrl) return null;

  return (
    <div className="grid grid-cols-2 gap-3" data-static-property-imagery>
      {streetUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={streetUrl}
            alt={`Street View of ${address}`}
            className="w-full rounded-xl"
          />
          <span className="absolute bottom-2 left-3 text-[11px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Google Maps
          </span>
        </div>
      )}
      {aerialUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={aerialUrl}
          alt={`Aerial view of ${address}`}
          className="w-full rounded-xl"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/shared/analysis/[token]/components/__tests__/StaticPropertyImagery.test.tsx"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire into the share page**

In the share page that renders `<StaticCompsMap/>`, resolve the Street View URL server-side and render the new component above the existing comps map. The page already has the saved analysis row, which carries `lat` and `lon`:

```tsx
import { fetchStreetView } from "@/lib/data";
import { StaticPropertyImagery } from "./components/StaticPropertyImagery";

// inside the async server component, before the return:
const streetView =
  analysis.lat != null && analysis.lon != null
    ? await fetchStreetView(analysis.lat, analysis.lon)
    : null;

// in the JSX, above <StaticCompsMap/>:
<StaticPropertyImagery
  streetUrl={streetView?.available ? streetView.url : null}
  lat={analysis.lat}
  lon={analysis.lon}
  address={analysis.address_full ?? ""}
/>;
```

Use whatever local variable already holds the saved analysis row in that file.

- [ ] **Step 6: Verify the share page and PDF**

Open a share link locally and confirm both images render. Then export the PDF and confirm the images appear in the rendered document — a blank space means Puppeteer raced the image load, which is fixed by awaiting network idle in the PDF renderer, not by changing this component.

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "packages/frontend/app/(app)/shared/analysis/[token]"
git commit -m "feat(share): add property imagery to the shared analysis and PDF"
```

---

### Task 8: Production credentials and end-to-end verification

This is where the signature is validated against the only authority that matters. A malformed signature returns HTTP 403 from Google.

**Files:**

- No source changes. Railway configuration and verification only.

**Interfaces:**

- Consumes: everything above.
- Produces: working imagery on `propertyiq.up.railway.app`.

- [ ] **Step 1: Enable the API in Google Cloud**

Project: `propertyiq-488415`. Enable `street-view-image-backend.googleapis.com` at
`https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com?project=propertyiq-488415`
(or `gcloud services enable street-view-image-backend.googleapis.com --project=propertyiq-488415`).

- [ ] **Step 2: Create and restrict the API key**

At `https://console.cloud.google.com/project/_/google/maps-apis/credentials` → Create credentials → API key.

- Application restrictions: **None** (requests originate from the Railway backend; an HTTP-referrer restriction would reject server-issued signed URLs).
- API restrictions: **Restrict key → Street View Static API** only.

- [ ] **Step 3: Copy the signing secret**

Same page, **Secret Generator** card → **Current secret**. Per-project and console-only; there is no `gcloud` equivalent.

- [ ] **Step 4: Set the Railway backend variables**

Set `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_SIGNING_SECRET` on the Railway **backend** service. Set them via file substitution rather than echoing values into the shell, and do not dump the variable list afterwards.

- [ ] **Step 5: Verify the signature against Google**

After the backend redeploys:

```bash
curl -s "https://backend-production-ee4d.up.railway.app/api/street-view/resolve?lat=40.4574&lon=-88.9931"
```

Expected: `"available": true` with a signed `url`. Then fetch that URL and check the status:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "<the url from the previous response>"
```

Expected: `200`. A `403` means the signature is wrong — almost always the secret being HMAC'd as a string instead of decoded to bytes (Task 1, Step 3).

- [ ] **Step 6: Verify a no-panorama address degrades**

```bash
curl -s "https://backend-production-ee4d.up.railway.app/api/street-view/resolve?lat=64.9631&lon=-19.0208"
```

Expected: `"available": false` with `"url": null`. Confirm in the UI that this address shows the Aerial view with no Street tab, and no error.

- [ ] **Step 7: Cap billing exposure (required, not advisory)**

Google's signing scheme has no expiry parameter, so a signed URL is **replayable
indefinitely** and every replay is a billed image request. On the public share page
that URL sits in the page source. Our per-IP throttler limits only URL _minting_ —
replay traffic goes straight to Google and never touches our infrastructure, so it
is invisible to us and uncapped by us.

Two controls, both required:

1. **Hard daily quota cap.** Google Cloud → APIs & Services → Street View Static API
   → Quotas → set a per-day request cap. This bounds worst-case spend regardless of
   replay. Size it to expected daily analyses with generous headroom (e.g. 500/day
   sits far under the 10,000/month free allowance while making runaway spend
   impossible). Exceeding the cap degrades imagery to unavailable — which the UI
   already handles as a hidden Street tab, not an error.
2. **Budget alert** on the project as a secondary signal.

Expected steady-state cost remains $0: the SKU includes 10,000 free requests per
month and one Analyzer run costs one request. The cap exists for the abuse case,
not the normal one.

- [ ] **Step 8: Commit any config documentation**

```bash
git add packages/backend/.env.example
git commit -m "docs(env): document Google Maps credentials for street view"
```

---

## Self-Review

**Spec coverage.** Architecture → Tasks 1–4. Backend components table → Task 2. Frontend components table → Tasks 3–5, 7. Placement → Task 6. Error-handling table → Task 2 (metadata statuses), Task 5 (all five UI rows). Attribution → Tasks 4, 5, 7. Testing section → every task's test steps. Deferred items are excluded, as specified.

**Type consistency.** `StreetViewResolution` uses the same four fields (`available`, `url`, `panoId`, `capturedAt`) in the backend service, the frontend fetcher, and every test. `buildAerialUrl(lat, lon)` and `signGoogleMapsUrl(url, secret)` keep identical signatures across all references. `PropertyImagery` and `StaticPropertyImagery` both take `address: string` and derive alt text the same way.

**Known deviation from spec.** The spec described aerial attribution as markup text (`© Mapbox © OpenStreetMap`); Task 4 instead relies on Mapbox's burned-in attribution by not disabling it. Same compliance outcome, less markup, and it avoids repeating the `StaticCompsMap` gap. Callers need no change.
