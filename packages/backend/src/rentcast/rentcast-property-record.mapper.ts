/**
 * Pure mapper: RentCast `/properties` raw response → `RentcastPropertyRecord`.
 *
 * Split from RentcastService to keep the service file under the 300-line
 * hard limit (CLAUDE.md §1.3). Has no I/O and no DI — pure data shape.
 *
 * RentCast's `/properties` endpoint returns an **array** (one element per
 * matched property). The previous in-service mapping treated the response
 * as a single object and silently dropped every field; we now take the
 * first element and surface every documented field.
 */

import type {
  RentcastPropertyRecord,
  RentcastTaxAssessment,
  RentcastPropertyTax,
  RentcastSaleEvent,
} from './rentcast.types';

function extractTaxAssessments(raw: any): RentcastTaxAssessment[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw)
    .filter((v): v is Record<string, any> => !!v && typeof v === 'object')
    .map((t) => ({
      year: typeof t.year === 'number' ? t.year : 0,
      value: t.value ?? null,
      land: t.land ?? null,
      improvements: t.improvements ?? null,
    }))
    .sort((a, b) => b.year - a.year);
}

function extractPropertyTaxes(raw: any): RentcastPropertyTax[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw)
    .filter((v): v is Record<string, any> => !!v && typeof v === 'object')
    .map((t) => ({
      year: typeof t.year === 'number' ? t.year : 0,
      total: t.total ?? null,
    }))
    .sort((a, b) => b.year - a.year);
}

function extractSaleHistory(raw: any): RentcastSaleEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw)
    .filter((v): v is Record<string, any> => !!v && typeof v === 'object')
    .map((h) => ({
      date: typeof h.date === 'string' ? h.date : '',
      event: typeof h.event === 'string' ? h.event : '',
      price: h.price ?? null,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function mapPropertyRecord(raw: any): RentcastPropertyRecord {
  const r: any = Array.isArray(raw)
    ? (raw[0] ?? {})
    : raw && typeof raw === 'object'
      ? raw
      : {};

  const taxAssessments = extractTaxAssessments(r.taxAssessments);
  const propertyTaxes = extractPropertyTaxes(r.propertyTaxes);
  const saleHistory = extractSaleHistory(r.history);
  const latestAssessmentValue = taxAssessments[0]?.value ?? null;

  return {
    id: r.id ?? null,
    formattedAddress: r.formattedAddress ?? null,
    addressLine1: r.addressLine1 ?? null,
    addressLine2: r.addressLine2 ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    zipCode: r.zipCode ?? null,
    county: r.county ?? null,
    countyFips: r.countyFips ?? null,

    beds: r.bedrooms ?? null,
    baths: r.bathrooms ?? null,
    sqft: r.squareFootage ?? null,
    lotSize: r.lotSize ?? null,
    yearBuilt: r.yearBuilt ?? null,
    propertyType: r.propertyType ?? null,

    lat: typeof r.latitude === 'number' ? r.latitude : null,
    lon: typeof r.longitude === 'number' ? r.longitude : null,

    assessorID: r.assessorID ?? null,
    legalDescription: r.legalDescription ?? null,
    subdivision: r.subdivision ?? null,

    lastSaleDate: r.lastSaleDate ?? null,
    lastSalePrice: r.lastSalePrice ?? null,

    hoaFee: r.hoa?.fee ?? null,

    architectureType: r.features?.architectureType ?? null,
    unitCount: r.features?.unitCount ?? null,
    floorCount: r.features?.floorCount ?? null,
    garage: typeof r.features?.garage === 'boolean' ? r.features.garage : null,
    garageSpaces: r.features?.garageSpaces ?? null,

    taxAssessment: latestAssessmentValue,
    taxAssessments,
    propertyTaxes,
    saleHistory,

    ownerNames: Array.isArray(r.owner?.names) ? r.owner.names : null,
    ownerType: r.owner?.type ?? null,
    ownerOccupied:
      typeof r.ownerOccupied === 'boolean' ? r.ownerOccupied : null,
  };
}
