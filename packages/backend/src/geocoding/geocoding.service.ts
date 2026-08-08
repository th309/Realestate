import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Google's `location_type` values, most precise first. Only the first two
 * identify an actual building or an interpolated point on its parcel;
 * GEOMETRIC_CENTER is a street segment's midpoint and APPROXIMATE can be a
 * whole city, either of which would place a property hundreds of metres or
 * more from the real address.
 */
const PROPERTY_LEVEL_PRECISION = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);

export interface GeocodeResult {
  lat: number;
  lon: number;
  /** Google's `location_type` for the top result. */
  precision: string;
  formattedAddress: string;
  /** True only for ROOFTOP / RANGE_INTERPOLATED — safe to show imagery for. */
  isPropertyLevel: boolean;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly apiKey: string;
  private readonly signingSecret: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is required');

    const signingSecret = this.config.get<string>('GOOGLE_MAPS_SIGNING_SECRET');
    if (!signingSecret)
      throw new Error('GOOGLE_MAPS_SIGNING_SECRET is required');

    this.apiKey = apiKey;
    this.signingSecret = signingSecret;
  }

  /**
   * Resolve a postal address to coordinates.
   *
   * Exists because the Analyzer's subject coordinates fall back to the centroid
   * of comparable sales when the property record carries none — which for comps
   * spread across two towns lands kilometres from the actual address. Geocoding
   * the address gives a building-level fix instead of an average of other
   * buildings.
   *
   * Never throws: callers treat a null as "no reliable position", which degrades
   * to hiding imagery rather than showing the wrong property.
   */
  async resolve(address: string): Promise<GeocodeResult | null> {
    try {
      // Deliberately UNSIGNED. URL signing applies to the Static APIs
      // (Street View Static, Maps Static); the Geocoding web service rejects a
      // signed request outright — "Unable to authenticate the request. The
      // 'signature' parameter is not required." Signing is unnecessary here in
      // any case: this call is server-side only, so the key never leaves us.
      const url = `${GEOCODE_ENDPOINT}?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

      const response = await fetch(url);
      const body = (await response.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          geometry?: {
            location?: { lat?: number; lng?: number };
            location_type?: string;
          };
        }>;
      };

      if (body.status !== 'OK' || !body.results?.length) {
        if (body.status && body.status !== 'ZERO_RESULTS') {
          this.logger.warn(
            `Geocoding returned ${body.status} for an address${
              body.error_message ? `: ${body.error_message}` : ''
            }`,
          );
        }
        return null;
      }

      const top = body.results[0];
      const lat = top.geometry?.location?.lat;
      const lon = top.geometry?.location?.lng;
      if (lat == null || lon == null) return null;

      const precision = top.geometry?.location_type ?? 'APPROXIMATE';

      return {
        lat,
        lon,
        precision,
        formattedAddress: top.formatted_address ?? address,
        isPropertyLevel: PROPERTY_LEVEL_PRECISION.has(precision),
      };
    } catch (error) {
      this.logger.warn(`Geocoding failed: ${(error as Error).message}`);
      return null;
    }
  }
}
