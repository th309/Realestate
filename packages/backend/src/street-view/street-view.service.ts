import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signGoogleMapsUrl } from './google-url-signer';

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

      if (body.status !== 'OK' || !body.pano_id) {
        if (body.status && body.status !== 'ZERO_RESULTS') {
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
