/**
 * Pure mapper: RentCast `comparables` raw entry → `RentcastComp`.
 *
 * Split from RentcastService for file-size compliance (CLAUDE.md §1.3).
 *
 * RentCast reuses the `price` field for both sale price (on `/avm/value`)
 * and monthly rent (on `/avm/rent/long-term`), distinguished only by which
 * endpoint returned it. The caller passes `kind` so rental comps route the
 * value into `rent` and leave `price` null.
 */

import type { RentcastComp } from './rentcast.types';

export function mapComp(c: any, kind: 'sale' | 'rent'): RentcastComp {
  const priceVal = c.price ?? null;
  return {
    id: c.id ?? null,
    address: c.formattedAddress ?? '',
    addressLine1: c.addressLine1 ?? null,
    addressLine2: c.addressLine2 ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
    zip: c.zipCode ?? null,
    county: c.county ?? null,
    countyFips: c.countyFips ?? null,
    lat: typeof c.latitude === 'number' ? c.latitude : null,
    lon: typeof c.longitude === 'number' ? c.longitude : null,
    propertyType: c.propertyType ?? null,
    beds: c.bedrooms ?? null,
    baths: c.bathrooms ?? null,
    sqft: c.squareFootage ?? null,
    lotSize: c.lotSize ?? null,
    yearBuilt: c.yearBuilt ?? null,
    status: c.status ?? null,
    listingType: c.listingType ?? null,
    listedDate: c.listedDate ?? null,
    removedDate: c.removedDate ?? null,
    lastSeenDate: c.lastSeenDate ?? null,
    daysOnMarket: c.daysOnMarket ?? null,
    daysOld: c.daysOld ?? null,
    price: kind === 'sale' ? priceVal : null,
    rent: kind === 'rent' ? priceVal : null,
    // RentCast doesn't surface a distinct sale date on comps; use
    // `removedDate` (when the listing left market) as the best proxy
    // for sales comps and leave rental comps null.
    saleDate:
      kind === 'sale' ? (c.removedDate ?? c.lastSeenDate ?? null) : null,
    distance: c.distance ?? 0,
    correlation: c.correlation ?? 0,
  };
}
