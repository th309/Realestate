import { Controller, Get, Param } from '@nestjs/common';
import { SocialProofService } from './social-proof.service';

@Controller('api/analytics/social-proof')
export class SocialProofController {
  constructor(private readonly socialProofService: SocialProofService) {}

  @Get(':geoLevel/:geoId')
  async getStats(
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
  ) {
    const stats = await this.socialProofService.getStats(geoLevel, geoId);
    return { success: true, data: stats };
  }
}
