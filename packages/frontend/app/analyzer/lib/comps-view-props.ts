import type { PropertyLookupResult } from "@/lib/data";

/** Sub-shape of a RentCast sales/rental comp used by the analyzer. */
export interface RawComp {
  address: string;
  lat?: number | null;
  lon?: number | null;
  price?: number | null;
  rent?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  distance?: number;
}

export interface CompsViewProps {
  salesComps: RawComp[];
  rentalComps: RawComp[];
  pricePerSqftValues: number[];
  yourPricePerSqft: number;
  /** Subject's input price — used as the reference in the price-only
   *  fallback chart that fires when RentCast comps lack sqft. */
  subjectPrice: number;
  /** Sales comps that have a valid `price` (regardless of sqft). The
   *  fallback chart bins by this when sqft is sparse. */
  salesCompPrices: number[];
  /** null when neither property-record nor comp centroid is available. */
  subjectLat: number | null;
  subjectLon: number | null;
  mapboxToken: string;
}

/**
 * Derive all CompsSection inputs from a RentCast lookup result. Subject
 * coordinates prefer the exact `property_record.lat/lon` (new backend) and
 * fall back to the centroid of comps when stale cached responses (transformed
 * before lat/lon extraction shipped) leave the property record without
 * coordinates.
 */
export function buildCompsViewProps(
  rentcastData: PropertyLookupResult | null,
  inputPrice: number,
): CompsViewProps {
  const salesComps = (rentcastData?.sales_comps ?? []) as RawComp[];
  const rentalComps = (rentcastData?.rental_comps ?? []) as RawComp[];

  const propertyLat =
    typeof rentcastData?.property_record?.lat === "number"
      ? rentcastData.property_record.lat
      : null;
  const propertyLon =
    typeof rentcastData?.property_record?.lon === "number"
      ? rentcastData.property_record.lon
      : null;
  const compsWithCoords = [...salesComps, ...rentalComps].filter(
    (c): c is RawComp & { lat: number; lon: number } =>
      typeof c.lat === "number" && typeof c.lon === "number",
  );
  const centroidLat =
    compsWithCoords.length > 0
      ? compsWithCoords.reduce((s, c) => s + c.lat, 0) / compsWithCoords.length
      : null;
  const centroidLon =
    compsWithCoords.length > 0
      ? compsWithCoords.reduce((s, c) => s + c.lon, 0) / compsWithCoords.length
      : null;

  const pricePerSqftValues = salesComps
    .map((c) => (c.price && c.sqft && c.sqft > 0 ? c.price / c.sqft : null))
    .filter((v): v is number => v != null);
  // Subject price/sqft = inputPrice / subjectSqft (from RentCast property
  // record). Falls back to the first comp's price/sqft when sqft is missing.
  // Previously divided by a hardcoded 1500 — wrong for any property whose
  // actual sqft wasn't ~1500 (which is most of them).
  const subjectSqft = rentcastData?.property_record?.sqft ?? null;
  const yourPricePerSqft =
    inputPrice > 0 && subjectSqft && subjectSqft > 0
      ? inputPrice / subjectSqft
      : pricePerSqftValues.length > 0
        ? pricePerSqftValues[0]
        : 0;

  // Price-only fallback: every sales comp with a numeric price. The chart
  // bins by these when too few comps have sqft to render the per-sqft view
  // (RentCast routinely returns null squareFootage for comps on /avm/value).
  const salesCompPrices = salesComps
    .map((c) => c.price)
    .filter((p): p is number => typeof p === "number" && p > 0);

  return {
    salesComps,
    rentalComps,
    pricePerSqftValues,
    yourPricePerSqft,
    subjectPrice: inputPrice,
    salesCompPrices,
    subjectLat: propertyLat ?? centroidLat,
    subjectLon: propertyLon ?? centroidLon,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
  };
}
