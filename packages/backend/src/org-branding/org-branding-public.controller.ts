/**
 * Organization Branding Public Controller
 *
 * Unauthenticated endpoint for shared reports and embeds
 * to fetch organization branding (logo, accent color, name).
 *
 * Routes:
 *   GET /api/org-branding/:orgId — Get public branding by org UUID
 */

import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { OrgBrandingService } from './org-branding.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/org-branding')
export class OrgBrandingPublicController {
  constructor(private readonly brandingService: OrgBrandingService) {}

  @Get(':orgId')
  async getBrandingPublic(@Param('orgId') orgId: string) {
    if (!UUID_REGEX.test(orgId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    return this.brandingService.getBrandingPublic(orgId);
  }
}
