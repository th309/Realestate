# Analyzer Property Imagery — Design

**Date:** 2026-08-08
**Status:** Approved
**Surface:** Analyzer (`/analyzer`), public share link (`/shared/analysis/[token]`), PDF export

## Problem

The Analyzer resolves an address and renders numbers, but never shows the property. Users
get no visual confirmation that the address resolved to the house they meant, and the share
link a user forwards to a client or lender is text-and-charts only.

Competitor research (PropertyWiz AI) confirmed the alternative approach is not viable for us:
their galleries hotlink MLS interior photos directly from `photos.zillowstatic.com`, which
carries copyright exposure against the listing photographer and brokerage, and breaks the
moment Zillow adds a referrer check. We deliberately do **not** pursue interior photos.

## Goals

- Show the property exterior and its aerial/parcel context in the Analyzer.
- Carry the same imagery onto the public share link and the PDF.
- Add no new legal exposure and no meaningful recurring cost.

## Non-goals

- Interior photos, MLS/IDX feeds, listing galleries.
- Storing or proxying image bytes.
- Thumbnails in the saved-reports list.
- Heading/pitch/zoom controls.
- Persisting `pano_id` to the database (see "Deferred" below).

## Constraints (from official Google docs)

| Constraint        | Value                                                                                  | Source                      |
| ----------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Metadata endpoint | **Free** — "no quota is consumed"                                                      | Street View metadata docs   |
| Image pricing     | 10,000/month free, then $7.00/1k                                                       | Maps Platform pricing       |
| Rate limit        | 30,000 QPM                                                                             | Street View usage & billing |
| Caching imagery   | **Prohibited** — "pre-fetching, indexing, storing, or caching is generally prohibited" | Street View policies        |
| `pano_id`         | **Exempt** — "can store panorama ID values indefinitely"                               | Street View policies        |
| Attribution       | Google logo or "Google Maps" text; visible, unobscured, unmodified                     | Street View policies        |
| Signing secret    | Per-project, console-only, HMAC-SHA1 over path+query                                   | Digital signature docs      |

The prohibition on caching imagery combined with the exemption for `pano_id` is the load-bearing
constraint: we resolve availability for free, never store pixels, and may store the identifier.

## Architecture

The two imagery sources use different paths because their trust models differ.

```
Analyzer (already has subjectLat / subjectLon)
   │
   ├─ STREET ─> usePropertyImagery(lat, lon)          [lib/data hook]
   │              └─> GET /api/street-view/resolve    [NestJS]
   │                    ├─ metadata call (FREE) → OK | ZERO_RESULTS
   │                    └─ HMAC-SHA1 sign image URL
   │              <── { available, url, panoId, capturedAt }
   │            <img src="maps.googleapis.com/...&signature="> ──> Google
   │
   └─ AERIAL ─> buildAerialUrl(lat, lon)              [pure fn, client]
                <img src="api.mapbox.com/.../satellite-v9/..."> ──> Mapbox
```

**Why Street View is backend-mediated.** The share page is unauthenticated, so a
`NEXT_PUBLIC` Google key would be readable in page source and its Referer allowlist is
spoofable. The backend holds the key and the signing secret and returns a pre-signed URL;
a lifted key is useless without the secret. The browser still fetches bytes directly from
Google, so we pay no proxy egress and add no latency to an above-the-fold image.

**Why aerial is not.** `NEXT_PUBLIC_MAPBOX_TOKEN` is already public by design, and
`StaticCompsMap.tsx` already builds Mapbox static URLs client-side. Routing aerial through
the backend would add a hop to protect a token that is not secret.

**No image bytes are stored or proxied by us.** React Query caches the metadata JSON
(2h, house standard). This is ToS-safe: it caches availability and a `pano_id`, both permitted.

## Components

### Backend — `packages/backend/src/street-view/`

