import { Injectable, Logger } from '@nestjs/common';
import { ClaudeService } from '../reports/claude.service';
import { RedisService } from '../redis/redis.service';

interface MetricValue {
  value: number | null;
  formatted: string;
  change: number | null;
}

interface AnalysisRequest {
  geoType: string;
  geoId: string;
  geoName: string;
  metrics: Record<string, MetricValue>;
  scores: {
    homeready: { score: number; grade: string };
    investoredge: { score: number; grade: string };
    markethealth: { score: number; grade: string };
  };
  lastUpdated?: string;
}

export interface AnalysisSection {
  title: string;
  analysis: string;
}

export interface MarketAnalysisResult {
  homebuyer: AnalysisSection[];
  investor: AnalysisSection[];
  generatedAt: string;
  cached: boolean;
}

@Injectable()
export class MarketAnalysisService {
  private readonly logger = new Logger(MarketAnalysisService.name);

  constructor(
    private readonly claudeService: ClaudeService,
    private readonly redisService: RedisService,
  ) {}

  async generateAnalysis(
    request: AnalysisRequest,
  ): Promise<MarketAnalysisResult> {
    const cacheKey = `piq:market-analysis:v2:${request.geoType}:${request.geoId}`;

    // Check cache
    const cached = await this.redisService.get(cacheKey, {});
    if (cached) {
      this.logger.log(
        `[MarketAnalysis] Cache hit for ${request.geoName}`,
      );
      return { ...cached, cached: true };
    }

    // Generate with Claude or fallback
    let homebuyer: AnalysisSection[];
    let investor: AnalysisSection[];

    if (this.claudeService.isAvailable()) {
      const result = await this.generateWithClaude(request);
      homebuyer = result.homebuyer;
      investor = result.investor;
    } else {
      this.logger.warn(
        '[MarketAnalysis] Claude unavailable, using template fallback',
      );
      homebuyer = this.generateFallback(request, 'homebuyer');
      investor = this.generateFallback(request, 'investor');
    }

    const result: MarketAnalysisResult = {
      homebuyer,
      investor,
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    // Cache result
    await this.redisService.set(cacheKey, {}, result);

    return result;
  }

  private async generateWithClaude(
    request: AnalysisRequest,
  ): Promise<{ homebuyer: AnalysisSection[]; investor: AnalysisSection[] }> {
    const prompt = this.buildPrompt(request);

    try {
      const response = await this.claudeService.complete(prompt, 1400);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error(
        `[MarketAnalysis] Claude generation failed: ${error.message}`,
      );
      return {
        homebuyer: this.generateFallback(request, 'homebuyer'),
        investor: this.generateFallback(request, 'investor'),
      };
    }
  }

  private buildPrompt(request: AnalysisRequest): string {
    const { geoName, metrics, scores } = request;

    const metricsBlock = Object.entries(metrics)
      .filter(([, v]) => v.value != null)
      .map(([key, v]) => {
        const changePart =
          v.change != null ? ` (${v.change >= 0 ? '+' : ''}${v.change.toFixed(1)}% YoY)` : '';
        return `- ${key}: ${v.formatted}${changePart}`;
      })
      .join('\n');

    return `You are a sharp, experienced real estate market analyst. Analyze the data below for ${geoName} and write 6 short analytical paragraphs — 3 for a homebuyer audience and 3 for an investor audience.

Market Data for ${geoName}:
${metricsBlock}

Scores:
- HomeReady Score: ${scores.homeready.score}/100 (Grade: ${scores.homeready.grade})
- InvestorEdge Score: ${scores.investoredge.score}/100 (Grade: ${scores.investoredge.grade})
- Market Health Score: ${scores.markethealth.score}/100 (Grade: ${scores.markethealth.grade})

Write exactly 6 sections — 3 for homebuyers and 3 for investors. Use natural, informative titles.

HOMEBUYER SECTIONS:
1. AFFORDABILITY — Can a typical buyer afford this market? Reference income requirements, median prices, price per sqft, and how long it takes to save.
2. MARKET PACE — Is this market moving fast or slow? Reference days on market, inventory trends, pending ratios. Should a buyer be aggressive or patient?
3. PRICE TRAJECTORY — Where are prices headed? Reference YoY/MoM changes, 5-year trends, price cuts. Is now a good or bad time to buy?

INVESTOR SECTIONS:
4. CASH FLOW POTENTIAL — Will a rental property cash flow here? Reference cap rates, gross yield, rent levels, GRM. Cash-flow market or appreciation play?
5. VALUE GROWTH — Will property values appreciate? Reference YoY and 5-year growth, population/job growth, overvalued indicators.
6. LIQUIDITY & DEMAND — Can you rent it out easily? Can you sell when you want? Reference days on market, inventory, rental demand, absorption.

Rules:
- Reference specific numbers from the data (say "prices are up 4.2% year-over-year to $385K", not just "prices are rising")
- Be honest and balanced — if the data is mixed, say so
- Each paragraph should be 60-100 words, conversational but analytical
- If a metric is missing, work with what you have — don't mention missing data
- End each section with a practical takeaway

Respond in this exact JSON format:
{"homebuyer":[{"title":"...","analysis":"..."},{"title":"...","analysis":"..."},{"title":"...","analysis":"..."}],"investor":[{"title":"...","analysis":"..."},{"title":"...","analysis":"..."},{"title":"...","analysis":"..."}]}`;
  }

  private parseResponse(
    response: string,
  ): { homebuyer: AnalysisSection[]; investor: AnalysisSection[] } {
    const defaultHomebuyer = ['Affordability', 'Market Pace', 'Price Direction'];
    const defaultInvestor = ['Cash Flow Potential', 'Value Growth', 'Liquidity & Demand'];

    // Try JSON parse first
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          parsed.homebuyer && Array.isArray(parsed.homebuyer) &&
          parsed.investor && Array.isArray(parsed.investor)
        ) {
          return {
            homebuyer: parsed.homebuyer.slice(0, 3),
            investor: parsed.investor.slice(0, 3),
          };
        }
        // Maybe it's the old flat format — try to split
        if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length >= 6) {
          return {
            homebuyer: parsed.sections.slice(0, 3),
            investor: parsed.sections.slice(3, 6),
          };
        }
      }
    } catch {
      this.logger.warn(
        '[MarketAnalysis] JSON parse failed, attempting text extraction',
      );
    }

    // Fallback: split numbered sections
    const parts = response.split(/\d+\.\s+/);
    const homebuyer: AnalysisSection[] = [];
    const investor: AnalysisSection[] = [];

    for (let i = 0; i < 6; i++) {
      const text = parts[i + 1]?.trim();
      const titles = i < 3 ? defaultHomebuyer : defaultInvestor;
      const target = i < 3 ? homebuyer : investor;
      if (text) {
        target.push({ title: titles[i % 3], analysis: text });
      }
    }

    if (homebuyer.length === 3 && investor.length === 3) {
      return { homebuyer, investor };
    }

    // Last resort: return empty so fallback kicks in at caller
    return {
      homebuyer: defaultHomebuyer.map(t => ({ title: t, analysis: 'Analysis unavailable.' })),
      investor: defaultInvestor.map(t => ({ title: t, analysis: 'Analysis unavailable.' })),
    };
  }

  private generateFallback(
    request: AnalysisRequest,
    viewType: 'homebuyer' | 'investor',
  ): AnalysisSection[] {
    const { geoName, metrics, scores } = request;

    const val = (key: string) => metrics[key]?.value ?? null;
    const fmt = (key: string) => metrics[key]?.formatted ?? null;
    const chg = (key: string) => metrics[key]?.change ?? null;

    if (viewType === 'homebuyer') {
      const hs = scores.homeready;
      const scoreDesc = hs.score >= 70 ? 'favorable' : hs.score >= 50 ? 'moderate' : 'challenging';

      const affordParts = [`${geoName} shows ${scoreDesc} conditions for homebuyers (HomeReady score: ${hs.score}).`];
      if (fmt('listing_price')) affordParts.push(`The median listing price is ${fmt('listing_price')}.`);
      if (fmt('income_to_buy')) affordParts.push(`You'd need roughly ${fmt('income_to_buy')} in annual income to afford a home here.`);
      const yts = val('years_to_save');
      if (yts != null) affordParts.push(`At current savings rates, expect about ${yts.toFixed(1)} years to save for a down payment.`);

      const speedParts: string[] = [];
      const dom = val('days_on_market');
      if (dom != null) speedParts.push(`Homes in ${geoName} average ${Math.round(dom)} days on market.`);
      const invChg = chg('for_sale_inventory');
      if (invChg != null) speedParts.push(`Inventory is ${invChg > 0 ? 'up' : 'down'} ${Math.abs(invChg).toFixed(1)}% year-over-year.`);
      const pr = val('pending_ratio');
      if (pr != null) speedParts.push(`The pending ratio sits at ${(pr * 100).toFixed(0)}%, indicating ${pr > 0.4 ? 'strong' : 'moderate'} buyer activity.`);
      if (speedParts.length === 0) speedParts.push(`Market pace data for ${geoName} is currently limited.`);

      const priceParts: string[] = [];
      if (fmt('home_value')) priceParts.push(`Current median home value: ${fmt('home_value')}.`);
      const hvYoy = val('home_value_yoy');
      if (hvYoy != null) priceParts.push(`Values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`);
      const hv5yr = val('home_value_5yr');
      if (hv5yr != null) priceParts.push(`The 5-year annualized growth rate is ${hv5yr.toFixed(1)}%.`);
      const pcPct = val('price_cut_pct');
      if (pcPct != null) priceParts.push(`${pcPct.toFixed(0)}% of listings have price reductions.`);
      if (priceParts.length === 0) priceParts.push(`Price trend data for ${geoName} is currently limited.`);

      return [
        { title: 'Affordability', analysis: affordParts.join(' ') },
        { title: 'Market Speed', analysis: speedParts.join(' ') },
        { title: 'Price Trajectory', analysis: priceParts.join(' ') },
      ];
    }

    // Investor fallback
    const is = scores.investoredge;
    const scoreDesc = is.score >= 70 ? 'strong' : is.score >= 50 ? 'moderate' : 'limited';

    const cfParts = [`${geoName} shows ${scoreDesc} investment potential (InvestorEdge score: ${is.score}).`];
    const cr = val('cap_rate');
    if (cr != null) cfParts.push(`Cap rates are around ${cr.toFixed(1)}%, indicating ${cr >= 6 ? 'solid cash flow' : cr >= 4 ? 'moderate returns' : 'appreciation-focused'} potential.`);
    if (fmt('rent_index')) cfParts.push(`Median rents at ${fmt('rent_index')}/month.`);
    const gy = val('gross_yield');
    if (gy != null) cfParts.push(`Gross yield: ${gy.toFixed(1)}%.`);

    const growParts: string[] = [];
    const hvYoy = val('home_value_yoy');
    if (hvYoy != null) growParts.push(`Property values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`);
    const hv5yr = val('home_value_5yr');
    if (hv5yr != null) growParts.push(`5-year annualized growth: ${hv5yr.toFixed(1)}%.`);
    const popG = val('population_growth');
    if (popG != null) growParts.push(`Population growth of ${popG.toFixed(1)}% supports demand.`);
    const jobG = val('job_growth');
    if (jobG != null) growParts.push(`Job growth: ${jobG.toFixed(1)}%.`);
    if (growParts.length === 0) growParts.push(`Growth data for ${geoName} is currently limited.`);

    const liqParts: string[] = [];
    const dom = val('days_on_market');
    if (dom != null) liqParts.push(`Homes sell in an average of ${Math.round(dom)} days.`);
    const invChg = chg('for_sale_inventory');
    if (invChg != null) liqParts.push(`Inventory ${invChg > 0 ? 'rising' : 'falling'} at ${Math.abs(invChg).toFixed(1)}% YoY.`);
    const pr = val('pending_ratio');
    if (pr != null) liqParts.push(`Pending ratio of ${(pr * 100).toFixed(0)}% suggests ${pr > 0.4 ? 'healthy' : 'softer'} demand.`);
    liqParts.push(`Market Health score: ${scores.markethealth.score}/100.`);

    return [
      { title: 'Cash Flow Potential', analysis: cfParts.join(' ') },
      { title: 'Value Growth', analysis: growParts.join(' ') },
      { title: 'Liquidity & Demand', analysis: liqParts.join(' ') },
    ];
  }
}
