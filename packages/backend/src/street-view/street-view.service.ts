import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signGoogleMapsUrl } from './google-url-signer';
import { bearingBetween } from './geo-bearing';

const METADATA_ENDPOINT =
  'https://maps.googleapis.com/maps/api/streetview/metadata';
const IMAGE_ENDPOINT = 'https://maps.googleapis.com/maps/api/streetview';

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

interface Panorama {
  panoId: string;
  capturedAt: string | null;
  lat: number | null;
  lon: number | null;
}

@Injectable()
export class StreetViewService {
  private readonly logger = new Logger(StreetViewService.name);
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
   * Resolve a signed Street View image URL showing a property's front.
   *
   * Panorama selection is by ADDRESS first, coordinates only as a fallback.
   * That difference decides which street the camera stands on: asking by
   * coordinate returns the physically nearest panorama, which on a corner lot
   * is routinely the cross street — yielding a photo of the property's side
   * wall. Asking by address makes Google pick a panorama with a view of that
   * address, i.e. one on the street the property is addressed on.
   *
   * Observed on 200 Orlando Ave: by coordinate Google returned a camera 24.0m
   * away on Liberty Rd (side elevation); by address, one 24.6m away on Orlando
   * Ave (front elevation). A 0.6m difference in distance, entirely different
   * photograph.
   *
   * The camera is then aimed from the panorama's own position at the property,
   * because a panorama's default heading follows the road rather than facing
   * any particular building.
   *
   * Never throws — every failure degrades to "unavailable", which callers
   * render as no photo rather than the wrong property.
   */
  async resolve(
    lat: number,
    lon: number,
    address?: string,
  ): Promise<StreetViewResolution> {
    try {
      const pano =
        (address ? await this.findPanorama(address) : null) ??
        (await this.findPanorama(`${lat},${lon}`));

      if (!pano) return UNAVAILABLE;

      const heading =
        pano.lat != null && pano.lon != null
          ? bearingBetween(pano.lat, pano.lon, lat, lon)
          : null;

      // return_error_code=true makes a missing panorama a 404 instead of the
      // grey "Sorry, we have no imagery here" placeholder Google otherwise
      // serves with HTTP 200 — which is indistinguishable from success.
      const imageUrl = signGoogleMapsUrl(
        `${IMAGE_ENDPOINT}?size=640x400&scale=2&fov=75&pitch=0` +
          `&source=outdoor&return_error_code=true` +
          (heading != null ? `&heading=${heading.toFixed(2)}` : '') +
          `&pano=${encodeURIComponent(pano.panoId)}&key=${this.apiKey}`,
        this.signingSecret,
      );

      return {
        available: true,
        url: imageUrl,
        panoId: pano.panoId,
        capturedAt: pano.capturedAt,
      };
    } catch (error) {
      this.logger.warn(
        `Street View resolve failed for ${lat},${lon}: ${(error as Error).message}`,
      );
      return UNAVAILABLE;
    }
  }

  /**
   * Look up the panorama Google considers best for a location, which may be an
   * address string or a "lat,lon" pair. Metadata requests are free and consume
   * no quota, so availability is always established before a billable image
   * URL is minted.
   */
  private async findPanorama(location: string): Promise<Panorama | null> {
    const url = signGoogleMapsUrl(
      `${METADATA_ENDPOINT}?location=${encodeURIComponent(location)}` +
        `&source=outdoor&key=${this.apiKey}`,
      this.signingSecret,
    );

    const response = await fetch(url);
    const body = (await response.json()) as {
      status?: string;
      pano_id?: string;
      date?: string;
      location?: { lat?: number; lng?: number };
    };

    if (body.status !== 'OK' || !body.pano_id) {
      if (body.status && body.status !== 'ZERO_RESULTS') {
        this.logger.warn(`Street View metadata returned ${body.status}`);
      }
      return null;
    }

    return {
      panoId: body.pano_id,
      capturedAt: body.date ?? null,
      lat: body.location?.lat ?? null,
      lon: body.location?.lng ?? null,
    };
  }
}
