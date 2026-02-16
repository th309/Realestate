import { Controller, Post, Param, Body, Logger } from '@nestjs/common';
import {
  MarketAnalysisService,
  MarketAnalysisResult,
} from './market-analysis.service';

interface MarketAnalysisBody {
  geoName: string;
  metrics: Record<
    string,
    { value: number | null; formatted: string; change: number | null }
  >;
  scores: {
    homeready: { score: number; grade: string };
    investoredge: { score: number; grade: string };
    markethealth: { score: number; grade: string };
  };
  lastUpdated?: string;
}

@Controller('api/markets')
export class MarketAnalysisController {
  private readonly logger = new Logger(MarketAnalysisController.name);

  constructor(
    private readonly marketAnalysisService: MarketAnalysisService,
  ) {}

  @Post(':geoType/:geoId/ai-analysis')
  async getAnalysis(
    @Param('geoType') geoType: string,
    @Param('geoId') geoId: string,
    @Body() body: MarketAnalysisBody,
  ): Promise<{ success: boolean; analysis: MarketAnalysisResult }> {
    this.logger.log(
      `[AI Analysis] ${body.geoName} (${geoType}/${geoId})`,
    );

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
