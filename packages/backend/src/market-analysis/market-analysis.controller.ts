import {
  Controller,
  Post,
  Param,
  Body,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  MarketAnalysisService,
  MarketAnalysisResult,
} from './market-analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface MarketAnalysisBody {
  geoName: string;
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: {
    propertyiq: { score: number; grade: string };
  };
  lastUpdated?: string;
}

@Controller('api/markets')
export class MarketAnalysisController {
  private readonly logger = new Logger(MarketAnalysisController.name);

  constructor(private readonly marketAnalysisService: MarketAnalysisService) {}

  @Post(':geoType/:geoId/ai-analysis')
  @UseGuards(JwtAuthGuard)
  async getAnalysis(
    @Param('geoType') geoType: string,
    @Param('geoId') geoId: string,
    @Body() body: MarketAnalysisBody,
  ): Promise<{ success: boolean; analysis: MarketAnalysisResult }> {
    this.logger.log(`[AI Analysis] ${body.geoName} (${geoType}/${geoId})`);

    const analysis = await this.marketAnalysisService.generateAnalysis({
      geoType,
      geoId,
      geoName: body.geoName,
      metrics: body.metrics,
      scores: body.scores,
      lastUpdated: body.lastUpdated,
    });

    return { success: true, analysis };
  }
}