| File                             | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `street-view.module.ts`          | Module wiring                                 |
| `street-view.controller.ts`      | `GET /api/street-view/resolve?lat=&lon=`      |
| `street-view.service.ts`         | Metadata fetch → availability → signed URL    |
| `google-url-signer.ts`           | HMAC-SHA1 over path+query, URL-safe base64    |
| `dto/resolve-street-view.dto.ts` | `class-validator`: lat −90..90, lon −180..180 |

New Railway secrets: `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SIGNING_SECRET`. Both throw at boot
if missing — no fallback values, per CLAUDE.md §1.2.

Response shape:

```ts
{
  available: boolean;
  url: string | null; // signed maps.googleapis.com URL
  panoId: string | null;
  capturedAt: string | null; // Google's `date`, e.g. "2023-10"
}
```

### Frontend

| File                                                           | Purpose                                         |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `lib/data/fetchers/street-view.ts`                             | Fetcher; exported from `lib/data/index.ts` (§5) |
| `lib/data/hooks/usePropertyImagery.ts`                         | React Query hook, 2h stale                      |
| `analyzer/components/PropertyImagery/PropertyImagery.tsx`      | Hero panel + Street/Aerial toggle               |
| `analyzer/components/PropertyImagery/buildAerialUrl.ts`        | Pure Mapbox static URL builder                  |
| `shared/analysis/[token]/components/StaticPropertyImagery.tsx` | Share/PDF variant, no toggle                    |

The share/PDF variant renders a plain `<img>` with no interactivity, mirroring why
`StaticCompsMap` exists: Puppeteer does not reliably hydrate vector tiles or client state.

### Placement

Hero media panel, left of the verdict/KPI block, above the Purchase/Rent/Expenses tabs.
Segmented `Street | Aerial` toggle in the panel's top-left. Only the active mode's image
is requested, so a user who never opens Aerial costs one Street View call.

## Error handling

Every path degrades; none throws to the UI.

| Condition                                       | Behavior                                               |
| ----------------------------------------------- | ------------------------------------------------------ |
| `ZERO_RESULTS` / `NOT_FOUND`                    | Street tab hidden entirely; panel opens on Aerial      |
| `OVER_QUERY_LIMIT` / `REQUEST_DENIED` / unknown | Logged as warn; treated as unavailable                 |
| `lat`/`lon` null                                | Panel renders `null` (matches `StaticCompsMap.tsx:30`) |
| Mapbox token missing                            | Aerial hidden                                          |
| Both unavailable                                | Whole panel renders `null` — no empty box              |

Hiding the Street tab rather than showing a broken one is deliberate: rural and
new-construction addresses miss often enough that a dead tab reads as a bug.

## Attribution

Contractual, not optional. Street mode renders the "Google" wordmark bottom-left over the
image, unobscured and unmodified. Aerial mode renders `© Mapbox © OpenStreetMap`.

Known pre-existing gap, out of scope for this change: `StaticCompsMap.tsx:49` sets
`logo=false&attribution=false`. The new component is compliant; the existing one is
untouched unless separately prioritized.

## Testing

**Backend**

- `google-url-signer` against a known HMAC-SHA1 vector, asserting URL-safe base64 in and out.
- Service against mocked metadata: `OK`, `ZERO_RESULTS`, `5xx`.
- DTO rejects out-of-range and non-numeric coordinates.

**Frontend**

- `buildAerialUrl` pure-function test.
- Component: both tabs when street available; Street tab hidden when unavailable; renders
  nothing when lat/lon null; attribution present in both modes.

Frontend suite is local-only (not in CI).

## Deferred

- **`pano_id` persistence.** Metadata is free, so storing it is an optimization, not a
  requirement. Revisit only if metadata latency becomes visible on the share page.
- **Saved-reports thumbnails.** Would multiply Street View calls by row count per page load;
  needs a caching story that ToS constrains.
- **Mapbox attribution fix** in `StaticCompsMap`.
