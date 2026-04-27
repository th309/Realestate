import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { RankingResolverService } from './ranking-resolver.service';
import { ResolveRankingDto } from './dto/resolve-ranking.dto';

@Controller('api/admin/content-pipeline/ranking')
@UseGuards(AdminGuard)
export class RankingResolverController {
  constructor(private readonly resolver: RankingResolverService) {}

  @Post('resolve')
  async resolve(@Body() dto: ResolveRankingDto) {
    const result = await this.resolver.resolve(dto);
    // Match the content-pipeline package convention: every controller wraps
    // responses as { success, data } (see content-pipeline.controller.ts).
    // The admin frontend's resolveRanking() unwraps json.data.
    return { success: true, data: result };
  }
}
