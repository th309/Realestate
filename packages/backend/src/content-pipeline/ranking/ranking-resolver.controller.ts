import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { RankingResolverService } from './ranking-resolver.service';
import { ResolveRankingDto } from './dto/resolve-ranking.dto';

@Controller('api/admin/content-pipeline/ranking')
@UseGuards(AdminGuard)
export class RankingResolverController {
  constructor(private readonly resolver: RankingResolverService) {}

  @Post('resolve')
  resolve(@Body() dto: ResolveRankingDto) {
    return this.resolver.resolve(dto);
  }
}
