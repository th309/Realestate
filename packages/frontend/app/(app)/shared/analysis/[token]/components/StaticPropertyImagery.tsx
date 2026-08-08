import { buildAerialUrl } from "@/app/analyzer/components/PropertyImagery";

interface Props {
  /** Signed Street View URL resolved server-side; null when no panorama exists. */
  streetUrl: string | null;
  lat: number | null;
  lon: number | null;
  /** Resolved address, used for image alt text. */
  address: string;
}

/**
 * Print/share variant of the property imagery — street exterior beside the
 * aerial view, no toggle and no client state.
 *
 * Deliberately not the interactive component: the share page is rendered
 * through Puppeteer for the PDF, which does not reliably hydrate client
 * components. This is the same reason StaticCompsMap exists alongside the
 * interactive Mapbox map.
 *
 * Both sources render at 640x400, so the 16:10 boxes never crop.
 */
export function StaticPropertyImagery({ streetUrl, lat, lon, address }: Props) {
  if (lat == null || lon == null) return null;

  const aerialUrl = buildAerialUrl(lat, lon);
  if (!streetUrl && !aerialUrl) return null;

  const label = address.trim() || "this property";

  return (
    <div
      data-static-property-imagery
      style={{
        display: "grid",
        gridTemplateColumns: streetUrl && aerialUrl ? "1fr 1fr" : "1fr",
        gap: "8pt",
      }}
    >
      {streetUrl && (
        <figure style={{ position: "relative", margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={streetUrl}
            alt={`Street View of ${label}`}
            style={{
              display: "block",
              width: "100%",
              aspectRatio: "16 / 10",
              objectFit: "cover",
              borderRadius: "6pt",
            }}
          />
          {/* Google requires visible, unobscured attribution on Street View
              imagery. The scrim guarantees contrast over arbitrary photos. */}
          <figcaption
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "12pt 8pt 4pt",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))",
              color: "#FFFFFF",
              fontSize: "7pt",
              fontWeight: 500,
              borderBottomLeftRadius: "6pt",
              borderBottomRightRadius: "6pt",
            }}
          >
            Google Maps
          </figcaption>
        </figure>
      )}

      {aerialUrl && (
        /* Mapbox burns its own attribution into the raster — see buildAerialUrl. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={aerialUrl}
          alt={`Aerial view of ${label}`}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 10",
            objectFit: "cover",
            borderRadius: "6pt",
          }}
        />
      )}
    </div>
  );
}
